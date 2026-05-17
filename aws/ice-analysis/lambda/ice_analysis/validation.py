from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from math import asin, cos, radians, sin, sqrt
from typing import Any

from .errors import ValidationError

MAX_LEGS = 25


@dataclass(frozen=True)
class Point:
    lat: float
    lng: float
    name: str | None = None
    id: str | None = None


@dataclass(frozen=True)
class LegInput:
    leg_index: int
    from_point: Point
    to_point: Point
    northernmost_point: Point
    distance_nm: int


@dataclass(frozen=True)
class AnalysisRequest:
    start_date: str
    end_date: str
    legs: tuple[LegInput, ...]


def calculate_distance_nm(points: list[Point] | tuple[Point, ...]) -> int:
    total = 0.0
    earth_radius_nm = 3440.065
    for first, second in zip(points, points[1:]):
        d_lat = radians(second.lat - first.lat)
        d_lng = radians(second.lng - first.lng)
        a = (
            sin(d_lat / 2) ** 2
            + cos(radians(first.lat)) * cos(radians(second.lat)) * sin(d_lng / 2) ** 2
        )
        total += earth_radius_nm * 2 * asin(sqrt(a))
    return round(total)


def validate_request(payload: dict[str, Any]) -> AnalysisRequest:
    window = payload.get("navigationWindow")
    if not isinstance(window, dict):
        raise ValidationError("navigationWindow is required.")

    start_date = _parse_date_string(window.get("startDate"), "navigationWindow.startDate")
    end_date = _parse_date_string(window.get("endDate"), "navigationWindow.endDate")
    if date.fromisoformat(end_date) < date.fromisoformat(start_date):
        raise ValidationError("navigationWindow.endDate must be on or after startDate.", code="invalid_date_range")

    raw_legs = payload.get("legs")
    if not isinstance(raw_legs, list) or not raw_legs:
        raise ValidationError("legs must contain at least one route leg.")
    if len(raw_legs) > MAX_LEGS:
        raise ValidationError(f"legs cannot contain more than {MAX_LEGS} items.", code="too_many_legs")

    legs = tuple(_parse_leg(raw_leg, index) for index, raw_leg in enumerate(raw_legs))
    return AnalysisRequest(start_date=start_date, end_date=end_date, legs=legs)


def _parse_date_string(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"{field} is required.")
    normalized = value.strip()
    try:
        date.fromisoformat(normalized)
    except ValueError as exc:
        raise ValidationError(f"{field} must be an ISO date string.", code="invalid_date") from exc
    return normalized


def _parse_leg(raw_leg: Any, index: int) -> LegInput:
    if not isinstance(raw_leg, dict):
        raise ValidationError(f"legs[{index}] must be an object.")

    from_point = _parse_point(raw_leg.get("from"), f"legs[{index}].from")
    to_point = _parse_point(raw_leg.get("to"), f"legs[{index}].to")
    northernmost = _parse_point(raw_leg.get("northernmostPoint"), f"legs[{index}].northernmostPoint")
    leg_index = raw_leg.get("legIndex", index)
    if not isinstance(leg_index, int):
        raise ValidationError(f"legs[{index}].legIndex must be an integer.")

    raw_distance = raw_leg.get("distanceNm")
    if isinstance(raw_distance, (int, float)) and raw_distance >= 0:
        distance_nm = round(raw_distance)
    else:
        distance_nm = calculate_distance_nm((from_point, to_point))

    return LegInput(
        leg_index=leg_index,
        from_point=from_point,
        to_point=to_point,
        northernmost_point=northernmost,
        distance_nm=distance_nm,
    )


def _parse_point(value: Any, field: str) -> Point:
    if not isinstance(value, dict):
        raise ValidationError(f"{field} is required.")

    lat = _parse_coordinate(value.get("lat"), f"{field}.lat", minimum=-90, maximum=90)
    lng = _parse_coordinate(value.get("lng"), f"{field}.lng", minimum=-180, maximum=180)
    name = value.get("name")
    point_id = value.get("id")

    return Point(
        lat=lat,
        lng=lng,
        name=name.strip() if isinstance(name, str) and name.strip() else None,
        id=point_id.strip() if isinstance(point_id, str) and point_id.strip() else None,
    )


def _parse_coordinate(value: Any, field: str, *, minimum: float, maximum: float) -> float:
    if not isinstance(value, (int, float)):
        raise ValidationError(f"{field} must be a number.")
    coordinate = float(value)
    if coordinate < minimum or coordinate > maximum:
        raise ValidationError(f"{field} is outside the allowed coordinate range.")
    return coordinate

