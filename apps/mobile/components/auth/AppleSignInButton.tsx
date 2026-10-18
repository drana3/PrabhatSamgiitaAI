import * as AppleAuthentication from "expo-apple-authentication"
import { ActivityIndicator, StyleSheet, View } from "react-native"

import { radius } from "@/constants/spacing"

type Props = {
  onPress: () => void
  loading?: boolean
  disabled?: boolean
}

export function AppleSignInButton({ onPress, loading, disabled }: Props) {
  const inactive = disabled || loading

  if (loading) {
    return (
      <View style={[styles.placeholder, styles.inactive]}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    )
  }

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={radius.lg}
      style={[styles.button, inactive && styles.inactive]}
      onPress={inactive ? () => undefined : onPress}
    />
  )
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    height: 52,
  },
  placeholder: {
    width: "100%",
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  inactive: {
    opacity: 0.55,
  },
})
