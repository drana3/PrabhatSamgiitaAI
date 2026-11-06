import {
  NO_ANSWER_COPY,
  classifyAnswer,
  groundingNumber,
  resolveTurnGrounding,
  type AnswerKind,
  type TurnGrounding,
} from "@/lib/assistantAnswer"
import type { QuotaReport } from "@/lib/assistantServerQuota"
import { t } from "@/lib/i18n"
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

/**
 * A failed request in plain words, in the app language. The server's stable `error code` decides
 * (rate limit, expired sign-in, the quota); network and timeout failures are told apart by what
 * fetch throws. Technical messages never reach the person.
 */
export function friendlyError(error: unknown, context: { isMember?: boolean } = {}): string {
  const name = error instanceof Error ? error.name : ""
  const message = error instanceof Error ? error.message : ""
  const code = typeof (error as { code?: unknown } | null)?.code === "string" ? (error as { code: string }).code : ""
  if (name === "AbortError") return t("assistant.error.timeout")
  if (/network request failed|failed to fetch|offline/i.test(message)) return t("assistant.error.offline")
  return friendlyCode(code, context) ?? t("assistant.error.unavailable")
}

/** The words for a server error code, or null when the code has none of its own. */
export function friendlyCode(code: string, context: { isMember?: boolean } = {}): string | null {
  switch (code) {
    case "rate_limited":
    case "http_429":
      return t("assistant.error.rateLimited")
    case "http_401":
    case "http_403":
      return t("assistant.error.signedOut")
    case "quota_exceeded":
      return t(context.isMember ? "assistant.error.quotaMember" : "assistant.error.quotaGuest")
    default:
      return null
  }
}

export type TurnDeps = {
  /** api.streamExplanation, unchanged */
  stream: (
    songNumber: number,
    onChunk: (chunk: string) => void,
    prompt: string,
    history: HistoryTurn[],
    /** the server's stable code when its reply is a notice (api.streamExplanation's `onNotice`) */
    onNotice?: (code: string) => void,
    /** today's allowance as the server reports it (api.streamExplanation's `onQuota`) */
    onQuota?: (quota: QuotaReport) => void,
  ) => Promise<void>
  /** chatStore.beginExchange bound to the account; returns the assistant message id */
  beginExchange: (displayPrompt: string) => string | null
  updateMessage: (assistantId: string, text: string) => void
  /** Only called for real answers. */
  saveMemory?: (turns: HistoryTurn[]) => void
  /** The server's count of today's questions, when it sends one. */
  onQuota?: (quota: QuotaReport) => void
}

export type TurnInput = {
  prompt: string
  history: HistoryTurn[]
  /** the song the sheet was opened on, if any */
  sheetSong: number | null
  language: AssistantLanguage
  /** picks the words of the daily-limit notice; a guest is offered to sign in */
  isMember?: boolean
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
  let noticeCode = ""
  try {
    await deps.stream(
      songNumber,
      (chunk) => {
        buffer += chunk
        deps.updateMessage(assistantId, formatAssistantMessage(buffer) || "…")
      },
      apiPrompt,
      input.history,
      (code) => {
        noticeCode = code
      },
      deps.onQuota,
    )
    finalText = buffer.trim() ? formatAssistantMessage(buffer) : NO_ANSWER_COPY
    // the daily limit is told in the app language, not in the server's English sentence
    if (noticeCode === "quota_exceeded") finalText = friendlyCode(noticeCode, { isMember: input.isMember }) ?? finalText
  } catch (error) {
    finalText = friendlyError(error, { isMember: input.isMember })
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
