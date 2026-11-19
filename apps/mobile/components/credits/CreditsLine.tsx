import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { creditsApi } from "@/lib/credits/api"
import type { CreditList } from "@/lib/credits/remote"
import { useT } from "@/lib/i18n"
import { creditLine, hasCreditLine, summaryParts } from "@/lib/kirtan/credits"
import { href } from "@/utils/href"

/** Remembered answers, so a screen that opens the same recording again does not ask again. */
const lineCache = new Map<string, CreditList | null>()

/**
 * "Also with …" under the recording's author line: the other people on it. A confirmed person is a link to their author page; a
 * plain or waiting name is plain text. The person who added the recording also sees how many are waiting and an "edit" link to
 * the people screen. Shows nothing while loading, when nobody is named, or when the request fails (an extra line, never an error).
 */
export function CreditsLine({ theme, recordingId, author }: { theme: SongsTheme; recordingId: string | null | undefined; author?: string | null }) {
  const t = useT()
  const router = useRouter()
  const [data, setData] = useState<CreditList | null>(recordingId ? (lineCache.get(recordingId) ?? null) : null)

  useEffect(() => {
    if (!recordingId) return undefined
    if (lineCache.has(recordingId)) {
      setData(lineCache.get(recordingId) ?? null)
      return undefined
    }
    let live = true
    creditsApi()
      .list(recordingId)
      .then(
        (found) => {
          lineCache.set(recordingId, found)
          if (live) setData(found)
        },
        () => undefined,
      )
    return () => {
      live = false
    }
  }, [recordingId])

  if (!data || !recordingId) return null
  const parts = creditLine(data.credits, data.can_manage, author ? [author] : undefined)
  const waiting = data.can_manage ? summaryParts(data.summary).waiting : 0
  if (!hasCreditLine(parts) && !data.can_manage) return null
  return (
    <View style={s.root} testID="credits-line">
      {hasCreditLine(parts) ? (
        <View style={s.row}>
          <Text style={[s.label, { color: theme.textBody }]}>{t("credits.line.with")}</Text>
          {parts.map((part, i) =>
            part.href ? (
              <KPress key={`${part.text}-${i}`} accessibilityRole="link" accessibilityLabel={part.text} hitSlop={6} onPress={() => router.push(href(part.href as string))} pressedScale={0.97} style={s.item}>
                <Text style={[s.name, s.link, { color: theme.accentText }]}>{part.text}</Text>
              </KPress>
            ) : (
              <Text key={`${part.text}-${i}`} style={[s.name, { color: theme.textHeading }]}>
                {part.text}
              </Text>
            ),
          )}
        </View>
      ) : null}
      {data.can_manage ? (
        <View style={s.row}>
          {waiting > 0 ? <Text style={[s.label, { color: theme.textMuted }]}>{t("credits.line.waiting", { count: waiting })}</Text> : null}
          <KPress accessibilityRole="link" accessibilityLabel={t("credits.line.edit")} hitSlop={6} onPress={() => router.push(href(`/recording-people?id=${encodeURIComponent(recordingId)}`))} pressedScale={0.97} style={s.item}>
            <Text style={[s.name, s.link, { color: theme.accentText }]}>{t("credits.line.edit")}</Text>
          </KPress>
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 2 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8 },
  label: { fontFamily: amFonts.regular, fontSize: 14, lineHeight: 20 },
  item: { minHeight: 32, justifyContent: "center" },
  name: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
  link: { textDecorationLine: "underline" },
})
