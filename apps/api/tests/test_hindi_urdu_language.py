"""Hindi/Urdu collection language verification."""

from __future__ import annotations

from app.services.hindi_urdu_language import (
    partition_collections_from_verification,
    verify_all_hindi_urdu,
)


def test_hindi_urdu_verification_is_disjoint_and_covers_catalog() -> None:
    verified = verify_all_hindi_urdu()
    hindi, urdu = partition_collections_from_verification(verified)
    assert len(verified) == 20
    assert set(hindi) | set(urdu) == {row.song_number for row in verified}
    assert set(hindi).isdisjoint(urdu)


def test_hindi_urdu_verification_expected_partition() -> None:
    verified = verify_all_hindi_urdu()
    hindi, urdu = partition_collections_from_verification(verified)
    assert hindi == [4062, 4070, 4195, 4512, 4733, 4979]
    assert urdu == [
        25,
        4072,
        4078,
        4135,
        4165,
        4166,
        4167,
        4168,
        4170,
        4171,
        4172,
        4283,
        4327,
        4335,
    ]


def test_dual_index_song_25_uses_category_not_hitl_when_clear() -> None:
    verified = {row.song_number: row for row in verify_all_hindi_urdu()}
    row = verified[25]
    assert row.primary == "urdu"
    assert any("Urdu before Hindi" in reason for reason in row.reasons)