from __future__ import annotations


class IceAnalysisError(Exception):
    def __init__(self, message: str, *, code: str, status_code: int) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


class ValidationError(IceAnalysisError):
    def __init__(self, message: str, *, code: str = "invalid_request") -> None:
        super().__init__(message, code=code, status_code=400)


class ConfigurationError(IceAnalysisError):
    def __init__(self, message: str, *, code: str = "configuration_error") -> None:
        super().__init__(message, code=code, status_code=500)


class UpstreamError(IceAnalysisError):
    def __init__(self, message: str, *, code: str = "upstream_error") -> None:
        super().__init__(message, code=code, status_code=502)

