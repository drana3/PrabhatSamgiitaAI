import { readFile } from "node:fs/promises"
import path from "node:path"

import { ImageResponse } from "next/og"

import { CARD_FORMATS, cardFormatOf } from "@/lib/author-card"
import { fetchSong } from "@/lib/api"
import { coalesceSongDetail, localSongDetail } from "@/lib/local-song-catalog"
import { songCardElement, SONG_DISPLAY_FONT, SONG_MONO_FONT } from "@/lib/song-card-image"
import { isSongNumber, songCardPhoto } from "@/lib/song-card"

/**
 * The picture a chat or a social network shows when a song link is pasted (docs/share.md, "Song page preview"):
 *   GET /share/song/<number>                  1200 x 630 (1.91:1), the link preview
 *   GET /share/song/<number>?format=story     1080 x 1920 (9:16)
 *   GET /share/song/<number>?format=square    1080 x 1080
 * An unknown song has no picture (404); the song page then falls back to the site's own image.
 */
export const runtime = "nodejs"
export const revalidate = 3600

const FILE_ROOT = path.join(process.cwd(), "public")
const HEADERS = { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" }

async function file(...parts: string[]): Promise<Buffer> {
  return readFile(path.join(FILE_ROOT, ...parts))
}

export async function GET(request: Request, context: { params: Promise<{ number: string }> }): Promise<Response> {
  const { number: raw } = await context.params
  const key = decodeURIComponent(raw).replace(/\.png$/i, "")
  if (!isSongNumber(key)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } })
  const number = Number(key)
  const format = cardFormatOf(new URL(request.url).searchParams.get("format"))

  const song = coalesceSongDetail(await fetchSong(number), localSongDetail(number))
  if (!song) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } })

  try {
    const [gloock, mono, bg] = await Promise.all([
      file("fonts", "Gloock-Regular.ttf"),
      file("fonts", "DMMono-Regular.ttf"),
      file("share", "bg", `${songCardPhoto(number)}.jpg`),
    ])
    const element = songCardElement({
      song: { number: song.number, title: song.title, first_line: song.first_line, language: song.language, theme: song.theme },
      format,
      background: `data:image/jpeg;base64,${bg.toString("base64")}`,
    })
    const { width, height } = CARD_FORMATS[format]
    return new ImageResponse(element, {
      width,
      height,
      headers: HEADERS,
      fonts: [
        { name: SONG_DISPLAY_FONT, data: gloock, weight: 400, style: "normal" },
        { name: SONG_MONO_FONT, data: mono, weight: 400, style: "normal" },
      ],
    })
  } catch {
    return new Response("The picture could not be made", { status: 500, headers: { "Cache-Control": "no-store" } })
  }
}
