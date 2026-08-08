import { useState } from "react"
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { ChevronDown } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRIES,
  validateNationalPhoneNumber,
  type PhoneCountry,
} from "@prabhat/core"

import { IconButton } from "@/components/common/IconButton"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

type Props = {
  countryCode: string
  nationalNumber: string
  onCountryCodeChange: (code: string) => void
  onNationalNumberChange: (value: string) => void
  disabled?: boolean
}

export function phoneInputValid(countryCode: string, nationalNumber: string) {
  return validateNationalPhoneNumber(countryCode, nationalNumber) === null
}

export function PhoneInput({
  countryCode,
  nationalNumber,
  onCountryCodeChange,
  onNationalNumberChange,
  disabled = false,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const selected =
    PHONE_COUNTRIES.find((country) => country.code === countryCode) ?? DEFAULT_PHONE_COUNTRY
  const validationError = nationalNumber
    ? validateNationalPhoneNumber(countryCode, nationalNumber)
    : null

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Mobile number *</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Country ${selected.name}`}
          disabled={disabled}
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [styles.countryButton, pressed && styles.pressed]}
        >
          <Text style={styles.countryCode}>{selected.code}</Text>
          <Text style={styles.dialCode}>{selected.dialCode}</Text>
          <ChevronDown size={16} color={colors.textSecondary} />
        </Pressable>
        <TextInput
          value={nationalNumber}
          onChangeText={onNationalNumberChange}
          placeholder={selected.example}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          editable={!disabled}
          style={styles.numberInput}
        />
      </View>
      {validationError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {validationError}
        </Text>
      ) : (
        <Text style={styles.hint}>
          Example: {selected.dialCode} {selected.example}
        </Text>
      )}

      <CountryPickerModal
        visible={pickerOpen}
        selectedCode={countryCode}
        onClose={() => setPickerOpen(false)}
        onSelect={(country) => {
          onCountryCodeChange(country.code)
          setPickerOpen(false)
        }}
      />
    </View>
  )
}

function CountryPickerModal({
  visible,
  selectedCode,
  onClose,
  onSelect,
}: {
  visible: boolean
  selectedCode: string
  onClose: () => void
  onSelect: (country: PhoneCountry) => void
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Country code</Text>
            <IconButton soft accessibilityLabel="Close country list" onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </IconButton>
          </View>
          <ScrollView contentContainerStyle={styles.countryList} keyboardShouldPersistTaps="handled">
            {PHONE_COUNTRIES.map((country) => {
              const selected = country.code === selectedCode
              return (
                <Pressable
                  key={country.code}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onSelect(country)}
                  style={[styles.countryRow, selected && styles.countryRowSelected]}
                >
                  <Text style={[styles.countryRowCode, selected && styles.countryRowTextSelected]}>
                    {country.code}
                  </Text>
                  <View style={styles.countryRowBody}>
                    <Text style={[styles.countryRowName, selected && styles.countryRowTextSelected]}>
                      {country.name}
                    </Text>
                    <Text style={styles.countryRowDial}>{country.dialCode}</Text>
                  </View>
                </Pressable>
              )
            })}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { ...typography.label, color: colors.textPrimary },
  row: { flexDirection: "row", gap: spacing.sm },
  countryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minWidth: 108,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  countryCode: { ...typography.label, color: colors.textPrimary, minWidth: 22 },
  dialCode: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  numberInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: 16,
  },
  hint: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.caption, color: colors.error },
  pressed: { opacity: 0.85 },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: "72%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingBottom: spacing.md,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sheetTitle: {
    flex: 1,
    fontFamily: "Lora_700Bold",
    fontSize: 20,
    color: colors.textPrimary,
  },
  closeText: { fontSize: 16, color: colors.textPrimary },
  countryList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.xs },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  countryRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  countryRowCode: { ...typography.label, width: 28, color: colors.textPrimary },
  countryRowBody: { flex: 1 },
  countryRowName: { ...typography.bodySmall, color: colors.textPrimary },
  countryRowDial: { ...typography.caption, color: colors.textMuted },
  countryRowTextSelected: { color: colors.textPrimary },
})
