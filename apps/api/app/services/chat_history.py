from __future__ import annotations

DEFAULT_MAX_TURNS = 6
DEFAULT_MAX_CHARS_PER_TURN = 500


def cap_chat_history(
    history: list[tuple[str, str]] | None,
    *,
    max_turns: int = DEFAULT_MAX_TURNS,
    max_chars_per_turn: int = DEFAULT_MAX_CHARS_PER_TURN,
) -> list[tuple[str, str]]:
    """Limit conversation history sent into the model (OWASP LLM10)."""
    if not history:
        return []
    capped: list[tuple[str, str]] = []
    for role, content in history[-max(1, max_turns) :]:
        text = " ".join((content or "").split())
        if len(text) > max_chars_per_turn:
            text = text[: max_chars_per_turn - 1].rstrip() + "…"
        if text:
            capped.append((role, text))
    return capped
