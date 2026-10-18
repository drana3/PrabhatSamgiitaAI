import { LoadingIndicator } from "@/components/loading-indicator"

export default function Loading() {
  return <main className="grid min-h-screen place-items-center bg-ivory-50 px-6 text-center"><div><LoadingIndicator label="Preparing your musical journey" /><p className="mt-4 text-sm text-stone-600">Bringing lyrics, meaning, and music together.</p></div></main>
}
