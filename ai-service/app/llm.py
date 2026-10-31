"""Thin wrapper around the Gemini API.

Everything that talks to the LLM goes through generate(), so switching model
(GEMINI_MODEL) or provider only touches this file.
"""
import logging
import re
import time

from pydantic import BaseModel, ValidationError

from google import genai
from google.genai import errors, types

from . import config

log = logging.getLogger("uvicorn.error")

# Google answers 500/503/504 when a model is overloaded ("high demand") or
# slow. These usually pass within seconds, so we wait and try again.
RETRYABLE = {500, 503, 504}
RETRY_WAITS = [2, 5]  # seconds before the 2nd and 3rd try on the main model


class LLMError(Exception):
    """The LLM call failed; status is the HTTP status the API should return."""

    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


_client = None


def _get_client():
    global _client
    if not config.GEMINI_API_KEY:
        raise LLMError(
            "The Gemini API key is not set. Add GEMINI_API_KEY to ai-service/.env and restart the AI service.",
            status=503,
        )
    if _client is None:
        # Give up after 60 s instead of leaving the student waiting forever.
        _client = genai.Client(api_key=config.GEMINI_API_KEY, http_options=types.HttpOptions(timeout=60_000))
    return _client


def _call(model: str, prompt: str, system: str, temperature: float, json_schema: dict | None = None) -> str:
    settings = {"system_instruction": system, "temperature": temperature}
    if json_schema:
        # Ask Gemini for JSON that follows the schema instead of free text.
        settings.update(response_mime_type="application/json", response_json_schema=json_schema)
    response = _get_client().models.generate_content(
        model=model, contents=prompt, config=types.GenerateContentConfig(**settings)
    )
    return (response.text or "").strip()


def _attempts():
    """(model, seconds to wait first): main model up to 3 times, then the fallback once."""
    yield config.GEMINI_MODEL, 0
    for wait in RETRY_WAITS:
        yield config.GEMINI_MODEL, wait
    if config.GEMINI_FALLBACK_MODEL and config.GEMINI_FALLBACK_MODEL != config.GEMINI_MODEL:
        yield config.GEMINI_FALLBACK_MODEL, 0


def generate(prompt: str, system: str, temperature: float = 0.2, json_schema: dict | None = None) -> str:
    """Send one prompt and return the model's text reply.

    Temporary overloads are retried automatically, falling back to a lighter
    model, so the student only sees an error if Gemini stays unavailable.
    When the main model's free quota is used up (429), the lighter model,
    which has its own quota, is tried straight away.
    """
    last_error = None
    skip_main = False
    for model, wait in _attempts():
        if skip_main and model == config.GEMINI_MODEL:
            continue
        if wait:
            time.sleep(wait)
        try:
            text = _call(model, prompt, system, temperature, json_schema)
        except errors.APIError as exc:
            log.warning("Gemini %s failed: %s %s", model, exc.code, exc.message)
            if exc.code in RETRYABLE:
                last_error = exc
                continue
            if exc.code == 429:
                last_error = exc
                skip_main = True  # waiting won't help; go to the fallback model
                continue
            raise _to_llm_error(exc) from exc
        except LLMError:
            raise  # e.g. the API key is missing: already a clear message
        except Exception as exc:  # network problems, timeouts
            log.warning("Gemini %s could not be reached: %s", model, exc)
            raise LLMError("Could not reach Gemini. Check your internet connection and try again.") from exc

        if not text:
            raise LLMError("Gemini returned an empty answer. Please try rephrasing your question.")
        if model != config.GEMINI_MODEL:
            log.info("Answered with fallback model %s", model)
        return text

    if last_error is not None and last_error.code == 429:
        raise _to_llm_error(last_error) from last_error
    raise LLMError(
        "Gemini is very busy right now and didn't answer after several tries. Please wait a minute and try again.",
        status=503,
    ) from last_error


def _quota_message(exc: errors.APIError) -> str:
    """Explain a 429, using Google's "Please retry in 10h15m51s" hint if there is one."""
    match = re.search(r"retry in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s", exc.message or "")
    if not match:
        return "The Gemini free-tier limit was reached. Please wait a minute and try again."
    hours, minutes = int(match[1] or 0), int(match[2] or 0)
    if hours:
        return (
            "Today's free Gemini limit has been used up. It resets in about "
            f"{hours} hour{'s' if hours != 1 else ''}{f' {minutes} min' if minutes else ''}."
        )
    seconds = minutes * 60 + float(match[3])
    return f"The Gemini free-tier limit was reached. Please try again in about {max(1, round(seconds))} seconds."


def _to_llm_error(exc: errors.APIError) -> LLMError:
    if exc.code == 429:
        return LLMError(_quota_message(exc), status=429)
    if exc.code in (400, 401, 403) and "API key" in str(exc):
        return LLMError("Gemini rejected the API key. Check GEMINI_API_KEY in ai-service/.env.", status=503)
    if exc.code == 404:
        # Google retires models; its message names the replacement to use.
        return LLMError(
            f"Gemini model is not available: {exc.message} Change GEMINI_MODEL in ai-service/.env.",
            status=503,
        )
    return LLMError(f"Gemini request failed ({exc.code}). Please try again.")


def generate_json(prompt: str, system: str, model_cls: type[BaseModel], temperature: float = 0.4) -> BaseModel:
    """Like generate(), but returns the reply parsed into model_cls.

    Gemini is asked to follow model_cls's JSON schema. If the reply still
    doesn't fit (rare), it is asked once more before giving up.
    """
    schema = model_cls.model_json_schema()
    for attempt in (1, 2):
        text = generate(prompt, system, temperature, json_schema=schema)
        try:
            return model_cls.model_validate_json(text)
        except ValidationError as exc:
            log.warning("Gemini JSON did not match %s (attempt %s): %s", model_cls.__name__, attempt, exc)
    raise LLMError("Gemini returned a reply in the wrong format. Please try again.")
