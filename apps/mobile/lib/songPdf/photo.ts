import { Platform } from "react-native"

import { photoWithoutPeople, STOCK_PHOTOS, type PhotoMood } from "@/lib/photos/catalog"

import type { PdfThemeId } from "./types"

const MOOD: Record<PdfThemeId, PhotoMood> = { dawn: "morning", night: "night", hymnal: "evening", poster: "calm", mono: "calm" }

/** Dawn always gets the misty mountain valley: it is the one the sky of the Sheet is drawn around. */
const DAWN_PHOTO = 27

function sourceFor(number: number | string, theme: PdfThemeId, size: "cover" | "thumb") {
  const misty = theme === "dawn" ? STOCK_PHOTOS.find((p) => p.n === DAWN_PHOTO) : undefined
  return (misty ?? photoWithoutPeople(`ps-${number}`, MOOD[theme]))[size]
}

/**
 * The picture on the PDF header: a stock photo with nobody in it, the same one every time for the same song and look
 * (the app's own photo system, no people, no Babá). A printed page cannot reach the app bundle, so on the phone the
 * file is read and inlined as a data URI. Returns null when it cannot be read: the PDF is then made without a photo.
 */
export async function pdfPhotoFor(number: number | string, theme: PdfThemeId, size: "cover" | "thumb" = "cover"): Promise<string | null> {
  try {
    const { Asset } = await import("expo-asset")
    const asset = Asset.fromModule(sourceFor(number, theme, size))
    if (Platform.OS === "web") {
      const uri = asset.uri
      return uri.startsWith("http") || uri.startsWith("data:") ? uri : `${globalThis.location?.origin ?? ""}${uri}`
    }
    await asset.downloadAsync()
    if (!asset.localUri) return null
    const FileSystem = await import("expo-file-system/legacy")
    const base64 = await FileSystem.readAsStringAsync(asset.localUri, { encoding: FileSystem.EncodingType.Base64 })
    return `data:image/jpeg;base64,${base64}`
  } catch {
    return null
  }
}
