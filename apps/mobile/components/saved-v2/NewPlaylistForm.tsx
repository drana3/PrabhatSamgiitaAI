import { useState } from "react"
import { StyleSheet, Text, TextInput, View } from "react-native"

import { PillButton } from "@/components/saved-v2/ui"
import { PressScale } from "@/components/today/motion"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amControl, amRadius } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"

/**
 * The `New playlist` button, which opens a name field in place.
 * Guests are sent to sign in by the caller (`onRequireSignIn`).
 */
export function NewPlaylistForm({
  theme,
  signedIn,
  onRequireSignIn,
  onCreate,
}: {
  theme: AmTheme
  signedIn: boolean
  onRequireSignIn: () => void
  onCreate: (name: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  if (!open) {
    return (
      <PillButton
        theme={theme}
        label="New playlist"
        onPress={() => (signedIn ? setOpen(true) : onRequireSignIn())}
      />
    )
  }

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    await onCreate(trimmed)
    setBusy(false)
    setName("")
    setOpen(false)
  }

  return (
    <View style={styles.form}>
      <TextInput
        autoFocus
        value={name}
        onChangeText={setName}
        onSubmitEditing={() => void submit()}
        returnKeyType="done"
        placeholder="Name of the playlist"
        placeholderTextColor={theme.textMuted}
        accessibilityLabel="Playlist name"
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.line, color: theme.textHeading }]}
      />
      <View style={styles.actions}>
        <View style={styles.grow}>
          <PillButton theme={theme} label="Create" onPress={() => void submit()} disabled={!name.trim() || busy} />
        </View>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={() => {
            setName("")
            setOpen(false)
          }}
          style={styles.cancel}
        >
          <Text style={[amType.body, { color: theme.textBody, fontFamily: amFonts.semi }]}>Cancel</Text>
        </PressScale>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: 10 },
  input: {
    height: 56,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    paddingHorizontal: 20,
    fontFamily: amFonts.medium,
    fontSize: 16,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 10 },
  grow: { flex: 1 },
  cancel: { height: amControl.pillHeight, minWidth: 72, alignItems: "center", justifyContent: "center" },
})
