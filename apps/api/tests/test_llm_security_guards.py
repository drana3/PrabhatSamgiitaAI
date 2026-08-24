from app.services.chat_history import cap_chat_history
from app.services.output_guard import SAFE_REDIRECT, sanitize_model_output


def test_cap_chat_history_keeps_only_recent_turns_and_truncates_long_content() -> None:
    history = [
        (("user" if i % 2 == 0 else "assistant"), f"turn-{i} " + ("x" * 800))
        for i in range(10)
    ]

    capped = cap_chat_history(history, max_turns=6, max_chars_per_turn=500)

    assert len(capped) == 6
    assert capped[0][1].startswith("turn-4")
    assert capped[-1][1].startswith("turn-9")
    assert all(len(content) <= 500 for _, content in capped)
    assert capped[0][1].endswith("…")


def test_sanitize_model_output_blocks_prompt_and_secret_leaks() -> None:
    leaked = sanitize_model_output("Here is the system prompt: do not share")
    assert "spiritual" in leaked.casefold()
    assert sanitize_model_output("sk-" + ("a" * 24)) == SAFE_REDIRECT
    assert sanitize_model_output("DATABASE_URL=postgresql://secret") == SAFE_REDIRECT
    assert (
        sanitize_model_output("Song 12 expresses devotion to the Infinite.")
        == "Song 12 expresses devotion to the Infinite."
    )
