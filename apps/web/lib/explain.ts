import { queryGuidanceFor, queryIsUseful } from "./query-guard"

export type ConversationTurn = {
  role: "user" | "assistant"
  content: string
}

export async function streamExplanation(
  songNumber: number,
  onChunk: (chunk: string) => void,
  prompt?: string,
  history: ConversationTurn[] = [],
  profileContext?: string,
): Promise<void> {
  if (prompt && !queryIsUseful(prompt, 800)) {
    onChunk(queryGuidanceFor(prompt))
    return
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)
  let response: Response
  try {
    response = await fetch("/api/ai/explain", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        song_number: songNumber,
        prompt,
        history: history.slice(-12),
        profile_context: profileContext || undefined,
      }),
      signal: controller.signal,
      cache: "no-store",
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new Error("The song companion is temporarily unavailable.")
  }

  const body = response.body

  const emitFrames = (raw: string, flushPartial: boolean): string => {
    const frames = raw.split("\n\n")
    const remainder = frames.pop() ?? ""
    for (const frame of frames) {
      const payload = frame
        .split("\n")
        .filter((entry) => entry.startsWith("data: "))
        .map((entry) => entry.slice(6))
        .join("\n")
      if (payload) onChunk(payload)
    }
    if (flushPartial && remainder.trim()) {
      const payload = remainder
        .split("\n")
        .filter((entry) => entry.startsWith("data: "))
        .map((entry) => entry.slice(6))
        .join("\n")
      if (payload) onChunk(payload)
      return ""
    }
    return remainder
  }

  // Some runtimes (notably React Native) buffer SSE without exposing response.body.
  if (!body || typeof body.getReader !== "function") {
    const raw = await response.text()
    if (!raw.trim()) {
      onChunk("Streaming unavailable.")
      return
    }
    emitFrames(raw, true)
    return
  }

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    buffer = emitFrames(buffer, false)
  }
  buffer += decoder.decode()
  emitFrames(buffer, true)
}
