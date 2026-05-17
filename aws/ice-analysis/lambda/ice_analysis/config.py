from __future__ import annotations

from dataclasses import dataclass
from os import environ
from typing import Mapping


@dataclass(frozen=True)
class Settings:
    openai_api_key_parameter: str
    openai_model: str = "gpt-5.4"
    openai_timeout_seconds: float = 25.0

    @classmethod
    def from_env(cls, env: Mapping[str, str] = environ) -> "Settings":
        parameter = env.get("OPENAI_API_KEY_PARAMETER", "").strip()
        timeout_raw = env.get("OPENAI_TIMEOUT_SECONDS", "25").strip()

        try:
            timeout = float(timeout_raw)
        except ValueError:
            timeout = 25.0

        return cls(
            openai_api_key_parameter=parameter,
            openai_model=env.get("OPENAI_MODEL", "gpt-5.4").strip() or "gpt-5.4",
            openai_timeout_seconds=timeout,
        )

