"""
Unified error hierarchy for Excom.

Usage:
    from excom.excom.utils.errors import ExcomProviderError, ExcomRateLimitError

    raise ExcomProviderError("WhatsApp API returned 401", provider="whatsapp")
"""

import frappe


class ExcomError(Exception):
    """Base exception for all Excom errors.

    Automatically logs to Error Log when raised in a background job.
    """

    http_status_code = 500
    title = "Excom Error"

    def __init__(self, message: str = "", **context):
        self.message = message
        self.context = context
        super().__init__(message)

    def log(self):
        """Persist to Frappe Error Log for post-mortem analysis."""
        frappe.log_error(
            title=self.title,
            message=f"{self.message}\n\nContext: {self.context}",
        )


class ExcomValidationError(ExcomError):
    """Data validation failures (bad input, schema violations)."""

    http_status_code = 400
    title = "Excom Validation Error"


class ExcomProviderError(ExcomError):
    """Upstream provider API errors (WhatsApp, email gateway, etc.)."""

    # Use 400 when the exception propagates uncaught so clients get a readable
    # API error instead of an HTTP 502 masked as “Bad Gateway”.
    http_status_code = 400
    title = "Excom Provider Error"

    def __init__(self, message: str = "", provider: str = "", **context):
        self.provider = provider
        super().__init__(message, provider=provider, **context)


class ExcomRateLimitError(ExcomProviderError):
    """Rate limit exceeded on a provider API."""

    http_status_code = 429
    title = "Excom Rate Limit Error"

    def __init__(self, message: str = "", provider: str = "", retry_after: int = 0, **context):
        self.retry_after = retry_after
        super().__init__(message, provider=provider, retry_after=retry_after, **context)


class ExcomIdentityError(ExcomError):
    """Identity resolution or merge failures."""

    http_status_code = 409
    title = "Excom Identity Error"
