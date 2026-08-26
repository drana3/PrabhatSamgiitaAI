import pytest

from app.models.song import Song
from app.services.rag import (
    RAGService,
    audit_grounded_answer,
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


class CorrectingProvider(CapturingProvider):
    def __init__(self) -> None:
        super().__init__()
        self.calls = 0

    async def complete(self, prompt: str) -> str:
        self.prompt = prompt
        self.calls += 1
        if self.calls == 1:
            return "I can provide a line-by-line explanation if you'd like."
        return (
            "1. Lyric: BANDHU HE NIYE CALO [1]\n"
            "Meaning: O dearest Friend, lead me onward.\n"
            "2. Lyric: ALOR OI JHARANA DHARARA PANE [2]\n"
            "Meaning: Lead me toward the fountain of divine light."
        )


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
    assert "CRITICAL — reply language for THIS turn only: clear, natural English." in prompt


def test_line_by_line_prompt_prefers_flowing_prose() -> None:
    song = Song(number=1, title="Bandhu He Niye Calo")

    prompt = build_grounded_prompt(
        song,
        "Explain this song line by line",
        ["[1] canonical lyrics", "[2] canonical English meaning"],
    )

    assert "flowing paragraphs" in prompt
    assert "Do not use numbered Lyric:/Meaning: pairs" in prompt
    assert "numbered `Lyric:` line" not in prompt


def test_line_by_line_audit_rejects_lyric_meaning_pairs() -> None:
    song = Song(
        number=5,
        title="ELO, ANEK JUGER SEI AJÁNÁ PATHIK",
        english_meaning="The ancient unknown traveler has come.",
    )
    chunks = fresh_song_chunks(song, "explain line by line in English")

    audit = audit_grounded_answer(
        song,
        "explain line by line in English",
        (
            "1. Lyric: ELO, ANEK JUGER\n"
            "Meaning: The traveler came.\n"
            "2. Lyric: CETANÁR MADHURA\n"
            "Meaning: The traveler came."
        ),
        chunks,
    )

    assert audit.passed is False
    assert any("Lyric/Meaning pairs" in issue for issue in audit.issues)


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


def test_answer_audit_rejects_wrong_song_and_missing_evidence_claims() -> None:
    song = Song(number=452, title="ARÚP SÁGARE SNÁNA KARIYÁCHO")
    chunks = fresh_song_chunks(
        Song(
            number=452,
            title="ARÚP SÁGARE SNÁNA KARIYÁCHO",
            english_meaning="You bathe in the ocean of formless beauty.",
        ),
        "what is this song about",
    )

    audit = audit_grounded_answer(
        song,
        "what is this song about",
        "I don't have the canonical meaning for this song. Song 2219 may be similar. [1]",
        chunks,
    )

    assert audit.passed is False
    assert any("evidence is missing" in issue for issue in audit.issues)
    assert any("unrelated song number" in issue for issue in audit.issues)


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


@pytest.mark.asyncio
async def test_failed_answer_is_corrected_once_against_the_same_song_context() -> None:
    song = Song(
        number=1,
        title="BANDHU HE NIYE CALO",
        lyrics_original="BANDHU HE NIYE CALO\nALOR OI JHARANA DHARARA PANE",
        english_meaning="O dearest Friend, lead me toward the fountain of divine light.",
    )
    provider = CorrectingProvider()

    answer, chunks = await RAGService(
        NoDatabaseSession(),  # type: ignore[arg-type]
        provider,  # type: ignore[arg-type]
    ).build_grounded_answer(song, "Explain this song line by line")

    assert provider.calls == 2
    assert "Lead me toward the fountain" in answer
    assert all(chunk.song_number == 1 for chunk in chunks)
    assert "CORRECTIVE GROUNDING PASS" in provider.prompt
