from __future__ import annotations

import json

from .validation import AnalysisRequest


SYSTEM_INSTRUCTION = (
    "You are Ice Route AI, a polar maritime route analyst. Return conservative "
    "planning estimates for Arc-class routing. Use only the supplied route "
    "coordinates, northernmost route points, and dates. Do not claim live or "
    "authoritative ice-chart certainty."
)

MODEL_OUTPUT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["legs"],
    "properties": {
        "legs": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["iceClass", "thickness", "risk", "integrity", "demandingSegment", "advisories"],
                "properties": {
                    "iceClass": {
                        "type": "string",
                        "description": "Recommended minimum class label, for example Ice3, Arc4, Arc7, Arc9, or Open Water.",
                    },
                    "thickness": {
                        "type": "string",
                        "description": "Worst-case ice thickness estimate as a compact UI label, such as 0.4m, 1.2m, or Unknown.",
                    },
                    "risk": {
                        "type": "string",
                        "enum": ["LOW", "MODERATE", "HIGH"],
                    },
                    "integrity": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 100,
                    },
                    "demandingSegment": {
                        "type": "string",
                        "description": "Short description of the most demanding part of the leg.",
                    },
                    "advisories": {
                        "type": "array",
                        "minItems": 2,
                        "maxItems": 5,
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["type", "title", "description"],
                            "properties": {
                                "type": {
                                    "type": "string",
                                    "enum": ["ice", "seasonal", "warning"],
                                },
                                "title": {
                                    "type": "string",
                                },
                                "description": {
                                    "type": "string",
                                },
                            },
                        },
                    },
                },
            },
        },
    },
}


def build_prompt(request: AnalysisRequest) -> str:
    legs = []
    for leg in request.legs:
        legs.append(
            {
                "legIndex": leg.leg_index,
                "from": _point_to_prompt(leg.from_point),
                "to": _point_to_prompt(leg.to_point),
                "northernmostPoint": _point_to_prompt(leg.northernmost_point),
                "distanceNm": leg.distance_nm,
            }
        )

    return json.dumps(
        {
            "task": "Estimate the worst expected ice load and Arc-class route risk for each leg.",
            "planningMode": "itinerary_and_season_only",
            "limitations": [
                "No live ice chart, satellite, buoy, or authoritative operational ice dataset is attached.",
                "Use the navigation window as the season signal and the northernmost point as the conservative route exposure signal.",
            ],
            "outputRules": [
                "Return exactly one legs item for each input leg, in the same order.",
                "Use concise maritime wording suitable for small UI cards.",
                "Estimate worst-case ice age, worst-case thickness, concentration, ridging, compression, and seasonality through the existing advisory fields.",
                "Keep thickness as a compact string and risk as LOW, MODERATE, or HIGH.",
                "Include at least one warning advisory that states this is a planning estimate only.",
            ],
            "navigationWindow": {
                "startDate": request.start_date,
                "endDate": request.end_date,
            },
            "legs": legs,
        },
        separators=(",", ":"),
    )


def _point_to_prompt(point: object) -> dict[str, object]:
    return {
        "name": getattr(point, "name", None),
        "lat": getattr(point, "lat"),
        "lng": getattr(point, "lng"),
    }

