import * as ImageManipulator from "expo-image-manipulator"
import * as ImagePicker from "expo-image-picker"
import { Linking, Platform } from "react-native"

import { PHOTO_QUALITY, PHOTO_SIZE, centerSquare } from "@/lib/profile/validate"

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

/**
 * Pick (or take) a picture, crop it to a centred square, resize it to 512 px and encode it as a JPEG
 * data URI, so the same value is what the profile stores and what the upload will send.
 * The library picker needs no permission on current iOS and Android; the camera asks for it.
 */
export async function chooseProfilePhoto(source: PhotoSource): Promise<PhotoResult> {
  try {
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) return { status: "denied", canAskAgain: permission.canAskAgain }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    }
    const picked =
      source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
    if (picked.canceled || !picked.assets?.[0]) return { status: "cancelled" }
    const asset = picked.assets[0]
    const crop = centerSquare(asset.width, asset.height)
    const made = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ crop }, { resize: { width: PHOTO_SIZE, height: PHOTO_SIZE } }],
      { compress: PHOTO_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    )
    if (!made.base64) return { status: "error", message: "That picture could not be read. Try another one." }
    return { status: "ok", uri: `data:image/jpeg;base64,${made.base64}` }
  } catch (error) {
    const text = error instanceof Error ? error.message : ""
    if (/permission|denied|authori[sz]/i.test(text)) return { status: "denied", canAskAgain: false }
    return { status: "error", message: "That picture could not be used. Try another one." }
  }
}
