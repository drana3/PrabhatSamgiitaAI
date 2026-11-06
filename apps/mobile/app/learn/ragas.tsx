import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { Chip, NavRow, OverlayScreen, useToast } from "@/components/learn-v2/ui"
import { Reveal } from "@/components/today/motion"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { indexRows, type IndexKind } from "@/lib/fixtures/learn"
import { LEARN_ROUTES } from "@/lib/learn/routes"
import { useT } from "@/lib/i18n"
import { href } from "@/utils/href"

const TABS: ReadonlyArray<{ key: IndexKind; label: "learn.index.tab.raga" | "learn.index.tab.tala" }> = [
  { key: "raga", label: "learn.index.tab.raga" },
  { key: "tala", label: "learn.index.tab.tala" },
]

/**
 * Raga and tala index (prototype INDEX). Two chips switch between the lists; a row shows a
 * toast, because the list of songs per raga or tala is not in the API yet (TODO(api)).
 * ?tab=tala opens on the Tala list.
 */
export default function RagaTalaIndexScreen() {
  const t = useT()
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
    <OverlayScreen theme={theme} onBack={back} label={t("learn.index.screen")} overlay={toast.node}>
      <Reveal index={0}>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t("learn.index.screen")}>
          {TABS.map((tab) => (
            <Chip key={tab.key} theme={theme} label={t(tab.label)} on={kind === tab.key} onPress={() => setKind(tab.key)} />
          ))}
        </View>
      </Reveal>
      <Reveal key={kind} index={1} style={styles.list}>
        {rows.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textBody }]}>
            {t("learn.index.empty")}
          </Text>
        ) : null}
        {rows.map((row) => (
          <NavRow
            key={row.name}
            theme={theme}
            numericEyebrow
            eyebrow={row.meta}
            title={row.name}
            onPress={() => toast.show(t("learn.index.toast", { name: row.name }))}
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
