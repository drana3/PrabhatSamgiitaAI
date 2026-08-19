"""Learner-facing notation links: prabhatasamgiita.net only, never Sarkarverse."""

ANDROMEDA_ARCHIVE = "https://prabhatasamgiita.net/notations/andromeda.php"


def learner_notation_url(*candidates: str | None) -> str:
    for raw in candidates:
        url = str(raw or "").strip()
        if not url:
            continue
        lowered = url.lower()
        if "sarkarverse.org" in lowered:
            continue
        if "prabhatasamgiita.net" in lowered:
            return url
    return ANDROMEDA_ARCHIVE
