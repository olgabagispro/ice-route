from __future__ import annotations

import base64
import json
from typing import Any

from .errors import ValidationError


ALLOWED_CORS_ORIGINS = {
    "https://ice-navigator.com",
    "https://www.ice-navigator.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}


def is_allowed_origin(origin: str | None) -> bool:
    if not origin:
        return False
    if origin in ALLOWED_CORS_ORIGINS:
        return True

    try:
        from urllib.parse import urlparse

        parsed = urlparse(origin)
        return (
            parsed.scheme == "https"
            and parsed.hostname is not None
            and parsed.hostname.startswith("ice-route.")
            and parsed.hostname.endswith(".workers.dev")
        )
    except ValueError:
        return False


def response_headers_for(origin: str | None) -> dict[str, str]:
    headers = {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
        "Vary": "Origin",
    }
    if is_allowed_origin(origin):
        headers["Access-Control-Allow-Origin"] = origin or ""
    return headers


def build_response(status_code: int, body: dict[str, Any] | None, origin: str | None = None) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": response_headers_for(origin),
        "body": "" if body is None else json.dumps(body, separators=(",", ":")),
    }


def request_method(event: dict[str, Any]) -> str:
    return (
        event.get("requestContext", {}).get("http", {}).get("method")
        or event.get("httpMethod")
        or "GET"
    ).upper()


def request_origin(event: dict[str, Any]) -> str | None:
    headers = event.get("headers") or {}
    for key, value in headers.items():
        if key.lower() == "origin":
            return value
    return None


def parse_json_body(event: dict[str, Any]) -> dict[str, Any]:
    raw_body = event.get("body")
    if raw_body is None:
        raise ValidationError("Request body is required.", code="missing_body")

    if event.get("isBase64Encoded"):
        raw_body = base64.b64decode(raw_body).decode("utf-8")

    try:
        parsed = json.loads(raw_body)
    except (TypeError, json.JSONDecodeError) as exc:
        raise ValidationError("Request body must be valid JSON.", code="invalid_json") from exc

    if not isinstance(parsed, dict):
        raise ValidationError("Request body must be a JSON object.")
    return parsed

