# Service registry: every outside service and secret

Last reviewed: 2026-11-08, from the contents of this repository only. Nobody has looked inside the live consoles
(Azure, GitHub, Neon, Cloudflare, Expo, Apple, Google). Everything that needs a console to confirm is marked.

This page lists the **names** of secrets, never their values. If you ever find a real value in this repo, do not
copy it here: tell the developer (see section 8).

Plain-language terms used below:

- **Secret**: a password-like value. Whoever holds it can act as us (read the database, spend money, log in as an admin).
- **Rotate**: replace a secret with a new one and switch off the old one. You do this on a schedule and after any leak.
- **Environment variable (env var)**: a named setting handed to a program when it starts. Some are secrets, some are not.
- **GitHub Actions secret**: a secret stored in GitHub that our automatic build and deploy jobs can read.
- **Container App**: the Azure service that runs our API (the server behind the app and website).
- **SWA (Static Web Apps)**: the Azure service that runs the website.
- **EAS**: Expo Application Services, the cloud that builds the phone apps.

Status column used in every table:

- **confirmed in repo**: I read it in a file here.
- **to confirm with owner**: the repo does not say; someone with console access must check.

Owner: "Dada (owner)" for everything, because no file in the repo names anyone else. The EAS team name
`dewasheesh3s-team` and the Azure/GitHub admin e-mail used in the scripts suggest one person holds most accounts.
Who else has access to each account is **to confirm with owner**.

---

## 1. Map of all services

| # | Service | What the app uses it for | Status |
|---|---------|--------------------------|--------|
| 1 | GitHub (repo, Actions, secrets) | Holds the code, runs tests, deploys, builds the phone apps, nightly YouTube scan | confirmed in repo |
| 2 | Docker Hub | Stores the API container image that Azure pulls | confirmed in repo (whether the image repo is private: to confirm with owner) |
| 3 | Azure subscription + deploy identity | The Azure account everything runs in; GitHub logs in to it with a passwordless "OIDC" link | confirmed in repo |
| 4 | Azure Container Apps, `prabhatai-api` | Runs the API (songs, members, AI, recordings). Resource group `prabhatai-rg`, region Central India | confirmed in repo |
| 5 | Azure Container Apps, `prabhatai-web` (old) | The old website host; replaced by Static Web Apps. Scripts still reference it | to confirm with owner (decommission script exists; was it run?) |
| 6 | Azure Static Web Apps, `prabhatai-www` | Runs the website `www.prabhatasamgiita.org`, including the Microsoft sign-in for the web | confirmed in repo |
| 7 | Azure Log Analytics, `prabhatai-law` | Stores the API logs (where you look for misuse) | confirmed in repo (bootstrap script) |
| 8 | Azure Blob Storage (search index) | Holds a zipped search index; the API downloads it through a private link (`FAISS_INDEX_URL`) | confirmed in repo (storage account name: to confirm with owner) |
| 9 | Azure budget alert (Terraform) | E-mails the owner at 70 percent of the monthly budget | confirmed in repo |
| 10 | Neon Postgres | The production database (members, songs, recordings, comments, quiz, chat memory) | confirmed in repo |
| 11 | Azure Database for PostgreSQL, `prabhatai-pg` (old) | The earlier database; still the source for the search-index export script | to confirm with owner (does it still exist, is it empty or deleted?) |
| 12 | Cloudflare R2 | File storage for member Kiirtan recordings (S3-compatible) | to confirm with owner (docs say the bucket was "not created yet"; code is ready) |
| 13 | Azure OpenAI | Answers in the AI assistant, and search embeddings | confirmed in repo |
| 14 | OpenAI (direct) | Optional alternative AI provider, supported in code | to confirm with owner (key may be unset) |
| 15 | Google Cloud Translation | Machine translation of song text, capped to the free monthly allowance | confirmed in repo |
| 16 | Google Cloud OAuth (Google sign-in) | "Continue with Google" on web, Android and iOS (Google Cloud project number `495992354696`) | confirmed in repo |
| 17 | Microsoft Entra ID, app `prabhatai-members` | "Continue with Microsoft" on web and in the app | confirmed in repo |
| 18 | Sign in with Apple | "Sign in with Apple" on iPhone (required by Apple when other sign-ins exist) | confirmed in repo (enabled on the App ID: to confirm with owner) |
| 19 | Facebook Login | **Removed from the app and the server on 2026-11-09** (owner decision). The website still has a Facebook button behind `NEXT_PUBLIC_FACEBOOK_AUTH_ENABLED`, off by default; nobody has to do anything for it | confirmed in repo |
| 20 | Azure Communication Services (e-mail) | Sends e-mail from the API (announcements, notices) | confirmed in repo |
| 21 | Expo Push service, Apple APNs, Google FCM | Push notifications for comment replies. New, off unless `PUSH_ENABLED` is true | confirmed in repo (new code, not yet deployed: to confirm) |
| 22 | Expo / EAS | Builds the Android and iOS apps in the cloud, stores signing keys, holds EAS env vars | confirmed in repo |
| 23 | Apple Developer Program + App Store Connect | Signing certificates, App ID, TestFlight, App Store listing and review | confirmed in repo (membership state: to confirm with owner) |
| 24 | Google Play Console | Android store listing, app signing, Data safety form | confirmed in repo |
| 25 | Sentry | Server crash reports. New, off unless `SENTRY_DSN` is set | confirmed in repo (new code); account to confirm with owner |
| 26 | YouTube (read-only scanning) | The nightly job and admin tools read public channel and video info. No account key | confirmed in repo |
| 27 | `prabhatasamgiita.net` (content source) | The older public site the API reads songs and content from (`CONTENT_SOURCE_URL`). Who runs it: to confirm | confirmed in repo; ownership to confirm with owner |
| 28 | Domain names and DNS for `prabhatasamgiita.org` | `www` points to the Static Web App; links from stores open the app | to confirm with owner (registrar and DNS host are not named in the repo) |
| 29 | Support mailbox (Gmail) | The support address shown in the stores | confirmed in repo (address in `.github/MOBILE_BUILD_SETUP.md`); account recovery set-up to confirm with owner |
| 30 | ClamAV (virus scanner) | Planned: scan uploaded recordings | planned, not in the repo yet |

