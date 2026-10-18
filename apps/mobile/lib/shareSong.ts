import { Platform, Share } from "react-native"

import { songShareMessage, songShareUrl } from "@/lib/webLinks"

export async function shareSong(input: {
  number: number
  title: string
  performer?: string | null
  detail?: string | null
}): Promise<void> {
  const message = songShareMessage(input.number, input.title, {
    performer: input.performer,
    detail: input.detail,
  })
  const title = `PS ${input.number} · ${input.title.trim() || "Prabhat Samgiita"}`

  if (Platform.OS === "ios") {
    // Keep the URL in the message body so Messages/WhatsApp format cleanly.
    await Share.share({ message, subject: title })
    return
  }

  await Share.share({
    message,
    title,
    url: songShareUrl(input.number),
  })
}
