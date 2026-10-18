from __future__ import annotations

import logging
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)


def acs_email_configured() -> bool:
    settings = get_settings()
    return bool(
        settings.acs_email_enabled
        and settings.acs_email_connection_string
        and settings.acs_email_from
    )


def send_transactional_email(
    *,
    to_address: str,
    subject: str,
    plain_text: str,
    html_body: str | None = None,
) -> bool:
    """Send via Azure Communication Services Email. Returns False when ACS is not configured."""
    settings = get_settings()
    if not acs_email_configured():
        logger.info(
            "ACS email not configured; would send to %s subject=%s",
            to_address,
            subject,
        )
        return False

    try:
        from azure.communication.email import EmailClient
    except ImportError:
        logger.warning("azure-communication-email package is not installed")
        return False

    message: dict[str, Any] = {
        "senderAddress": settings.acs_email_from,
        "recipients": {"to": [{"address": to_address}]},
        "content": {
            "subject": subject,
            "plainText": plain_text,
        },
    }
    if html_body:
        message["content"]["html"] = html_body

    client = EmailClient.from_connection_string(settings.acs_email_connection_string or "")
    poller = client.begin_send(message)
    result = poller.result()
    message_id = getattr(result, "message_id", None) or getattr(result, "id", None)
    logger.info("ACS email queued to %s id=%s", to_address, message_id)
    return True
