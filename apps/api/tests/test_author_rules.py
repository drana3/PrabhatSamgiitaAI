"""The pure rules of author profiles: addresses, names, links, text, and the counting rules."""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")

import pytest

from app.services import author_rules as rules
from app.services import author_stats as stats

# --------------------------------------------------------------------------- slugs


@pytest.mark.parametrize(
    ("typed", "slug"),
    [
        ("Madhu Vrata", "madhu-vrata"),
        ("  Bábá_Nám  ", "baba-nam"),
        ("Sadhana--Group!!", "sadhana-group"),
        ("a.b.c", "a-b-c"),
        ("ДАДА", ""),  # nothing Latin left: the app asks for another one
    ],
)
def test_a_typed_address_becomes_lowercase_ascii(typed: str, slug: str) -> None:
    assert rules.normalize_slug(typed) == slug


@pytest.mark.parametrize(
    ("slug", "problem"),
    [
        ("ab", "too_short"),
        ("a" * 31, "too_long"),
        ("---", "characters"),
        ("123", "needs_letter"),
        ("admin", "reserved"),
        ("add-kirtan", "reserved"),
        ("upload-set", "reserved"),
        ("sign-in", "reserved"),
        ("signin", "reserved"),
        ("madhu-vrata", None),
        ("dada108", None),
    ],
)
def test_address_rules(slug: str, problem: str | None) -> None:
    assert rules.slug_problem(slug) == problem


def test_the_founder_the_organisation_and_the_app_are_protected() -> None:
    for text in (
        "anandamurti-songs",
        "Ananda Marga Official",
        "prabhat-samgiita-team",
        "Sri Sri Anandamurti",
        "Shrii Shrii Anandamurti ji",
    ):
        assert rules.protected_hit(text), text
    assert rules.protected_name_hit("Shri Shri Anandamurti")
    assert rules.protected_name_hit("Prabhat Samgiita AI")
    assert not rules.protected_hit("madhu-vrata")


def test_look_alike_names_are_one_name() -> None:
    assert rules.names_alike("Madhuvrata", "Madhuvr4ta")
    assert rules.names_alike("Devi Priya", "Priya Devi")
    assert rules.names_alike("Bábá Nám", "Baba Nam")
    assert rules.names_alike("Dada Maetreya", "Dada Maetreya Music")
    assert not rules.names_alike("Madhuvrata", "Kalyani")
    assert not rules.names_alike("", "Kalyani")
    # a name from another script is compared as it is, not folded away to nothing
    assert not rules.names_alike("Мадхуврата", "Kalyani")
    assert rules.names_alike("Мадхуврата", "мадхуврата ")


# --------------------------------------------------------------------------- text


def test_control_and_direction_override_characters_are_removed() -> None:
    assert rules.clean_line("Dada‮ evil\x00  name", 60) == "Dada evil name"
    assert rules.clean_line("x" * 100, 10) == "x" * 10
    assert rules.clean_paragraphs("a\n\n\n\nb ​\n", 100) == "a\n\nb"


@pytest.mark.parametrize(
    "text",
    ["see https://x.example", "www.example.org", "my-site.com", "write to me on t.me", "ok.app"],
)
def test_links_in_free_text_are_found(text: str) -> None:
    assert rules.contains_link(text)


def test_plain_text_is_not_a_link() -> None:
    assert not rules.contains_link("Kiirtan singer from Warsaw. I sing since 2012.")


# --------------------------------------------------------------------------- links


@pytest.mark.parametrize(
    "raw",
    [
        "javascript:alert(1)",
        "JaVaScRiPt:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "file:///etc/passwd",
        "mailto:a@b.co",
        "http://example.com",  # http is refused, only https
        "ftp://example.com/x",
    ],
)
def test_only_https_links_are_stored(raw: str) -> None:
    with pytest.raises(rules.LinkError) as caught:
        rules.normalize_link("website", raw)
    assert caught.value.code in ("scheme", "url")


