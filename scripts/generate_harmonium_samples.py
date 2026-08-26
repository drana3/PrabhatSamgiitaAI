#!/usr/bin/env python3
"""Generate reed-like harmonium WAV samples (C3–C6) into apps/web/public and mobile assets."""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB_DIR = ROOT / "apps" / "web" / "public" / "audio" / "harmonium"
MOBILE_DIR = ROOT / "apps" / "mobile" / "assets" / "audio" / "harmonium"
NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
SAMPLE_RATE = 22050
DURATION = 0.85


def midi_to_hz(midi: int) -> float:
    return 440.0 * (2 ** ((midi - 69) / 12))


def note_name(midi: int) -> str:
    return f"{NOTES[midi % 12]}{midi // 12 - 1}"


def reed_samples(frequency: float, duration: float = DURATION, sample_rate: int = SAMPLE_RATE) -> list[int]:
    total = int(sample_rate * duration)
    out: list[int] = []
    # Harmonium-ish: strong odd harmonics + soft even, slow attack, gentle vibrato.
    harmonics = (
        (1.0, 1.0),
        (0.55, 2.0),
        (0.35, 3.0),
        (0.18, 4.0),
        (0.12, 5.0),
        (0.08, 6.0),
        (0.05, 7.0),
    )
    for i in range(total):
        t = i / sample_rate
        attack = min(1.0, t / 0.04)
        release = min(1.0, (duration - t) / 0.12) if t < duration else 0.0
        vibrato = 1.0 + 0.004 * math.sin(2 * math.pi * 5.5 * t)
        sample = 0.0
        for amp, mult in harmonics:
            sample += amp * math.sin(2 * math.pi * frequency * mult * vibrato * t)
        # Soft breath noise
        sample += 0.015 * math.sin(2 * math.pi * (frequency * 0.5) * t + i * 0.7)
        envelope = attack * release
        value = max(-1.0, min(1.0, sample * 0.22 * envelope))
        out.append(int(value * 32767))
    return out


def write_wav(path: Path, samples: list[int], sample_rate: int = SAMPLE_RATE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        handle.writeframes(b"".join(struct.pack("<h", sample) for sample in samples))


def main() -> None:
    # C3 (48) through C6 (84)
    for midi in range(48, 85):
        name = note_name(midi).replace("#", "s")  # C#4 -> Cs4 for safe filenames
        samples = reed_samples(midi_to_hz(midi))
        for target in (WEB_DIR, MOBILE_DIR):
            write_wav(target / f"{name}.wav", samples)
    manifest = {
        "engine": "reed_harmonic_v1",
        "sample_rate": SAMPLE_RATE,
        "duration_sec": DURATION,
        "range": "C3-C6",
        "count": 85 - 48,
    }
    for target in (WEB_DIR, MOBILE_DIR):
        (target / "manifest.json").write_text(
            __import__("json").dumps(manifest, indent=2) + "\n",
            encoding="utf-8",
        )
    print(f"Wrote {85 - 48} harmonium samples to {WEB_DIR} and {MOBILE_DIR}")


if __name__ == "__main__":
    main()
