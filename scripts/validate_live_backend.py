from __future__ import annotations

import json
import re
import sys
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

RETRY_STATUSES = {0, 502, 503, 504}


def request(
    base_url: str,
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 60,
) -> tuple[int, dict[str, str], bytes, float]:
    body = json.dumps(payload).encode() if payload is not None else None
    request_headers = {"Accept": "application/json", **(headers or {})}
    if body is not None:
        request_headers["Content-Type"] = "application/json"
    started = time.monotonic()
    req = Request(
        f"{base_url.rstrip('/')}{path}",
        data=body,
        headers=request_headers,
        method=method,
    )
    try:
        with urlopen(req, timeout=timeout) as response:
            return (
                response.status,
                {key.lower(): value for key, value in response.headers.items()},
                response.read(),
                time.monotonic() - started,
            )
    except HTTPError as exc:
        return (
            exc.code,
            {key.lower(): value for key, value in (exc.headers.items() if exc.headers else [])},
            exc.read() if exc.fp is not None else b"",
            time.monotonic() - started,
        )
    except (URLError, TimeoutError, OSError) as exc:
        return (
            0,
            {},
            f"network error: {exc}".encode(),
            time.monotonic() - started,
        )


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def parse_json(body: bytes, *, status: int, path: str) -> Any:
    if not body.strip():
        raise AssertionError(f"{path} returned empty body (HTTP {status})")
    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        preview = body[:240].decode(errors="replace")
        raise AssertionError(
            f"{path} returned non-JSON (HTTP {status}): {preview!r}"
        ) from exc


def request_json(
    base_url: str,
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 60,
    attempts: int = 6,
    sleep_seconds: float = 8,
) -> tuple[int, dict[str, str], Any, float]:
    """Retry through Container Apps warm-up empties / 502-504 / transient network errors."""
    last_error = "request failed"
    total_elapsed = 0.0
    for attempt in range(1, attempts + 1):
        status, response_headers, body, elapsed = request(
            base_url,
            method,
            path,
            payload=payload,
            headers=headers,
            timeout=timeout,
        )
        total_elapsed += elapsed
        if status in RETRY_STATUSES or not body.strip():
            preview = body[:160].decode(errors="replace")
            last_error = (
                f"{path} attempt {attempt}/{attempts}: HTTP {status}, "
                f"body={preview!r}"
            )
            if attempt < attempts:
                time.sleep(sleep_seconds)
            continue
        try:
            parsed = parse_json(body, status=status, path=path)
            return status, response_headers, parsed, total_elapsed
        except AssertionError as exc:
            last_error = str(exc)
            if attempt < attempts:
                time.sleep(sleep_seconds)
            continue
    raise AssertionError(last_error)


