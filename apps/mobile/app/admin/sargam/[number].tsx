import { Text, View } from "react-native"
import { useLocalSearchParams } from "expo-router"

import { AdminSargamCapturePanel } from "@/components/admin/AdminSargamCapturePanel"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { colors } from "@/constants/colors"
import { spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

export default function AdminSargamCaptureScreen() {
  const { number } = useLocalSearchParams<{ number: string }>()
  const songNumber = Number(number)
  const valid = Number.isInteger(songNumber) && songNumber >= 1

  return (
    <ScreenContainer
      edges={["top"]}
      padded={false}
      title="Sargam capture"
      subtitle={valid ? `Song ${songNumber}` : undefined}
    >
      {valid ? (
        <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>
          <AdminSargamCapturePanel songNumber={songNumber} />
        </View>
      ) : (
        <View style={{ padding: spacing.lg }}>
          <Text style={{ ...typography.bodySmall, color: colors.error }}>Enter a valid song number from Admin → Sargam.</Text>
        </View>
      )}
    </ScreenContainer>
  )
}
