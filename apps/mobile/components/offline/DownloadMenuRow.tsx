import type { ReactNode } from "react"

import { DownloadMark } from "@/components/offline/DownloadMark"
import { useDownloadState } from "@/hooks/useDownloadState"
import { downloadMenuLabel, type DownloadItem } from "@/lib/offline/downloadModel"
import { useLanguage } from "@/lib/i18n"

type Props = {
  item: DownloadItem | null
  /** colours of the mark on the menu's ground */
  color: string
  size?: number
  /** draws the menu's own row from the label, the mark and the action */
  children: (row: { label: string; icon: ReactNode; onPress: () => void }) => ReactNode
}

/**
 * The Download item of a row menu (songs and Kiirtans): "Download", "Cancel download" while the
 * ring runs, "Remove download" when it is on the phone, with the same mark as the buttons. Draws
 * nothing for a song without playable audio. The menu closes itself around `onPress`.
 */
export function DownloadMenuRow({ item, color, size = 24, children }: Props) {
  useLanguage() // re-render when the language changes: the labels come from lib/offline/downloadModel
  const { view, press } = useDownloadState(item)
  if (!view.visible) return null
  return (
    <>
      {children({
        label: downloadMenuLabel(view.status),
        icon: <DownloadMark status={view.status} progress={view.progress} size={size} color={color} />,
        onPress: press,
      })}
    </>
  )
}
