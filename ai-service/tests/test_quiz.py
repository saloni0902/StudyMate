import json

import pytest
from fastapi.testclient import TestClient

from app import config, embeddings, llm, quiz, vector_store
from app.main import app

client = TestClient(app, headers={"X-Service-Key": config.AI_SERVICE_KEY})

SUBJECT = "a" * 24
DOC = "b" * 24
CHUNKS = [
    {"page": 2, "text": "Round Robin scheduling gives each process a fixed time quantum before pre-emption."},
    {"page": 3, "text": "A deadlock needs mutual exclusion, hold and wait, no pre-emption and circular wait."},
    {"page": 4, "text": "Paging divides memory into fixed-size frames and logical memory into pages."},
]


def add_notes():
    vector_store.add_document(SUBJECT, DOC, "os.pdf", CHUNKS, embeddings.embed([c["text"] for c in CHUNKS]))


def question(text, answer=0, source=1, options=None, topic="CPU scheduling"):
    return {
        "question": text,
        "options": options or ["Correct", "Wrong one", "Wrong two", "Wrong three"],
        "answer": answer,
        "topic": topic,
        "explanation": "Because the notes say so.",
        "source": source,
    }


@pytest.fixture
def fake_gemini(monkeypatch):
    """Replaces Gemini's JSON reply; records the prompts it was given."""

    class Calls(list):
        reply = {}

    calls = Calls()

    def generate(prompt, system, temperature=0.2, json_schema=None):
        calls.append({"prompt": prompt, "schema": json_schema})
        return json.dumps(calls.reply)

    monkeypatch.setattr(llm, "generate", generate)
    return calls


def make_quiz(**body):
    return client.post("/quiz", json={"subjectId": SUBJECT, **body})


def test_quiz_questions_are_checked_shuffled_and_sourced(fake_gemini):
    add_notes()
    fake_gemini.reply = {"questions": [question(f"Question {i}?", source=1 + i % 3) for i in range(5)]}

    res = make_quiz(count=5, difficulty="easy", knownTopics=["CPU scheduling", "Deadlock"])
    assert res.status_code == 200
    questions = res.json()["questions"]
    assert len(questions) == 5
    for q in questions:
        # The correct option is tracked through the shuffle.
        assert q["options"][q["answerIndex"]] == "Correct"
        assert q["source"]["fileName"] == "os.pdf"
    assert {q["source"]["page"] for q in questions} == {2, 3, 4}
    # Gemini was asked for JSON, given the difficulty and the subject's topic names.
    assert fake_gemini[0]["schema"]["title"] == "DraftQuiz"
    assert "Easy:" in fake_gemini[0]["prompt"]
    assert "CPU scheduling, Deadlock" in fake_gemini[0]["prompt"]


def test_bad_questions_are_dropped(fake_gemini):
    add_notes()
    fake_gemini.reply = {
        "questions": [
            question("Good one?"),
            question("Good two?", answer=2),
            question("Good three?", answer=3),
            question("Good one?"),  # duplicate
            question("Three options?", options=["A", "B", "C"]),
            question("Same options?", options=["A", "A", "B", "C"]),
            question("Answer out of range?", answer=4),
            question("Unknown source?", source=9),
        ]
    }
    questions = make_quiz(count=4).json()["questions"]
    assert [q["question"] for q in questions] == ["Good one?", "Good two?", "Good three?"]


def test_too_few_good_questions_is_an_error(fake_gemini):
    add_notes()
    fake_gemini.reply = {"questions": [question("Only one?")]}
    res = make_quiz(count=10)
    assert res.status_code == 502
    assert "enough good questions" in res.json()["error"]["message"]


def test_topic_not_in_notes(fake_gemini):
    add_notes()
    res = make_quiz(topic="French revolution")
    assert res.status_code == 422
    assert "couldn't find French revolution" in res.json()["error"]["message"]
    assert fake_gemini == []


def test_whole_subject_spreads_across_the_notes():
    chunks = [{"page": i, "text": f"chunk {i}"} for i in range(1, 41)]
    picked = quiz._spread(chunks, 4)
    assert [c["page"] for c in picked] == [1, 11, 21, 31]


def test_empty_subject(fake_gemini):
    assert make_quiz().status_code == 422


@pytest.mark.parametrize("body", [{"count": 2}, {"count": 20}, {"difficulty": "extreme"}, {"topic": "x"}])
def test_bad_requests(body):
    assert make_quiz(**body).status_code == 422


def test_topic_extraction_cleans_names(monkeypatch):
    def generate(prompt, system, temperature=0.2, json_schema=None):
        return json.dumps({"topics": ["cpu scheduling", " Deadlock. ", "CPU Scheduling", "", "x" * 80]})

    monkeypatch.setattr(llm, "generate", generate)
    pages = [{"page": 1, "text": "Some notes about scheduling and deadlock."}]
    assert quiz.extract_topics("os.pdf", pages) == ["Cpu scheduling", "Deadlock"]


def test_topic_extraction_never_fails_ingest():
    # No API key in tests, so Gemini is unavailable: topics are simply empty.
    pages = [{"page": 1, "text": "Some notes about scheduling and deadlock."}]
    assert quiz.extract_topics("os.pdf", pages) == []


def test_wrong_json_is_retried_once(monkeypatch):
    replies = ["not json", json.dumps({"topics": ["Paging"]})]
    monkeypatch.setattr(llm, "generate", lambda *a, **k: replies.pop(0))
    pages = [{"page": 1, "text": "Paging splits memory into frames."}]
    assert quiz.extract_topics("os.pdf", pages) == ["Paging"]
