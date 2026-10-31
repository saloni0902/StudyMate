import pytest
from fastapi.testclient import TestClient

from app import config, embeddings, llm, prompts, vector_store
from app.main import app

client = TestClient(app, headers={"X-Service-Key": config.AI_SERVICE_KEY})

SUBJECT = "a" * 24
DOC_OS = "b" * 24
DOC_DB = "c" * 24

OS_CHUNKS = [
    {"page": 3, "text": "Round Robin scheduling gives each process a fixed time quantum before it is pre-empted."},
    {"page": 7, "text": "A deadlock needs mutual exclusion, hold and wait, no pre-emption and circular wait."},
]
DB_CHUNKS = [{"page": 1, "text": "Normalisation removes redundancy from relational database tables."}]


def add(doc_id, file_name, chunks):
    vectors = embeddings.embed([c["text"] for c in chunks])
    vector_store.add_document(SUBJECT, doc_id, file_name, chunks, vectors)


@pytest.fixture
def fake_llm(monkeypatch):
    """Replaces Gemini; records prompts and returns a canned answer."""
    class Calls(list):
        reply = ""

    calls = Calls()

    def generate(prompt, system, temperature=0.2):
        calls.append(prompt)
        return calls.reply

    calls.reply = "Round Robin gives each process a **time quantum** [1]."
    monkeypatch.setattr(llm, "generate", generate)
    return calls


def ask(question, history=None):
    return client.post("/ask", json={"subjectId": SUBJECT, "question": question, "history": history or []})


def test_answer_cites_file_and_page(fake_llm):
    add(DOC_OS, "os.pdf", OS_CHUNKS)
    res = ask("How does round robin scheduling work?")
    assert res.status_code == 200
    body = res.json()
    assert body["grounded"] is True
    assert body["citations"] == [
        {"n": 1, "documentId": DOC_OS, "fileName": "os.pdf", "page": 3, "snippet": OS_CHUNKS[0]["text"]}
    ]
    # The prompt numbers the sources with file and page.
    assert "[1] (os.pdf, page 3)" in fake_llm[0]


def test_unrelated_question_skips_the_llm(fake_llm):
    add(DOC_OS, "os.pdf", OS_CHUNKS)
    body = ask("Who won the football world cup?").json()
    assert body["grounded"] is False
    assert body["answer"] == prompts.NOT_FOUND_ANSWER
    assert fake_llm == []


def test_llm_saying_not_found_is_respected(fake_llm):
    add(DOC_OS, "os.pdf", OS_CHUNKS)
    fake_llm.reply = prompts.NOT_FOUND_MARKER
    body = ask("What is the round robin quantum in Linux?").json()
    assert body["grounded"] is False
    assert body["citations"] == []


def test_citation_numbers_outside_the_sources_are_ignored(fake_llm):
    add(DOC_OS, "os.pdf", OS_CHUNKS)
    fake_llm.reply = "Round robin uses a quantum [1][9]."
    body = ask("round robin quantum").json()
    assert [c["n"] for c in body["citations"]] == [1]


def test_follow_up_uses_previous_question(fake_llm):
    add(DOC_OS, "os.pdf", OS_CHUNKS)
    history = [
        {"role": "user", "content": "Explain round robin scheduling"},
        {"role": "assistant", "content": "Each process gets a time quantum [1]."},
    ]
    body = ask("give me an example", history).json()
    assert body["grounded"] is True
    assert "Conversation so far" in fake_llm[0]


def test_empty_subject_is_not_found(fake_llm):
    assert ask("What is a process?").json()["grounded"] is False


def test_deleting_a_document_removes_its_chunks(fake_llm):
    add(DOC_OS, "os.pdf", OS_CHUNKS)
    add(DOC_DB, "dbms.pdf", DB_CHUNKS)
    assert vector_store.chunk_count(SUBJECT) == 3

    client.delete(f"/documents/{SUBJECT}/{DOC_OS}")
    assert vector_store.chunk_count(SUBJECT) == 1
    assert ask("round robin time quantum").json()["grounded"] is False

    # The index on disk matches after a reload.
    vector_store._cache.clear()
    assert vector_store.chunk_count(SUBJECT) == 1


def test_reingesting_replaces_old_chunks():
    add(DOC_OS, "os.pdf", OS_CHUNKS)
    add(DOC_OS, "os.pdf", OS_CHUNKS[:1])
    assert vector_store.chunk_count(SUBJECT) == 1


def test_llm_errors_become_clean_responses(monkeypatch):
    add(DOC_OS, "os.pdf", OS_CHUNKS)

    def rate_limited(*args, **kwargs):
        raise llm.LLMError("The Gemini free-tier limit was reached.", status=429)

    monkeypatch.setattr(llm, "generate", rate_limited)
    res = ask("round robin quantum")
    assert res.status_code == 429
    assert "free-tier" in res.json()["error"]["message"]


def test_missing_api_key_is_explained(monkeypatch):
    add(DOC_OS, "os.pdf", OS_CHUNKS)
    monkeypatch.setattr(config, "GEMINI_API_KEY", "")
    res = ask("round robin quantum")
    assert res.status_code == 503
    assert "GEMINI_API_KEY" in res.json()["error"]["message"]


@pytest.mark.real_model
def test_real_model_finds_the_right_chunk():
    """With real MiniLM embeddings, a paraphrased question finds the right page."""
    add(DOC_OS, "os.pdf", OS_CHUNKS)
    add(DOC_DB, "dbms.pdf", DB_CHUNKS)
    [vector] = embeddings.embed(["What are the conditions for a deadlock?"])
    hits = vector_store.search(SUBJECT, vector, 3)
    assert hits[0]["page"] == 7
    assert hits[0]["score"] >= config.MIN_SCORE

    [vector] = embeddings.embed(["Who won the football world cup in 2022?"])
    assert vector_store.search(SUBJECT, vector, 1)[0]["score"] < config.MIN_SCORE
