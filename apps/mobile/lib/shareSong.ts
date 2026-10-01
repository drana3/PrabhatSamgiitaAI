import { Share } from "react-native"

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
  await Share.share({
    message,
    title: `PS ${input.number} — ${input.title}`,
    url: songShareUrl(input.number),
  })
}
