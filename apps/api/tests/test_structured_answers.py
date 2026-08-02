from app.models.song import Song
from app.services.structured_answers import (
    build_line_by_line_answer,
    build_meditation_answer,
    build_related_songs_answer,
    try_structured_answer,
)


def test_line_by_line_answer_pairs_lyrics_with_meaning() -> None:
    song = Song(
        number=4,
        title="SAKAL MANER VIIŃÁ EK SURE BÁJE ÁJ",
        lyrics_original="SAKAL MANER VIIŃÁ EK SURE BÁJE ÁJ\nSAKAL HRDAYE SAORABH",
        english_meaning="In every mind, one melody plays today.\nIn every heart, fragrance.",
    )

    answer = build_line_by_line_answer(song)

    assert answer is not None
    assert "1. Lyric: SAKAL MANER" in answer
    assert "Meaning: In every mind" in answer
    assert "2. Lyric: SAKAL HRDAYE" in answer
    assert "Meaning: In every heart" in answer


def test_line_by_line_answer_pairs_refrain_lyrics_sequentially() -> None:
    song = Song(
        number=8,
        title="ÁMI JETE CÁI, TUMI NIYE JÁO",
        lyrics_original="ÁMI JETE CÁI, TUMI NIYE JÁO\nBÁDHAÁR BÁNDHAÁ SAB CHINŔE DÁO",
        english_meaning="I want to go,\nplease take me with You.",
    )

    answer = build_line_by_line_answer(song)

    assert answer is not None
    assert "1. Lyric: ÁMI JETE CÁI" in answer
    assert "Meaning: I want to go," in answer
    assert "2. Lyric: BÁDHAÁR BÁNDHAÁ" in answer
    assert "Meaning: please take me with You." in answer


def test_structured_answer_line_by_line_uses_overview_not_pairs() -> None:
    song = Song(
        number=16,
        title="ÁJI, SAJALA PAVANE SAGHANA SVAPANE",
        lyrics_original="ÁJI, SAJALA PAVANE SAGHANA SVAPANE\nAJÁNA PATHIK ESECHE\n" * 4,
        english_meaning=(
            "Deep in dream, the air heavy with moisture, the Unknown Traveler came.\n"
            "The unknown has become known today."
        ),
        theme="Mysticism",
    )

    answer = try_structured_answer("Explain the meaning line by line", song)

    assert answer is not None
    assert "Lyric:" not in answer
    assert "Unknown Traveler" in answer
    assert "Theme: Mysticism" in answer


def test_structured_answer_handles_explain_requests() -> None:
    song = Song(
        number=452,
        title="ARÚP SÁGARE SNÁNA KARIYÁCHO",
        english_meaning="You bathe in the ocean of formless beauty.",
        theme="Devotion",
    )

    answer = try_structured_answer("What is this song about?", song)

    assert answer is not None
    assert "formless beauty" in answer
    assert "Theme: Devotion" in answer


def test_structured_answer_skips_regional_language_requests() -> None:
    song = Song(
        number=3,
        title="ÁNDHÁRA SHEŚE ÁLORA DESHE",
        english_meaning="Calling all, I will sing the glories of this crimson dawn.",
        theme="Neo-Humanism",
    )

    assert try_structured_answer("explain its meaning in magahi", song) is None
    assert try_structured_answer("maithili me batao", song, [("user", "What is this song about?")]) is None


def test_structured_answer_handles_story_requests() -> None:
    song = Song(number=419, title="KENDE KENDE KATA D'A'KI")

    answer = try_structured_answer("Any devotee stories about this song?", song)

    assert answer is not None
    assert "/stories/anandakaruna-419" in answer
    assert "/stories" in answer


def test_related_songs_answer_uses_catalog_matches() -> None:
    song = Song(number=1, title="Bandhu He Niye Calo", theme="Devotion")
    related = [
        Song(number=2, title="Alor Oi Jharana", theme="Devotion"),
        Song(number=3, title="Another Song", theme="Devotion"),
    ]

    answer = build_related_songs_answer(song, related)

    assert answer is not None
    assert "Song 2" in answer
    assert "Song 3" in answer


def test_meditation_answer_uses_song_context() -> None:
    song = Song(
        number=10,
        title="Meditation Song",
        english_meaning="The mind rests in stillness.",
        meditation_context="Evening meditation",
    )

    answer = build_meditation_answer(song)

    assert answer is not None
    assert "stillness" in answer
    assert "evening meditation" in answer.casefold()
