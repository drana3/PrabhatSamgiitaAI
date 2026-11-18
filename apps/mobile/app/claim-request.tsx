import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native"

import { ClaimsFrame } from "@/components/authors/ClaimParts"
import { CodeBox, ProofForm, ProofList, StageBlock } from "@/components/authors/ProofParts"
import { LoadingRows, SIDE, StateBlock } from "@/components/authors/AuthorsUi"
import { useAuthorRequest } from "@/hooks/useAuthorRequest"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { authorsApi } from "@/lib/authors/api"
import { say } from "@/lib/authors/text"
import { useT } from "@/lib/i18n"
import { keyboardBehavior } from "@/lib/keyboardBehavior"

/**
 * "My request": one proof that the author page is the person's, for all the recordings they ask for
 * (docs/author-profiles.md, "Proof of identity"). Where the request stands, the proofs sent, the code box and the form.
 */
export default function ClaimRequestScreen() {
  const t = useT()
  return <ClaimsFrame title={t("claimProof.bar")}>{() => <Body />}</ClaimsFrame>
}

function Body() {
  const t = useT()
  const theme = useSongsTheme()
  const bottom = useScrollBottomInset()
  const api = authorsApi()
  const request = useAuthorRequest(() => api.claimRequest(), [])
  const state = request.data
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={keyboardBehavior(Platform.OS)}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom + 32, gap: 24, paddingTop: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {request.loading && !state ? <LoadingRows theme={theme} rows={3} /> : null}
        {request.error ? <StateBlock theme={theme} tone="error" title={t("authors.page.errorTitle")} body={say(t, request.error)} action={t("common.tryAgain")} onAction={request.reload} /> : null}
        {state ? (
          <View style={styles.pad}>
            <StageBlock theme={theme} state={state} />
            <CodeBox theme={theme} state={state} onChanged={request.reload} />
            <ProofList theme={theme} proofs={state.proofs} onChanged={request.reload} />
            <ProofForm theme={theme} state={state} onChanged={request.reload} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: SIDE, gap: 20 },
})
