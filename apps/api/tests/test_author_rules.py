"""The pure rules of author profiles: addresses, names, links, text, and the counting rules."""

from __future__ import annotations

import os
import re
import unicodedata

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
        ("sitemap", "reserved"),
        ("slug-check", "reserved"),
        ("by-recording", "reserved"),
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


@pytest.mark.parametrize(
    "text",
    [
        "Admin Team",
        "PS Team",
        "Official PS",
        "Support",
        "Moderator",
        "support-team",
        "official-ps",
        "verified-artist",
        "admin1",
        "officialps",
        "Staff",
        "Dada Maetreya",
        "dada-maetreya-music",
        "Maitreya",
        "ADMINS",
    ],
)
def test_names_and_addresses_that_sound_like_staff_are_found(text: str) -> None:
    assert rules.staff_hit(text), text


@pytest.mark.parametrize(
    "text", ["Madhu Vrata", "madhu-vrata", "Teamwork Kirtan", "Priya Devi", "steamboat", "Kalyani"]
)
def test_ordinary_names_are_not_staff(text: str) -> None:
    # whole words only for the short word "team": "Teamwork" and "steamboat" are not staff
    assert not rules.staff_hit(text), text


DISGUISED_STAFF = [
    "\u0410dmin \u0422e\u0430m",  # Cyrillic A, e, a, T in "Admin Team"
    "\u041eff\u0456cial",  # Cyrillic O and i in "Official"
    "\u0455taff",  # Cyrillic s
    "\u0391dmin",  # Greek capital Alpha
    "\u03bfffici\u03b1l",  # Greek omicron and alpha
    "\uff21\uff44\uff4d\uff49\uff4e",  # fullwidth "Admin"
    "\uff34\uff45\uff41\uff4d",  # fullwidth "Team"
    "Adm\u200bin",  # zero-width space inside
    "Of\u00adficial",  # soft hyphen inside
    "S\u202eupport",  # bidi override inside
    "4dm1n",
    "supp0rt",
    "0ff1c14l",
    "t34m",
    "5taff",
    "m0d3r4t0r",
    "d4d4-m4itreya",
    "\u0410dmin-\u0422eam",
    "\u041c\u0430itreya",  # Cyrillic M and a in an owner name
]


@pytest.mark.parametrize("text", DISGUISED_STAFF)
def test_disguised_staff_names_are_found(text: str) -> None:
    assert rules.staff_hit(text), ascii(text)


def test_the_skeleton_turns_look_alikes_into_latin() -> None:
    assert rules.latin_skeleton("\u0410dmin \u0422e\u0430m") == "admin team"
    assert rules.latin_skeleton("\uff21\uff44\uff4d\uff49\uff4e") == "admin"
    assert rules.latin_skeleton("Adm\u200bin") == "admin"
    assert rules.latin_skeleton(None) == ""


@pytest.mark.parametrize(
    "text",
    [
        "Teamwork Kirtan",
        "steamboat",
        "St3amboat",
        "T3amwork",
        "Kiirtan 108",
        "Madhu Vrata 7",
        "\u041c\u0430\u0434\u0445\u0443 \u0412\u0440\u0430\u0442\u0430",  # a Russian name
        "\u0928\u093f\u0924\u094d\u092f\u093e",  # Devanagari
    ],
)
def test_normalising_does_not_make_ordinary_names_staff(text: str) -> None:
    assert not rules.staff_hit(text), ascii(text)


# --------------------------------------------------------------------------- QA-043: look-alikes

# The small capitals of the alphabet, as the Unicode block has them (there is no x).
SMALL_CAPITALS = {
    "\u1d00": "a", "\u0299": "b", "\u1d04": "c", "\u1d05": "d", "\u1d07": "e",
    "\ua730": "f", "\u0262": "g", "\u029c": "h", "\u026a": "i", "\u1d0a": "j",
    "\u1d0b": "k", "\u029f": "l", "\u1d0d": "m", "\u0274": "n", "\u1d0f": "o",
    "\u1d18": "p", "\u0280": "r", "\ua731": "s", "\u1d1b": "t", "\u1d1c": "u",
    "\u1d20": "v", "\u1d21": "w", "\u028f": "y", "\u1d22": "z",
}  # fmt: skip
# Greek capitals that are drawn like a Latin letter, and the letter.
GREEK_CAPITALS = {
    "\u0391": "a", "\u0392": "b", "\u0395": "e", "\u0396": "z", "\u0397": "h",
    "\u0399": "i", "\u039a": "k", "\u039c": "m", "\u039d": "n", "\u039f": "o",
    "\u03a1": "p", "\u03a4": "t", "\u03a5": "y", "\u03a7": "x",
}  # fmt: skip


