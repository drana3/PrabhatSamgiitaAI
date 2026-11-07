"""Pure rules for author profiles: slugs, names, links, text. No database, no I/O
(docs/author-profiles.md).

Every limit is a named constant at the top so the owner can change one number.
"""

from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher
from typing import Any
from urllib.parse import urlsplit

SLUG_MIN = 3
SLUG_MAX = 30
NAME_MIN = 2
NAME_MAX = 60
BIO_MAX = 280
ABOUT_MAX = 4000
PLACE_MAX = 80
MAX_LINKS = 6
LINK_URL_MAX = 300
# After the page was published once, the address can change this seldom (the old one keeps
# redirecting).
SLUG_CHANGE_COOLDOWN_DAYS = 30
# A deleted address is not given to anybody for this long.
SLUG_QUARANTINE_DAYS = 90
# Two names this alike (0..1) are "the same name" for the impersonation check.
NAME_SIMILARITY = 0.86

PROFILE_LANGUAGES = ("bengali", "sanskrit", "hindi", "english", "spanish", "russian", "other")

# --------------------------------------------------------------------------- slugs

# Words that can never be an address: routes of the site and the app, roles, system words.
RESERVED_SLUGS = frozenset(
    """
    admin administrator root system support help staff team the-team moderator mod official verified
    api www app web mobile ios android null undefined none new edit me mine my you
    about authors author songs song kiirtan kirtan bhajan bhajans kiirtans prabhat samgiita
    search explore stories story quiz learn today library saved playlist playlists festival
    festivals
    sitemap slug-check by-recording photo recordings collections report
    signin sign-in signup sign-up login logout auth account settings profile privacy terms
    content-rules rules feedback contact delete-account forgot-password reset-password
    notifications radio drive harmonium assistant ai upload add-kirtan upload-set
    baba babanam ananda anandamarga ananda-marga anandamurti shrii sri
    """.split()
)
# If the slug, without hyphens, CONTAINS one of these it is held for the team: the founder, the
# organisation and the app. (Names of living performers are not listed here: they are protected by
# the
# similarity check against names already in the library, so the list never goes out of date.)
PROTECTED_FRAGMENTS = (
    "anandamurti",
    "anandamarga",
    "prabhatranjan",
    "ranjansarkar",
    "prabhatsamgiita",
    "prabhatasamgiita",
    "shriishrii",
    "srisri",
    "sadguru",
)
# Display names that are taken by equality or high similarity (whole name).
PROTECTED_NAMES = (
    "Shrii Shrii Anandamurti",
    "Shri Shri Anandamurti",
    "Sri Sri Anandamurti",
    "Anandamurti",
    "Prabhat Ranjan Sarkar",
    "P R Sarkar",
    "Baba",
    "Ananda Marga",
    "Ananda Marga Team",
    "Prabhat Samgiita",
    "Prabhat Samgiita Team",
    "Prabhat Samgiita AI",
    "Sadguru",
)

# Words that make a name or address LOOK like the team or the app. The page is not refused: it is
# held for the team (review reason `staff_name`) unless the team has verified the page.
STAFF_WORDS = ("team", "official", "support", "moderator", "admin", "verified", "staff")
# The owners' names, matched inside the name or address without spaces and hyphens.
OWNER_FRAGMENTS = ("dadamaetreya", "dadamaitreya", "maetreya", "maitreya")

# Literal path segments of the author API ("sitemap", "slug-check", "me", ...), added by the router
# module when it is imported, so a new route can never be taken as an address.
_ROUTE_WORDS: set[str] = set()


def register_route_words(words: set[str]) -> None:
    _ROUTE_WORDS.update(w.lower() for w in words if w)


def route_words() -> frozenset[str]:
    return frozenset(_ROUTE_WORDS)


