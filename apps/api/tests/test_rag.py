from app.models.song import Song
from app.services.rag import build_song_chunks, cosine_similarity, split_text_blocks


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