@pytest.mark.parametrize(("char", "plain"), SMALL_CAPITALS.items())
def test_every_small_capital_folds_to_its_ascii_letter(char: str, plain: str) -> None:
    assert rules.latin_skeleton(char) == plain, ascii(char)
    assert unicodedata.name(char).endswith(f"SMALL CAPITAL {plain.upper()}")


def test_the_small_capital_block_is_covered_by_name_not_by_a_hand_list() -> None:
    found = [
        chr(code)
        for code in range(0x250, 0xA800)
        if re.fullmatch(r"LATIN LETTER SMALL CAPITAL [A-Z]", unicodedata.name(chr(code), ""))
    ]
    assert set(SMALL_CAPITALS) <= set(found)
    for char in found:
        assert rules.latin_skeleton(char) == unicodedata.name(char)[-1].lower(), ascii(char)


@pytest.mark.parametrize(("char", "plain"), GREEK_CAPITALS.items())
def test_greek_capitals_that_look_like_latin_letters_fold_to_ascii(char: str, plain: str) -> None:
    folded = rules.latin_skeleton(char)
    assert folded.isascii() and len(folded) == 1, ascii(char)
    assert folded == plain, ascii(char)


def test_greek_nu_and_mu_fold_to_the_letter_they_look_like() -> None:
    assert rules.latin_skeleton("\u039d") == "n"  # capital Nu is n, not v
    assert rules.latin_skeleton("\u03bd") == "v"  # small nu is v
    assert rules.latin_skeleton("\u039c") == "m"
    assert rules.latin_skeleton("\u03bc") == "m"


@pytest.mark.parametrize(
    "text",
    [
        "\u039coderator",  # Greek capital Mu
        "\u039caitreya",
        "Dada \u039caetreya",
        "\u1d00dmin",  # Latin small capital A
        "\u1d0doderator",  # Latin small capital M
        "\u1d00\u1d05\u1d0d\u026a\u0274",  # small capitals only: "admin"
        "\u1d1b\u1d07\u1d00\u1d0d",  # "team"
        "\u039ffficial",  # Greek capital Omicron
        "\U0001d400dmin",  # mathematical bold A
        "\U0001d5a0dmin",  # mathematical sans-serif A
        # monospace "official"
        "\U0001d698\U0001d68f\U0001d68f\U0001d692\U0001d68c\U0001d692\U0001d68a\U0001d695",
        "\U0001d6a8dmin",  # mathematical Greek capital Alpha
    ],
)
def test_greek_mu_small_capitals_and_math_letters_do_not_get_past_the_staff_filter(
    text: str,
) -> None:
    assert rules.staff_hit(text), ascii(text)


def test_look_alikes_get_the_same_treatment_in_the_protected_name_checks() -> None:
    assert rules.protected_hit("\u0391nandamurti")  # Greek Alpha
    assert rules.protected_hit("\u1d00nandamurti")  # small capital A
    assert rules.protected_hit("\u1d18rabhat Samgiita")  # small capital P
    assert rules.protected_hit("\u0455ri\u0455ri")  # Cyrillic dze for s: "srisri"
    assert rules.protected_name_hit("\u1d00nandamurti")
    assert rules.protected_name_hit("\u0392aba")  # Greek Beta: "Baba"
    assert rules.names_alike("\u039caitreya", "Maitreya")
    assert rules.names_alike("\u1d00nanda \u1d0darga", "Ananda Marga")
    assert rules.confusable_key("\u039coderator") == rules.confusable_key("Moderator")
    assert not rules.protected_hit("madhu-vrata")


def test_plain_cyrillic_names_still_compare_as_before() -> None:
    assert rules.names_alike("\u041c\u0430\u0434\u0445\u0443", "\u041c\u0430\u0434\u0445\u0443")
    assert not rules.names_alike("\u041c\u0430\u0434\u0445\u0443", "\u0420\u0430\u0434\u0445\u0430")