_SLUG_OK = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def ascii_fold(text: str) -> str:
    """Accents removed: "Bábá Nám" -> "Baba Nam". Letters with no ASCII form are dropped."""
    decomposed = unicodedata.normalize("NFKD", text)
    return (
        "".join(c for c in decomposed if not unicodedata.combining(c))
        .encode("ascii", "ignore")
        .decode("ascii")
    )


def normalize_slug(raw: str | None) -> str:
    """What the person typed, made into an address: lowercase ASCII, words joined by single
    hyphens."""
    text = ascii_fold(raw or "").lower()
    text = re.sub(r"[\s_.]+", "-", text)
    text = re.sub(r"[^a-z0-9-]", "", text)
    return re.sub(r"-{2,}", "-", text).strip("-")


def name_key(text: str | None) -> str:
    """A name without case, accents, spaces or punctuation, for comparing names."""
    return re.sub(r"[^a-z0-9Ѐ-ӿऀ-ॿ]", "", ascii_or_keep(text or "").lower())


def ascii_or_keep(text: str) -> str:
    """Latin accents go (so "Bábá" equals "Baba"); letters of other scripts stay as they are."""
    out: list[str] = []
    for char in unicodedata.normalize("NFKD", text):
        if unicodedata.combining(char) and out and ord(out[-1]) < 0x250:
            continue
        out.append(char)
    return unicodedata.normalize("NFC", "".join(out))


