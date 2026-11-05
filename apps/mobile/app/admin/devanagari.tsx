import { useLocalSearchParams } from "expo-router"

import { AdminGate } from "@/components/admin/AdminGate"
import { AdminDevanagariPanel } from "@/components/admin/AdminDevanagariPanel"
import { ScreenContainer } from "@/components/common/ScreenContainer"

export default function AdminDevanagariScreen() {
  const { song } = useLocalSearchParams<{ song?: string }>()
  const initial = song && /^\d+$/.test(song) ? Number(song) : undefined

  return (
    <AdminGate>
      <ScreenContainer edges={["top"]} padded={false} title="Devanagari review">
        <AdminDevanagariPanel initialSongNumber={initial} />
      </ScreenContainer>
    </AdminGate>
  )
}
