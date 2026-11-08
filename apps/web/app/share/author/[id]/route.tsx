import { readFile } from "node:fs/promises"
import path from "node:path"

import { ImageResponse } from "next/og"

import { authorCardElement, DISPLAY_FONT, MONO_FONT } from "@/lib/author-card-image"
import { CARD_FORMATS, authorCardPhoto, cardFormatOf, sniffDrawable } from "@/lib/author-card"
import { fetchAuthorPhotoBytes, fetchAuthorProfile } from "@/lib/authors"

/**
 * The picture a chat or a social network shows when a link to an author page is pasted (docs/share.md, "Author page
 * preview"), and the same picture in two more shapes for people to post:
 *   GET /share/author/<page id or address>                  1200 x 630 (1.91:1), the link preview
 *   GET /share/author/<page id or address>?format=story     1080 x 1920 (9:16), an Instagram story
 *   GET /share/author/<page id or address>?format=square    1080 x 1080
 * Only a published page has a picture (404 otherwise; the page then falls back to the site's own image). The drawing
 * is lib/author-card-image.tsx, the rules lib/author-card.ts. No listener numbers and no site address are ever drawn.
 */
export const runtime = "nodejs"
export const revalidate = 3600

const FILE_ROOT = path.join(process.cwd(), "public")

async function file(...parts: string[]): Promise<Buffer> {
  return readFile(path.join(FILE_ROOT, ...parts))
}

const HEADERS = { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" }

function dataUri(mime: string, bytes: Uint8Array | Buffer): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id: rawId } = await context.params
  const key = decodeURIComponent(rawId).replace(/\.png$/i, "")
  const format = cardFormatOf(new URL(request.url).searchParams.get("format"))

  const profile = await fetchAuthorProfile(key)
  if (!profile) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } })

  try {
    const [gloock, mono, bg, own] = await Promise.all([
      file("fonts", "Gloock-Regular.ttf"),
      file("fonts", "DMMono-Regular.ttf"),
      file("share", "bg", `${authorCardPhoto(profile.id)}.jpg`),
      profile.photo_url ? fetchAuthorPhotoBytes(profile.id) : Promise.resolve(null),
    ])
    const mime = own ? sniffDrawable(own) : null
    const element = authorCardElement({
      profile,
      format,
      background: dataUri("image/jpeg", bg),
      photo: own && mime ? dataUri(mime, own) : null,
    })
    const { width, height } = CARD_FORMATS[format]
    return new ImageResponse(element, {
      width,
      height,
      headers: HEADERS,
      fonts: [
        { name: DISPLAY_FONT, data: gloock, weight: 400, style: "normal" },
        { name: MONO_FONT, data: mono, weight: 400, style: "normal" },
      ],
    })
  } catch {
    return new Response("The picture could not be made", { status: 500, headers: { "Cache-Control": "no-store" } })
  }
}
