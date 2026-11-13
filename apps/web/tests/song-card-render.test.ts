// @vitest-environment node
import { readFile } from "node:fs/promises"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { ImageResponse } from "next/og"

import { CARD_FORMATS } from "@/lib/author-card"
import { songCardElement, SONG_DISPLAY_FONT, SONG_MONO_FONT } from "@/lib/song-card-image"
import { songCardPhoto } from "@/lib/song-card"

/** Draws the real picture once, so a font or layout problem fails here and not on a shared link. */
describe("song card renders", () => {
  it("makes a PNG of the right size for the link format", async () => {
    const root = path.join(process.cwd(), "public")
    const [gloock, mono, bg] = await Promise.all([
      readFile(path.join(root, "fonts", "Gloock-Regular.ttf")),
      readFile(path.join(root, "fonts", "DMMono-Regular.ttf")),
      readFile(path.join(root, "share", "bg", `${songCardPhoto(1234)}.jpg`)),
    ])
    const element = songCardElement({
      song: { number: 1234, title: "Madhur Hásí Tava Cittá", first_line: "Madhur hásí tava cittá cora" },
      format: "link",
      background: `data:image/jpeg;base64,${bg.toString("base64")}`,
    })
    const { width, height } = CARD_FORMATS.link
    const response = new ImageResponse(element, {
      width,
      height,
      fonts: [
        { name: SONG_DISPLAY_FONT, data: gloock, weight: 400, style: "normal" },
        { name: SONG_MONO_FONT, data: mono, weight: 400, style: "normal" },
      ],
    })
    const bytes = new Uint8Array(await response.arrayBuffer())
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
    const view = new DataView(bytes.buffer, bytes.byteOffset)
    expect(view.getUint32(16)).toBe(1200)
    expect(view.getUint32(20)).toBe(630)
    // SONG_CARD_OUT=/some/file.png keeps the picture so a person can look at it
    if (process.env.SONG_CARD_OUT) await import("node:fs").then((fs) => fs.writeFileSync(process.env.SONG_CARD_OUT as string, bytes))
  }, 30_000)
})
