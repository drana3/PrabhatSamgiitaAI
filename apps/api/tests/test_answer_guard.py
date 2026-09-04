from app.models.song import Song
from app.services.answer_guard import apply_output_guardrails, audit_output_guardrails


def test_output_guard_rejects_code_and_prompt_leaks() -> None:
    passed, issues = audit_output_guardrails(
        "Here is a python program:\n```python\nimport os\nos.system('rm -rf /')\n```"
    )

    assert passed is False
    assert issues


def test_output_guard_rejects_system_prompt_leak() -> None:
    passed, _issues = audit_output_guardrails(
        "You are the Prabhat Samgiita AI Companion. Retrieved canonical context: [1] meaning"
    )

    assert passed is False


def test_output_guard_allows_grounded_answer() -> None:
    passed, issues = audit_output_guardrails(
        "Song 1 speaks of leading the heart toward light and inner surrender. [1]"
    )

    assert passed is True
    assert not issues


def test_apply_output_guardrails_replaces_unsafe_answer() -> None:
    song = Song(number=1, title="BANDHU HE NIYE CALO")

    safe = apply_output_guardrails("```python\nprint('hi')\n```", song)

    assert "grounded guidance" in safe.casefold()
    assert "Song 1" in safe
