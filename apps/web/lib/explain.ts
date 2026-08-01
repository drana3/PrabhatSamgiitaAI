import { fetchJson } from "./api"
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
): Promise<void> {
  if (prompt && !queryIsUseful(prompt, 800)) {
    onChunk(queryGuidanceFor(prompt))
    return
  }
  const response = await fetchJson("/api/v1/ai/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      song_number: songNumber,
      prompt,
      history: history.slice(-12),
    }),
  })

  if (!response.ok) {
    throw new Error("The song companion is temporarily unavailable.")
  }

  if (!response.body) {
    onChunk("Streaming unavailable.")
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split("\n\n")
    buffer = frames.pop() ?? ""
    for (const frame of frames) {
      const line = frame
        .split("\n")
        .find((entry) => entry.startsWith("data: "))
      if (line) onChunk(line.slice(6))
    }
  }
}
