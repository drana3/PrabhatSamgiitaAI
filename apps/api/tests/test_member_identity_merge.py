from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.models import UserAccount
from app.services.members import _account_preference, _subject_rank


def test_oid_subject_ranks_above_email_and_preview_forks() -> None:
    assert _subject_rank("aad:11111111-2222-3333-4444-555555555555") > _subject_rank(
        "aad:member@example.com"
    )
    assert _subject_rank("aad:11111111-2222-3333-4444-555555555555") > _subject_rank(
        "aad:preview:member@example.com"
    )


def test_admin_website_account_preferred_over_newer_mobile_uuid_fork() -> None:
    older = datetime.now(UTC) - timedelta(days=30)
    newer = datetime.now(UTC)
    website = UserAccount(
        id=uuid4(),
        external_subject="aad:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        identity_provider="aad",
        email="owner@example.com",
        display_name="Owner",
        created_at=older,
        last_seen_at=older,
        is_admin=True,
    )
    mobile_fork = UserAccount(
        id=uuid4(),
        external_subject="aad:ffffffff-0000-1111-2222-333333333333",
        identity_provider="aad",
        email="owner@example.com",
        display_name="Owner",
        created_at=newer,
        last_seen_at=newer,
        is_admin=False,
    )
    assert _account_preference(website) < _account_preference(mobile_fork)
