import { useEffect, useRef, useState } from "react"
import { Platform, StyleSheet, Text, TextInput, View } from "react-native"

import { Button } from "@/components/comments/CommentsView"
import { SpSheet } from "@/components/song-v2/SpSheet"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { PREVIEW_NAME } from "@/lib/songComments/mock"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { VIDEO_TITLE_MAX, cleanVideoTitle, parseVideoUrl, providerHost } from "@/lib/recordingVideos/rules"
import type { VideoFailure } from "@/lib/recordingVideos/types"
import { videoFailureText } from "@/lib/recordingVideos/words"
import { useAuthStore } from "@/stores/authStore"

import { VideoLinkPreview } from "@/components/video/VideoLinkPreview"

import { CheckLine, Note, R_FIELD } from "./ui"
import type { VideosController } from "./useVideos"

/**
 * "Add a video": a sheet with one field for the link, one for an optional short title, the anonymous checkbox and
 * Add. The link is checked on the phone with the same rules as the server (https only, a single video on YouTube,
 * Vimeo or the Internet Archive); what the server says is still the last word. The link and the title are never
 * thrown away by a failure. Nothing is fetched from the link: the app only stores and opens it.
 */
export function AddVideoSheet({ t, visible, onClose, videos, onAdded }: { t: SpTheme; visible: boolean; onClose: () => void; videos: VideosController; onAdded: () => void }) {
  const tr = useT()
  const mode = useAuthStore((s) => s.mode)
  const myName = useAuthStore((s) => s.displayName)
  const name = mode === "signed_in" ? myName : MOCKUP_DATA ? PREVIEW_NAME : ""
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [anonymous, setAnonymous] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<VideoFailure | null>(null)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  const parsed = url.trim() ? parseVideoUrl(url) : null
  const cleaned = cleanVideoTitle(title)
  // what the phone already knows is wrong, said while typing (not before anything is typed)
  const live: VideoFailure | null = parsed && !parsed.ok ? parsed.failure : !cleaned.ok ? cleaned.failure : null
  const ready = Boolean(parsed?.ok) && cleaned.ok && !busy

  const submit = async () => {
    if (!ready || !parsed?.ok || !cleaned.ok) return
    setBusy(true)
    setFailure(null)
    const result = await videos.add({ url: parsed.url, title: cleaned.title, isAnonymous: anonymous })
    if (!alive.current) return
    setBusy(false)
    if (result.ok) {
      setUrl("")
      setTitle("")
      setAnonymous(false)
      onAdded()
      onClose()
    } else {
      setFailure(result.failure)
    }
  }
  const webField = Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null
  const problem = failure ?? live

  return (
    <SpSheet t={t} visible={visible} onClose={onClose} label={tr("recVideos.sheet.label")} testID="add-video-sheet">
      <View style={styles.body}>
        <Text accessibilityRole="header" style={[styles.title, { color: t.ink900 }]}>
          {tr("recVideos.sheet.title")}
        </Text>
        <Note t={t}>{tr("recVideos.accepted")}</Note>
        {MOCKUP_DATA ? <Note t={t}>{tr("recVideos.preview")}</Note> : null}

        <Text style={[styles.label, { color: t.ink900 }]}>{tr("recVideos.url")}</Text>
        <TextInput
          value={url}
          onChangeText={(v) => {
            setUrl(v)
            if (failure) setFailure(null)
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          textContentType="URL"
          maxLength={400}
          editable={!busy}
          placeholder={tr("recVideos.url.placeholder")}
          placeholderTextColor={t.ink500}
          accessibilityLabel={tr("recVideos.url")}
          style={[styles.field, webField, { color: t.ink900, backgroundColor: t.white, borderColor: problem && url.trim() ? t.dangerText : t.sand400 }]}
        />
        {parsed?.ok && !failure ? <Note t={t} tone="body">{tr("recVideos.looksGood", { site: providerHost(parsed.provider) })}</Note> : null}
        {parsed?.ok ? <VideoLinkPreview value={url} textColor={t.ink900} /> : null}

        <Text style={[styles.label, { color: t.ink900 }]}>{tr("recVideos.title.label")}</Text>
        <TextInput
          value={title}
          onChangeText={(v) => {
            setTitle(v)
            if (failure) setFailure(null)
          }}
          maxLength={VIDEO_TITLE_MAX + 20}
          editable={!busy}
          placeholder={tr("recVideos.title.placeholder")}
          placeholderTextColor={t.ink500}
          accessibilityLabel={tr("recVideos.title.label")}
          style={[styles.field, webField, { color: t.ink900, backgroundColor: t.white, borderColor: t.sand400 }]}
        />

        <CheckLine t={t} on={anonymous} label={tr("recVideos.anonymous")} onToggle={() => setAnonymous((v) => !v)} />
        <Note t={t} tone="body">{anonymous ? tr("recVideos.as.anonymous") : name ? tr("recVideos.as.named", { name }) : tr("recVideos.as.namedNoName")}</Note>
        {anonymous ? <Note t={t}>{tr("recVideos.as.team")}</Note> : null}

        {problem && (failure || url.trim()) ? <Note t={t} tone="danger">{videoFailureText(tr, problem)}</Note> : null}

        <View style={styles.row}>
          <Button t={t} label={busy ? tr("recVideos.submitting") : tr("recVideos.submit")} onPress={() => void submit()} disabled={!ready} busy={busy} />
        </View>
      </View>
    </SpSheet>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 8, gap: 8 },
  title: { fontFamily: amFonts.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.64, paddingBottom: 4 },
  label: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20, paddingTop: 8 },
  field: { minHeight: 52, paddingHorizontal: 14, paddingVertical: 12, borderRadius: R_FIELD, borderWidth: 1, fontFamily: amFonts.regular, fontSize: 16, lineHeight: 22 },
  row: { paddingTop: 12, flexDirection: "row", justifyContent: "flex-end" },
})
