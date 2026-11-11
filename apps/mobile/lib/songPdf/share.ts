import { Platform } from "react-native"

import { buildSongPdfHtml, type PdfPlan } from "./html"
import type { PdfOptions, PdfSongInput } from "./types"

/** `ps-1-bandhu-he-niye-calo.pdf` */
export function pdfFileName(song: Pick<PdfSongInput, "number" | "title">): string {
  const slug = song.title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return `ps-${song.number}${slug ? `-${slug}` : ""}.pdf`
}

/**
 * Makes the PDF on the phone, with no server: the page is printed to a file and the share sheet offers it (save to Files,
 * send, print). In a browser the print dialog opens instead, "Save as PDF" is in it. `missing` is what was asked for and
 * the song does not have, so the sheet can say it after the file is made.
 */
export async function shareSongPdf(song: PdfSongInput, options: PdfOptions): Promise<{ plan: PdfPlan; shared: boolean }> {
  const photo = song.photo ?? (await (await import("./photo")).pdfPhotoFor(song.number, options.theme))
  const { html, plan, page } = buildSongPdfHtml({ ...song, photo }, options)
  const Print = await import("expo-print")
  if (Platform.OS === "web") {
    await Print.printAsync({ html })
    return { plan, shared: true }
  }
  const size = page === "landscape" ? { width: 842, height: 595 } : { width: 595, height: 842 }
  const { uri } = await Print.printToFileAsync({ html, ...size })
  const Sharing = await import("expo-sharing")
  if (!(await Sharing.isAvailableAsync())) return { plan, shared: false }
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: pdfFileName(song) })
  return { plan, shared: true }
}
