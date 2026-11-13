import { MOCKUP_DATA } from "@/lib/mockupMode"
import { buildProfileIdentity, type ProfileIdentity } from "@/lib/profileSheet"
import { initialOf } from "@/lib/profile/validate"
import { useAuthStore } from "@/stores/authStore"
import { pickAvatarPhoto, useProfileStore } from "@/stores/profileStore"

export type ProfileView = ProfileIdentity & {
  /** the picture to draw, or `null` for the initial letter */
  photoUri: string | null
  /** the name Edit profile starts from: empty for a guest who has not chosen one */
  editableName: string
}

/** Account block of the profile sheet and the Edit profile page: account data with the saved name and picture on top. */
export function useProfileIdentity(): ProfileView {
  const mode = useAuthStore((s) => s.mode)
  const displayName = useAuthStore((s) => s.displayName)
  const email = useAuthStore((s) => s.email)
  const savedName = useProfileStore((s) => s.name)
  const photoUri = useProfileStore(pickAvatarPhoto)

  // MOCKUP_DATA: the prototype's signed-in member, so the sheet matches its boards.
  const base: ProfileIdentity = MOCKUP_DATA
    ? { initial: "D", title: "I M Dada", subtitle: "Signed in with Apple", signedIn: true }
    : buildProfileIdentity({ mode, displayName, email })
  const title = savedName || base.title
  return {
    ...base,
    title,
    initial: savedName ? initialOf(savedName) : base.initial,
    photoUri,
    editableName: savedName || (base.signedIn ? base.title : ""),
  }
}
