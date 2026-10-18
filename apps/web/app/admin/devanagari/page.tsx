import { AdminDevanagariPanel } from "@/components/admin-devanagari-panel"

export default async function AdminDevanagariPage({
  searchParams,
}: {
  searchParams: Promise<{ song?: string }>
}) {
  const { song } = await searchParams
  const initialSongNumber = song && /^\d+$/.test(song) ? song : undefined
  return <AdminDevanagariPanel initialSongNumber={initialSongNumber} />
}
