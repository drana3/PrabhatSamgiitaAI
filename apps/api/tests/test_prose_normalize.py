from app.services.prose_normalize import normalize_prose_block


def test_unwraps_soft_line_wraps_inside_paragraphs() -> None:
    raw = "Darkness has come to an end,\ncrossing the threshold.\n\nNow call all."
    assert normalize_prose_block(raw) == (
        "Darkness has come to an end, crossing the threshold.\n\nNow call all."
    )


def test_collapses_line_as_paragraph_artifacts() -> None:
    raw = "\n\n".join(
        [
            "Calling all,",
            "I will sing the glories",
            "of this crimson dawn",
            "in the kingdom of light.",
            "The sky is studded with stars.",
        ]
    )
    out = normalize_prose_block(raw)
    assert "\n" not in out
    assert "Calling all, I will sing" in out
