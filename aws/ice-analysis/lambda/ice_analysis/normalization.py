from __future__ import annotations

from typing import Any

from .errors import UpstreamError
from .validation import AnalysisRequest, LegInput

VALID_RISKS = {"LOW", "MODERATE", "HIGH"}
VALID_ADVISORY_TYPES = {"ice", "seasonal", "warning"}
PLANNING_WARNING_TITLE = "Planning estimate only"
PLANNING_WARNING_DESCRIPTION = "No live ice chart or authoritative operational ice dataset was attached."


def normalize_analysis_response(model_response: dict[str, Any], request: AnalysisRequest) -> dict[str, Any]:
    raw_legs = model_response.get("legs")
    if not isinstance(raw_legs, list):
        raise UpstreamError("OpenAI output did not include a legs array.", code="openai_invalid_contract")

    legs = []
    for index, request_leg in enumerate(request.legs):
        raw_leg = raw_legs[index] if index < len(raw_legs) and isinstance(raw_legs[index], dict) else {}
        legs.append(_normalize_leg(raw_leg, request_leg, index))

    return {"legs": legs}


def _normalize_leg(raw_leg: dict[str, Any], request_leg: LegInput, index: int) -> dict[str, Any]:
    from_name = _short_name(request_leg.from_point.name) or f"Waypoint {index + 1}"
    to_name = _short_name(request_leg.to_point.name) or f"Waypoint {index + 2}"

    advisories = _normalize_advisories(raw_leg.get("advisories"))
    if not _has_planning_warning(advisories):
        advisories.append(
            {
                "type": "warning",
                "title": PLANNING_WARNING_TITLE,
                "description": PLANNING_WARNING_DESCRIPTION,
            }
        )

    return {
        "from": _string_or_default(raw_leg.get("from"), from_name),
        "to": _string_or_default(raw_leg.get("to"), to_name),
        "iceClass": _string_or_default(raw_leg.get("iceClass"), "Unknown"),
        "thickness": _string_or_default(raw_leg.get("thickness"), "Unknown"),
        "risk": _normalize_risk(raw_leg.get("risk")),
        "integrity": _normalize_integrity(raw_leg.get("integrity")),
        "distance": request_leg.distance_nm,
        "demandingSegment": _string_or_default(
            raw_leg.get("demandingSegment"),
            f"Northernmost exposure near {request_leg.northernmost_point.lat:.2f}N.",
        ),
        "advisories": advisories[:5],
    }


def _normalize_risk(value: Any) -> str:
    if isinstance(value, str) and value.upper() in VALID_RISKS:
        return value.upper()
    return "MODERATE"


def _normalize_integrity(value: Any) -> int:
    if isinstance(value, bool):
        return 50
    if isinstance(value, (int, float)):
        return max(0, min(100, round(value)))
    return 50


def _normalize_advisories(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []

    normalized: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        advisory_type = item.get("type")
        if not isinstance(advisory_type, str) or advisory_type not in VALID_ADVISORY_TYPES:
            advisory_type = "warning"

        description = item.get("description")
        if not isinstance(description, str) or not description.strip():
            continue

        title = item.get("title")
        normalized.append(
            {
                "type": advisory_type,
                "title": title.strip() if isinstance(title, str) and title.strip() else "Ice advisory",
                "description": description.strip(),
            }
        )

    return normalized


def _has_planning_warning(advisories: list[dict[str, str]]) -> bool:
    return any(advisory["title"].strip().lower() == PLANNING_WARNING_TITLE.lower() for advisory in advisories)


def _string_or_default(value: Any, default: str) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return default


def _short_name(value: str | None) -> str | None:
    if not value:
        return None
    return value.split(",")[0].strip() or None

