import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { SheetTopBar } from "@/components/common/SheetTopBar"
import { KPress } from "@/components/kirtan/KPress"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { formatDate, useT } from "@/lib/i18n"
import { CONTACT_ROUTE, isRulesAccepted, RULES_VERSION, ruleSections } from "@/lib/kirtan/rules"
import { unblockAuthorOf } from "@/lib/kirtan/safety"
import { useContentRulesStore } from "@/stores/contentRulesStore"
import { useKirtanStore } from "@/stores/kirtanStore"
import { href } from "@/utils/href"

/**
 * The content rules for a Kiirtan or a Bhajan, in plain words (docs/kiirtan-publishing.md; App Store 1.2, Play UGC).
 * Reached from the add form, from Report, and from a removal notice. Also where the person sees when they agreed,
 * how to reach the team, and the authors they blocked (with Unblock). The text is the dictionary's (`ugc.rules.*`), so
 * it reads the same in the app language and the version stays in one place (lib/kirtan/rules.ts RULES_VERSION).
 */
export default function ContentRulesScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const bottomInset = useScrollBottomInset(24)
  const acceptedAt = useContentRulesStore((s) => s.acceptedAt)
  const version = useContentRulesStore((s) => s.version)
  const blockedKeys = useKirtanStore((s) => s.blockedAuthorIds)
  const blockedNames = useKirtanStore((s) => s.blockedNames)
  const agreed = isRulesAccepted({ acceptedAt, version })
  const close = () => (router.canGoBack() ? router.back() : router.replace(href("/v2/kiirtan")))
  const sections = ruleSections()

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <SheetTopBar closeLabel={t("ugc.add.close")} onClose={close} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}>
        <Reveal index={0}>
          <Text style={[styles.over, { color: theme.accent }]}>{t("ugc.rules.eyebrow")}</Text>
          <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
            {t("ugc.rules.title")}
          </Text>
          <Text style={[styles.intro, { color: theme.textBody }]}>{t("ugc.rules.intro", { version: RULES_VERSION })}</Text>
        </Reveal>

        {sections.map((section, index) => (
          <Reveal key={section.id} index={index + 1} style={[styles.section, { borderColor: theme.line }]}>
            <Text style={[styles.number, { color: theme.ink300 }]}>{String(index + 1).padStart(2, "0")}</Text>
            <View style={styles.sectionText}>
              <Text style={[styles.sectionTitle, { color: theme.textHeading }]} accessibilityRole="header">
                {section.title}
              </Text>
              <Text style={[styles.body, { color: theme.textBody }]}>{section.body}</Text>
            </View>
          </Reveal>
        ))}

        <Reveal index={sections.length + 1} style={styles.block}>
          <Text style={[styles.body, { color: theme.textHeading }]}>
            {agreed && acceptedAt ? t("ugc.rules.agreed", { date: formatDate(acceptedAt, "medium") }) : t("ugc.rules.notAgreed")}
          </Text>
          <KPress accessibilityRole="button" accessibilityLabel={t("ugc.rules.contact")} onPress={() => router.push(href(CONTACT_ROUTE))} pressedScale={0.98} style={[styles.send, { backgroundColor: amColors.orange700 }]}>
            <Text style={styles.sendText}>{t("ugc.rules.contact")}</Text>
          </KPress>
        </Reveal>

        <Reveal index={sections.length + 2} style={styles.block}>
          <Text style={[styles.sectionTitle, { color: theme.textHeading }]} accessibilityRole="header">
            {t("ugc.blocked.title")}
          </Text>
          {blockedKeys.length ? (
            blockedKeys.map((key) => (
              <BlockedRow key={key} theme={theme} name={blockedNames[key] || t("ugc.blocked.unnamed")} onUnblock={() => void unblockAuthorOf(key).catch(() => undefined)} />
            ))
          ) : (
            <Text style={[styles.body, { color: theme.textBody }]}>{t("ugc.blocked.none")}</Text>
          )}
        </Reveal>
      </ScrollView>
    </View>
  )
}

function BlockedRow({ theme, name, onUnblock }: { theme: SongsTheme; name: string; onUnblock: () => void }) {
  const t = useT()
  return (
    <View style={[styles.blockedRow, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <Text style={[styles.blockedName, { color: theme.textHeading }]} numberOfLines={1}>
        {name}
      </Text>
      <KPress accessibilityRole="button" accessibilityLabel={`${t("ugc.blocked.unblock")}: ${name}`} onPress={onUnblock} pressedScale={0.94} style={[styles.unblock, { backgroundColor: theme.peach }]}>
        <Text style={[styles.unblockText, { color: theme.accent }]}>{t("ugc.blocked.unblock")}</Text>
      </KPress>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 24, paddingTop: 8, maxWidth: 600, width: "100%", alignSelf: "center" },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", marginBottom: 6 },
  h1: { fontFamily: amFonts.display, fontSize: 52, lineHeight: 50, letterSpacing: -1, textTransform: "uppercase" },
  intro: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22, marginTop: 12 },
  section: { flexDirection: "row", gap: 16, borderTopWidth: 1, paddingTop: 18 },
  number: { fontFamily: amFonts.display, fontSize: 34, lineHeight: 34, letterSpacing: -0.6, width: 48 },
  sectionText: { flex: 1, gap: 8 },
  sectionTitle: { fontFamily: amFonts.semi, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  block: { gap: 14 },
  send: { height: 56, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  sendText: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, color: "#FFFFFF" },
  blockedRow: { minHeight: 56, borderRadius: 20, borderWidth: 1, paddingLeft: 16, paddingRight: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  blockedName: { flex: 1, minWidth: 0, fontFamily: amFonts.semi, fontSize: 16, lineHeight: 22 },
  unblock: { height: 40, paddingHorizontal: 16, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  unblockText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.4 },
})
