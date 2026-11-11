import { Platform } from "react-native"

import { photoWithoutPeople, type PhotoMood } from "@/lib/photos/catalog"

import type { PdfThemeId } from "./types"

const MOOD: Record<PdfThemeId, PhotoMood> = { dawn: "morning", night: "night", hymnal: "evening", poster: "calm", mono: "calm" }

/**
 * The picture on the PDF header: a stock photo with nobody in it, the same one every time for the same song and look
 * (the app's own photo system, no people, no Babá). A printed page cannot reach the app bundle, so on the phone the
 * file is read and inlined as a data URI. Returns null when it cannot be read: the PDF is then made without a photo.
 */
export async function pdfPhotoFor(number: number | string, theme: PdfThemeId, size: "cover" | "thumb" = "cover"): Promise<string | null> {
  try {
    const { Asset } = await import("expo-asset")
    const asset = Asset.fromModule(photoWithoutPeople(`ps-${number}`, MOOD[theme])[size])
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
