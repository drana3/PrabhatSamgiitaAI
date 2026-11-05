import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { Chip, NavRow, OverlayScreen, useToast } from "@/components/learn-v2/ui"
import { Reveal } from "@/components/today/motion"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { indexRows, type IndexKind } from "@/lib/fixtures/learn"
import { LEARN_ROUTES } from "@/lib/learn/routes"
import { href } from "@/utils/href"

const TABS: ReadonlyArray<{ key: IndexKind; label: string }> = [
  { key: "raga", label: "Raga" },
  { key: "tala", label: "Tala" },
]

/**
 * Raga and tala index (prototype INDEX). Two chips switch between the lists; a row shows a
 * toast, because the list of songs per raga or tala is not in the API yet (TODO(api)).
 * ?tab=tala opens on the Tala list.
 */
export default function RagaTalaIndexScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const params = useLocalSearchParams<{ tab?: string }>()
  const [kind, setKind] = useState<IndexKind>(params.tab === "tala" ? "tala" : "raga")
  const toast = useToast()
  const rows = indexRows(kind)

  const back = () => {
    if (router.canGoBack()) router.back()
    else router.replace(href(LEARN_ROUTES.learn))
  }

  return (
    <OverlayScreen theme={theme} onBack={back} label="Index" overlay={toast.node}>
      <Reveal index={0}>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Index">
          {TABS.map((tab) => (
            <Chip key={tab.key} theme={theme} label={tab.label} on={kind === tab.key} onPress={() => setKind(tab.key)} />
          ))}
        </View>
      </Reveal>
      <Reveal key={kind} index={1} style={styles.list}>
        {rows.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textBody }]}>
            The raga and tala index is not ready yet. The catalog does not list ragas and talas song by song.
          </Text>
        ) : null}
        {rows.map((row) => (
          <NavRow
            key={row.name}
            theme={theme}
            numericEyebrow
            eyebrow={row.meta}
            title={row.name}
            onPress={() => toast.show(`Songs in ${row.name} open here`)}
          />
        ))}
      </Reveal>
    </OverlayScreen>
  )
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  list: { gap: 10 },
  empty: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22, paddingVertical: 24 },
})
