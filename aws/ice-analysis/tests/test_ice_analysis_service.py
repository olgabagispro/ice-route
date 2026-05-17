from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

LAMBDA_ROOT = Path(__file__).resolve().parents[1] / "lambda"
sys.path.insert(0, str(LAMBDA_ROOT))

from ice_analysis.errors import ValidationError  # noqa: E402
from ice_analysis.service import handle_analysis_request  # noqa: E402
from ice_analysis.validation import validate_request  # noqa: E402
from lambda_handler import lambda_handler  # noqa: E402


class FakeClient:
    def __init__(self, response: dict):
        self.response = response
        self.calls = []

    def create_structured_analysis(self, *, instructions: str, prompt: str, schema: dict) -> dict:
        self.calls.append({"instructions": instructions, "prompt": prompt, "schema": schema})
        return self.response


def valid_payload() -> dict:
    return {
        "navigationWindow": {"startDate": "2026-07-01", "endDate": "2026-07-14"},
        "legs": [
            {
                "legIndex": 0,
                "from": {"id": "a", "name": "Murmansk", "lat": 68.97, "lng": 33.08},
                "to": {"id": "b", "name": "Dikson", "lat": 73.50, "lng": 80.55},
                "northernmostPoint": {"lat": 74.10, "lng": 62.20},
                "distanceNm": 920,
            }
        ],
    }


class IceAnalysisServiceTests(unittest.TestCase):
    def test_returns_current_web_contract(self) -> None:
        client = FakeClient(
            {
                "legs": [
                    {
                        "iceClass": "Arc7",
                        "thickness": "1.2m",
                        "risk": "HIGH",
                        "integrity": 73,
                        "demandingSegment": "Northernmost exposure near 74.1N.",
                        "advisories": [
                            {
                                "type": "ice",
                                "title": "Worst-case ice age",
                                "description": "Residual first-year ice with possible old-ice inclusions.",
                            }
                        ],
                    }
                ]
            }
        )

        result = handle_analysis_request(valid_payload(), client=client)

        self.assertEqual(set(result.keys()), {"legs"})
        self.assertEqual(len(result["legs"]), 1)
        leg = result["legs"][0]
        self.assertEqual(
            set(leg.keys()),
            {"from", "to", "iceClass", "thickness", "risk", "integrity", "distance", "demandingSegment", "advisories"},
        )
        self.assertEqual(leg["iceClass"], "Arc7")
        self.assertEqual(leg["distance"], 920)
        self.assertTrue(any(advisory["title"] == "Planning estimate only" for advisory in leg["advisories"]))
        self.assertEqual(client.calls[0]["schema"]["required"], ["legs"])

    def test_validates_required_navigation_window(self) -> None:
        payload = valid_payload()
        payload["navigationWindow"] = {"startDate": "", "endDate": "2026-07-14"}

        with self.assertRaises(ValidationError):
            validate_request(payload)

    def test_fills_missing_model_leg_with_conservative_defaults(self) -> None:
        result = handle_analysis_request(valid_payload(), client=FakeClient({"legs": []}))

        leg = result["legs"][0]
        self.assertEqual(leg["iceClass"], "Unknown")
        self.assertEqual(leg["risk"], "MODERATE")
        self.assertEqual(leg["integrity"], 50)
        self.assertTrue(leg["advisories"])

    def test_lambda_rejects_non_post_methods(self) -> None:
        response = lambda_handler({"httpMethod": "GET", "headers": {}}, object())

        self.assertEqual(response["statusCode"], 405)
        self.assertEqual(json.loads(response["body"])["code"], "method_not_allowed")


if __name__ == "__main__":
    unittest.main()
