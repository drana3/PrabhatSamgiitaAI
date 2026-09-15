/** Touch the archive host so TLS + first bytes are ready before the browser opens the stream. */
export async function warmArchiveAudioStream(url: string): Promise<void> {
  const trimmed = url.trim()
  if (!trimmed || typeof fetch !== "function") return

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 1200)
  try {
    await fetch(trimmed, {
      method: "GET",
      headers: { Range: "bytes=0-2047" },
      signal: controller.signal,
    })
  } catch {
    /* best-effort only — never block playback */
  } finally {
    clearTimeout(timer)
  }
}
