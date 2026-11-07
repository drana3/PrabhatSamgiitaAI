import type { ProfileSink } from "@/lib/profile/saveProfile"
import { useAuthStore } from "@/stores/authStore"
import { useProfileStore } from "@/stores/profileStore"

/**
 * Local write of a saved profile: the profile store always (guests and the preview too), and the
 * account name when signed in, so greetings and the member headers follow.
 */
export const localProfileSink: ProfileSink = {
  apply: ({ name, photoUri }) => {
    useProfileStore.getState().setProfile({ name, photoUri })
    // "Remove photo" also drops the provider's picture, or it would come straight back.
    if (photoUri === null) useProfileStore.getState().setProviderPhoto(null)
    if (name !== undefined && useAuthStore.getState().mode === "signed_in") {
      useAuthStore.getState().setDisplayName(name)
    }
  },
}
