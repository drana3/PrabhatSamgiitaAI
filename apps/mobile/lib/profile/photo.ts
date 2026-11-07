import * as ImageManipulator from "expo-image-manipulator"
import * as ImagePicker from "expo-image-picker"
import { Linking, Platform } from "react-native"

import type { CropRect } from "@/lib/profile/crop"
import { workingSize } from "@/lib/profile/downscale"
import { PHOTO_QUALITY, PHOTO_SIZE } from "@/lib/profile/validate"
import { t } from "@/lib/i18n"

export type PhotoSource = "library" | "camera"

export type PhotoResult =
  | { status: "ok"; uri: string }
  | { status: "cancelled" }
  /** the system said no; `canAskAgain` false means only Settings can change it */
  | { status: "denied"; canAskAgain: boolean }
  | { status: "error"; message: string }

/** Camera is offered on phones only; the browser preview has the file chooser. */
export function cameraOffered(): boolean {
  return Platform.OS !== "web"
}

export function openAppSettings(): void {
  void Linking.openSettings().catch(() => undefined)
}

export type PickedImage = { uri: string; width: number; height: number }

export type PickResult =
  | { status: "ok"; image: PickedImage }
  | { status: "cancelled" }
  /** the system said no; `canAskAgain` false means only Settings can change it */
  | { status: "denied"; canAskAgain: boolean }
  | { status: "error"; message: string }

/**
 * A 48 MP photo decoded for the crop sheet can exhaust a weak Android phone's memory, and the avatar
 * is 512 px. Shrink the long side to 2048 px first; if that fails the original is used as it was.
 */
async function shrinkForFraming(image: PickedImage): Promise<PickedImage> {
  const size = workingSize(image.width, image.height)
  if (!size) return image
  try {
    const made = await ImageManipulator.manipulateAsync(image.uri, [{ resize: size }], {
      compress: 0.92,
      format: ImageManipulator.SaveFormat.JPEG,
    })
    return { uri: made.uri, width: made.width, height: made.height }
  } catch {
    return image
  }
}

/**
 * Pick (or take) a picture and hand it back whole, with its size. The system's own square editor is off:
 * the app's crop sheet (components/profile-v2/PhotoCropSheet.tsx) does the framing, so the person can place
 * a face where they want it. The library picker needs no permission on current iOS and Android; the camera asks.
 */
export async function pickProfileImage(source: PhotoSource): Promise<PickResult> {
  try {
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) return { status: "denied", canAskAgain: permission.canAskAgain }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: false, quality: 1 }
    const picked =
      source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
    if (picked.canceled || !picked.assets?.[0]) return { status: "cancelled" }
    const asset = picked.assets[0]
    if (!asset.uri || !asset.width || !asset.height) return { status: "error", message: t("account.photo.unreadable") }
    return { status: "ok", image: await shrinkForFraming({ uri: asset.uri, width: asset.width, height: asset.height }) }
  } catch (error) {
    const text = error instanceof Error ? error.message : ""
    if (/permission|denied|authori[sz]/i.test(text)) return { status: "denied", canAskAgain: false }
    return { status: "error", message: t("account.photo.unusable") }
  }
}

/**
 * Cut the chosen square out of the picture, resize it to 512 px and encode it as a JPEG data URI, so the
 * same value is what the profile stores and what the upload will send.
 */
export async function renderProfilePhoto(uri: string, rect: CropRect): Promise<PhotoResult> {
  try {
    const made = await ImageManipulator.manipulateAsync(
      uri,
      [{ crop: rect }, { resize: { width: PHOTO_SIZE, height: PHOTO_SIZE } }],
      { compress: PHOTO_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    )
    if (!made.base64) return { status: "error", message: t("account.photo.unreadable") }
    return { status: "ok", uri: `data:image/jpeg;base64,${made.base64}` }
  } catch {
    return { status: "error", message: t("account.photo.unusable") }
  }
}
