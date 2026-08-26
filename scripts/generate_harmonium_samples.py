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
DURATION = 0.95

# Warm reed spectrum — odd harmonics present but not harsh.
HARMONICS = (
    (1.0, 1),
    (0.28, 2),
    (0.42, 3),
    (0.10, 4),
    (0.18, 5),
    (0.05, 6),
    (0.06, 7),
)


def midi_to_hz(midi: int) -> float:
    return 440.0 * (2 ** ((midi - 69) / 12))


def note_name(midi: int) -> str:
    return f"{NOTES[midi % 12]}{midi // 12 - 1}"


def reed_samples(frequency: float, duration: float = DURATION, sample_rate: int = SAMPLE_RATE) -> list[int]:
    total = int(sample_rate * duration)
    out: list[int] = []
    for i in range(total):
        t = i / sample_rate
        attack = min(1.0, t / 0.035)
        release = min(1.0, max(0.0, duration - t) / 0.14)
        # Gentle pitch vibrato only — avoids the wobble/beating from v2 phase flutter.
        vibrato = 1.0 + 0.003 * math.sin(2 * math.pi * 5.2 * t)
        pitch = frequency * vibrato

        sample = 0.0
        for amp, mult in HARMONICS:
            sample += amp * math.sin(2 * math.pi * pitch * mult * t)

        # Light bass coupler for body, kept subtle to avoid muddiness.
        sample += 0.06 * math.sin(2 * math.pi * pitch * 0.5 * t)

        envelope = attack * release
        value = max(-1.0, min(1.0, math.tanh(sample * 0.26) * envelope))
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
    for midi in range(48, 85):
        name = note_name(midi).replace("#", "s")
        samples = reed_samples(midi_to_hz(midi))
        for target in (WEB_DIR, MOBILE_DIR):
            write_wav(target / f"{name}.wav", samples)
    manifest = {
        "engine": "reed_harmonic_v3",
        "sample_rate": SAMPLE_RATE,
        "duration_sec": DURATION,
        "range": "C3-C6",
        "count": 85 - 48,
        "features": ["warm_harmonics", "gentle_vibrato", "light_coupler"],
    }
    for target in (WEB_DIR, MOBILE_DIR):
        (target / "manifest.json").write_text(
            __import__("json").dumps(manifest, indent=2) + "\n",
            encoding="utf-8",
        )
    print(f"Wrote {85 - 48} harmonium samples to {WEB_DIR} and {MOBILE_DIR}")


if __name__ == "__main__":
    main()
