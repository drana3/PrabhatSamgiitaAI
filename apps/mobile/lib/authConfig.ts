import { facebookAuthConfigured } from "@/lib/facebookAuth"
import { googleAuthConfigured } from "@/lib/googleOAuthConfig"
import { microsoftAuthConfigured } from "@/lib/msal"

export function oauthSignInConfigured() {
  return microsoftAuthConfigured() || googleAuthConfigured() || facebookAuthConfigured()
}
