import { FlatList, StyleSheet, Text, View } from "react-native"

import { ScreenContainer } from "@/components/common/ScreenContainer"
import { colors } from "@/constants/colors"
import { featureParity } from "@/constants/featureParity"
import { spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

const statusColor = {
  ui: colors.success,
  next: colors.warning,
  auth: colors.primary,
  skip: colors.textMuted,
} as const

export default function ParityScreen() {
  return (
    <ScreenContainer edges={["top"]} padded={false} title="Website parity">
      <FlatList
        data={[...featureParity]}
        keyExtractor={(item) => item.web}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.legend}>
            ui = in app · next = API wire · auth = needs member login · skip = web-only/ops
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: statusColor[item.status] }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.web}>{item.web}</Text>
              <Text style={styles.mobile}>{item.mobile}</Text>
              {"api" in item && item.api ? <Text style={styles.api}>{item.api}</Text> : null}
            </View>
            <Text style={[styles.status, { color: statusColor[item.status] }]}>{item.status}</Text>
          </View>
        )}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.section },
  legend: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  web: { ...typography.label, color: colors.textPrimary },
  mobile: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  api: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  status: { ...typography.caption, textTransform: "uppercase" },
})
