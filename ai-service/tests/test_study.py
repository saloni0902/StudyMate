import json

import pytest
from fastapi.testclient import TestClient

from app import config, embeddings, llm, vector_store
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


@pytest.fixture
def fake_gemini(monkeypatch):
    class Calls(list):
        reply = {}

    calls = Calls()

    def generate(prompt, system, temperature=0.2, json_schema=None):
        calls.append({"prompt": prompt, "schema": json_schema})
        return json.dumps(calls.reply)

    monkeypatch.setattr(llm, "generate", generate)
    return calls


def card(front, source=1, back="An answer from the notes.", topic="round robin"):
    return {"front": front, "back": back, "topic": topic, "source": source}


# --- Flashcards --------------------------------------------------------------


def test_flashcards_are_checked_and_sourced(fake_gemini):
    add_notes()
    fake_gemini.reply = {
        "cards": [
            card("What is a time quantum?"),
            card("What are the deadlock conditions?", source=2),
            card("What is paging?", source=3),
            card("What is a time quantum?"),  # duplicate
            card("Empty back?", back="  "),
            card("Bad source?", source=7),
        ]
    }
    res = client.post("/flashcards", json={"subjectId": SUBJECT, "count": 5, "knownTopics": ["Round Robin"]})
    assert res.status_code == 200
    cards = res.json()["cards"]
    assert [c["front"] for c in cards] == ["What is a time quantum?", "What are the deadlock conditions?", "What is paging?"]
    assert cards[1]["source"] == {"documentId": DOC, "fileName": "os.pdf", "page": 3}
    assert cards[0]["topic"] == "Round robin"
    assert fake_gemini[0]["schema"]["title"] == "DraftDeck"
    assert "Suggested topic names: Round Robin" in fake_gemini[0]["prompt"]


def test_flashcards_topic_not_in_notes(fake_gemini):
    add_notes()
    res = client.post("/flashcards", json={"subjectId": SUBJECT, "topic": "French revolution"})
    assert res.status_code == 422
    assert fake_gemini == []


def test_too_few_flashcards_is_an_error(fake_gemini):
    add_notes()
    fake_gemini.reply = {"cards": [card("Only one?")]}
    assert client.post("/flashcards", json={"subjectId": SUBJECT, "count": 10}).status_code == 502


# --- Study plan ----------------------------------------------------------------


def day(n, focus, sources=(1,), tasks=("Re-read the notes", "Take a short quiz")):
    return {"day": n, "focus": focus, "tasks": list(tasks), "sources": list(sources)}


def plan_request(**overrides):
    body = {"subjectId": SUBJECT, "weakTopics": [{"topic": "Round Robin", "percent": 0}, {"topic": "Deadlock", "percent": 50}], "days": 3}
    return client.post("/study-plan", json={**body, **overrides})


def test_study_plan_uses_weak_topics_and_cites_pages(fake_gemini):
    add_notes()
    fake_gemini.reply = {
        "days": [
            day(1, "Round Robin", sources=[1, 1, 9]),
            day(2, "Deadlock", sources=[2]),
            day(3, "Mixed review", sources=[1, 2]),
            day(4, "Extra day the student didn't ask for"),
        ]
    }
    res = plan_request()
    assert res.status_code == 200
    days = res.json()["days"]
    assert [d["focus"] for d in days] == ["Round Robin", "Deadlock", "Mixed review"]
    # Repeated and unknown source numbers are dropped.
    assert days[0]["sources"] == [{"documentId": DOC, "fileName": "os.pdf", "page": 2}]
    prompt = fake_gemini[0]["prompt"]
    assert "- Round Robin: 0% correct" in prompt
    assert "3-day study plan" in prompt


def test_source_numbers_in_tasks_become_pages_and_chips_are_per_page(fake_gemini):
    vector_store.add_document(
        SUBJECT,
        DOC,
        "os.pdf",
        CHUNKS + [{"page": 2, "text": "Round Robin with a very large time quantum behaves like first-come first-served."}],
        embeddings.embed([c["text"] for c in CHUNKS] + ["Round Robin large quantum behaves like FCFS"]),
    )
    fake_gemini.reply = {
        "days": [
            day(1, "Round Robin", sources=[1, 2], tasks=["Re-read source 1 on time quanta.", "Compare deadlock conditions using sources 2 and 3"]),
            day(2, "Deadlock"),
        ]
    }
    days = plan_request(weakTopics=[{"topic": "Round Robin", "percent": 0}]).json()["days"]
    tasks = days[0]["tasks"]
    assert "source" not in " ".join(tasks).lower()
    assert tasks[0] == "Re-read (p. 2) on time quanta."
    # Two passages from page 2 give one chip.
    assert [s["page"] for s in days[0]["sources"]] == [2]


def test_empty_days_are_skipped_and_renumbered(fake_gemini):
    add_notes()
    fake_gemini.reply = {"days": [day(1, "Round Robin"), day(2, "", tasks=()), day(3, "Deadlock")]}
    days = plan_request().json()["days"]
    assert [(d["day"], d["focus"]) for d in days] == [(1, "Round Robin"), (2, "Deadlock")]


def test_study_plan_needs_notes(fake_gemini):
    assert plan_request().status_code == 422


@pytest.mark.parametrize(
    "overrides", [{"weakTopics": []}, {"days": 2}, {"days": 10}, {"weakTopics": [{"topic": "X", "percent": 150}]}]
)
def test_study_plan_bad_requests(overrides):
    assert plan_request(**overrides).status_code == 422
