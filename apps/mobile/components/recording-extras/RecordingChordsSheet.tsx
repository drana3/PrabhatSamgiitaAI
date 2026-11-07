import { useEffect, useState } from "react"
import { useRouter } from "expo-router"

import type { SpTheme } from "@/constants/tokens/amSong"
import { chordsFormHref } from "@/lib/recordingExtras/links"
import { href } from "@/utils/href"

import { ChordsViewer } from "./ChordsViewer"
import { useRecordingSheets, type SheetsController } from "./useRecordingSheets"

/**
 * The chord sheet of one recording for a host that does not keep the chart list itself (the full player). It loads
 * the charts the first time it is opened, not before, so a player that never opens it asks the server nothing.
 */
export function RecordingChordsSheet({ t, recordingId, title, visible, onClose, beforeNavigate }: { t: SpTheme; recordingId: string; title: string; visible: boolean; onClose: () => void; beforeNavigate?: () => void }) {
  const [wanted, setWanted] = useState(visible)
  useEffect(() => {
    if (visible) setWanted(true)
  }, [visible])
  if (!wanted) return null
  return <Loaded t={t} recordingId={recordingId} title={title} visible={visible} onClose={onClose} beforeNavigate={beforeNavigate} />
}

function Loaded({ t, recordingId, title, visible, onClose, beforeNavigate }: { t: SpTheme; recordingId: string; title: string; visible: boolean; onClose: () => void; beforeNavigate?: () => void }) {
  const sheets = useRecordingSheets(recordingId)
  return <Viewer t={t} sheets={sheets} recordingId={recordingId} title={title} visible={visible} onClose={onClose} beforeNavigate={beforeNavigate} />
}

/** The viewer wired to the "Add chords" screen; used by the page (with its own list) and by the player (above). `beforeNavigate` lets the player close itself first. */
export function Viewer({ t, sheets, recordingId, title, visible, onClose, beforeNavigate }: { t: SpTheme; sheets: SheetsController; recordingId: string; title: string; visible: boolean; onClose: () => void; beforeNavigate?: () => void }) {
  const router = useRouter()
  const go = (edit?: string) => {
    onClose()
    beforeNavigate?.()
    router.push(href(chordsFormHref({ recordingId, title, edit })))
  }
  return <ChordsViewer t={t} visible={visible} onClose={onClose} sheets={sheets} onAdd={() => go()} onChange={(sheet) => go(sheet.id)} />
}
