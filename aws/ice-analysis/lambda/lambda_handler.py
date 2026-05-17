from __future__ import annotations

import json
import logging
import time
from typing import Any

from ice_analysis.config import Settings
from ice_analysis.errors import IceAnalysisError
from ice_analysis.http import build_response, parse_json_body, request_method, request_origin
from ice_analysis.openai_client import OpenAIResponsesClient, get_api_key_from_ssm
from ice_analysis.service import handle_analysis_request

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event: dict[str, Any], context: object) -> dict[str, Any]:
    started = time.perf_counter()
    method = request_method(event)
    origin = request_origin(event)
    request_id = getattr(context, "aws_request_id", None)

    if method == "OPTIONS":
        return build_response(204, None, origin)

    if method != "POST":
        return build_response(405, {"error": "Method not allowed", "code": "method_not_allowed"}, origin)

    try:
        payload = parse_json_body(event)
        settings = Settings.from_env()
        api_key = get_api_key_from_ssm(settings.openai_api_key_parameter)
        client = OpenAIResponsesClient(
            api_key=api_key,
            model=settings.openai_model,
            timeout_seconds=settings.openai_timeout_seconds,
        )
        result = handle_analysis_request(payload, client=client)
        _log_outcome("success", started, request_id, status_code=200, leg_count=len(result["legs"]))
        return build_response(200, result, origin)
    except IceAnalysisError as exc:
        _log_outcome("rejected", started, request_id, status_code=exc.status_code, reason=exc.code)
        return build_response(exc.status_code, {"error": exc.message, "code": exc.code}, origin)
    except Exception:
        logger.exception(_log_payload("failed", started, request_id, status_code=500, reason="unhandled_exception"))
        return build_response(500, {"error": "Ice analysis service failed.", "code": "ice_analysis_failed"}, origin)


def _log_outcome(status: str, started: float, request_id: str | None, **fields: Any) -> None:
    logger.info(_log_payload(status, started, request_id, **fields))


def _log_payload(status: str, started: float, request_id: str | None, **fields: Any) -> str:
    payload = {
        "status": status,
        "awsRequestId": request_id,
        "durationMs": round((time.perf_counter() - started) * 1000),
        **fields,
    }
    return json.dumps(payload, separators=(",", ":"))

