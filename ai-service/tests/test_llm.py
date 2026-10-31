import pytest
from google.genai import errors

from app import config, llm


def api_error(code, message="This model is currently experiencing high demand."):
    return errors.APIError(code, {"error": {"code": code, "message": message, "status": "X"}})


@pytest.fixture
def fake_gemini(monkeypatch):
    """Scripted replies: each item is a text to return or an error to raise."""
    calls = []
    script = []

    def call(model, prompt, system, temperature, json_schema=None):
        calls.append(model)
        outcome = script.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    monkeypatch.setattr(config, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(config, "GEMINI_MODEL", "main-model")
    monkeypatch.setattr(config, "GEMINI_FALLBACK_MODEL", "lite-model")
    monkeypatch.setattr(llm, "_call", call)
    monkeypatch.setattr(llm.time, "sleep", lambda seconds: None)
    return calls, script


def test_overload_is_retried(fake_gemini):
    calls, script = fake_gemini
    script += [api_error(503), "Summary"]
    assert llm.generate("p", "s") == "Summary"
    assert calls == ["main-model", "main-model"]


def test_falls_back_to_lighter_model(fake_gemini):
    calls, script = fake_gemini
    script += [api_error(503), api_error(504), api_error(500), "From lite"]
    assert llm.generate("p", "s") == "From lite"
    assert calls == ["main-model", "main-model", "main-model", "lite-model"]


def test_clear_error_when_everything_is_busy(fake_gemini):
    calls, script = fake_gemini
    script += [api_error(503)] * 4
    with pytest.raises(llm.LLMError) as err:
        llm.generate("p", "s")
    assert err.value.status == 503
    assert "very busy" in str(err.value)
    assert len(calls) == 4


def test_used_up_quota_goes_straight_to_fallback(fake_gemini):
    calls, script = fake_gemini
    script += [api_error(429, "Quota exceeded. Please retry in 10h15m51.5s."), "From lite"]
    assert llm.generate("p", "s") == "From lite"
    assert calls == ["main-model", "lite-model"]


def test_daily_limit_message_says_when_it_resets(fake_gemini):
    calls, script = fake_gemini
    script += [api_error(429, "Quota exceeded. Please retry in 10h15m51.5s.")] * 2
    with pytest.raises(llm.LLMError) as err:
        llm.generate("p", "s")
    assert err.value.status == 429
    assert str(err.value) == "Today's free Gemini limit has been used up. It resets in about 10 hours 15 min."
    assert calls == ["main-model", "lite-model"]


def test_per_minute_limit_message(fake_gemini):
    calls, script = fake_gemini
    script += [api_error(429, "Please retry in 41.2s.")] * 2
    with pytest.raises(llm.LLMError) as err:
        llm.generate("p", "s")
    assert "about 41 seconds" in str(err.value)


def test_retired_model_passes_on_googles_advice(fake_gemini):
    calls, script = fake_gemini
    script += [api_error(404, "Use models/gemini-3.8-flash instead.")]
    with pytest.raises(llm.LLMError) as err:
        llm.generate("p", "s")
    assert "gemini-3.8-flash" in str(err.value)


def test_no_fallback_when_disabled(fake_gemini, monkeypatch):
    calls, script = fake_gemini
    monkeypatch.setattr(config, "GEMINI_FALLBACK_MODEL", "")
    script += [api_error(503)] * 3
    with pytest.raises(llm.LLMError):
        llm.generate("p", "s")
    assert calls == ["main-model"] * 3
