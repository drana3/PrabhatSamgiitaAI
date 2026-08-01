from __future__ import annotations

import json
import re
import sys
import time
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def request(
    base_url: str,
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 35,
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
            {key.lower(): value for key, value in exc.headers.items()},
            exc.read(),
            time.monotonic() - started,
        )


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


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

    status, _, body, elapsed = request(base_url, "GET", "/api/v1/health/readiness")
    ready = json.loads(body)
    require(status == 200, body.decode(errors="replace"))
    require(ready["snapshot"]["songs"] == 5018, str(ready))
    require(ready["database"]["songs"] == 5018, str(ready))
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

    status, _, body, elapsed = request(base_url, "GET", "/api/v1/songs/111")
    song = json.loads(body)
    require(status == 200 and song["number"] == 111, body.decode(errors="replace"))
    require(bool(song["lyrics_original"] and song["english_meaning"]), str(song))
    audio = next((item for item in song["media"] if item["kind"] == "audio"), None)
    require(audio is not None, str(song["media"]))
    if audio is None:
        raise AssertionError("Song 111 audio is missing")
    record("Show song 111.", "Lyrics, meaning, and audio", elapsed)

    status, _, body, elapsed = request(
        base_url,
        "POST",
        "/api/v1/search",
        {"query": "111"},
    )
    rows = json.loads(body)
    require(status == 200 and rows and rows[0]["number"] == 111, body.decode())
    record("Find song 111.", "Song 111 first", elapsed)

    status, _, body, elapsed = request(
        base_url,
        "POST",
        "/api/v1/search",
        {"query": "fountain of effulgence"},
    )
    rows = json.loads(body)
    require(status == 200 and any(row["number"] == 1 for row in rows[:5]), body.decode())
    record("Find a song about the fountain of effulgence.", "Song 1 near the top", elapsed)

    status, _, body, elapsed = request(
        base_url,
        "POST",
        "/api/v1/recommendations",
        {"festival": "Shravanii Purnima", "maximum_results": 8},
    )
    rows = json.loads(body)
    require(status == 200 and rows[0]["number"] == 4954, body.decode())
    record("Recommend for Shravanii Purnima.", "Canonical song 4954 first", elapsed)

    status, _, body, elapsed = request(
        base_url,
        "GET",
        "/api/v1/songs/1/localized?language=Hindi",
    )
    localized = json.loads(body)
    localized_text = " ".join(
        str(localized.get(key) or "")
        for key in ("localized_title", "localized_meaning", "localized_explanation")
    )
    require(
        status == 200 and bool(re.search(r"[\u0900-\u097f]", localized_text)),
        str(localized),
    )
    record("Explain song 1 in Hindi.", "Grounded Devanagari localization", elapsed)

    status, _, body, elapsed = request(
        base_url,
        "POST",
        "/api/v1/ai/explain",
        {"song_number": 1, "prompt": "What is the central message of this song?"},
    )
    explanation = body.decode(errors="replace")
    require(status == 200 and "Sources:" in explanation and "1:" in explanation, explanation)
    require("Mock grounded" not in explanation, explanation)
    record("BOT, what is song 1's central message?", "Real grounded streamed answer", elapsed)

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

    status, headers, _, elapsed = request(
        base_url,
        "OPTIONS",
        "/api/v1/search",
        headers={
            "Origin": "https://prabhatai-web.bluemeadow-9418d5fc.centralindia.azurecontainerapps.io",
            "Access-Control-Request-Method": "POST",
        },
    )
    require(status == 200 and headers.get("access-control-allow-origin") == "*", str(headers))
    record("Can the web app call the API?", "CORS preflight succeeds", elapsed)

    print(json.dumps({"passed": len(results), "total": len(results), "cases": results}, indent=2))


if __name__ == "__main__":
    main()
