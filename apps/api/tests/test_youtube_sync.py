from __future__ import annotations

from scripts.sync_youtube import media_row, review_row

SONGS = {1: {"number": 1, "title": "Bandhu He Niye Calo", "first_line": "Bandhu He"}}


def test_numbered_channel_video_is_published_by_song_number() -> None:
    video = {
        "video_id": "D4LHhnSLhro",
        "title": "Prabhat Samgiita No. 1 - Bandhu He Niye Calo",
    }

    row = media_row(video, SONGS)

    assert row is not None
    assert row["song_number"] == 1
    assert row["embed_url"] == "https://www.youtube-nocookie.com/embed/D4LHhnSLhro"


def test_unnumbered_upload_is_retained_for_human_review() -> None:
    video = {"video_id": "new-video", "title": "A devotional dawn melody"}

    assert media_row(video, SONGS) is None
    review = review_row(video, SONGS)
    assert review["status"] == "pending_review"
    assert review["review_reason"] == "missing_explicit_song_number"
