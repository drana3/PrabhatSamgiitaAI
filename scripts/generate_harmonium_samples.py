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
DURATION = 1.25

# Odd-heavy spectrum + weak evens — closer to metal reed tongues.
HARMONICS = (
    (1.0, 1),
    (0.07, 2),
    (0.78, 3),
    (0.11, 4),
    (0.52, 5),
    (0.06, 6),
    (0.32, 7),
    (0.14, 9),
)


def midi_to_hz(midi: int) -> float:
    return 440.0 * (2 ** ((midi - 69) / 12))


def note_name(midi: int) -> str:
    return f"{NOTES[midi % 12]}{midi // 12 - 1}"


def soft_clip(value: float) -> float:
    return math.tanh(value * 1.15)


def reed_samples(frequency: float, duration: float = DURATION, sample_rate: int = SAMPLE_RATE) -> list[int]:
    total = int(sample_rate * duration)
    out: list[int] = []
    for i in range(total):
        t = i / sample_rate
        attack = min(1.0, t / 0.085)
        release = min(1.0, max(0.0, duration - t) / 0.22)
        # Reed flutter + slow bellows sway (typical of hand-pumped harmonium).
        flutter = 1.0 + 0.038 * math.sin(2 * math.pi * 46 * t) + 0.014 * math.sin(2 * math.pi * 71 * t)
        sway = 1.0 + 0.0035 * math.sin(2 * math.pi * 4.1 * t)
        pitch = frequency * sway

        sample = 0.0
        for amp, mult in HARMONICS:
            sample += amp * math.sin(2 * math.pi * pitch * mult * flutter * t)

        # Coupler octave (bass reed) — common in traditional practice harmoniums.
        sample += 0.24 * math.sin(2 * math.pi * pitch * 0.5 * t) * (0.75 + 0.25 * flutter)

        # Air / reed chatter (deterministic, reproducible).
        sample += 0.018 * math.sin(2 * math.pi * (pitch * 1.7) * t + i * 0.91)
        sample += 0.012 * math.sin(2 * math.pi * (pitch * 2.3) * t + i * 1.37)

        envelope = attack * release
        value = max(-1.0, min(1.0, soft_clip(sample * 0.28) * envelope))
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
        "engine": "reed_harmonic_v2",
        "sample_rate": SAMPLE_RATE,
        "duration_sec": DURATION,
        "range": "C3-C6",
        "count": 85 - 48,
        "features": ["odd_harmonics", "reed_flutter", "octave_coupler", "soft_clip"],
    }
    for target in (WEB_DIR, MOBILE_DIR):
        (target / "manifest.json").write_text(
            __import__("json").dumps(manifest, indent=2) + "\n",
            encoding="utf-8",
        )
    print(f"Wrote {85 - 48} harmonium samples to {WEB_DIR} and {MOBILE_DIR}")


if __name__ == "__main__":
    main()
