from __future__ import annotations

import asyncio
import json
import os
import sys
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy.exc import SQLAlchemyError

ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "apps" / "api"
sys.path.insert(0, str(API_ROOT))

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://acceptance:acceptance@127.0.0.1:9/acceptance",
)
os.environ.setdefault("APP_ENV", "test")

from app.core.db import get_session  # noqa: E402
from app.main import app  # noqa: E402


class _FailedNestedTransaction:
    async def __aenter__(self) -> None:
        raise SQLAlchemyError("database intentionally unavailable")

    async def __aexit__(self, *_args: object) -> None:
        return None


class UnavailableSession:
    def __init__(self) -> None:
        self.added: list[Any] = []

    async def execute(self, _statement: Any) -> None:
        raise SQLAlchemyError("database intentionally unavailable")

    async def rollback(self) -> None:
        return None

    async def commit(self) -> None:
        return None

    def add(self, value: Any) -> None:
        self.added.append(value)

    def begin_nested(self) -> _FailedNestedTransaction:
        return _FailedNestedTransaction()


async def unavailable_session() -> Any:
    yield UnavailableSession()


app.dependency_overrides[get_session] = unavailable_session


Validator = Callable[[httpx.Response], None]


@dataclass(frozen=True, slots=True)
class AcceptanceCase:
    question: str
    expected: str
    method: str
    path: str
    validate: Validator
    payload: dict[str, Any] | None = None


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def validate_readiness(response: httpx.Response) -> None:
    payload = response.json()
    require(response.status_code == 200, response.text)
    require(payload["snapshot"]["songs"] == 5018, response.text)
    require(payload["snapshot_complete"] is True, response.text)


def validate_liveness(response: httpx.Response) -> None:
    require(response.status_code == 200, response.text)
    require(response.json() == {"status": "ok"}, response.text)


def validate_song_page(response: httpx.Response) -> None:
    rows = response.json()
    require(response.status_code == 200, response.text)
    require([row["number"] for row in rows] == [111, 112], response.text)


def validate_related(response: httpx.Response) -> None:
    rows = response.json()
    require(response.status_code == 200 and len(rows) > 0, response.text)
    require(all(row["number"] != 1 for row in rows), response.text)


def validate_song_111(response: httpx.Response) -> None:
    payload = response.json()
    require(response.status_code == 200, response.text)
    require(payload["number"] == 111, response.text)
    require(bool(payload["lyrics_original"]), "Song 111 lyrics are missing")
    require(bool(payload["english_meaning"]), "Song 111 meaning is missing")
    require(
        any(item["kind"] == "audio" for item in payload["media"]),
        "Song 111 verified audio is missing",
    )


def validate_song_1_meaning(response: httpx.Response) -> None:
    payload = response.json()
    require(response.status_code == 200, response.text)
    require(payload["number"] == 1, response.text)
    require("friend" in payload["english_meaning"].lower(), response.text)
    require(bool(payload["hindi_meaning"]), "Seed-enriched Hindi meaning is missing")


def validate_search_number(response: httpx.Response) -> None:
    rows = response.json()
    require(response.status_code == 200, response.text)
    require(bool(rows) and rows[0]["number"] == 111, response.text)


def validate_search_2256_is_exact(response: httpx.Response) -> None:
    rows = response.json()
    require(response.status_code == 200, response.text)
    require([row["number"] for row in rows] == [2256], response.text)


def validate_natural_language_number_intent(response: httpx.Response) -> None:
    rows = response.json()
    require(response.status_code == 200, response.text)
    require([row["number"] for row in rows] == [223], response.text)


def validate_full_name_search(response: httpx.Response) -> None:
    validate_search_number(response)
    require(response.json()[0]["is_verified"] is True, response.text)


def validate_search_song_one(response: httpx.Response) -> None:
    rows = response.json()
    require(response.status_code == 200, response.text)
    require(any(row["number"] == 1 for row in rows[:5]), response.text)


def validate_rich_video_search(response: httpx.Response) -> None:
    payload = response.json()
    require(response.status_code == 200, response.text)
    require(payload["items"][0]["song_number"] == 1, response.text)
    require(payload["items"][0]["media_summary"]["video_count"] >= 1, response.text)


def validate_recommendations(response: httpx.Response) -> None:
    rows = response.json()
    require(response.status_code == 200, response.text)
    require(len(rows) == 8, response.text)
    require(len({row["number"] for row in rows}) == 8, response.text)
    require(all(row["is_verified"] for row in rows), response.text)