@pytest.mark.parametrize(
    "raw",
    [
        "https://localhost/x",
        "https://127.0.0.1/x",
        "https://192.168.0.1/x",
        "https://printer.local/x",
        "https://user:pass@example.com/",
        "https://example.com:8443/",
        "https://exa mple.com/",
        "https://nodot/",
    ],
)
def test_private_or_odd_hosts_are_refused(raw: str) -> None:
    with pytest.raises(rules.LinkError):
        rules.normalize_link("website", raw)


def test_a_social_link_must_point_at_that_network() -> None:
    assert (
        rules.normalize_link("youtube", "youtube.com/@dada")["url"] == "https://youtube.com/@dada"
    )
    assert rules.normalize_link("youtube", "https://m.youtube.com/@dada")["kind"] == "youtube"
    with pytest.raises(rules.LinkError) as caught:
        rules.normalize_link("youtube", "https://evil.example/youtube.com")
    assert caught.value.code == "host"
    with pytest.raises(rules.LinkError):
        rules.normalize_link("instagram", "https://notinstagram.com/x")
    with pytest.raises(rules.LinkError):
        rules.normalize_link("nonsense", "https://example.com")


def test_a_link_list_has_a_limit_and_no_repeats() -> None:
    one = [{"kind": "website", "url": "https://example.com/a"}] * 3
    assert len(rules.normalize_links(one)) == 1
    many = [
        {"kind": "website", "url": f"https://example.com/{i}"} for i in range(rules.MAX_LINKS + 1)
    ]
    with pytest.raises(rules.LinkError) as caught:
        rules.normalize_links(many)
    assert caught.value.code == "count"
    twice = [
        {"kind": "youtube", "url": "https://youtube.com/a"},
        {"kind": "youtube", "url": "https://youtube.com/b"},
    ]
    with pytest.raises(rules.LinkError) as repeat:
        rules.normalize_links(twice)
    assert repeat.value.code == "repeat"


# --------------------------------------------------------------------------- the counting rules


@pytest.mark.parametrize(
    ("duration", "needed"),
    [(None, 30), (0, 30), (600, 30), (61, 30), (40, 20), (20, 10), (8, 10), (4, 10)],
)
def test_a_play_counts_after_30_seconds_or_half_of_a_short_track(
    duration: int | None, needed: int
) -> None:
    assert stats.play_threshold(duration) == needed
    assert stats.qualifies(needed, duration)
    assert not stats.qualifies(needed - 1, duration)


def test_a_listener_key_is_short_and_stable_and_keyed() -> None:
    key = stats.listener_key("secret", "m:1")
    assert key == stats.listener_key("secret", "m:1")
    assert len(key) == stats.LISTENER_KEY_BITS // 4
    assert key != stats.listener_key("other-secret", "m:1")
    assert key != stats.listener_key("secret", "m:2")
    assert key != stats.listener_key("secret", "d:1")


def test_distinct_listeners_are_corrected_for_shared_keys() -> None:
    assert stats.estimate_distinct(0) == 0
    assert stats.estimate_distinct(1) == 1
    assert stats.estimate_distinct(100) == 100
    # with 24 bits about one pair in 16 million collides: 100 000 people look like fewer keys
    space = 2**stats.LISTENER_KEY_BITS
    looks_like = int(space * (1 - (1 - 1 / space) ** 100_000))
    assert abs(stats.estimate_distinct(looks_like) - 100_000) < 50


def test_countries_need_enough_listeners_and_a_big_enough_whole() -> None:
    assert stats.visible_countries({"PL": 4, "DE": 3}) is None  # whole too small
    counts = {"PL": 12, "DE": 6, "FR": 2, "IS": 1}
    shown = stats.visible_countries(counts)
    assert shown == [{"country": "PL", "listeners": 12}, {"country": "DE", "listeners": 6}]
    assert stats.visible_countries({"PL": 4, "DE": 4, "FR": 4, "ES": 4, "IT": 4, "NL": 4}) is None


def test_a_device_region_is_two_letters_or_nothing() -> None:
    assert stats.country_code("pl") == "PL"
    assert stats.country_code(" de ") == "DE"
    assert stats.country_code("POL") is None
    assert stats.country_code("1a") is None
    assert stats.country_code(None) is None
