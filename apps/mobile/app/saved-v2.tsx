import { ScrollView, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { MineContent } from "@/components/saved-v2/MineContent"
import { BackButton, SectionHeading } from "@/components/saved-v2/ui"
import { Reveal } from "@/components/today/motion"
import { amGap } from "@/constants/tokens/amSpacing"
import { useAmTheme } from "@/hooks/useAmTheme"

/**
 * Songs > Mine, standalone (spec SCR-11 item 7). Redesign route at /saved-v2.
 * The Songs screen embeds the same `<MineContent />` under its segmented control.
 * The old Saved tab is untouched.
 */
export default function SavedV2Screen() {
  const router = useRouter()
  const theme = useAmTheme()

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.page }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: amGap.gutter }]}
      >
        <Reveal index={0}>
          <View style={styles.topBar}>
            <BackButton theme={theme} onPress={() => router.back()} />
          </View>
        </Reveal>
        <Reveal index={1}>
          <SectionHeading theme={theme} first="Songs" second="Mine" />
        </Reveal>
        <MineContent theme={theme} revealStart={2} />
        <View style={styles.tail} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { gap: amGap.block },
  topBar: { height: 56, justifyContent: "center", alignItems: "flex-start" },
  tail: { height: 140 },
})
