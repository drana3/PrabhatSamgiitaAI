type FavoritesScopeInput = {
  mode: "guest" | "signed_in"
  memberId: string | null
  identityProvider: string | null
  email: string | null
}

/** Isolate saved songs per guest, preview, and real member accounts. */
export function favoritesScopeKey(input: FavoritesScopeInput) {
  if (input.mode === "guest") return "guest"
  if (input.identityProvider === "preview" || input.memberId === "mobile-preview") {
    return "preview"
  }
  return `member:${input.memberId || input.email || "signed-in"}`
}
