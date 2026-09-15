"use client"

import { useEffect, useState } from "react"
import type { RankedAudio } from "@prabhat/core"

import { SongListenPanel } from "@/components/song-listen-panel"

function useXlViewport() {
  const [isXl, setIsXl] = useState<boolean | null>(null)

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setIsXl(false)
      return
    }
    const query = window.matchMedia("(min-width: 1280px)")
    const update = () => setIsXl(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return isXl
}

export function SongPageListen({
  songNumber,
  recordings,
  placement,
}: {
  songNumber: number
  recordings: RankedAudio[]
  placement: "primary" | "sidebar"
}) {
  const isXl = useXlViewport()

  if (isXl === null) {
    if (placement === "sidebar") return null
  } else if ((placement === "primary" && isXl) || (placement === "sidebar" && !isXl)) {
    return null
  }

  return (
    <div id="listen" className={placement === "primary" ? "mb-6 scroll-mt-28" : undefined}>
      <SongListenPanel songNumber={songNumber} recordings={recordings} />
    </div>
  )
}
