import logging
from functools import lru_cache

from openai import APIError, LengthFinishReasonError, OpenAI

from app.prompt import SYSTEM_INSTRUCTIONS, build_extraction_prompt
from app.schema import LeaseExtraction
from config import get_settings

logger = logging.getLogger(__name__)


class LLMUnavailableError(Exception):
    pass


class LLMResponseError(Exception):
    pass


@lru_cache
def get_client() -> OpenAI:
    return OpenAI(api_key=get_settings().API_KEY, timeout=30.0, max_retries=3)


def extract_lease_fields(raw_text: str) -> LeaseExtraction:
    try:
        response = get_client().responses.parse(
            model=get_settings().MODEL,
            instructions=SYSTEM_INSTRUCTIONS,
            input=build_extraction_prompt(raw_text),
            text_format=LeaseExtraction,
        )
    except LengthFinishReasonError as exc:
        logger.error("LLM response truncated before completion: %s", exc)
        raise LLMResponseError("The model response was truncated before completion.") from exc
    except APIError as exc:
        logger.error("LLM call failed: %s", exc)
        raise LLMUnavailableError(str(exc)) from exc

    if response.output_parsed is None:
        logger.error("LLM returned no schema-conforming payload: %s", response.output_text)
        raise LLMResponseError("The model did not return a payload matching the schema.")

    return response.output_parsed
