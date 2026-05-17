from __future__ import annotations

import json
from typing import Any, Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .errors import ConfigurationError, UpstreamError

OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"


class StructuredAnalysisClient(Protocol):
    def create_structured_analysis(self, *, instructions: str, prompt: str, schema: dict[str, Any]) -> dict[str, Any]:
        ...


class OpenAIResponsesClient:
    def __init__(self, *, api_key: str, model: str, timeout_seconds: float) -> None:
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds

    def create_structured_analysis(self, *, instructions: str, prompt: str, schema: dict[str, Any]) -> dict[str, Any]:
        payload = {
            "model": self.model,
            "instructions": instructions,
            "input": prompt,
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "ice_route_analysis",
                    "strict": True,
                    "schema": schema,
                },
            },
        }
        request = Request(
            OPENAI_RESPONSES_URL,
            method="POST",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )

        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                response_body = response.read().decode("utf-8")
        except HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")
            message = _extract_error_message(error_body) or f"OpenAI request failed with {exc.code}."
            raise UpstreamError(message, code="openai_request_failed") from exc
        except URLError as exc:
            raise UpstreamError("OpenAI request failed before a response was received.", code="openai_unreachable") from exc

        try:
            data = json.loads(response_body)
        except json.JSONDecodeError as exc:
            raise UpstreamError("OpenAI response was not valid JSON.", code="openai_invalid_json") from exc

        text = _extract_response_text(data)
        if not text:
            raise UpstreamError("OpenAI response did not include structured output.", code="openai_missing_output")

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise UpstreamError("OpenAI structured output was not valid JSON.", code="openai_invalid_structured_output") from exc

        if not isinstance(parsed, dict):
            raise UpstreamError("OpenAI structured output must be a JSON object.", code="openai_invalid_structured_output")
        return parsed


def get_api_key_from_ssm(parameter_name: str, ssm_client: Any | None = None) -> str:
    if not parameter_name:
        raise ConfigurationError("OPENAI_API_KEY_PARAMETER is required.")

    if ssm_client is None:
        try:
            import boto3
        except ImportError as exc:
            raise ConfigurationError("boto3 is required to read OPENAI_API_KEY_PARAMETER from SSM.") from exc

        ssm_client = boto3.client("ssm")

    response = ssm_client.get_parameter(Name=parameter_name, WithDecryption=True)
    value = response.get("Parameter", {}).get("Value")
    if not isinstance(value, str) or not value.strip():
        raise ConfigurationError("SSM parameter did not contain an OpenAI API key.")
    return value.strip()


def _extract_response_text(response: dict[str, Any]) -> str:
    output_text = response.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    chunks: list[str] = []
    for item in response.get("output", []):
        if not isinstance(item, dict):
            continue
        for content in item.get("content", []):
            if isinstance(content, dict) and isinstance(content.get("text"), str):
                chunks.append(content["text"])
    return "\n".join(chunks).strip()


def _extract_error_message(error_body: str) -> str | None:
    try:
        parsed = json.loads(error_body)
    except json.JSONDecodeError:
        return None

    message = parsed.get("error", {}).get("message")
    return message if isinstance(message, str) else None

