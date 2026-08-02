import base64
import json
from datetime import date

import pytest
from fastapi import HTTPException

from app.models import ReflectionQuote, UserInterestProfile
from app.services.members import _summary, decode_client_principal
from app.services.reflections import (
    has_book_provenance,
    reflection_context,
    select_reflection,
)


def encoded_principal(claims: list[dict[str, str]]) -> str:
    payload = {"auth_typ": "google", "claims": claims}
    return base64.b64encode(json.dumps(payload).encode()).decode()


def test_authenticated_principal_maps_to_stable_member_identity() -> None:
    principal = encoded_principal(
        [
            {"typ": "sub", "val": "stable-user-42"},
            {"typ": "name", "val": "Ananda Das"},
            {"typ": "email", "val": "ananda@example.com"},
        ]
    )

    identity = decode_client_principal(principal)

    assert identity.subject == "google:stable-user-42"
    assert identity.display_name == "Ananda Das"
    assert identity.email == "ananda@example.com"


def test_principal_without_subject_is_rejected() -> None:
    principal = encoded_principal([{"typ": "name", "val": "No Identifier"}])

    with pytest.raises(HTTPException, match="no subject"):
        decode_client_principal(principal)


def test_chat_memory_turn_accepts_long_assistant_replies() -> None:
    from app.schemas.member import ChatMemoryTurn

    turn = ChatMemoryTurn(role="assistant", content="x" * 5000)

    assert len(turn.content) == 5000


def test_recent_chat_memory_does_not_short_circuit_when_personalization_disabled() -> None:
    import inspect

    from app.services import members as members_service

    source = inspect.getsource(members_service.recent_chat_memory)
    assert "if not member.personalization_enabled:" not in source
    assert "Always restore chat turns" in source


def test_interest_summary_is_compact_and_long_lived() -> None:
    profile = UserInterestProfile(
        topic_counts={"meaning": 5, "translation": 3, "practice": 1},
        song_counts={"135": 4, "1": 2},
        language_counts={"Hindi/Devanagari": 5, "Roman/English": 2},
    )

    summary = _summary(profile)

    assert "meaning" in summary
    assert "songs 135, 1" in summary
    assert "Hindi/Devanagari" in summary
    assert len(summary) < 240


def quote(
    text: str,
    source: str = "Ánanda Sútram",
    *,
    observances: list[str] | None = None,
    themes: list[str] | None = None,
    status: str = "source_verified",
) -> ReflectionQuote:
    return ReflectionQuote(
        quote_text=text,
        attribution="Shrii Shrii Anandamurti ji",
        source_title=source,
        source_url=f"https://example.test/{source}",
        themes={"values": themes or []},
        observances={"values": observances or []},
        verification_status=status,
        is_active=True,
    )


def test_independence_day_reflection_prefers_exact_reviewed_context() -> None:
    daily = quote("Daily", themes=["meditation"])
    social = quote(
        "Social justice",
        "Prout in a Nutshell",
        observances=["independence-day-india"],
    )

    selected, label = select_reflection([daily, social], date(2026, 8, 15))

    assert selected is social
    assert label == "India Independence Day"


def test_unverified_reflection_never_enters_rotation() -> None:
    verified = quote("Verified")
    pending = quote("Pending", observances=["new-year"], status="pending")

    selected, _ = select_reflection([pending, verified], date(2026, 1, 1))

    assert selected is verified


def test_generic_web_article_never_enters_reflection_rotation() -> None:
    book = quote("Book source")
    article = quote("Article source", "Meditation", observances=["new-year"])

    selected, _ = select_reflection([article, book], date(2026, 1, 1))

    assert selected is book
    assert has_book_provenance("Ánanda Vacanámrtam Part 12") is True
    assert has_book_provenance("Meditation") is False


def test_reflection_context_is_stable_for_ordinary_day() -> None:
    assert reflection_context(date(2026, 8, 2)) == (
        "daily-practice",
        "Daily spiritual reflection",
    )