_CONFUSABLE = str.maketrans({"0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "$": "s"})


def confusable_key(text: str | None) -> str:
    """name_key with look-alikes folded ("Madhuvr4ta" and "Madhuvrata" are one key; rn -> m)."""
    return (
        name_key(text)
        .translate(_CONFUSABLE)
        .replace("rn", "m")
        .replace("ii", "i")
        .replace("aa", "a")
    )


def names_alike(a: str | None, b: str | None) -> bool:
    """Would a reader take these two names for the same person?"""
    ka, kb = confusable_key(a), confusable_key(b)
    if not ka or not kb:
        return False
    if ka == kb:
        return True
    shorter, longer = sorted((ka, kb), key=len)
    if len(shorter) >= 6 and shorter in longer and len(shorter) / len(longer) >= 0.6:
        return True
    # the same words in another order ("Devi Priya" / "Priya Devi")
    ta = sorted(re.findall(r"\w+", ascii_or_keep(a or "").lower()))
    tb = sorted(re.findall(r"\w+", ascii_or_keep(b or "").lower()))
    if len(ta) > 1 and ta == tb:
        return True
    return SequenceMatcher(None, ka, kb).ratio() >= NAME_SIMILARITY


def slug_problem(slug: str) -> str | None:
    """None when the address is acceptable, else a code the app turns into a sentence."""
    if len(slug) < SLUG_MIN:
        return "too_short"
    if len(slug) > SLUG_MAX:
        return "too_long"
    if not _SLUG_OK.match(slug):
        return "characters"
    if not re.search(r"[a-z]", slug):
        return "needs_letter"
    if slug in RESERVED_SLUGS or slug.replace("-", "") in RESERVED_SLUGS or slug in _ROUTE_WORDS:
        return "reserved"
    return None


# Letters of other scripts that are drawn like a Latin one. Applied to lowercase text after NFKC.
_LOOKALIKE = str.maketrans(
    {
        # Cyrillic
        "\u0430": "a",
        "\u0432": "b",
        "\u0435": "e",
        "\u0451": "e",
        "\u043a": "k",
        "\u043c": "m",
        "\u043d": "h",
        "\u043e": "o",
        "\u0440": "p",
        "\u0441": "c",
        "\u0442": "t",
        "\u0443": "y",
        "\u0445": "x",
        "\u0456": "i",
        "\u0458": "j",
        "\u0455": "s",
        "\u0501": "d",
        "\u04cf": "l",
        "\u051b": "q",
        "\u051d": "w",
        "\u04bb": "h",
        "\u0491": "r",
        # Greek
        "\u03b1": "a",
        "\u03b2": "b",
        "\u03b3": "y",
        "\u03b5": "e",
        "\u03b7": "n",
        "\u03b9": "i",
        "\u03ba": "k",
        "\u03bd": "v",
        "\u03bf": "o",
        "\u03c1": "p",
        "\u03c4": "t",
        "\u03c5": "u",
        "\u03c7": "x",
        "\u03c9": "w",
        # Latin letters with no ASCII decomposition
        "\u0131": "i",
        "\u0268": "i",
        "\u0269": "i",
        "\u0261": "g",
        "\u0251": "a",
    }
)
# Characters with no width or no sound: they only split a word to slip past a filter.
_INVISIBLE = re.compile(
    "[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f"
    "\u202a-\u202e\u2060-\u206f\u3164\ufe00-\ufe0f\ufeff\uffa0]"
)
_LEET = str.maketrans(
    {"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "$": "s", "@": "a"}
)


def latin_skeleton(text: str | None) -> str:
    """Lowercase Latin text that looks like the input: invisible characters dropped, fullwidth and
    styled letters made plain, Cyrillic and Greek look-alikes turned into the Latin letter they
    imitate, accents removed. "\u0410dmin \u0422e\u0430m" -> "admin team"."""
    plain = _INVISIBLE.sub("", _CONTROL.sub("", text or ""))
    plain = unicodedata.normalize("NFKC", plain).lower().translate(_LOOKALIKE)
    return ascii_fold(plain)


def _staff_word_in(skeleton: str) -> bool:
    for token in re.findall(r"[a-z]+", skeleton):
        if token in STAFF_WORDS or (token.endswith("s") and token[:-1] in STAFF_WORDS):
            return True
    compact = re.sub(r"[^a-z]", "", skeleton)
    return any(word in compact for word in STAFF_WORDS if len(word) >= 5)


def staff_hit(text: str | None) -> bool:
    """The name or address sounds like staff (team, official, support, ...) or carries an owner's
    name. Whole words (also with a number, "admin1", or a plural) and, for the longer words, inside
    a longer one ("officialps", "supportteam"). Look-alike letters of other scripts, fullwidth
    letters, invisible characters and simple leetspeak ("4dm1n") do not get past it."""
    skeleton = latin_skeleton(text)
    if _staff_word_in(skeleton) or _staff_word_in(skeleton.translate(_LEET)):
        return True
    compact = re.sub(r"[^a-z0-9]", "", skeleton)
    leet = re.sub(r"[^a-z]", "", skeleton.translate(_LEET))
    return any(fragment in compact or fragment in leet for fragment in OWNER_FRAGMENTS)


def protected_hit(slug_or_name: str) -> bool:
    """The slug or name contains the founder's, the organisation's or the app's name."""
    compact = name_key(slug_or_name)
    return any(fragment in compact for fragment in PROTECTED_FRAGMENTS)


def protected_name_hit(name: str) -> bool:
    return protected_hit(name) or any(names_alike(name, p) for p in PROTECTED_NAMES)


# --------------------------------------------------------------------------- text


_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f​-‏‪-‮⁦-⁩]")
_LINK_WORD = re.compile(
    r"(?:https?://|www\.|\b[a-z0-9-]+\.(?:com|org|net|io|me|co|app|xyz|info|tv|ly|link|site)\b)",
    re.I,
)


def clean_line(value: str | None, limit: int) -> str:
    """One line: control and bidi-override characters out, spaces collapsed."""
    return " ".join(_CONTROL.sub("", value or "").split())[:limit]


def clean_paragraphs(value: str | None, limit: int) -> str:
    """Several paragraphs: at most one blank line between them, no control characters."""
    text = _CONTROL.sub("", (value or "").replace("\r\n", "\n").replace("\r", "\n"))
    lines = [" ".join(line.split()) for line in text.split("\n")]
    out: list[str] = []
    for line in lines:
        if not line and (not out or not out[-1]):
            continue
        out.append(line)
    return "\n".join(out).strip()[:limit]


def contains_link(text: str) -> bool:
    return bool(_LINK_WORD.search(text))


# --------------------------------------------------------------------------- links

# kind -> hosts it may point to (a host matches when it equals one or is a subdomain of one).
LINK_HOSTS: dict[str, tuple[str, ...]] = {
    "youtube": ("youtube.com", "youtu.be"),
    "instagram": ("instagram.com",),
    "facebook": ("facebook.com", "fb.com"),
    "telegram": ("t.me", "telegram.me"),
    "spotify": ("spotify.com",),
    "soundcloud": ("soundcloud.com",),
    "bandcamp": ("bandcamp.com",),
    "apple_music": ("music.apple.com",),
    "x": ("x.com", "twitter.com"),
    "website": (),  # any public https host
}
LINK_KINDS = tuple(LINK_HOSTS)
_HOST = re.compile(r"^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$")
_IPV4 = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")


class LinkError(ValueError):
    """The code says which rule failed: scheme, host, kind, length, count."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def normalize_link(kind: str, raw: str | None) -> dict[str, str]:
    """A checked link ready to store: https only, lowercase host, no credentials, no fragment.

    `javascript:`, `data:`, `file:`, `http:` and everything else that is not https is refused, so a
    stored link can never run code or downgrade the connection. A social link must point at that
    social network's own host; a `website` may point anywhere public.
    """
    if kind not in LINK_HOSTS:
        raise LinkError("kind")
    text = (raw or "").strip()
    if not text or len(text) > LINK_URL_MAX or _CONTROL.search(text) or " " in text:
        raise LinkError("length" if len(text) > LINK_URL_MAX else "url")
    if "://" not in text:
        if re.match(r"^[a-z][a-z0-9+.-]*:", text, re.I) and not re.match(
            r"^[a-z0-9.-]+:\d+", text, re.I
        ):
            raise LinkError("scheme")  # javascript:..., data:..., mailto:...
        text = f"https://{text}"
    try:
        parts = urlsplit(text)
        host = (parts.hostname or "").lower().rstrip(".")
        port = parts.port
    except ValueError as exc:
        raise LinkError("url") from exc
    if parts.scheme.lower() != "https":
        raise LinkError("scheme")
    if parts.username or parts.password or port not in (None, 443):
        raise LinkError("url")
    if not _HOST.match(host) or _IPV4.match(host) or host == "localhost" or host.endswith(".local"):
        raise LinkError("host")
    allowed = LINK_HOSTS[kind]
    if allowed and not any(host == h or host.endswith(f".{h}") for h in allowed):
        raise LinkError("host")
    path = parts.path or ""
    query = f"?{parts.query}" if parts.query else ""
    url = f"https://{host}{path}{query}"
    if len(url) > LINK_URL_MAX:
        raise LinkError("length")
    return {"kind": kind, "url": url}


def normalize_links(items: list[dict[str, Any]] | None) -> list[dict[str, str]]:
    """The whole list: at most MAX_LINKS, no repeated address, one per social network."""
    out: list[dict[str, str]] = []
    seen_urls: set[str] = set()
    seen_kinds: set[str] = set()
    for item in items or []:
        link = normalize_link(str(item.get("kind", "")), item.get("url"))
        if link["url"] in seen_urls:
            continue
        if link["kind"] != "website" and link["kind"] in seen_kinds:
            raise LinkError("repeat")
        seen_urls.add(link["url"])
        seen_kinds.add(link["kind"])
        out.append(link)
    if len(out) > MAX_LINKS:
        raise LinkError("count")
    return out


def same_as_urls(links: list[dict[str, str]]) -> list[str]:
    """Addresses for schema.org `sameAs`: every stored link (all are https and checked)."""
    return [link["url"] for link in links]
