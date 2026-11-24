import { LoadingIndicator } from "@/components/loading-indicator"

export default function SongPageLoading() {
  return (
    <main className="flex min-h-[50vh] items-center justify-center bg-ivory-100 px-4 py-16">
      <LoadingIndicator label="Loading song…" />
    </main>
  )
}