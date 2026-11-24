import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import asyncio

from app.api.v1 import ai as ai_module
from app.models.song import Song
from app.schemas.song import ExplanationRequest
from app.services.explain_song import resolve_explain_song_number


def test_resolve_explain_song_number_catalog_when_unspecified() -> None:
    assert resolve_explain_song_number(None, "Suggest a morning devotion song") is None
    assert resolve_explain_song_number(None, "What is song 42 about?") == 42
    assert resolve_explain_song_number(10, None) == 10
    assert resolve_explain_song_number(88, "Suggest a morning devotion song") is None
    assert resolve_explain_song_number(88, "Recommend related songs") == 88
    assert resolve_explain_song_number(88, "What is this song about?") == 88


def test_companion_catalog_fallback_morning() -> None:
    from app.services.structured_answers import companion_catalog_fallback_songs

    songs = companion_catalog_fallback_songs("Suggest a morning devotion song", limit=6)
    assert len(songs) >= 3
    assert songs[0].number >= 1


def test_catalog_structured_answer_lists_multiple_songs() -> None:
    from app.services.structured_answers import try_catalog_structured_answer

    songs = [
        Song(id=1, number=1, title="BANDHU HE NIYE CALO", theme="Devotion"),
        Song(id=2, number=6, title="BANDHU AMAR", theme="Devotion"),
        Song(id=3, number=100, title="KAMALA", theme="Nature"),
    ]
    answer = try_catalog_structured_answer("Suggest a morning devotion song", songs)
    assert answer
    assert "Song 1" in answer
    assert "Song 6" in answer


def test_catalog_explain_uses_direct_answer_without_song_number(monkeypatch) -> None:
    catalog_called = {"search": False}

    class FakeCatalog:
        async def get_song(self, _number: int) -> Song | None:
            return None

        async def search(self, _query: str, limit: int = 20) -> list[Song]:
            catalog_called["search"] = True
            return [
                Song(
                    id=1,
                    number=100,
                    title="Morning song",
                    theme="Devotion",
                )
            ]

    monkeypatch.setattr(ai_module, "CatalogService", lambda _session: FakeCatalog())
    monkeypatch.setattr(ai_module, "try_member_identity", lambda _request: None)
    monkeypatch.setattr(ai_module, "require_public_quota", lambda *_args, **_kwargs: None)
    async def fake_lookup(*_args, **_kwargs):
        return None

    monkeypatch.setattr(ai_module, "lookup_preferred_language", fake_lookup)

    async def fake_cache_get(_key: str) -> None:
        return None

    async def fake_cache_set(_key: str, _value: list[str]) -> None:
        return None

    monkeypatch.setattr(ai_module.explanation_cache, "get", fake_cache_get)
    monkeypatch.setattr(ai_module.explanation_cache, "set", fake_cache_set)

    class FakeRequest:
        client = type("Client", (), {"host": "203.0.113.10"})()
        headers = type("Headers", (), {"get": lambda _self, _key: None})()

    async def run() -> bytes:
        response = await ai_module.explain(
            ExplanationRequest(prompt="What is Prabhat Samgiita?"),
            FakeRequest(),
            session=None,  # type: ignore[arg-type]
        )
        chunks: list[bytes] = []
        async for chunk in response.body_iterator:  # type: ignore[attr-defined]
            chunks.append(chunk if isinstance(chunk, bytes) else chunk.encode())
        return b"".join(chunks)

    body = asyncio.run(run())
    text = body.decode()
    assert "5,018" in text
    assert catalog_called["search"] is False