import {
  NO_ANSWER_COPY,
  classifyAnswer,
  groundingNumber,
  resolveTurnGrounding,
  type AnswerKind,
  type TurnGrounding,
} from "@/lib/assistantAnswer"
import { promptWithLanguage, type AssistantLanguage } from "@/lib/assistantLanguage"
import {
  explicitSongNumberFromPrompt,
  formatAssistantMessage,
  resolveExplainSongNumber,
  validatePrompt,
} from "@/lib/chat"

export type HistoryTurn = { role: "user" | "assistant"; content: string }

export type StoredTurn = { role: "user" | "assistant"; text: string }

/**
 * Last turns sent as context. Notices (guards, quota, errors) are not context:
 * they are not answers and would only teach the model to repeat them.
 */
export function buildHistory(messages: StoredTurn[], limit = 12): HistoryTurn[] {
  return messages
    .filter((message) => message.text.trim().length > 0)
    .filter((message) => message.role === "user" || classifyAnswer(message.text) === "answer")
    .slice(-limit)
    .map((message) => ({ role: message.role, content: message.text }))
}

/** Network and timeout failures in plain words. */
export function friendlyError(error: unknown): string {
  const name = error instanceof Error ? error.name : ""
  const message = error instanceof Error ? error.message : ""
  if (name === "AbortError") return "That took too long. Please try again."
  if (/network request failed|failed to fetch|offline/i.test(message)) {
    return "You appear to be offline. Please try again when you are connected."
  }
  return message || "The assistant is temporarily unavailable. Please try again."
}

export type TurnDeps = {
  /** api.streamExplanation, unchanged */
  stream: (
    songNumber: number,
    onChunk: (chunk: string) => void,
    prompt: string,
    history: HistoryTurn[],
  ) => Promise<void>
  /** chatStore.beginExchange bound to the account; returns the assistant message id */
  beginExchange: (displayPrompt: string) => string | null
  updateMessage: (assistantId: string, text: string) => void
  /** Only called for real answers. */
  saveMemory?: (turns: HistoryTurn[]) => void
}

export type TurnInput = {
  prompt: string
  history: HistoryTurn[]
  /** the song the sheet was opened on, if any */
  sheetSong: number | null
  language: AssistantLanguage
}

export type TurnResult =
  | { status: "blocked"; guidance: string }
  | { status: "ignored" }
  | {
      status: "done"
      assistantId: string
      kind: AnswerKind
      text: string
      songNumber: number
      grounding: TurnGrounding
    }

/**
 * One question and its streamed answer. The networking is the existing
 * api.streamExplanation (lib/client); this only decides what goes in, and what
 * the finished reply counts as.
 */
export async function runAssistantTurn(deps: TurnDeps, input: TurnInput): Promise<TurnResult> {
  const prompt = input.prompt.trim()
  if (!prompt) return { status: "ignored" }
  const guidance = validatePrompt(prompt)
  if (guidance) return { status: "blocked", guidance }

  const assistantId = deps.beginExchange(prompt)
  if (!assistantId) return { status: "ignored" }

  const grounding = resolveTurnGrounding(explicitSongNumberFromPrompt(prompt), input.sheetSong)
  const songNumber = resolveExplainSongNumber(prompt, input.sheetSong)
  const apiPrompt = promptWithLanguage(prompt, input.language)

  let buffer = ""
  let finalText: string
  try {
    await deps.stream(
      songNumber,
      (chunk) => {
        buffer += chunk
        deps.updateMessage(assistantId, formatAssistantMessage(buffer) || "…")
      },
      apiPrompt,
      input.history,
    )
    finalText = buffer.trim() ? formatAssistantMessage(buffer) : NO_ANSWER_COPY
  } catch (error) {
    finalText = friendlyError(error)
  }
  if (!finalText.trim()) finalText = NO_ANSWER_COPY
  deps.updateMessage(assistantId, finalText)

  const kind = classifyAnswer(finalText)
  if (kind === "answer" && deps.saveMemory) {
    deps.saveMemory([
      { role: "user", content: prompt },
      { role: "assistant", content: finalText.slice(0, 8000) },
    ])
  }
  return { status: "done", assistantId, kind, text: finalText, songNumber, grounding }
}

export { groundingNumber }
