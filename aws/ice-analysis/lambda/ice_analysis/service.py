from __future__ import annotations

from typing import Any

from .normalization import normalize_analysis_response
from .openai_client import StructuredAnalysisClient
from .prompt import MODEL_OUTPUT_SCHEMA, SYSTEM_INSTRUCTION, build_prompt
from .validation import validate_request


def handle_analysis_request(payload: dict[str, Any], *, client: StructuredAnalysisClient) -> dict[str, Any]:
    request = validate_request(payload)
    prompt = build_prompt(request)
    model_response = client.create_structured_analysis(
        instructions=SYSTEM_INSTRUCTION,
        prompt=prompt,
        schema=MODEL_OUTPUT_SCHEMA,
    )
    return normalize_analysis_response(model_response, request)

