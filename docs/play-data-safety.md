# Google Play and App Store: Data safety, privacy labels, deletion URLs

## What Google checks

Play Console **Data safety** requires a public HTTPS URL that explains how users delete their account and associated data. Google’s crawler must get **HTTP 200** (not 404).

In-app deletion is supported: **Profile → Delete account data** (mobile) and **Account → Delete account data** (web). The app only reports "Account deleted" after the server confirmed `DELETE /api/v1/members/me`; if the build has no member sync or the request fails, it shows an error and keeps the account (see `apps/mobile/lib/accountDeletion.ts`).

## AI questions: what to declare (added Nov 2026)

The AI assistant (`/api/v1/ai/explain`, `apps/api/app/services/ai.py`) sends the person’s question to **Microsoft Azure OpenAI**. Since Nov 2025, App Store guideline **5.1.2(i)** requires saying where data goes, including third-party AI, and getting explicit permission **before** sending it. The app now does this:

- First question: a consent sheet says "Your questions are sent to our servers and processed by Azure OpenAI to answer. Do not send personal information." with **Agree** / **Not now** (en, ru, es).
- Nothing is sent without it. The API client refuses to stream a question until consent exists (`apps/mobile/lib/client.ts`, `lib/aiConsent.ts`), so no screen can bypass it.
- The yes is stored on the phone with a timestamp and a wording version (`stores/aiConsentStore.ts`, key `prabhat-ai-consent`). Changing the wording needs a bump of `AI_CONSENT_VERSION` to ask everyone again.
- It can be taken back in **Profile → More → AI questions** (the next question asks again).

What goes to the server with each question: the question text, the last 12 messages of the chat, the answer language, the song number, and, for a signed-in person, the account identifier (daily limit and chat memory). Signed-in chat turns are also kept on the server as chat memory until the person clears them (Profile → Clear chat) or deletes the account.

**Play Console, Data safety (you do this):**

| Data type | Collected | Shared | Purpose | Notes |
|-----------|-----------|--------|---------|-------|
| User-generated content: other in-app messages (AI questions) | Yes | Yes, with a service provider (Azure OpenAI processes it for us) | App functionality | Optional (the app works without asking the AI); the person agrees in the app before the first question |
| Personal info: name, email address | Yes (signed-in accounts) | No | Account management, app functionality | |
| Photos: profile picture | Only when the person chooses one | No | App functionality | Stored on the phone; the sign-in provider picture (Google) is a URL |
| Audio | No | | | Voice search is turned into text by the device’s speech service; no recording is sent to our servers |

Data is encrypted in transit (HTTPS). Deletion: in-app (Profile) and the web URL below.

**App Store Connect, App Privacy (you do this):** declare "Other User Content" (AI questions) and "Name" / "Email Address" (accounts) as collected and linked to the user, used for App Functionality; not used for tracking. In the privacy policy (`apps/web`, `/privacy`) the sentence about Azure OpenAI must match the consent text above. In the new age-rating questionnaire answer yes for the AI feature.

## Current status (checked 5 Nov 2026)

The `www` DNS problem described in the October notice is fixed. Both pages now answer **200** on the real domain:

| URL | Status |
|-----|--------|
| `https://www.prabhatasamgiita.org/delete-account` | **200** |
| `https://www.prabhatasamgiita.org/privacy` | **200** |
| `https://yellow-desert-06a0d4a00.2.azurestaticapps.net/delete-account` | **200** (same site on Azure Static Web Apps) |

**Use the `www` URLs** in Play Console (Account deletion URL, Data deletion URL, Privacy policy) and in App Store Connect (Privacy Policy URL). The `/delete-account` page is `apps/web/app/delete-account/page.tsx`.

## History: the October fix (kept for reference)

In October the `www` CNAME still pointed at a decommissioned Container App and both pages answered 404, so the SWA address below was used as a stopgap. It is no longer needed; this section only explains the earlier notice.

## Set the URLs in Play Console

1. Open [Play Console](https://play.google.com/console) → **Prabhat Samgiita AI** → **App content** → **Data safety**.
2. Set **Account deletion URL** and **Data deletion URL** to the **same** link:

   ```
   https://www.prabhatasamgiita.org/delete-account
   ```

3. Add the AI row from the table above, save and submit the Data safety form for review (no new APK/AAB needed for the form itself).

Verify before saving:

```bash
./scripts/verify-delete-account-url.sh
```

## If `www` ever breaks again

1. At your DNS host, set **`www.prabhatasamgiita.org`** CNAME to:

   ```
   yellow-desert-06a0d4a00.2.azurestaticapps.net
   ```

   Remove the old CNAME to `prabhatai-web….azurecontainerapps.io`.

2. After DNS propagates (often 15–60 minutes):

   ```bash
   CONFIRM=1 SKIP_DNS_CHECK=1 ./infra/azure/attach-swa-custom-domains.sh
   PUBLIC_SITE_URL=https://www.prabhatasamgiita.org ./infra/azure/sync-swa-app-settings.sh
   ```

3. Re-run `./scripts/verify-delete-account-url.sh` — `www` should return **200**.

4. Update Play Console URLs to `https://www.prabhatasamgiita.org/delete-account`.

## Deadline

Google’s notice cited **17 October 2026**. Updating Data safety with a **200** URL is sufficient; appeal only if you believe the decision was wrong.
