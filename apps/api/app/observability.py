"""Crash reports (Sentry) and log hygiene. Docs: docs/observability.md.

Rules this file keeps:

* OFF without a DSN. `SENTRY_DSN` comes from the environment; no key lives in the repository.
* NO PERSONAL DATA leaves the server. Before an event is sent, `scrub_event` removes request
  bodies, cookies, query strings, auth headers, the client IP and the e-mail of a user, and
  masks e-mail addresses, bearer tokens, JWTs and signed-URL signatures in every message.
  Local variables are not attached, and `send_default_pii` stays False.
* Only server faults are reported (HTTP 5xx and unhandled exceptions). A 4xx is the caller's
  mistake and is not a crash.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Mapping, MutableMapping
from typing import Any

from app.config import Settings

logger = logging.getLogger(__name__)

REDACTED = "[redacted]"

# Header names whose value is a secret or identifies a person.
SENSITIVE_HEADERS = frozenset(
    {
        "authorization",
        "cookie",
        "set-cookie",
        "x-admin-key",
        "x-member-key",
        "x-member-token",
        "x-api-key",
        "x-forwarded-for",
        "x-real-ip",
        "proxy-authorization",
    }
)

EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
BEARER = re.compile(r"(?i)\b(bearer|basic)\s+[A-Za-z0-9._~+/=\-]{8,}")
JWT = re.compile(r"\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{4,}\b")
SIGNATURE = re.compile(r"(?i)(X-Amz-(?:Signature|Credential|Security-Token)=)[^&\s\"']+")
LONG_HEX = re.compile(r"\b[0-9a-fA-F]{40,}\b")
UPLOAD_TOKEN = re.compile(r"(/recordings/uploads/)[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}")


def scrub_text(value: str) -> str:
    """Mask e-mails, tokens and signatures in a piece of text."""
    value = SIGNATURE.sub(r"\1" + REDACTED, value)
    value = UPLOAD_TOKEN.sub(r"\1" + REDACTED, value)
    value = JWT.sub(REDACTED, value)
    value = BEARER.sub(lambda m: f"{m.group(1)} {REDACTED}", value)
    value = EMAIL.sub("[email]", value)
    return LONG_HEX.sub(REDACTED, value)


def _scrub_value(value: Any, depth: int = 0) -> Any:
    if depth > 6:
        return REDACTED
    if isinstance(value, str):
        return scrub_text(value)
    if isinstance(value, Mapping):
        return {k: _scrub_value(v, depth + 1) for k, v in value.items()}
    if isinstance(value, list | tuple):
        return [_scrub_value(v, depth + 1) for v in value]
    return value


def _scrub_headers(headers: Any) -> Any:
    if isinstance(headers, Mapping):
        return {
            k: (REDACTED if str(k).lower() in SENSITIVE_HEADERS else _scrub_value(v))
            for k, v in headers.items()
        }
    if isinstance(headers, list):
        return [
            [k, REDACTED if str(k).lower() in SENSITIVE_HEADERS else _scrub_value(v)]
            for k, v in (p for p in headers if isinstance(p, list | tuple) and len(p) == 2)
        ]
    return headers


def scrub_event(event: MutableMapping[str, Any], hint: Any = None) -> MutableMapping[str, Any]:
    """`before_send` for Sentry. Returns the event with personal data removed."""
    request = event.get("request")
    if isinstance(request, MutableMapping):
        request.pop("data", None)  # the body: lyrics, questions, passwords
        request.pop("cookies", None)
        request.pop("env", None)  # REMOTE_ADDR and friends
        request.pop("query_string", None)
        if "headers" in request:
            request["headers"] = _scrub_headers(request["headers"])
        if isinstance(request.get("url"), str):
            request["url"] = scrub_text(str(request["url"]).split("?", 1)[0])

    user = event.get("user")
    if isinstance(user, MutableMapping):
        # Keep an opaque id when there is one (to count affected people), nothing else.
        opaque = user.get("id")
        event["user"] = {"id": scrub_text(str(opaque))} if opaque else {}

    for key in ("message", "logentry", "transaction", "extra", "contexts", "tags"):
        if key in event:
            event[key] = _scrub_value(event[key])

    exception = event.get("exception")
    if isinstance(exception, MutableMapping):
        for item in exception.get("values") or []:
            if isinstance(item, MutableMapping):
                if isinstance(item.get("value"), str):
                    item["value"] = scrub_text(item["value"])
                stacktrace = item.get("stacktrace")
                if isinstance(stacktrace, MutableMapping):
                    for frame in stacktrace.get("frames") or []:
                        if isinstance(frame, MutableMapping):
                            frame.pop("vars", None)

    breadcrumbs = event.get("breadcrumbs")
    if isinstance(breadcrumbs, MutableMapping):
        breadcrumbs = breadcrumbs.get("values")
    if isinstance(breadcrumbs, list):
        for crumb in breadcrumbs:
            if isinstance(crumb, MutableMapping):
                if isinstance(crumb.get("message"), str):
                    crumb["message"] = scrub_text(crumb["message"])
                if "data" in crumb:
                    crumb["data"] = _scrub_value(crumb["data"])
    return event


def scrub_breadcrumb(crumb: MutableMapping[str, Any], hint: Any = None) -> MutableMapping[str, Any]:
    if isinstance(crumb.get("message"), str):
        crumb["message"] = scrub_text(crumb["message"])
    if "data" in crumb:
        crumb["data"] = _scrub_value(crumb["data"])
    return crumb


def sentry_options(settings: Settings) -> dict[str, Any] | None:
    """The `sentry_sdk.init` options, or None when crash reports are off (no DSN)."""
    dsn = (settings.sentry_dsn or "").strip()
    if not dsn:
        return None
    return {
        "dsn": dsn,
        "environment": settings.sentry_environment or settings.app_env,
        "release": settings.sentry_release or f"prabhat-samgiita-api@{settings.app_version}",
        "send_default_pii": False,
        "include_local_variables": False,
        "attach_stacktrace": True,
        "max_breadcrumbs": 30,
        "traces_sample_rate": settings.sentry_traces_sample_rate,
        "before_send": scrub_event,
        "before_breadcrumb": scrub_breadcrumb,
    }


def init_sentry(settings: Settings) -> bool:
    """Start Sentry when a DSN is set. Returns whether it started; never raises."""
    options = sentry_options(settings)
    if options is None:
        return False
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        sentry_sdk.init(
            **options,
            integrations=[
                StarletteIntegration(),
                FastApiIntegration(),
                # Error logs become events; info and warning logs only become breadcrumbs.
                LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
            ],
        )
    except Exception:  # a broken monitoring setup must never stop the API
        logger.exception("Sentry could not start; continuing without crash reports")
        return False
    return True


class RedactingFilter(logging.Filter):
    """Masks e-mails, tokens and signed-URL signatures in every log line."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:  # a bad format string must not lose the line
            return True
        cleaned = scrub_text(message)
        if cleaned != message:
            record.msg = cleaned
            record.args = ()
        return True


NOISY_LOGGERS = ("httpx", "httpcore", "azure", "urllib3")


def harden_logging() -> None:
    """Called once at start: quiet libraries that print URLs, and redact what is still logged."""
    for name in NOISY_LOGGERS:
        logging.getLogger(name).setLevel(logging.WARNING)
    root = logging.getLogger()
    if not any(isinstance(f, RedactingFilter) for f in root.filters):
        root.addFilter(RedactingFilter())
        for handler in root.handlers:
            handler.addFilter(RedactingFilter())
