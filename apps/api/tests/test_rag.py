import pytest

from app.models.song import Song
from app.services.rag import (
    RAGService,
    build_grounded_prompt,
    build_song_chunks,
    cosine_similarity,
    fresh_song_chunks,
    requests_related_songs,
    split_text_blocks,
)


class NoDatabaseSession:
    async def execute(self, statement: object) -> None:
        raise AssertionError("song-scoped grounding should not query unrelated database chunks")


class CapturingProvider:
    def __init__(self) -> None:
        self.prompt = ""

    async def embed(self, text: str) -> list[float]:
        return []

    async def embed_many(self, texts: list[str]) -> list[list[float]]:
        return [[] for _ in texts]

    async def complete(self, prompt: str) -> str:
        self.prompt = prompt
        return "It describes the Divine manifesting beauty, love, compassion, and peace. [1]"


def test_split_text_blocks_preserves_paragraphs() -> None:
    blocks = split_text_blocks("alpha\n\nbeta\n\ngamma")
    assert blocks == ["alpha", "beta", "gamma"]


def test_build_song_chunks_creates_grounded_sections() -> None:
    song = Song(
        id=1,
        number=69,
        title="KE ELE NÁ BOLE ELE",
        first_line="KE ELE NÁ BOLE ELE",
        lyrics_original="KE ELE NÁ BOLE ELE\nGHUMER GHOR BHÁNGÁNOR D́ÁK DIYE",
        transliteration="Who are You that came without telling me?",
        english_meaning="Who are You that came without telling me?",
        hindi_meaning="तुम बिना बताए आए कौन हो?",
        canonical_source_url="https://prabhatasamgiita.net/lyrics/ps_69.htm",
        metadata_json={"purport": "A grounded explanation."},
    )

    chunks = build_song_chunks(song)

    assert chunks[0]["chunk_type"] == "summary"
    assert chunks[1]["chunk_type"] == "lyrics"
    assert chunks[2]["chunk_type"] == "transliteration"
    assert any(chunk["chunk_type"] == "purport" for chunk in chunks)
    assert any("grounded explanation" in chunk["content"] for chunk in chunks)


def test_cosine_similarity_matches_identical_vectors() -> None:
    assert cosine_similarity([1.0, 0.0], [1.0, 0.0]) == 1.0


def test_grounded_prompt_uses_recent_turns_only_for_follow_up_context() -> None:
    song = Song(number=2256, title="Asar Katha Chilo Anek Age")

    prompt = build_grounded_prompt(
        song,
        "What did I ask last?",
        ["[1] Canonical meaning"],
        [("user", "Explain it in Magahi"), ("assistant", "Here is the explanation.")],
    )

    assert "User: Explain it in Magahi" in prompt
    assert "Current user question: What did I ask last?" in prompt
    assert "Answer factual claims only from the retrieved canonical context" in prompt
    assert "same Romanized style" in prompt


def test_song_scoped_meaning_is_mandatory_first_context() -> None:
    song = Song(
        number=452,
        title="ARÚP SÁGARE SNÁNA KARIYÁCHO",
        lyrics_original="ARÚP SÁGARE SNÁNA KARIYÁCHO",
        english_meaning="You bathe in the ocean of formless beauty.",
        canonical_source_url="https://prabhatasamgiita.net/1-5018.htm",
    )

    chunks = fresh_song_chunks(song, "what this song is about")

    assert chunks[0].song_number == 452
    assert chunks[0].chunk_type == "meaning"
    assert "formless beauty" in chunks[0].content
    assert requests_related_songs("what this song is about") is False
    assert requests_related_songs("recommend a related song") is True


@pytest.mark.asyncio
async def test_song_scoped_answer_never_substitutes_another_song() -> None:
    song = Song(
        number=452,
        title="ARÚP SÁGARE SNÁNA KARIYÁCHO",
        lyrics_original="ARÚP SÁGARE SNÁNA KARIYÁCHO",
        english_meaning="You bathe in the ocean of formless beauty and pour forth peace.",
        canonical_source_url="https://prabhatasamgiita.net/1-5018.htm",
    )
    provider = CapturingProvider()

    answer, chunks = await RAGService(
        NoDatabaseSession(),  # type: ignore[arg-type]
        provider,  # type: ignore[arg-type]
    ).build_grounded_answer(song, "what this song is about")

    assert "beauty" in answer
    assert chunks[0].song_number == 452
    assert all(chunk.song_number == 452 for chunk in chunks)
    assert "ocean of formless beauty" in provider.prompt
    assert "2219" not in provider.prompt
