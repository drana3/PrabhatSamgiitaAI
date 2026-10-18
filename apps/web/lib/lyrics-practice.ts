export type LyricsPracticeResult = {
  score: number | null
  matchedWords: number
  expectedWords: number
  bestLine: string | null
  heardTranscript: string
  suggestions: string[]
}

export function normalizeLyricText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\u0900-\u097F\s'-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function lyricTokens(value: string) {
  const normalized = phoneticLyricKey(normalizeLyricText(value))
  if (!normalized) return []
  return normalized.split(" ").filter((token) => token.length > 1)
}

export function compareLyricsTranscript(transcript: string, expectedLines: string[]): LyricsPracticeResult {
  const heardTranscript = transcript.trim()
  const cleanedLines = expectedLines.map((line) => line.trim()).filter(Boolean)
  if (!heardTranscript) {
    return {
      score: null,
      matchedWords: 0,
      expectedWords: 0,
      bestLine: null,
      heardTranscript,
      suggestions: ["Sing the words clearly while recording so the browser can hear the lyric line."],
    }
  }
  if (!cleanedLines.length) {
    return {
      score: null,
      matchedWords: 0,
      expectedWords: 0,
      bestLine: null,
      heardTranscript,
      suggestions: ["This song does not yet have lyric lines to compare against."],
    }
  }

  const heardTokens = lyricTokens(heardTranscript)
  if (!heardTokens.length) {
    return {
      score: null,
      matchedWords: 0,
      expectedWords: 0,
      bestLine: null,
      heardTranscript,
      suggestions: ["The recording did not capture recognizable words. Try one short lyric line closer to the microphone."],
    }
  }

  let bestLine = cleanedLines[0]
  let bestMatched = 0
  let bestExpected = lyricTokens(cleanedLines[0]).length

  for (const line of cleanedLines) {
    const expectedTokens = lyricTokens(line)
    if (!expectedTokens.length) continue
    const matched = expectedTokens.filter((token) => heardTokens.some((heard) => tokensSimilar(heard, token))).length
    const ratio = matched / expectedTokens.length
    const bestRatio = bestExpected ? bestMatched / bestExpected : 0
    if (ratio > bestRatio || (ratio === bestRatio && matched > bestMatched)) {
      bestLine = line
      bestMatched = matched
      bestExpected = expectedTokens.length
    }
  }

  const score = bestExpected ? Math.max(1, Math.min(100, Math.round((bestMatched / bestExpected) * 100))) : null
  const suggestions: string[] = []
  const expectedTokens = lyricTokens(bestLine)
  const missing = expectedTokens.filter((token) => !heardTokens.some((heard) => tokensSimilar(heard, token)))

  if (score !== null && score >= 70) {
    suggestions.push("Your words are close to the lyric line. Keep the same clarity while matching the melody.")
  } else if (score !== null && score >= 40) {
    suggestions.push("Part of the lyric line is coming through. Sing one line slowly while reading the words on screen.")
  } else {
    suggestions.push("The sung words do not yet match the lyric line closely. Listen once, then sing one short line at a time.")
  }

  if (missing.length && missing.length <= 6) {
    suggestions.push(`Focus on these words next: ${missing.slice(0, 6).join(", ")}.`)
  }

  return {
    score,
    matchedWords: bestMatched,
    expectedWords: bestExpected,
    bestLine,
    heardTranscript,
    suggestions,
  }
}

function tokensSimilar(left: string, right: string) {
  if (left === right) return true
  if (left.length >= 4 && right.length >= 4 && (left.startsWith(right.slice(0, 4)) || right.startsWith(left.slice(0, 4)))) {
    return true
  }
  return levenshtein(left, right) <= 1
}

function phoneticLyricKey(value: string) {
  return value
    .replace(/\bph/g, "f")
    .replace(/\bbh/g, "b")
    .replace(/\bdh/g, "d")
    .replace(/\bth/g, "t")
    .replace(/sh/g, "s")
    .replace(/aa/g, "a")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
}

function levenshtein(left: string, right: string) {
  const rows = left.length + 1
  const columns = right.length + 1
  const costs = Array.from({ length: rows }, () => new Uint16Array(columns))
  for (let row = 0; row < rows; row++) costs[row][0] = row
  for (let column = 0; column < columns; column++) costs[0][column] = column
  for (let row = 1; row < rows; row++) {
    for (let column = 1; column < columns; column++) {
      const price = left[row - 1] === right[column - 1] ? 0 : 1
      costs[row][column] = Math.min(
        costs[row - 1][column] + 1,
        costs[row][column - 1] + 1,
        costs[row - 1][column - 1] + price,
      )
    }
  }
  return costs[rows - 1][columns - 1]
}