No-key services also used (nothing to rotate): `api.qrserver.com` (QR images on the website), Sarkarverse and
archive.org (public pages read by import scripts), Google and Apple speech services on the phone (voice search
runs on the device's own service; the app sends no recording to our servers per `docs/play-data-safety.md`).

**Analytics:** no third-party analytics service (no Firebase, Google Analytics, PostHog or similar) was found.
The app records anonymous usage events in our own database (`app_events` table, see
`apps/api/app/models/app_telemetry.py`). Crash reporting is Sentry on the server only; no crash SDK was found in the
phone app.

---

## 2. Public by design versus real secrets

Anything starting with `EXPO_PUBLIC_` or `NEXT_PUBLIC_` is **copied into the app or the web page that every visitor
downloads**. Treat it as published. That is fine for identifiers, never fine for passwords.

### 2.1 Values that are public on purpose

| Name | What it is | Why it is not a secret | Status |
|------|------------|------------------------|--------|
| `EXPO_PUBLIC_API_BASE_URL` | Address of the API | Anyone must be able to reach the API | confirmed in repo |
| `EXPO_PUBLIC_WEB_BASE_URL` | Address of the website (share links) | Public address | confirmed in repo |
| `EXPO_PUBLIC_AZURE_CLIENT_ID`, `EXPO_PUBLIC_AZURE_TENANT_ID` | Identify our Microsoft app registration | Identifiers, no password | confirmed in repo |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (web), `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Identify our Google sign-in clients | Google designs these to be public | confirmed in repo |
| `EXPO_PUBLIC_MOCKUP_DATA` | Developer switch for fake data | Not sensitive | confirmed in repo |
| `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_AUTH_ENABLED`, `NEXT_PUBLIC_LOCAL_AUTH_ENABLED`, `NEXT_PUBLIC_WEB_MICROSOFT_SIGNIN_ENABLED` | Website addresses and switches | Visible in the page source anyway | confirmed in repo |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_FACEBOOK_APP_ID`, `NEXT_PUBLIC_FACEBOOK_AUTH_ENABLED` | Website sign-in identifiers | Same as the app ones | confirmed in repo |
| `NEXT_PUBLIC_ANDROID_PLAY_STORE_URL`, `NEXT_PUBLIC_IOS_APP_STORE_URL` | Store links | Public links | confirmed in repo |
| `EAS_PROJECT_ID` | Expo project identifier | An id, not a password. It is written openly in `scripts/sync-mobile-github-secrets.sh` and the workflows | confirmed in repo |
| Apple Team ID, bundle id `net.prabhatasamgiita.ai`, package name, signing fingerprints (SHA-1 / SHA-256) | Identify the app to Apple, Google and Android | Fingerprints and ids are public by design (the Apple Team ID is even published in the website's `apple-app-site-association` file) | confirmed in repo |

### 2.2 A "secret" that is NOT secret in practice

| Name | The problem | Status |
|------|-------------|--------|
| `EXPO_PUBLIC_MEMBER_PROXY_KEY` (GitHub secret `MOBILE_MEMBER_PROXY_KEY`, EAS env var of the same name) | This is a real shared key that the API uses to trust the app. Because it starts with `EXPO_PUBLIC_` it is **baked into every installed app**. Anyone can unzip the app and read it. Treat it as already public. Rotating it does not help until the new sign-in design ships, because each new app build would contain the new key again. Full story and fix plan: `docs/security-member-auth.md`. | confirmed in repo |

### 2.3 Real secrets (must never be in an app, a web page or git)

Everything in section 3 except the rows above. In short: database URL, AI and translation keys, storage keys,
signing secrets, deploy tokens, OAuth client **secrets** (as opposed to client ids).

---

## 3. Secret names and where each one lives

Places a secret can live (check them all when you rotate):

- **GH** = GitHub repository secrets (Settings, Secrets and variables, Actions). The deploy job also uses the GitHub
  environment called `production`; whether any secret lives only there instead of at repository level is to confirm
  with owner.
- **ACA-api** = secret or env var on the Azure Container App `prabhatai-api`.
- **ACA-web** = secret on the old Container App `prabhatai-web`.
- **SWA** = application setting on the Static Web App `prabhatai-www`.
- **EAS** = Expo environment variable (`preview` and `production` environments).
- **Local** = a `.env` file on a developer's computer. `.env` files are git-ignored (see `.gitignore`);
  `.env.example` files are templates with no real values.

| Name | What it protects | Lives in | Status |
|------|------------------|----------|--------|
| `DATABASE_URL` | Full access to the Neon database | GH; ACA-api secret `database-url`; Local | confirmed in repo |
| `MEMBER_PROXY_KEY` | Lets the website and the app speak for members to the API (see 2.2); also signs the website's short admin cookie | GH (also fallback `MOBILE_MEMBER_PROXY_KEY`); ACA-api secret `member-proxy-key`; SWA; ACA-web secret `member-proxy-key`; Local | confirmed in repo |
| `MOBILE_MEMBER_PROXY_KEY` / `EXPO_PUBLIC_MEMBER_PROXY_KEY` | Same value, shipped inside the app | GH; EAS (marked "sensitive"); `apps/mobile/.env` | confirmed in repo |
| `ADMIN_API_KEY_HASH` | The API admin key, stored only as a hash | ACA-api env var (how it was set: not in deploy script) | to confirm with owner |
| `ADMIN_API_KEY` | The plain admin key used by the nightly YouTube job to call the API | GH | confirmed in repo |
| `AZURE_OPENAI_API_KEY` | Spending on Azure OpenAI | GH; ACA-api as a **plain env var** (not a protected secret) | confirmed in repo |
| `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_CHAT_DEPLOYMENT`, `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION` | Address and model names, not secret on their own | GH; ACA-api | confirmed in repo |
| `OPENAI_API_KEY` | Spending on OpenAI (optional) | ACA-api env var, if set | to confirm with owner |
| `GOOGLE_TRANSLATE_API_KEY` | Spending on Google Translate | GH; ACA-api as a **plain env var** | confirmed in repo |
| `GOOGLE_CLIENT_SECRET` | Google web sign-in code exchange | GH; SWA; ACA-web secret `google-client-secret`; Local | confirmed in repo |
| `AZURE_CLIENT_SECRET` (Entra app secret) | Microsoft sign-in on the website | SWA; ACA-web secret `microsoft-provider-authentication-secret` | confirmed in repo (expiry date: to confirm with owner) |
| `ACS_EMAIL_CONNECTION_STRING` | Sending e-mail as us | ACA-api secret `acs-email-connection-string` (not passed by the GitHub deploy, so set by hand) | to confirm with owner |
| `FAISS_INDEX_URL` | Private link (SAS URL) to the search index zip | GH; ACA-api secret `faiss-index-url` | confirmed in repo (the link has an expiry: to confirm with owner) |
| `RECORDING_SIGNING_SECRET` | Signs links to recordings and upload tickets; also feeds anonymous listener statistics | ACA-api env var | to confirm with owner (docs/security-member-auth.md says it must be set in production) |
| `AUTHOR_STATS_PEPPER` | Extra secret that scrambles listener ids in author statistics (falls back to the signing secret, then the proxy key) | ACA-api env var | to confirm with owner |
| `RECORDING_S3_ACCESS_KEY_ID`, `RECORDING_S3_SECRET_ACCESS_KEY` | Read and write the R2 bucket | ACA-api env vars (once the bucket exists) | to confirm with owner |
| `RECORDING_S3_ENDPOINT`, `RECORDING_S3_BUCKET`, `RECORDING_S3_REGION`, `RECORDING_PUBLIC_BASE_URL` | Where the bucket is; not secret on their own | ACA-api env vars | to confirm with owner |
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (GitHub secrets, deploy login) | Identify the deploy identity. No password: GitHub proves who it is through OIDC | GH | confirmed in repo |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Publishing the website | GH (the token is created by `infra/azure/setup-static-web-app.sh`) | confirmed in repo |
| `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` | Pushing and pulling the API image | GH; ACA-api registry setting (rewritten at each API deploy) | confirmed in repo |
| `EXPO_TOKEN` | Starting builds in EAS as the team | GH | confirmed in repo |
| `CATALOG_API_URL` | API address for the nightly job (has a built-in default) | GH (optional) | confirmed in repo |
| `MOBILE_API_BASE_URL`, `MOBILE_WEB_BASE_URL`, `MOBILE_AZURE_CLIENT_ID`, `MOBILE_AZURE_TENANT_ID`, `MOBILE_GOOGLE_CLIENT_ID`, `MOBILE_GOOGLE_IOS_CLIENT_ID`, `MOBILE_GOOGLE_ANDROID_CLIENT_ID` | Overrides for the public values in section 2.1 | GH | confirmed in repo (not secrets) |
| `FACEBOOK_APP_ID` | Facebook app id for the website build | GH | confirmed in repo (public id) |
| `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_STORE_CONNECT_APP_ID` | Used only for a manual `eas submit` from a laptop | Local shell | confirmed in repo (not wired into GitHub) |
| `PG_PASSWORD` | Password of the old Azure Postgres server | Mentioned in `docs/deployment-azure.md` as a GitHub secret; no workflow uses it | to confirm with owner (probably stale) |
| `EXPO_ACCESS_TOKEN` | Optional Expo push "enhanced security" token | ACA-api env var, only if push is on | planned / optional |
| `SENTRY_DSN` | Where crash reports are sent (a low-risk address, not a password) | ACA-api env var | planned / optional |
| `GITHUB_TOKEN` | Temporary token GitHub creates for each job | Created automatically | confirmed in repo (nothing to rotate) |
| Apple distribution certificate, provisioning profiles, push key (APNs) | Signing and push for the iPhone app | EAS credential store | to confirm with owner |
| Android upload keystore (and Google Play app signing key) | Signing the Android app | EAS credential store; Play holds the app signing key | to confirm with owner |

**Seeing names without seeing values** (safe to run, but do not share your screen while doing it):

- GitHub: `gh secret list`
- API container: `az containerapp secret list --name prabhatai-api --resource-group prabhatai-rg --query "[].name"`
  and `az containerapp show --name prabhatai-api --resource-group prabhatai-rg --query "properties.template.containers[0].env[].name"`
- Website: `az staticwebapp appsettings list --name prabhatai-www --resource-group prabhatai-rg --query "keys(properties)"`
  (the `keys(...)` part matters: without it the command prints the values)
- Expo: `eas env:list --environment production` in `apps/mobile` (sensitive values are hidden)

`az containerapp update --set-env-vars` (used by `infra/azure/deploy-app.sh`) only changes the variables it names, so
variables you set by hand should survive a deploy. This is **to confirm with owner** against the live app.

---

## 4. Each service: owner, rotation, and what breaks

General rule for every rotation:

1. If the provider allows **two keys at once**, create the new key first, switch the app, then delete the old key. No downtime.
2. If it allows only one, expect a short outage between "old key dead" and "new key live". Do it in a quiet hour.
3. After changing a secret on a Container App, **restart it** (a new revision): a changed secret is not picked up by a running copy.
4. Never paste a secret into chat, an e-mail, a ticket, or a command typed as a shell argument that stays in history.
   `gh secret set NAME` asks for the value interactively; use that.
5. After the change, run the checks in section 6.

### 4.1 GitHub (service 1)

- Owner: Dada (owner). Other collaborators with admin or write access: to confirm with owner.
- Secrets: all "GH" rows in section 3. Workflows: `.github/workflows/deploy.yml`, `mobile-preview.yml`,
  `mobile-release.yml`, `watch-youtube.yml`, `ingest-sarkarverse-sargam.yml`.
- Rotate one secret: `gh secret set NAME` (or Settings, Secrets, Actions, Update). To rebuild the mobile set from a
  local `apps/mobile/.env`: `scripts/sync-mobile-github-secrets.sh` (needs `gh auth login`; takes `EXPO_TOKEN` from the shell).
- Rotate your own GitHub login or personal access tokens: github.com, Settings, Developer settings. Turn on two-factor sign-in.
- What breaks: changing a GitHub secret changes nothing live by itself. Azure and EAS keep the old value until the next
  deploy or build. Order: change the provider, change GitHub, run the deploy, check, then revoke the old one.

### 4.2 Docker Hub (service 2)

- Owner: Dada (owner). Account name is in the `DOCKERHUB_USERNAME` secret.
- Secrets: `DOCKERHUB_TOKEN` (an access token, not the account password).
- Rotate: hub.docker.com, Account settings, Security, New access token (read and write). Put it in GitHub
  (`gh secret set DOCKERHUB_TOKEN`). Run the **Deploy** workflow with `deploy_api` on (Actions, Deploy, Run workflow):
  the deploy script gives Azure the new token (`az containerapp registry set`). Then delete the old token.
- What breaks: if you delete the old token before the deploy ran, Azure cannot pull a new image and a restart or
  scale-up may fail. The running copy keeps working until it is replaced.
- Check: whether the image repository `prabhat-samgiita-api` on Docker Hub is **private** (a public image would expose
  the code and any data baked into it). To confirm with owner.

### 4.3 Azure subscription, deploy identity, Container Apps, Static Web Apps, Log Analytics, Blob, budget (services 3 to 9)

- Owner: Dada (owner). Azure admin e-mail is set in the Terraform defaults and the scripts (`infra/terraform/budget`,
  `infra/azure/deploy-app.sh`).
- Resources named in the repo: resource group `prabhatai-rg`; Container Apps environment `prabhatai-env`; API app
  `prabhatai-api`; old web app `prabhatai-web`; Static Web App `prabhatai-www` (region East Asia); Log Analytics
  `prabhatai-law`; Postgres server `prabhatai-pg` (old).
- Secrets and access:
  - Deploy login: GitHub secrets `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, using a **federated
    credential** (no password to leak). If the deploy identity is suspected: Azure Portal, Microsoft Entra ID, App
    registrations, the deploy app, Certificates and secrets, Federated credentials: delete and recreate it; also review
    its role assignments on the subscription.
  - Container App secrets: `member-proxy-key`, `database-url`, `faiss-index-url`, `acs-email-connection-string`
    (API); `member-proxy-key`, `google-client-secret`, `microsoft-provider-authentication-secret` (old web app).
  - Static Web App deployment token `AZURE_STATIC_WEB_APPS_API_TOKEN`.
- Rotate the website deployment token: `az staticwebapp secrets reset-api-key --name prabhatai-www --resource-group prabhatai-rg`,
  then `gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN` with the new token (`az staticwebapp secrets list ... --query properties.apiKey -o tsv`
  shows it; note that `infra/azure/setup-static-web-app.sh` also prints it to the screen, so do not run that script in a recorded session).
  What breaks: website deploys fail until GitHub has the new token. The live site keeps running.
- Rotate a Container App secret by hand: `az containerapp secret set --name prabhatai-api --resource-group prabhatai-rg --secrets NAME=VALUE`,
  then restart: `az containerapp revision restart --name prabhatai-api --resource-group prabhatai-rg --revision <active revision name>`.
  What breaks: the API restarts (a few seconds to a minute; it can scale to zero and cold-start anyway).
- Remove access of people who left: Azure Portal, Subscription, Access control (IAM). Review it each quarter.
- Budget: the 70 percent alert is only an e-mail, not a hard stop (`infra/azure/README.md`). A sudden cost jump is also an
  incident signal (stolen AI key, crypto-mining). Cost Management is the place to look.
- Website sign-in settings in Azure (Entra redirect URIs) are in 4.10.

### 4.4 Neon Postgres (service 10)

- Owner: Dada (owner). Neon account holder and project name: to confirm with owner.
- Secrets: `DATABASE_URL` (the "pooled" connection address with user and password). A second "direct" address is used only
  for database migrations and restores (`.env.example`, "Direct URL"). Both contain the password.
- Rotate: Neon console, the project, Roles, reset the password of the app role (this changes both addresses).
  Then:
  1. Take the new pooled address (with `sslmode=require`).
  2. `gh secret set DATABASE_URL`.
  3. Run **Deploy** with `deploy_api` on: the script writes the new value to the Container App secret `database-url`.
  4. Check `https://prabhatai-api.bluemeadow-9418d5fc.centralindia.azurecontainerapps.io/api/v1/health/readiness`.
  5. Update any local `.env` files and any scheduled job that uses the address (the nightly `watch-youtube.yml` reads the GitHub secret).
- What breaks: from the moment Neon resets the password until the API restarts with the new one, **the whole API fails**.
  To shorten it, do steps 1 to 3 immediately after the reset, or create a second role first, switch to it, then delete the old role (no outage).
- If Neon offers IP allow-listing or branch protection on your plan, check it: to confirm with owner.

### 4.5 Azure Postgres (old) and Azure Blob search index (services 11 and 8)

- Owner: Dada (owner). Is the old server still running? To confirm with owner. If it is not needed, delete it: every database
  that is not needed is a leak waiting to happen. Do not delete it before checking `scripts/export_embeddings_to_faiss.py` and
  `scripts/copy_postgres_relational.py`, which read from it (`DATABASE_URL_SOURCE`).
- Secrets: its admin password (set when `infra/azure/deploy.sh` ran, not stored in the repo); and `FAISS_INDEX_URL`, a Blob link with a
  built-in access signature that expires.
- Rotate: old server password via `az postgres flexible-server update --name prabhatai-pg --resource-group prabhatai-rg --admin-password ...`
  (type it in a shell prompt, not on the command line history). Search index link: Azure Portal, the storage account, the zip file,
  Generate SAS, then `gh secret set FAISS_INDEX_URL` and run **Deploy** with `deploy_api` on.
- What breaks: an expired or revoked index link stops the API from loading a new search index at start. The API can fall back to
  re-embedding, which is slow (the deploy script waits up to one hour in that case).

### 4.6 Cloudflare R2 (service 12)

- Owner: Dada (owner). Cloudflare account and bucket name: to confirm with owner (docs say the bucket did not exist yet).
- Secrets: `RECORDING_S3_ACCESS_KEY_ID`, `RECORDING_S3_SECRET_ACCESS_KEY` (an R2 API token). `RECORDING_SIGNING_SECRET` is separate (see 4.14).
- Rotate: Cloudflare dashboard, R2, Manage API tokens. Create a new token limited to this one bucket with read and write
  permission only. Set the two values on the API app (`az containerapp update --name prabhatai-api --resource-group prabhatai-rg --set-env-vars ...`
  using secret references where possible), restart, test an upload and a play, then delete the old token.
- What breaks: while the old token is dead and the new one is not yet live, uploads and playback of stored recordings fail.
- If the bucket is public (`RECORDING_PUBLIC_BASE_URL`), assume every file in it is public. Do not store anything private there.
- Moving old files into the bucket: `apps/api/scripts/migrate_recording_files.py` (dry run by default).

### 4.7 Azure OpenAI and OpenAI (services 13 and 14)

- Owner: Dada (owner).
- Secrets: `AZURE_OPENAI_API_KEY` (GH and API app, stored as a plain env var today, which means anyone who can read the app's
  settings in Azure can read the key; moving it into a Container App secret is a recommended hardening, not done yet);
  `OPENAI_API_KEY` if set.
- Rotate (Azure OpenAI has two keys): Azure Portal, the Azure OpenAI resource, Keys and Endpoint. Copy Key 2, `gh secret set AZURE_OPENAI_API_KEY`,
  run **Deploy** with `deploy_api` on, check an AI answer works, then **Regenerate Key 1**. Next time swap the other way.
- OpenAI direct: platform.openai.com, API keys, create a new key, set it on the API app, restart, delete the old key.
- What breaks: with no valid key the API falls back to a built-in mock answer (`infra/azure/README.md`), so the assistant gives
  weak answers rather than failing outright. The AI daily limits (15 guests, 50 signed-in) cap normal use but not a stolen key.
- Misuse signs: a spike in requests or cost in Azure OpenAI metrics and Cost Management.

### 4.8 Google Cloud Translation (service 15)

- Owner: Dada (owner). Google Cloud project: to confirm with owner (the sign-in project is `495992354696`; the translation key may live in the same one).
- Secret: `GOOGLE_TRANSLATE_API_KEY` (GH and API app plain env var). The code caps use at about 400,000 characters a month and
  never goes past the free allowance unless `GOOGLE_TRANSLATE_ALLOW_PAID` is changed (keep it `false`).
- Rotate: Google Cloud console, APIs and Services, Credentials, create a new API key restricted to **Cloud Translation API only**,
  `gh secret set GOOGLE_TRANSLATE_API_KEY`, run **Deploy** with `deploy_api` on, then delete the old key.
- What breaks: translations fall back to the AI model (`apps/api/app/config.py` comment: over budget goes to the LLM) until the new key is live.

### 4.9 Google sign-in (service 16)

- Owner: Dada (owner). Google Cloud project number `495992354696`.
- Secret: `GOOGLE_CLIENT_SECRET` (the Web client's secret, used by the website for the code exchange). The three client ids are public (section 2.1).
  Phones use native Google sign-in and hold no Google secret.
- Rotate: Google Cloud console, APIs and Services, Credentials, the Web client: add a new client secret, put it in GitHub
  (`gh secret set GOOGLE_CLIENT_SECRET`), run **Deploy** with `deploy_web` on (it also runs `infra/azure/sync-swa-app-settings.sh`,
  which writes it to the website settings), check "Continue with Google" on the site, then disable the old secret.
  Whether your Google console version lets you hold two secrets at once is to confirm with owner.
- What breaks: Google sign-in on the **website** fails while the secret is out of sync. Mobile sign-in is unaffected.
- Android Play-store sign-in needs one Android client per signing fingerprint: `docs/android-google-signin.md`.

### 4.10 Microsoft Entra ID (service 17)

- Owner: Dada (owner). Tenant and app registration `prabhatai-members` (ids are public).
- Secret: `AZURE_CLIENT_SECRET`, the app registration's client secret, used by Static Web Apps for the website sign-in. **It expires on a date
  chosen when it was created** (to confirm with owner: put the date in your calendar). The phone app uses the public client and has no secret.
- Rotate: Azure Portal, Microsoft Entra ID, App registrations, `prabhatai-members`, Certificates and secrets, New client secret.
  Put the new value in the website: `AZURE_CLIENT_SECRET=... ./infra/azure/sync-swa-app-settings.sh` (needs `az login`). Test "Continue with Microsoft"
  on the site, then delete the old secret.
- What breaks: website Microsoft sign-in fails when the secret expires or is deleted before the new one is live. App sign-in is unaffected.
- Redirect addresses to keep: `prabhatai://auth` (mobile) and the website `/.auth/login/aad/callback` addresses (see `infra/azure/README.md`).
- Trap: the deploy does not carry `AZURE_CLIENT_SECRET` in GitHub. `infra/azure/sync-swa-app-settings.sh` reads it from the **old** web app's secret
  `microsoft-provider-authentication-secret`. If the old web app is deleted, the script can no longer fetch it and simply leaves the value already in the
  website settings. So after the old app is gone, rotate by passing `AZURE_CLIENT_SECRET=...` to the script yourself, and keep the new value in a password manager.

### 4.11 Apple: Developer Program, Sign in with Apple, App Store Connect (services 18 and 23)

- Owner: Dada (owner) as the Apple ID holder. Whether the paid membership is active and who else is on the team: to confirm with owner.
- Secrets: none in the repo. Signing material lives in EAS (distribution certificate, provisioning profiles, push key). Apple ID password and
  two-factor devices are personal secrets. `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_STORE_CONNECT_APP_ID` are used only for manual `eas submit`.
- Rotate:
  - Apple ID password: appleid.apple.com. Review trusted devices.
  - Certificates and profiles: in `apps/mobile` run `npx eas-cli credentials -p ios`, pick production, remove or regenerate.
  - If you create an App Store Connect API key for automatic upload: App Store Connect, Users and Access, Integrations; keep the `.p8` file out of git
    (`.gitignore` already lists `*.p8`).
- What breaks: a revoked certificate stops new builds from being signed until EAS makes a new one (a few minutes). Apps already installed keep working.
- Store listing and privacy labels must match reality: `docs/play-data-safety.md`, `docs/ios-privacy-manifest.md`.

### 4.12 Facebook Login (service 19)

- Owner: Dada (owner). Status: removed from the app and the API on 2026-11-09. Nothing in the repo uses a Facebook secret any more.
- If a Facebook developer app was ever created for this, it can be deleted at developers.facebook.com (the app, Settings, Advanced, Delete app). Nothing breaks: the app and the server no longer call it.
- The website still contains a Facebook button, switched off by `NEXT_PUBLIC_FACEBOOK_AUTH_ENABLED=false`. Leave it off. Removing the website code is the web team's file set and was not touched.
- Sharing a song to Facebook (the share sheet) is not a sign-in and stays.

### 4.13 Azure Communication Services e-mail (service 20)

- Owner: Dada (owner).
- Secret: `ACS_EMAIL_CONNECTION_STRING` (API app secret `acs-email-connection-string`). The sender address `ACS_EMAIL_FROM` and the switch
  `ACS_EMAIL_ENABLED` are not secret.
- Rotate: Azure Portal, the Communication Services resource, Keys: regenerate the secondary key, put the new connection string in the
  API app secret, restart, test an e-mail, then regenerate the primary key.
- What breaks: the API cannot send e-mail (it logs "would send" and carries on); sign-in and the app keep working.
- Misuse signs: unexpected sent-mail volume in the resource's metrics; spam complaints.

### 4.14 Our own signing secrets (live in the API, no outside service)

| Secret | What it signs | If you rotate it | Status |
|--------|---------------|------------------|--------|
| `RECORDING_SIGNING_SECRET` | Links to stored recordings and upload tickets (valid 15 minutes); also an input to anonymous listener hashes unless `AUTHOR_STATS_PEPPER` is set | Old signed links stop working at once (the app asks for fresh ones); upload tickets in flight fail and must be restarted; the anonymous "unique listener" counts restart from zero because the hashes change | to confirm with owner (whether it is set in production) |
| `AUTHOR_STATS_PEPPER` | Scrambles listener ids in author stats | The "unique listeners" numbers reset | to confirm with owner |
| `MEMBER_PROXY_KEY` | The website-to-API and app-to-API trust key; the website also signs a 5-minute admin cookie with it | Every installed app loses member features (sync, profile, notices) until updated, because the old key sits in the app; the website must get the new value at the same moment (`sync-swa-app-settings.sh` or **Deploy** with `deploy_web`); admin cookies expire within 5 minutes anyway; if `RECORDING_SIGNING_SECRET` is not set, signed media links also die because the code falls back to this key | confirmed in repo |
| `ADMIN_API_KEY_HASH` + `ADMIN_API_KEY` | The API admin key. The API stores only the hash (`sha256:` plus the hex digest of the key) | Make a new random key, compute its hash with `python3 -c "import hashlib,sys;print('sha256:'+hashlib.sha256(sys.stdin.read().strip().encode()).hexdigest())"` (type the key at the prompt, then press Ctrl-D), set `ADMIN_API_KEY_HASH` on the API app, restart, then `gh secret set ADMIN_API_KEY`. The nightly YouTube job fails between the two steps; nothing else depends on it | confirmed in repo |

How to make a good random value (for any signing secret or key): `python3 -c "import secrets;print(secrets.token_urlsafe(48))"` (the output goes to the screen only; paste it straight into the GitHub or Azure prompt).

### 4.15 Expo / EAS and the phone stores (services 21, 22, 24)

- Owner: Dada (owner); EAS account/team `dewasheesh3s-team`, project `prabhatsamgiitaai`. Other team members on Expo: to confirm with owner.
- Secrets: `EXPO_TOKEN` (GH). EAS env var `EXPO_PUBLIC_MEMBER_PROXY_KEY` (see 2.2). Signing keys inside EAS. `EXPO_ACCESS_TOKEN` only if push security is switched on.
- Rotate `EXPO_TOKEN`: expo.dev, Settings, Access tokens, create a new one, `gh secret set EXPO_TOKEN`, delete the old one. What breaks: phone builds
  from GitHub fail while the token is invalid; the live apps are not affected.
- Android: the upload keystore is held by EAS (`eas credentials -p android`); Google Play holds the app signing key. **Download a backup of the upload
  keystore and keep it offline**: losing it means a request to Google to reset the upload key. Play Console service accounts are not used by the repo today.
- Push (new): the API sends through the Expo push service, which relays to Apple (APNs) and Google (FCM). Android push needs Google FCM credentials uploaded
  to EAS, iOS push needs an APNs key managed by EAS. Whether these exist: to confirm with owner. Off until `PUSH_ENABLED` is true on the API.
- Google Play Console: the account owner login is the key secret. Add people with the least access they need (Users and permissions). Play Console, App signing,
  holds the SHA-1 and SHA-256 fingerprints used by Google sign-in and the web `assetlinks.json` (`docs/app-links.md`, still a placeholder at the last check).

### 4.16 Sentry (service 25) and ClamAV (service 30)

- Sentry: new, off unless `SENTRY_DSN` is set on the API app. The DSN only lets someone send events in, not read them; rotate by creating a new key in
  the Sentry project, setting it, then disabling the old one. Related settings: `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE`.
  The code strips e-mails, tokens and signed links before sending (`apps/api/app/observability.py`); the Sentry account login still needs two-factor.
  Status: confirmed in repo; whether an account exists: to confirm with owner.
- ClamAV: planned and optional (settings names are for the developer to confirm); it is a program we would run ourselves, so it has no outside account.

### 4.17 YouTube, content source, domains, support mailbox (services 26 to 29)

- YouTube: no account key. The nightly job `watch-youtube.yml` calls our own API with `ADMIN_API_KEY`. `scripts/sync_youtube.py` contains YouTube's public
  web-player key (see section 7). Risk is low; YouTube may block scans, which is an availability issue, not a leak.
- `prabhatasamgiita.net`: read-only source. Nothing to rotate. Who owns it: to confirm with owner.
- Domain and DNS: the website must keep `www.prabhatasamgiita.org` pointing at the Static Web App (`infra/azure/attach-swa-custom-domains.sh`). Registrar,
  DNS host and who can log in: **to confirm with owner**. Losing the domain account is a serious incident (someone could redirect users, steal sign-ins, and
  break app links). Use a strong password, two-factor, and registrar lock.
- Support mailbox: the address printed in the stores is a Gmail account. Use two-factor and a recovery phone, because app-store and Google account recovery mails land there.

---

## 5. New authentication and safety settings (being added)

The auth agent is rewriting `docs/security-member-auth.md`. These names come from that plan and from the working tree.
They are **not live in production** until the matching code is deployed; confirm each before relying on it.

| Name | What it is | Rotation or use | Status |
|------|------------|-----------------|--------|
| `MEMBER_SESSION_SECRET` | The key that signs member session tokens (the "you are signed in" pass the API hands out after sign-in) | **Emergency button.** Replacing it makes every existing session token invalid, so everyone is signed out and must sign in again. Use it if sessions may be forged or stolen. Whether refresh tokens also die depends on the final design: check `docs/security-member-auth.md` | being added: to confirm with owner |
| `WEB_PROXY_KEY` | A key only the website server uses to speak to the API for signed-in website visitors; it never goes into an app. It replaces the shared `MEMBER_PROXY_KEY` role for the web | Store in GH, SWA settings and the API app. Rotate by setting the API and website to the new value together | being added: to confirm with owner |
| `ALLOW_LEGACY_MEMBER_PRINCIPAL` | A switch. While true, old apps can still use the old shared-key sign-in. Setting it to false closes the old hole | Not a secret. Flip to false only after old app versions are forced to update (see `docs/forced-update.md`) | being added: to confirm with owner |
| `LEGACY_PRINCIPAL_ADMIN` | Controls whether the old-style sign-in may act as an admin (per the auth agent; exact behaviour to confirm in the rewritten `docs/security-member-auth.md`) | Not a secret | being added: to confirm with owner |
| `SMOKE_ADMIN_TOKEN` | Proposed replacement for the "deploy-smoke" test identity used by the deploy script | Would be a real secret in GH only | proposed in the old design note: to confirm with owner |
| `RATE_LIMIT_BACKEND` | Where "too many requests" counters are kept (today they are in memory of each API copy) | Not a secret | planned / optional |
| ClamAV settings (virus scanning of uploads) | Host and port or path of a scanner, and an on/off switch | Not secrets unless the scanner needs a password | planned / optional |
| `PUSH_ENABLED`, `EXPO_ACCESS_TOKEN`, `EXPO_PUSH_URL`, `EXPO_PUSH_RECEIPTS_URL` | Push notification switch and optional token (section 4.15) | Only `EXPO_ACCESS_TOKEN` is secret | new in working tree: to confirm with owner |
| `SENTRY_DSN` and related | Crash reports (section 4.16) | Low-risk address | new in working tree: to confirm with owner |

Today's weak spot, until the new sign-in ships: anyone who reads `EXPO_PUBLIC_MEMBER_PROXY_KEY` out of an app can pretend to be any member and, with
an admin's e-mail address, an admin. That is why the incident plan (`docs/incident-response.md`) treats the member session secret and the legacy switch as the main emergency controls.

---

## 6. Rotation order cheat sheet

Use this when a leak is suspected. It assumes you do not know how far it went.

1. **Cut off the cause first, then replace.** If the leaked thing is a cloud key (OpenAI, Translate, R2, ACS), create the new key before deleting the old one when the provider allows.
2. **Highest damage first:** (a) `DATABASE_URL` (Neon), (b) admin paths (`ADMIN_API_KEY`, `MEMBER_PROXY_KEY`, `MEMBER_SESSION_SECRET`), (c) cloud accounts (Azure, GitHub, Expo, Apple, Google Play, Cloudflare logins and tokens),
   (d) money keys (AI, Translate), (e) signing secrets (`RECORDING_SIGNING_SECRET`), (f) everything else.
3. **Where to change each:** provider console, then GitHub secret (`gh secret set`), then **Deploy** workflow (`deploy_api` for the API, `deploy_web` for the website), then restart if you changed a Container App secret by hand.
4. **Phone apps:** nothing a server change fixes is baked into already installed apps, except that the old proxy key there keeps working until the server stops accepting it. New value in an app means a new build and store review, so plan for the lag and use the forced update described in `docs/forced-update.md`.
5. **Verify after every change:**
   - API: `GET /api/v1/health/readiness` on the API address returns healthy.
   - Website: open `https://www.prabhatasamgiita.org`, sign in with Google and Microsoft, open the account page.
   - AI: ask one question in the assistant.
   - Recordings: play one and (if R2 is on) upload one.
   - E-mail: trigger one test message.
   - Nightly job: run **Watch trusted Prabhat Samgiita channels** by hand once.
6. **Write down** what you changed, when, and why (see `docs/incident-response.md`, internal status update).

Dependency notes:

- `DATABASE_URL`: GH, API app secret, nightly YouTube job, local `.env` files, and any copy script (`DATABASE_URL_SOURCE`).
- `MEMBER_PROXY_KEY`: GH (`MEMBER_PROXY_KEY` and `MOBILE_MEMBER_PROXY_KEY`), API app, website setting, EAS env, `apps/mobile/.env`, and (if unset elsewhere) recording links and listener stats.
- `GOOGLE_CLIENT_SECRET`: GH, website setting (and the old web app).
- `DOCKERHUB_TOKEN`: GH, then an API deploy rewrites the Azure registry setting.

---

## 7. Found in repo, please check

Paths only; no values are repeated here. None of these looks like a live production secret, but a person should confirm each.

| File | What it is | Concern |
|------|------------|---------|
| `scripts/sync_youtube.py` | A Google-style API key string, labelled in a code comment as YouTube's public web player key | Probably public by design (it is the key YouTube's own web player uses), but confirm it is not a key from our own Google Cloud project; if it is ours, rotate it |
| `apps/api/tests/test_recordings.py` | A sample AWS access key and secret | These are the documented example values from Amazon's signing guide (`examplebucket`), used to test our link-signing code. Not real. |
| `.env.example`, `docker-compose.yml`, `docs/local-setup.md`, `scripts/validate_backend_acceptance.py`, `apps/api/tests/test_import_kiirtan_library.py`, `apps/api/tests/test_recording_loudness.py` | Database addresses with throwaway passwords (`postgres`, `acceptance`, `user`) | Local test databases only. Confirm none was ever used on a real server |
| `apps/mobile/eas.json`, `apps/mobile/app.config.js`, `apps/mobile/app.json`, `apps/mobile/.env.example`, `.github/MOBILE_BUILD_SETUP.md`, `docs/android-google-signin.md` | Real Microsoft and Google client ids, tenant id, project number | Public by design (section 2.1). Listed so you know they are intentionally in git |
| `.env.example` | `MEMBER_PROXY_KEY=replace-with-a-long-random-server-only-value` | A placeholder text, not a key. Make sure nobody ever ran production with it |
| `infra/azure/deploy-app.sh` | On first bootstrap, if no key exists, the script **derives** `MEMBER_PROXY_KEY` from a hash of the database address | Anyone who has the database address can recompute that key. Confirm production uses a random key, not the derived one, and rotate it if unsure |
| `infra/azure/deploy-app.sh`, `infra/azure/sync-swa-app-settings.sh`, `infra/terraform/budget/variables.tf`, `infra/terraform/budget/README.md` | The owner's personal admin e-mail address as a default | Not a secret but personal data in git. Decide whether that is acceptable |
| `infra/azure/deploy-app.sh` | Passes `AZURE_OPENAI_API_KEY` and `GOOGLE_TRANSLATE_API_KEY` to Azure as plain settings | Anyone with read access to the Container App can see them. Recommended: move to Container App secrets |
| `infra/azure/setup-static-web-app.sh` | Prints the website deployment token to the screen | Do not run it in a recorded or shared terminal; rotate the token if it was ever shown that way |
| `docs/deployment-azure.md` | Names a GitHub secret `PG_PASSWORD` that no workflow uses | Probably stale; if the secret exists in GitHub and the old server is gone, delete it |
| `apps/mobile/.env` (local, ignored) | Expected to hold the real mobile values on the owner's computer; **not present in this checkout** | Keep it ignored. Back it up in a password manager, not in git |

Checked: `.gitignore` excludes `.env`, `.env.*`, `*.tfstate`, `.terraform/`, `*.jks`, `*.p8`, `*.p12`, `*.mobileprovision`. No `.env`, `.p8`, `.jks`, `.pem`, `google-services.json` or service-account file is tracked in git.

What I could not check: git history. A secret deleted from a file can still sit in old commits. Run a history scan (for example `gitleaks detect` or GitHub's secret scanning) and treat anything it finds as leaked.

---

## 8. Open questions for the owner

1. Is the old Azure Postgres server `prabhatai-pg` still alive, and does anyone still need it?
2. Has the old Container App `prabhatai-web` been removed (`infra/azure/decommission-web-container-app.sh`)? If not, it still holds secrets.
3. Is `RECORDING_SIGNING_SECRET` set in production? Is `AUTHOR_STATS_PEPPER`? Is `ADMIN_API_KEY_HASH`?
4. Does the Cloudflare R2 bucket exist, and who holds the Cloudflare login?
5. When does the Entra client secret (`AZURE_CLIENT_SECRET`) expire? When does the Blob link in `FAISS_INDEX_URL` expire?
6. Is the Docker Hub image repository private?
7. Who else has access to: GitHub, Azure, Neon, Expo, Apple, Google Play, Cloudflare, the domain registrar, the support mailbox?
8. Which account holds the domain `prabhatasamgiita.org`, and where does DNS live?
9. Are Sentry and Expo push (APNs, FCM) really planned, and by when? (Facebook Login was dropped on 2026-11-09.)
10. Is the production `MEMBER_PROXY_KEY` random, or the value derived from the database address (section 7)?
11. Do any secrets live only in the GitHub `production` environment instead of the repository level?

Review this page every quarter and after any person joins or leaves the project (see the drill list in `docs/incident-response.md`).
