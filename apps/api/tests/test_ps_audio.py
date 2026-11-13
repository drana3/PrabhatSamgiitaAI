"""The colleagues' PS recordings: planned rows, signed-link route, ranking (docs/ps-audio.md)."""

from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")
os.environ.setdefault("APP_ENV", "test")

import httpx
import pytest
from fastapi import FastAPI

from app.api.v1 import ps_audio as route
from app.config import Settings, get_settings
from app.models.media import Media
from app.services import ps_audio
from app.services.media_quality import merge_media, preferred_audio_url, to_media_item_response
from app.services.ps_audio_import import PERFORMER, plan_rows

ROOT = Path(__file__).resolve().parents[3]
API = "https://api.example.org"


def make_settings(**values: object) -> Settings:
    return Settings.model_validate({key.upper(): value for key, value in values.items()})


@pytest.fixture(scope="module")
def audio() -> dict:
    return json.loads((ROOT / "data/curated/ps_colleagues/audio.json").read_text("utf-8"))


@pytest.fixture(scope="module")
def titles() -> dict[int, str]:
    rows = json.loads((ROOT / "data/generated/songs.json").read_text("utf-8"))
    return {int(r["number"]): r["title"] for r in rows}


def test_plan_has_one_row_per_recording_with_the_song_title(
    audio: dict, titles: dict[int, str]
) -> None:
    rows, problems = plan_rows(audio, titles, api_base_url=API, bucket="am-site-books-private")
    assert problems == []
    assert len(rows) == 69
    assert len({r.url for r in rows}) == 69
    first = next(r for r in rows if r.song_number == 1)
    assert first.title == "BANDHU HE NIYE CALO"
    assert first.url == f"{API}/api/v1/ps-audio/1%20Bandhu%20He%20Niye%20Calo.m4a"
    meta = first.row.metadata_json
    assert meta["performer"] == PERFORMER == "Gunavati"
    assert meta["r2_key"] == "audio-extractor/ps-audio/1 Bandhu He Niye Calo.m4a"
    assert first.row.provider == "ps_colleagues"
    assert first.row.verification_status == "verified"
    # no Cyrillic in any title: the English (romanised) title of the song as the catalogue has it
    assert not any("Ѐ" <= ch <= "ӿ" for r in rows for ch in r.title)


def test_a_missing_song_or_odd_file_name_is_left_out_and_reported(audio: dict) -> None:
    rows, problems = plan_rows(audio, {1: "BANDHU HE NIYE CALO"}, api_base_url=API, bucket="b")
    assert [r.song_number for r in rows] == [1]
    assert len(problems) == 68
    odd = {
        "songs": {
            "1": {
                "recordings": [
                    {
                        "file_name": "../1 x.m4a",
                        "r2_key": "audio-extractor/ps-audio/../1 x.m4a",
                        "status": "uploaded",
                    }
                ]
            }
        }
    }
    rows, problems = plan_rows(odd, {1: "T"}, api_base_url=API, bucket="b")
    assert rows == [] and "unexpected file name" in problems[0]


def test_colleague_recording_is_the_default_and_listed_first(
    audio: dict, titles: dict[int, str]
) -> None:
    rows, _ = plan_rows(audio, titles, api_base_url=API, bucket="b")
    ours = next(r.row for r in rows if r.song_number == 1)
    official = Media(
        song_number=1,
        kind="audio",
        provider="official",
        title="BANDHU HE NIYE CALO",
        url="https://prabhatasamgiita.net/1-999/1%20BANDHU%20HE%20NIYE%20CALO.mp3",
        verification_status="verified",
    )
    old = Media(
        song_number=1,
        kind="audio",
        provider="official",
        title="BANDHU HE NIYE CALO",
        url="https://prabhatasamgiita.net/1-999/1%20BANDHU%20HE%20NIYE%20CALO%20%28old%20version%29.mp3",
        verification_status="verified",
        metadata_json={"version": "old"},
    )
    merged = merge_media([official, old], [ours])
    assert merged[0] is ours
    assert preferred_audio_url(merged) == ours.url
    response = to_media_item_response(ours, latest_url=ours.url)
    assert response.performer == "Gunavati"
    assert response.is_latest is True
    assert to_media_item_response(official).performer is None


