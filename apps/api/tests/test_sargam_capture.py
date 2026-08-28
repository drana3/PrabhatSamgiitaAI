from app.services.sargam_capture import (
    PROTECTED_BOOKLET_SONGS,
    apply_take,
    booklet_sargam_from_events,
    can_submit_lines,
    confirm_line,
    is_learner_playable_notation,
    is_notation_enabled,
    retake_line,
    sargam_attribution_payload,
    split_lyric_lines,
)


def test_split_lyric_lines_prefers_newlines() -> None:
    assert split_lyric_lines("Bandhu he niye calo\nAlor oi jharana") == [
        "Bandhu he niye calo",
        "Alor oi jharana",
    ]


def test_confirm_retake_and_submit_rules() -> None:
    events = [{"sargam": "S", "western": "C4", "startSec": 0, "durationSec": 0.6}]
    lines = [
        {"line_number": 1, "lyric": "Line one", "status": "empty", "events": []},
        {"line_number": 2, "lyric": "Line two", "status": "empty", "events": []},
    ]
    recorded = apply_take(lines, 1, events)
    assert recorded[0]["status"] == "recorded"
    assert "Sa" in (recorded[0]["sargam"] or "")
    confirmed = confirm_line(recorded, 1)
    assert confirmed[0]["status"] == "confirmed"
    assert can_submit_lines(confirmed) is False

    reset = retake_line(confirmed, 1)
    assert reset[0]["status"] == "empty"
    assert reset[0]["events"] == []

    both = confirm_line(apply_take(reset, 1, events), 1)
    both = confirm_line(apply_take(both, 2, events), 2)
    assert can_submit_lines(both) is True


def test_cannot_overwrite_confirmed_line() -> None:
    events = [{"sargam": "S", "western": "C4", "startSec": 0, "durationSec": 0.6}]
    lines = [{"line_number": 1, "lyric": "Line", "status": "confirmed", "events": events}]
    try:
        apply_take(lines, 1, events)
        raise AssertionError("expected ValueError")
    except ValueError as exc:
        assert "confirmed" in str(exc)


def test_booklet_songs_are_locked() -> None:
    assert PROTECTED_BOOKLET_SONGS == frozenset({1, 2, 27})


def test_learner_playable_notation_gates() -> None:
    json_text = '{"version":1,"source_scale":"C","lines":[]}'
    assert is_learner_playable_notation(1, "practice_draft", json_text) is True
    assert is_learner_playable_notation(5, "practice_draft", json_text) is False
    assert is_learner_playable_notation(5, "admin_submitted", json_text) is True
    assert is_learner_playable_notation(4961, "expert_verified", json_text) is True
    assert is_learner_playable_notation(5, "admin_submitted", "") is False
    assert is_notation_enabled(None) is True
    assert is_notation_enabled({"learner_visible": False}) is False
    hidden = {"learner_visible": False}
    assert is_learner_playable_notation(5, "admin_submitted", json_text, hidden) is False
    assert is_learner_playable_notation(1, "verified", json_text, hidden) is False


def test_attribution_only_after_submit() -> None:
    meta = {"submitted_by_display_name": "Ada", "submitted_at": "2026-08-28T00:00:00+00:00"}
    assert sargam_attribution_payload(meta, "admin_draft") is None
    payload = sargam_attribution_payload(meta, "admin_submitted")
    assert payload == {"display_name": "Ada", "submitted_at": "2026-08-28T00:00:00+00:00"}


def test_booklet_sargam_uses_tempo_beats() -> None:
    events = [{"sargam": "S", "western": "C4", "startSec": 0, "durationSec": 1.2}]
    line = booklet_sargam_from_events(events, tempo_bpm=100)
    assert line.startswith("Sa")