def validate_shravanii_recommendations(response: httpx.Response) -> None:
    rows = response.json()
    require(response.status_code == 200, response.text)
    require([row["number"] for row in rows] == [4954], response.text)
    require(rows[0]["is_verified"] is True, response.text)


def validate_notation_source(response: httpx.Response) -> None:
    payload = response.json()
    require(response.status_code == 200, response.text)
    require(payload["song_number"] == 1, response.text)
    require(payload["verification_status"] == "verified", response.text)
    require(payload["learner_verification_status"] == "practice_draft", response.text)
    require(payload["source_url"].startswith("https://"), response.text)
    require(payload["machine_readable"] is True, response.text)
    require(payload["transposition_available"] is True, response.text)


def validate_transposed_practice_notation(response: httpx.Response) -> None:
    payload = response.json()
    require(response.status_code == 200, response.text)
    require(payload["song_number"] == 1, response.text)
    require(payload["source_scale"] == "C", response.text)
    require(payload["target_scale"] == "D", response.text)
    require(payload["verification_status"] == "practice_draft", response.text)
    require(bool(payload["notation"]["lines"]), response.text)


def validate_youtube_video(response: httpx.Response) -> None:
    rows = response.json()
    require(response.status_code == 200, response.text)
    require(len(rows) == 1, response.text)
    require(rows[0]["external_id"] == "D4LHhnSLhro", response.text)
    require(
        rows[0]["embed_url"].startswith("https://www.youtube-nocookie.com/embed/"),
        response.text,
    )
    require(rows[0]["source_status"] == "verified_community", response.text)


def validate_multiple_videos(response: httpx.Response) -> None:
    rows = response.json()
    require(response.status_code == 200, response.text)
    require(len(rows) == 2, response.text)
    require(len({row["external_id"] for row in rows}) == 2, response.text)
    require(all(row["kind"] == "video" for row in rows), response.text)


def validate_number_matched_community_audio(response: httpx.Response) -> None:
    rows = response.json()
    require(response.status_code == 200, response.text)
    require(bool(rows), "Song 1112 community audio is missing")
    require(all(row["kind"] == "audio" for row in rows), response.text)
    require(any(row["provider"] == "external_site" for row in rows), response.text)
    require(any(row["source_status"] == "community" for row in rows), response.text)
    require(any(row["rights_status"] == "link_only" for row in rows), response.text)
    require(any(row["verification_status"] == "unverified" for row in rows), response.text)


def validate_localization(response: httpx.Response) -> None:
    payload = response.json()
    require(response.status_code == 200, response.text)
    require(payload["language"] == "Hindi", response.text)
    require(bool(payload["localized_meaning"]), response.text)


def validate_bot(response: httpx.Response) -> None:
    require(response.status_code == 200, response.text)
    require("Verified song 1" in response.text, response.text)
    require("Sources:" in response.text, response.text)
    require("1:" in response.text, response.text)


def validate_missing_song(response: httpx.Response) -> None:
    require(response.status_code == 404, response.text)
    require(response.json()["detail"] == "Song not found", response.text)


def validate_inventory(response: httpx.Response) -> None:
    rows = response.json()
    require(response.status_code == 200, response.text)
    require(len(rows) == 25, response.text)
    require(all(row["url"].startswith("https://") for row in rows), response.text)


def validate_occasions(response: httpx.Response) -> None:
    rows = response.json()
    require(response.status_code == 200 and len(rows) >= 8, response.text)
    require(any(row["slug"] == "dharma-cakra" for row in rows), response.text)


def validate_festivals(response: httpx.Response) -> None:
    rows = response.json()
    require(response.status_code == 200 and len(rows) > 0, response.text)
    require(any(row["name"] == "Shravanii Purnima Day" for row in rows), response.text)
    require(all(row["source_urls"] for row in rows), response.text)


def validate_today(response: httpx.Response) -> None:
    payload = response.json()
    require(response.status_code == 200, response.text)
    require(payload["context"]["festival"] == "Bábá Birthday", response.text)
    require(len(payload["recommendations"]) == 3, response.text)
    require(all(row["is_verified"] for row in payload["recommendations"]), response.text)


