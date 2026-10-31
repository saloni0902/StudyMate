import pytest
from fastapi.testclient import TestClient

from app import config, document_store, embeddings, llm, prompts, rag, vector_store
from app.main import app

client = TestClient(app, headers={"X-Service-Key": config.AI_SERVICE_KEY})

SUBJECT = "a" * 24
DOC = "b" * 24
PAGES = [
    {"page": 1, "text": "A process is a program in execution with a program counter and stack."},
    {"page": 2, "text": ""},
    {"page": 3, "text": "Round Robin scheduling gives each process a fixed time quantum."},
]


@pytest.fixture
def fake_llm(monkeypatch):
    class Calls(list):
        reply = "Your notes cover processes [1] and scheduling [3].\n\n## Key points\n- **Round Robin** [3]"

    calls = Calls()

    def generate(prompt, system, temperature=0.2):
        calls.append(prompt)
        return calls.reply

    monkeypatch.setattr(llm, "generate", generate)
    return calls


def summarize(**body):
    return client.post("/summarize", json={"subjectId": SUBJECT, **body})


def test_document_summary_cites_page_numbers(fake_llm):
    document_store.save_pages(SUBJECT, DOC, "os.pdf", PAGES)
    res = summarize(documentId=DOC, length="detailed")
    assert res.status_code == 200
    body = res.json()
    assert body["grounded"] is True
    assert [(c["n"], c["page"]) for c in body["citations"]] == [(1, 1), (3, 3)]
    # Pages are numbered by page number, empty pages are left out, length is passed on.
    assert "[3] (page 3)" in fake_llm[0]
    assert "[2] (page 2)" not in fake_llm[0]
    assert "400-600 words" in fake_llm[0]


def test_long_documents_are_cut_and_flagged(fake_llm, monkeypatch):
    monkeypatch.setattr(rag, "MAX_DOCUMENT_CHARS", 80)
    document_store.save_pages(SUBJECT, DOC, "os.pdf", PAGES)
    body = summarize(documentId=DOC).json()
    assert body["truncated"] is True
    assert "Round Robin" not in fake_llm[0]


def test_missing_document_is_404(fake_llm):
    assert summarize(documentId=DOC).status_code == 404


def test_topic_summary_uses_matching_chunks(fake_llm):
    chunks = [{"page": 3, "text": PAGES[2]["text"]}, {"page": 1, "text": PAGES[0]["text"]}]
    vector_store.add_document(SUBJECT, DOC, "os.pdf", chunks, embeddings.embed([c["text"] for c in chunks]))
    fake_llm.reply = "Round Robin uses a **time quantum** [1]."

    body = summarize(topic="Round Robin scheduling").json()
    assert body["grounded"] is True
    assert body["citations"][0]["page"] == 3
    assert "Round Robin scheduling" in fake_llm[0]


def test_unknown_topic_skips_the_llm(fake_llm):
    chunks = [{"page": 1, "text": PAGES[0]["text"]}]
    vector_store.add_document(SUBJECT, DOC, "os.pdf", chunks, embeddings.embed([c["text"] for c in chunks]))
    body = summarize(topic="French revolution").json()
    assert body["grounded"] is False
    assert fake_llm == []


def test_llm_not_found_marker(fake_llm):
    document_store.save_pages(SUBJECT, DOC, "os.pdf", PAGES)
    fake_llm.reply = prompts.NOT_FOUND_MARKER
    assert summarize(documentId=DOC).json()["grounded"] is False


@pytest.mark.parametrize(
    "body",
    [{}, {"documentId": DOC, "topic": "processes"}, {"topic": "x"}, {"documentId": DOC, "length": "huge"}],
)
def test_bad_requests(fake_llm, body):
    assert summarize(**body).status_code == 422
