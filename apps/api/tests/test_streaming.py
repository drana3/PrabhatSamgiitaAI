import pytest

from app.services.streaming import stream_text


@pytest.mark.asyncio
async def test_stream_text_emits_multiline_chunks_as_separate_data_lines() -> None:
    chunks = ["Intro line", "1. Lyric: first\nMeaning: one"]
    frames = [frame async for frame in stream_text(chunks)]
    payload = b"".join(frames).decode()

    assert payload == (
        "data: Intro line\n"
        "\n"
        "data: 1. Lyric: first\n"
        "data: Meaning: one\n"
        "\n"
    )
