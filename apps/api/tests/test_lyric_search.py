import time

from app.services.lyric_search import LYRIC_RESULT_LIMIT, search_lyrics


def test_opening_line_is_the_top_hit() -> None:
    hits = search_lyrics("BANDHU HE NIYE CALO")
    assert hits
    assert hits[0].number == 1
    assert hits[0].matched_by == "opening_line"


def test_inner_lyric_line_ranks_the_song_in_top_five() -> None:
    hits = search_lyrics("ANDHARER VYATHA AR SAYE NA PRANE")
    numbers = [hit.number for hit in hits]
    assert 1 in numbers
    assert len(hits) <= LYRIC_RESULT_LIMIT


def test_searches_all_5018_songs_including_late_catalog_verses() -> None:
    from app.services.lyric_search import lyric_index

    records, _postings = lyric_index()
    assert len(records) == 5018
    hits = search_lyrics("JINANER ALOKE RAUNGIYE DOBO")
    assert 5018 in [hit.number for hit in hits]


def test_english_meaning_is_not_used_for_lyric_search() -> None:
    hits = search_lyrics("I can no longer bear the pain of darkness in my heart")
    assert 1 not in [hit.number for hit in hits]


def test_transliteration_spelling_variants_match_the_same_lyric() -> None:
    from app.services.lyric_search import fold_lyric_phonetic

    assert fold_lyric_phonetic("humdardi") == fold_lyric_phonetic("hamdardii")
    hits = search_lyrics("humdardi")
    assert 4170 in [hit.number for hit in hits]


def test_missing_letter_still_matches_the_lyric() -> None:
    hits = search_lyrics("hamdrdi")
    assert 4170 in [hit.number for hit in hits]


def test_wrong_first_letter_and_swapped_letters_still_match() -> None:
    assert search_lyrics("pandhu")[0].number == 1
    assert search_lyrics("bnadhu")[0].number == 1
    assert 1 in [hit.number for hit in search_lyrics("bandhu he niye kalo")]
    assert search_lyrics("vandhu")[0].number == 1


def test_lyric_search_returns_within_milliseconds() -> None:
    search_lyrics("bandhu")  # warm index
    started = time.perf_counter()
    hits = search_lyrics("alor oi jharana dharara pane")
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert hits
    assert elapsed_ms < 120
