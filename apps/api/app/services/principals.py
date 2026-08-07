from __future__ import annotations

import base64
import json

from app.models import UserAccount

NAME_CLAIMS = (
    "name",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
    "http://schemas.microsoft.com/identity/claims/displayname",
)
EMAIL_CLAIMS = (
    "email",
    "preferred_username",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
)
SUBJECT_CLAIMS = (
    "sub",
    "oid",
    "nameidentifier",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
    "http://schemas.microsoft.com/identity/claims/objectidentifier",
)


def raw_subject_for_member(member: UserAccount) -> str:
    prefix = f"{member.identity_provider}:"
    subject = member.external_subject
    if subject.casefold().startswith(prefix.casefold()):
        return subject[len(prefix) :]
    return subject


def build_client_principal(
    provider: str,
    subject: str,
    display_name: str | None = None,
    email: str | None = None,
) -> str:
    claims: list[dict[str, str]] = [
        {
            "typ": "http://schemas.microsoft.com/identity/claims/objectidentifier",
            "val": subject,
        },
        {
            "typ": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
            "val": subject,
        },
        {"typ": "sub", "val": subject},
    ]
    if display_name:
        claims.append({"typ": "name", "val": display_name[:255]})
        claims.append(
            {
                "typ": "http://schemas.microsoft.com/identity/claims/displayname",
                "val": display_name[:255],
            }
        )
    if email:
        normalized = email.strip()[:320]
        claims.append({"typ": "email", "val": normalized})
        claims.append({"typ": "preferred_username", "val": normalized})
        claims.append(
            {
                "typ": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
                "val": normalized,
            }
        )
    payload = {"auth_typ": provider, "claims": claims}
    return base64.b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")).decode(
        "utf-8"
    )


def principal_for_member(member: UserAccount) -> str:
    return build_client_principal(
        member.identity_provider,
        raw_subject_for_member(member),
        member.display_name,
        member.email,
    )
