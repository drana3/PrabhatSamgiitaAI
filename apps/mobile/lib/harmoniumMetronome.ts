import { playWesternNote } from "@/lib/harmoniumPlayback"

let timer: ReturnType<typeof setInterval> | null = null
let activeBpm = 0

export function startHarmoniumMetronome(bpm: number): void {
  stopHarmoniumMetronome()
  const safeBpm = Math.max(40, Math.min(220, Math.round(bpm)))
  activeBpm = safeBpm
  const intervalMs = Math.round(60_000 / safeBpm)
  void playWesternNote("C5", 0.06)
  timer = setInterval(() => {
    void playWesternNote("C5", 0.06)
  }, intervalMs)
}

export function stopHarmoniumMetronome(): void {
  if (timer) clearInterval(timer)
  timer = null
  activeBpm = 0
}

export function harmoniumMetronomeActive(): boolean {
  return timer != null
}

export function harmoniumMetronomeBpm(): number {
  return activeBpm
}
