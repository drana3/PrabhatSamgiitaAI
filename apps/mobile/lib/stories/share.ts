/**
 * What the Share button sends for a story. The story's own web page is used only when the API gave one; no
 * address is made up.
 */
export function storyShareMessage(input: {
  title: string
  songNumber?: number | null
  songTitle?: string | null
  url?: string | null
}): { message: string; subject: string } {
  const title = input.title.trim() || "A story behind a song"
  const song = input.songNumber
    ? `About PS ${input.songNumber}${input.songTitle?.trim() ? `, ${input.songTitle.trim()}` : ""}.`
    : ""
  const lines = [title, song, "A story behind a Prabhat Samgiita song.", input.url?.trim() ?? ""].filter(Boolean)
  return { message: lines.join("\n"), subject: title }
}
