import { Stack } from "expo-router"

import { AddRecordingForm } from "@/app/add-kirtan"

/**
 * Add a recording of Others (Guru Puja, Pitr Yajina, Samgacchadhvam ... or something else; the category was "Other mantras" until 9 Nov 2026). Dada, 9 Nov 2026: a Kiirtan is only Baba Nam Kevalam,
 * so every other mantra has its own page, its own category in the app and its own kind on the server (`other_mantra`).
 * It is the one upload form (app/add-kirtan.tsx) with the Others header, the required "what is it" choice and no kind cards, sharing the
 * queue, the rules and the moderation of every other recording. Opens as a sheet like the other upload pages.
 */
export default function AddMantraScreen() {
  return (
    <>
      <Stack.Screen options={{ presentation: "modal" }} />
      <AddRecordingForm mantra />
    </>
  )
}