def test_file_name_rules() -> None:
    assert ps_audio.ps_audio_file_ok("1 Bandhu He Niye Calo.m4a")
    assert ps_audio.ps_audio_file_ok("68 I Love This Tiny Green Island.m4a")
    for bad in ("../x.m4a", "1 a/b.m4a", "1 a..b.m4a", "x.m4a", "1 a.exe", "1 a.m4a\n"):
        assert not ps_audio.ps_audio_file_ok(bad), bad


# --------------------------------------------------------------------------- the route

FILE = "1 Bandhu He Niye Calo.m4a"
CONFIGURED = dict(
    ps_audio_s3_bucket="am-site-books-private",
    recording_s3_endpoint="https://acct.r2.cloudflarestorage.com",
    recording_s3_access_key_id="KEYID",
    recording_s3_secret_access_key="SECRET",
)


def registered_media() -> dict[int, tuple[Media, ...]]:
    return {
        1: (
            Media(
                song_number=1,
                kind="audio",
                provider="ps_colleagues",
                title="T",
                url="u",
                metadata_json={"r2_key": ps_audio.ps_audio_key(FILE)},
            ),
        )
    }


def client(monkeypatch: pytest.MonkeyPatch, **settings: object) -> httpx.AsyncClient:
    app = FastAPI()
    app.include_router(route.router, prefix="/api/v1")
    app.dependency_overrides[get_settings] = lambda: make_settings(**settings)
    monkeypatch.setattr(route, "media_by_song_number", registered_media)
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_route_redirects_to_a_short_lived_signed_link(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with client(monkeypatch, **CONFIGURED) as http:
        response = await http.get(f"/api/v1/ps-audio/{FILE}", follow_redirects=False)
    assert response.status_code == 302
    target = urlsplit(response.headers["location"])
    assert target.netloc == "acct.r2.cloudflarestorage.com"
    assert (
        target.path
        == "/am-site-books-private/audio-extractor/ps-audio/1%20Bandhu%20He%20Niye%20Calo.m4a"
    )
    query = parse_qs(target.query)
    assert query["X-Amz-Expires"] == ["3600"]
    assert "X-Amz-Signature" in query
    assert "SECRET" not in response.headers["location"]


@pytest.mark.asyncio
async def test_head_is_signed_as_head(monkeypatch: pytest.MonkeyPatch) -> None:
    async with client(monkeypatch, **CONFIGURED) as http:
        get = await http.get(f"/api/v1/ps-audio/{FILE}", follow_redirects=False)
        head = await http.head(f"/api/v1/ps-audio/{FILE}", follow_redirects=False)
    assert head.status_code == 302
    sig = lambda r: parse_qs(urlsplit(r.headers["location"]).query)["X-Amz-Signature"]  # noqa: E731
    assert sig(get) != sig(head)


@pytest.mark.asyncio
async def test_unknown_or_unregistered_files_are_404(monkeypatch: pytest.MonkeyPatch) -> None:
    async with client(monkeypatch, **CONFIGURED) as http:
        for name in (
            "2 Not In The Catalogue.m4a",
            "1 Bandhu He Niye Calo.exe",
            "..%2Fsecret.m4a",
            "books.pdf",
        ):
            response = await http.get(f"/api/v1/ps-audio/{name}", follow_redirects=False)
            assert response.status_code == 404, name


@pytest.mark.asyncio
async def test_without_bucket_keys_the_route_says_503(monkeypatch: pytest.MonkeyPatch) -> None:
    async with client(monkeypatch) as http:
        response = await http.get(f"/api/v1/ps-audio/{FILE}", follow_redirects=False)
    assert response.status_code == 503
