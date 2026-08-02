from __future__ import annotations

from collections.abc import AsyncIterator


async def stream_text(chunks: list[str]) -> AsyncIterator[bytes]:
    for chunk in chunks:
        if not chunk:
            continue
        for line in chunk.splitlines():
            yield f"data: {line}\n".encode()
        yield b"\n"
