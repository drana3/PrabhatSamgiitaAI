# Google Play — Data safety (account / data deletion URLs)

## What Google checks

Play Console **Data safety** requires a public HTTPS URL that explains how users delete their account and associated data. Google’s crawler must get **HTTP 200** (not 404).

In-app deletion is already supported: **Profile → Delete account data** (mobile) and **Account → Delete account data** (web).

## Root cause (Oct 2026)

| URL | Status |
|-----|--------|
| `https://prabhatai-web…azurecontainerapps.io/delete-account` | **404** — old Container App web (decommissioned) |
| `https://www.prabhatasamgiita.org/delete-account` | **404** — `www` DNS CNAME still points at that Container App |
| `https://yellow-desert-06a0d4a00.2.azurestaticapps.net/delete-account` | **200** — production site on **Azure Static Web Apps** |

The `/delete-account` page is implemented in `apps/web/app/delete-account/page.tsx` and is deployed on Static Web Apps.

## Privacy policy URL

Same DNS situation as account deletion:

| URL | Status |
|-----|--------|
| `https://www.prabhatasamgiita.org/privacy` | **404** until `www` CNAME is fixed |
| `https://yellow-desert-06a0d4a00.2.azurestaticapps.net/privacy` | **200** |

Use the SWA URL in **Play Console → Store settings → Privacy policy** (and App Store Connect) until `www` works.

## Fix Play Console now (no app release)

1. Open [Play Console](https://play.google.com/console) → **Prabhat Samgiita AI** → **App content** → **Data safety**.
2. Set **Account deletion URL** and **Data deletion URL** to the **same** working link:

   ```
   https://yellow-desert-06a0d4a00.2.azurestaticapps.net/delete-account
   ```

3. Save and submit the Data safety form for review (you do **not** need a new APK/AAB for this-only fix).

After custom domain is fixed (below), switch both fields to:

```
https://www.prabhatasamgiita.org/delete-account
```

Verify before saving:

```bash
./scripts/verify-delete-account-url.sh
```

## Fix `www` (recommended)

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
