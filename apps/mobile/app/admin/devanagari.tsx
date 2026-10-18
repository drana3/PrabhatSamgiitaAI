import { useLocalSearchParams } from "expo-router"

import { AdminDevanagariPanel } from "@/components/admin/AdminDevanagariPanel"
import { ScreenContainer } from "@/components/common/ScreenContainer"

export default function AdminDevanagariScreen() {
  const { song } = useLocalSearchParams<{ song?: string }>()
  const initial = song && /^\d+$/.test(song) ? Number(song) : undefined

  return (
    <ScreenContainer edges={["top"]} padded={false} title="Devanagari review">
      <AdminDevanagariPanel initialSongNumber={initial} />
    </ScreenContainer>
  )
}
