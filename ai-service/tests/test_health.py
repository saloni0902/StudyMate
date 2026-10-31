from fastapi.testclient import TestClient

from app import config
from app.main import app

client = TestClient(app)


def test_health_is_public():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_service_key_required():
    res = client.get("/whoami")
    assert res.status_code == 401
    assert res.json()["error"]["message"] == "Invalid service key"


def test_service_key_accepted():
    res = client.get("/whoami", headers={"X-Service-Key": config.AI_SERVICE_KEY})
    assert res.status_code == 200


def test_unexpected_errors_return_clean_json(monkeypatch):
    from app import rag

    def broken(*args, **kwargs):
        raise RuntimeError("internal detail that must not leak")

    monkeypatch.setattr(rag, "ask", broken)
    quiet_client = TestClient(app, raise_server_exceptions=False)
    res = quiet_client.post(
        "/ask",
        json={"subjectId": "a" * 24, "question": "What is a process?"},
        headers={"X-Service-Key": config.AI_SERVICE_KEY},
    )
    assert res.status_code == 500
    assert res.json()["error"]["message"] == "The AI service hit an unexpected error. Please try again."
    assert "internal detail" not in res.text
