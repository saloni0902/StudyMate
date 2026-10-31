import pymupdf
import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app

client = TestClient(app, headers={"X-Service-Key": config.AI_SERVICE_KEY})

SUBJECT = "a" * 24
DOC = "b" * 24


@pytest.fixture(autouse=True)
def temp_dirs(tmp_path, monkeypatch):
    """Point uploads and extracted text at a temp folder for each test."""
    uploads = tmp_path / "uploads"
    uploads.mkdir()
    monkeypatch.setattr(config, "UPLOAD_DIR", uploads.resolve())
    monkeypatch.setattr(config, "DOCS_DIR", (tmp_path / "documents").resolve())
    return uploads


def make_pdf(path, page_texts):
    doc = pymupdf.open()
    for text in page_texts:
        page = doc.new_page()
        if text:
            page.insert_textbox(pymupdf.Rect(72, 72, 520, 770), text)
    doc.save(path)


def ingest(path, file_name="os.pdf"):
    return client.post(
        "/ingest",
        json={"subjectId": SUBJECT, "documentId": DOC, "filePath": str(path), "fileName": file_name},
    )


def test_ingest_keeps_page_numbers(temp_dirs):
    pdf = temp_dirs / "os.pdf"
    make_pdf(pdf, ["A process is a program in execution.", "", "Round Robin gives each process a time quantum."])

    res = ingest(pdf)
    assert res.status_code == 200
    body = res.json()
    assert body["pages"] == 3
    assert body["emptyPages"] == [2]

    pages = client.get(f"/documents/{SUBJECT}/{DOC}/pages").json()["pages"]
    assert pages[0] == {"page": 1, "text": "A process is a program in execution."}
    assert "Round Robin" in pages[2]["text"]


def test_rejects_pdf_without_text(temp_dirs):
    pdf = temp_dirs / "scan.pdf"
    make_pdf(pdf, ["", ""])
    res = ingest(pdf)
    assert res.status_code == 422
    assert "scanned" in res.json()["error"]["message"]


def test_rejects_non_pdf(temp_dirs):
    fake = temp_dirs / "notes.pdf"
    fake.write_text("just text, not a pdf")
    res = ingest(fake)
    assert res.status_code == 422


def test_only_reads_from_upload_folder(tmp_path):
    outside = tmp_path / "secret.pdf"
    make_pdf(outside, ["Some private text that should not be read."])
    res = ingest(outside)
    assert res.status_code == 400

    res = ingest(tmp_path / "uploads" / ".." / "secret.pdf")
    assert res.status_code == 400


def test_rejects_bad_ids(temp_dirs):
    res = client.post(
        "/ingest",
        json={"subjectId": "../../etc", "documentId": DOC, "filePath": "x", "fileName": "x"},
    )
    assert res.status_code == 422
    assert client.get(f"/documents/{SUBJECT}/not-an-id/pages").status_code == 400


def test_delete_document_and_subject(temp_dirs):
    pdf = temp_dirs / "os.pdf"
    make_pdf(pdf, ["A process is a program in execution."])
    ingest(pdf)

    assert client.delete(f"/documents/{SUBJECT}/{DOC}").status_code == 200
    assert client.get(f"/documents/{SUBJECT}/{DOC}/pages").status_code == 404

    ingest(pdf)
    assert client.delete(f"/subjects/{SUBJECT}").status_code == 200
    assert client.get(f"/documents/{SUBJECT}/{DOC}/pages").status_code == 404
