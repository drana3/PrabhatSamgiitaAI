import { useState } from "react"
import { Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES, validateNationalPhoneNumber, type PhoneCountry } from "@prabhat/core"
import { SafeAreaView } from "react-native-safe-area-context"

import { Press } from "@/components/songs-v2/Press"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"

/** Mobile number: a country button (code and dial code) beside the number, with a country list sheet. */
export function PhoneField({
  theme,
  countryCode,
  nationalNumber,
  onCountryCodeChange,
  onNationalNumberChange,
  error,
  disabled,
  onFocus,
}: {
  theme: SongsTheme
  countryCode: string
  nationalNumber: string
  onCountryCodeChange: (code: string) => void
  onNationalNumberChange: (value: string) => void
  /** shown under the field; when empty the example number shows instead */
  error?: string | null
  disabled?: boolean
  onFocus?: () => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const country = PHONE_COUNTRIES.find((entry) => entry.code === countryCode) ?? DEFAULT_PHONE_COUNTRY
  const border = error ? theme.dangerText : focused ? theme.accentBright : theme.line

  return (
    <View style={s.wrap}>
      <Text style={[s.label, { color: theme.textBody }]}>{t("account.phone.a11y")}</Text>
      <View style={s.row}>
        <Press
          accessibilityRole="button"
          accessibilityLabel={t("account.phone.country.a11y", { name: country.name, code: country.dialCode })}
          disabled={disabled}
          onPress={() => setOpen(true)}
          pressedScale={0.97}
          style={[s.country, { backgroundColor: theme.card, borderColor: theme.line }]}
        >
          <Text style={[s.countryCode, { color: theme.textHeading }]}>{country.code}</Text>
          <Text style={[s.dial, { color: theme.textMuted }]}>{country.dialCode}</Text>
        </Press>
        <TextInput
          accessibilityLabel={t("account.phone.a11y")}
          value={nationalNumber}
          onChangeText={onNationalNumberChange}
          placeholder={country.example}
          placeholderTextColor={theme.textMuted}
          selectionColor={theme.accentBright}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          editable={!disabled}
          onFocus={() => {
            setFocused(true)
            onFocus?.()
          }}
          onBlur={() => setFocused(false)}
          style={[
            s.number,
            { backgroundColor: theme.card, borderColor: border, color: theme.textHeading, borderWidth: focused || error ? 2 : 1 },
            Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null,
          ]}
        />
      </View>
      {error ? (
        <Text style={[s.note, { color: theme.dangerText }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : (
        <Text style={[s.note, { color: theme.textMuted }]}>
          Example: {country.dialCode} {country.example}
        </Text>
      )}
      <CountrySheet
        theme={theme}
        visible={open}
        selected={country.code}
        onClose={() => setOpen(false)}
        onSelect={(entry) => {
          onCountryCodeChange(entry.code)
          setOpen(false)
        }}
      />
    </View>
  )
}

/** Phone check shared by the sign-up form and the complete-profile page. */
export function phoneError(countryCode: string, nationalNumber: string): string | null {
  return validateNationalPhoneNumber(countryCode, nationalNumber)
}

function CountrySheet({
  theme,
  visible,
  selected,
  onClose,
  onSelect,
}: {
  theme: SongsTheme
  visible: boolean
  selected: string
  onClose: () => void
  onSelect: (country: PhoneCountry) => void
}) {
  const t = useT()
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Press accessibilityLabel={t("account.phone.closeList")} onPress={onClose} outerStyle={StyleSheet.absoluteFill} pressedScale={1} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={["bottom"]} style={[s.sheet, { backgroundColor: theme.page }]}>
          <View style={[s.handle, { backgroundColor: theme.line }]} />
          <Text style={[s.sheetTitle, { color: theme.textHeading }]} accessibilityRole="header">
            {t("account.phone.country.title")}
          </Text>
          <ScrollView contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
            {PHONE_COUNTRIES.map((entry) => {
              const on = entry.code === selected
              return (
                <Press
                  key={entry.code}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${entry.name}, ${entry.dialCode}`}
                  onPress={() => onSelect(entry)}
                  pressedScale={0.985}
                  style={[s.item, { backgroundColor: on ? theme.peach : theme.card, borderColor: on ? theme.accentBright : theme.line }]}
                >
                  <Text style={[s.itemCode, { color: theme.textHeading }]}>{entry.code}</Text>
                  <Text style={[s.itemName, { color: theme.textHeading }]} numberOfLines={1}>
                    {entry.name}
                  </Text>
                  <Text style={[s.itemDial, { color: theme.textMuted }]}>{entry.dialCode}</Text>
                </Press>
              )
            })}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18, letterSpacing: 0.4 },
  row: { flexDirection: "row", gap: 12 },
  country: { height: 56, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 108 },
  countryCode: { fontFamily: amFonts.semi, fontSize: 17 },
  dial: { fontFamily: amFonts.medium, fontSize: 15 },
  number: { flex: 1, height: 56, borderRadius: 16, paddingHorizontal: 16, fontFamily: amFonts.medium, fontSize: 17 },
  note: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { maxHeight: "72%", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 12 },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginTop: 8, marginBottom: 12 },
  sheetTitle: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.4, paddingHorizontal: 20, paddingBottom: 12 },
  list: { paddingHorizontal: 20, paddingBottom: 20, gap: 8 },
  item: { minHeight: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  itemCode: { fontFamily: amFonts.semi, fontSize: 15, width: 30 },
  itemName: { flex: 1, fontFamily: amFonts.medium, fontSize: 16 },
  itemDial: { fontFamily: amFonts.medium, fontSize: 15 },
})