def request_ready(
    base_url: str,
    attempts: int = 8,
    timeout: int = 120,
) -> tuple[int, dict[str, str], Any, float]:
    return request_json(
        base_url,
        "GET",
        "/api/v1/health/readiness",
        timeout=timeout,
        attempts=attempts,
        sleep_seconds=5,
    )


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: validate_live_backend.py https://api-host")
    base_url = sys.argv[1]
    results: list[dict[str, Any]] = []

    def record(question: str, expected: str, elapsed: float) -> None:
        results.append(
            {
                "question": question,
                "expected": expected,
                "status": "PASS",
                "seconds": round(elapsed, 3),
            }
        )

    status, _, ready, elapsed = request_ready(base_url)
    require(status == 200, str(ready))
    require(ready["snapshot"]["songs"] == 5018, str(ready))
    require(ready["database"]["songs"] == 5018, str(ready))
    require(ready["database"]["media"] >= 10570, str(ready))
    # Notation PDFs in git are ~1,098; do not use a round 1,100 floor.
    require(ready["snapshot"]["notations"] >= 1000, str(ready))
    require(
        ready["database"]["notations"] >= ready["snapshot"]["notations"],
        str(ready),
    )
    require(ready["database"]["inventory"] >= 17644, str(ready))
    require(ready["rag_chunks_ready"] is True, str(ready))
    require(ready["database"]["rag_chunks"] > 5018, str(ready))
    require(
        ready["database"]["embedded_chunks"] == ready["database"]["rag_chunks"],
        str(ready),
    )
    require(ready["embedding_progress"] >= 1, str(ready))
    record(
        "Is the complete catalog and RAG index live?",
        "5,018 DB songs and every canonical chunk embedded",
        elapsed,
    )

    status, _, song, elapsed = request_json(base_url, "GET", "/api/v1/songs/111")
    require(status == 200 and song["number"] == 111, str(song))
    require(bool(song["lyrics_original"] and song["english_meaning"]), str(song))
    audio = next((item for item in song["media"] if item["kind"] == "audio"), None)
    require(audio is not None, str(song["media"]))
    if audio is None:
        raise AssertionError("Song 111 audio is missing")
    record("Show song 111.", "Lyrics, meaning, and audio", elapsed)

    status, _, gap_audio, elapsed = request_json(
        base_url,
        "GET",
        "/api/v1/songs/1112/media?media_type=audio",
    )
    require(
        status == 200
        and any(
            item["provider"] == "external_site"
            and item["source_status"] == "community"
            and item["verification_status"] == "unverified"
            for item in gap_audio
        ),
        str(gap_audio),
    )
    record(
        "Can a song missing from the official audio archive still be heard?",
        "Number-matched community audio is clearly labelled and linked without re-hosting",
        elapsed,
    )

    status, _, videos, elapsed = request_json(
        base_url,
        "GET",
        "/api/v1/songs/1/media?media_type=video&platform=youtube",
    )
    require(status == 200 and len(videos) == 1, str(videos))
    require(videos[0]["external_id"] == "D4LHhnSLhro", str(videos))
    require(
        videos[0]["embed_url"].startswith("https://www.youtube-nocookie.com/embed/"),
        str(videos),
    )
    record("Can I watch song 1 without re-hosting video?", "Allow-listed YouTube embed", elapsed)

    status, _, rows, elapsed = request_json(
        base_url,
        "POST",
        "/api/v1/search",
        {"query": "111"},
        timeout=90,
    )
    require(status == 200 and rows and rows[0]["number"] == 111, str(rows))
    record("Find song 111.", "Song 111 first", elapsed)

    status, _, rows, elapsed = request_json(
        base_url,
        "POST",
        "/api/v1/search",
        {"query": "fountain of effulgence"},
        timeout=90,
    )
    require(status == 200 and any(row["number"] == 1 for row in rows[:5]), str(rows))
    record("Find a song about the fountain of effulgence.", "Song 1 near the top", elapsed)

    status, _, rows, elapsed = request_json(
        base_url,
        "POST",
        "/api/v1/recommendations",
        {"festival": "Shravanii Purnima", "maximum_results": 8},
        timeout=90,
    )
    require(status == 200 and rows[0]["number"] == 4954, str(rows))
    record("Recommend for Shravanii Purnima.", "Canonical song 4954 first", elapsed)

    status, _, today, elapsed = request_json(
        base_url,
        "GET",
        "/api/v1/recommendations/today?timezone=Asia%2FKolkata&date=2026-05-21",
        timeout=90,
    )
    require(status == 200 and today["context"]["festival"] == "Bábá Birthday", str(today))
    require(len(today["recommendations"]) == 3, str(today))
    record("What fits Bábá's birthday?", "Reviewed Today context and three songs", elapsed)

    status, _, festivals, elapsed = request_json(base_url, "GET", "/api/v1/festivals")
    require(
        status == 200
        and any(item["name"] == "Shravanii Purnima Day" for item in festivals),
        str(festivals),
    )
    record("Which festivals have sourced mappings?", "Canonical provenance list", elapsed)

    status, _, localized, elapsed = request_json(
        base_url,
        "GET",
        "/api/v1/songs/1/localized?language=Hindi",
        timeout=120,
    )
    localized_text = " ".join(
        str(localized.get(key) or "")
        for key in ("localized_title", "localized_meaning", "localized_explanation")
    )
    require(
        status == 200 and bool(re.search(r"[\u0900-\u097f]", localized_text)),
        str(localized),
    )
    record("Explain song 1 in Hindi.", "Grounded Devanagari localization", elapsed)

    # Use a prompt the structured-answer shortcut does not intercept, so this
    # check still exercises live Azure OpenAI + RAG grounding.
    rag_prompt = (
        "Compose a short dawn-practice reflection for a seeker beginning with "
        "this composition. Keep it grounded in the selected song."
    )
    status, _, body, elapsed = request(
        base_url,
        "POST",
        "/api/v1/ai/explain",
        {"song_number": 1, "prompt": rag_prompt},
        timeout=120,
    )
    explanation = body.decode(errors="replace")
    if status in RETRY_STATUSES or not explanation.strip():
        for _attempt in range(5):
            time.sleep(8)
            status, _, body, extra = request(
                base_url,
                "POST",
                "/api/v1/ai/explain",
                {"song_number": 1, "prompt": rag_prompt},
                timeout=120,
            )
            elapsed += extra
            explanation = body.decode(errors="replace")
            if status == 200 and explanation.strip():
                break
    require(status == 200, explanation or f"empty AI response (HTTP {status})")
    require("Mock grounded" not in explanation, explanation)
    require(
        "expresses the following grounded meaning" not in explanation,
        "Structured overview shortcut answered a prompt that should use RAG",
    )
    require(
        re.search(r"\b(?:1|BANDHU|Friend|dawn|effulgence)\b", explanation, re.IGNORECASE)
        is not None
        or "[1]" in explanation,
        explanation,
    )
    require(len(explanation.strip()) > 80, explanation)
    record("BOT, dawn-practice reflection for song 1?", "Real grounded streamed answer", elapsed)

    audio_started = time.monotonic()
    audio_request = Request(audio["url"], headers={"Range": "bytes=0-1023"})
    with urlopen(audio_request, timeout=30) as response:
        sample = response.read(1024)
        require(response.status in {200, 206} and bool(sample), "Audio source returned no data")
    record(
        "Can I listen to song 111?",
        "Official audio bytes are reachable",
        time.monotonic() - audio_started,
    )

    web_origin = "https://prabhatai-web.bluemeadow-9418d5fc.centralindia.azurecontainerapps.io"
    status, headers, _, elapsed = request(
        base_url,
        "OPTIONS",
        "/api/v1/search",
        headers={
            "Origin": web_origin,
            "Access-Control-Request-Method": "POST",
        },
    )
    require(
        status == 200 and headers.get("access-control-allow-origin") == web_origin,
        str(headers),
    )
    record("Can the web app call the API?", "CORS preflight succeeds", elapsed)

    print(json.dumps({"passed": len(results), "total": len(results), "cases": results}, indent=2))


if __name__ == "__main__":
    main()
