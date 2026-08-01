from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.sync_psplayer import parse_index  # noqa: E402


def test_psplayer_connector_matches_by_card_number() -> None:
    html = """
    <article class="song-card" data-number="0001">
      <h2 class="song-card__title"><a>Bandhu he niye calo</a></h2>
      <button data-audio-url="https://sarkarverse.org/PS/1-999-f/song1.mp3"></button>
    </article>
    """
    rows = parse_index(html, {1: {"number": 1, "title": "Bandhu He Niye Calo"}})
    assert len(rows) == 1
    assert rows[0]["song_number"] == 1
    assert rows[0]["verification_status"] == "unverified"
    assert rows[0]["metadata_json"]["rights_status"] == "link_only"


def test_psplayer_connector_rejects_unlisted_audio_host() -> None:
    html = """
    <article class="song-card" data-number="0001">
      <h2 class="song-card__title"><a>Bandhu he niye calo</a></h2>
      <button data-audio-url="https://example.com/song1.mp3"></button>
    </article>
    """
    assert parse_index(html, {1: {"number": 1, "title": "Bandhu He Niye Calo"}}) == []