def validate_reviewed_festival_today(response: httpx.Response) -> None:
    payload = response.json()
    require(response.status_code == 200, response.text)
    require(payload["context"]["festival"] == "Shrávanii Purnimá", response.text)
    require(payload["signals"][0]["title"] == "Shrávanii Purnimá", response.text)
    require(payload["signals"][0]["source_name"] == "Ananda Marga India", response.text)
    require(
        [row["number"] for row in payload["recommendations"]] == [4954],
        response.text,
    )


def validate_report(response: httpx.Response) -> None:
    payload = response.json()
    require(response.status_code == 201, response.text)
    require(payload["status"] == "received", response.text)
    require(bool(payload["report_id"]), response.text)


CASES = [
    AcceptanceCase(
        "Is the Prabhat Samgiita AI service alive?",
        "The liveness endpoint responds without touching the database.",
        "GET",
        "/api/v1/health/live",
        validate_liveness,
    ),
    AcceptanceCase(
        "Is the complete Prabhat Samgiita catalog available?",
        "Readiness reports exactly 5,018 packaged songs.",
        "GET",
        "/api/v1/health/readiness",
        validate_readiness,
    ),
    AcceptanceCase(
        "Show the catalog page containing songs 111 and 112.",
        "Bounded pagination returns exactly songs 111 and 112.",
        "GET",
        "/api/v1/songs?limit=2&offset=110",
        validate_song_page,
    ),
    AcceptanceCase(
        "Show me Prabhat Samgiita number 111.",
        "Song 111 returns verified lyrics, English meaning, and audio.",
        "GET",
        "/api/v1/songs/111",
        validate_song_111,
    ),
    AcceptanceCase(
        "What is song 1 and what does it mean?",
        "Song 1 returns its canonical text plus English and Hindi meaning.",
        "GET",
        "/api/v1/songs/1",
        validate_song_1_meaning,
    ),
    AcceptanceCase(
        "Which songs are related to song 1?",
        "Related verified songs are returned without repeating song 1.",
        "GET",
        "/api/v1/songs/1/related",
        validate_related,
    ),
    AcceptanceCase(
        "Find song number 111.",
        "Exact-number search places song 111 first.",
        "POST",
        "/api/v1/search",
        validate_search_number,
        {"query": "111"},
    ),
    AcceptanceCase(
        "Find Prabhat Samgiita 111 using the full name.",
        "Full-name exact-number search places song 111 first and marks it verified.",
        "POST",
        "/api/v1/search",
        validate_full_name_search,
        {"query": "Prabhat Samgiita 111"},
    ),
    AcceptanceCase(
        "Find exactly song 2256 without showing song 226.",
        "A numeric identifier returns only song 2256 and never a fuzzy number match.",
        "POST",
        "/api/v1/search",
        validate_search_2256_is_exact,
        {"query": "2256"},
    ),
    AcceptanceCase(
        "Explain Prabhat Samgiita 223.",
        "Natural-language song intent returns only song 223 before semantic retrieval.",
        "POST",
        "/api/v1/search",
        validate_natural_language_number_intent,
        {"query": "explain about prabhat sagiat 223"},
    ),
    AcceptanceCase(
        "I remember the line 'Bandhu He Niye Calo'. Which song is it?",
        "Opening-line search finds song 1 near the top.",
        "POST",
        "/api/v1/search",
        validate_search_song_one,
        {"query": "Bandhu He Niye Calo"},
    ),
    AcceptanceCase(
        "Find a song about the fountain of effulgence.",
        "Meaning search finds song 1 near the top.",
        "POST",
        "/api/v1/search",
        validate_search_song_one,
        {"query": "fountain of effulgence"},
    ),
    AcceptanceCase(
        "Find Bandhu He with a verified YouTube video.",
        "Rich filtered search returns song 1 with a non-zero video count.",
        "GET",
        "/api/v1/search?q=Bandhu%20He&has_video=true",
        validate_rich_video_search,
    ),
    AcceptanceCase(
        "Recommend songs for peaceful morning meditation.",
        "Eight distinct, verified songs are returned without invented metadata.",
        "POST",
        "/api/v1/recommendations",
        validate_recommendations,
        {
            "occasion": "meditation",
            "mood": "peaceful",
            "meditation_context": "morning meditation",
            "maximum_results": 8,
        },
    ),
    AcceptanceCase(
        "Recommend songs for Shravanii Purnima.",
        "Only canonical Shravanii Purnima song 4954 is returned.",
        "POST",
        "/api/v1/recommendations",
        validate_shravanii_recommendations,
        {"festival": "Shravanii Purnima", "maximum_results": 8},
    ),
    AcceptanceCase(
        "What should I listen to on Bábá's birthday in Kolkata?",
        "Today recommendations detect the reviewed fixed observance and return three songs.",
        "GET",
        "/api/v1/recommendations/today?timezone=Asia%2FKolkata&date=2026-05-21",
        validate_today,
    ),
    AcceptanceCase(
        "What should I listen to on Shrávanii Purnimá 2026?",
        "The reviewed festival is the primary sourced context for today's recommendations.",
        "GET",
        "/api/v1/recommendations/today?timezone=Asia%2FKolkata&date=2026-08-28",
        validate_reviewed_festival_today,
    ),
    AcceptanceCase(
        "Which occasions can I browse?",
        "The API lists reviewed occasion choices including Dharma Cakra.",
        "GET",
        "/api/v1/occasions",
        validate_occasions,
    ),
    AcceptanceCase(
        "Which festivals have canonically sourced song mappings?",
        "The API lists festival names, source URLs, and mapped-song counts.",
        "GET",
        "/api/v1/festivals",
        validate_festivals,
    ),
    AcceptanceCase(
        "Is official notation available for song 1?",
        "The canonical source and learner-draft statuses are reported separately.",
        "GET",
        "/api/v1/songs/1/notation/source",
        validate_notation_source,
    ),
    AcceptanceCase(
        "Transpose song 1 to D on harmonium.",
        "The OCR-derived practice draft is transposed to D and remains clearly labelled.",
        "GET",
        "/api/v1/songs/1/notation?scale=D&system=sargam",
        validate_transposed_practice_notation,
    ),
    AcceptanceCase(
        "Play the verified YouTube performance for song 1.",
        "Song 1 returns a privacy-enhanced YouTube embed from the allow-listed channel.",
        "GET",
        "/api/v1/songs/1/media?media_type=video&platform=youtube",
        validate_youtube_video,
    ),
    AcceptanceCase(
        "Play song 1112, which is absent from the official audio archive.",
        "A number-matched community link is returned with explicit trust and rights labels.",
        "GET",
        "/api/v1/songs/1112/media?media_type=audio",
        validate_number_matched_community_audio,
    ),
    AcceptanceCase(
        "Are there multiple video renditions of song 2635?",
        "Both distinct performances remain attached to canonical song number 2635.",
        "GET",
        "/api/v1/songs/2635/media?media_type=video",
        validate_multiple_videos,
    ),
    AcceptanceCase(
        "Explain song 1 in Hindi.",
        (
            "A non-empty Hindi localization contract is returned; live Azure validation "
            "checks script quality."
        ),
        "GET",
        "/api/v1/songs/1/localized?language=Hindi",
        validate_localization,
    ),
    AcceptanceCase(
        "BOT, what is the central message of song 1?",
        "The streamed response identifies song 1 and includes grounded source labels.",
        "POST",
        "/api/v1/ai/explain",
        validate_bot,
        {"song_number": 1, "prompt": "What is the central message of this song?"},
    ),
    AcceptanceCase(
        "Show song 6000.",
        "The API returns Song not found rather than inventing content.",
        "GET",
        "/api/v1/songs/6000",
        validate_missing_song,
    ),
    AcceptanceCase(
        "Show a page of verified source resources.",
        "Exactly 25 HTTPS inventory resources are returned.",
        "GET",
        "/api/v1/inventory?limit=25",
        validate_inventory,
    ),
    AcceptanceCase(
        "Report that a media link is broken.",
        "A bounded anonymous report is accepted for human review.",
        "POST",
        "/api/v1/reports",
        validate_report,
        {
            "entity_type": "media",
            "entity_id": "D4LHhnSLhro",
            "reason": "broken_media",
            "comment": "The video does not play in my region.",
        },
    ),
]


async def main() -> None:
    results: list[dict[str, Any]] = []
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://acceptance") as client:
        for case in CASES:
            response = await client.request(
                case.method,
                case.path,
                json=case.payload,
                timeout=20,
            )
            case.validate(response)
            results.append(
                {
                    "question": case.question,
                    "expected": case.expected,
                    "status": "PASS",
                    "endpoint": f"{case.method} {case.path}",
                }
            )
    print(json.dumps({"passed": len(results), "total": len(CASES), "cases": results}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
