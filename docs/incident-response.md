# Incident response plan: leaked keys or data

Last reviewed: 2026-11-08. Written from the repository only. Nothing here has been tried against the live system.
Items that need production or a console to confirm are marked **to confirm**.

Companion pages:

- `docs/service-registry.md`: every outside service, secret names, where each lives, how to rotate it. Called "the registry" below.
- `docs/security-member-auth.md`: how member sign-in works and the open weakness around the shared key in the app.
- `docs/forced-update.md`: how to make old app versions update (the minimum-version control). Read it before you need it.

Plain-language terms:

- **Incident**: something happened, or may have happened, that exposes our secrets or people's data, or breaks the app in a harmful way.
- **Rotate**: replace a secret with a new one and kill the old one.
- **Contain**: stop it getting worse (for example, kill the leaked key). Containing comes before understanding.
- **Supervisory authority**: the government body that handles privacy law breaches (in the EU, a national data protection authority).
- **Personal data**: anything that identifies a person: name, e-mail, phone number, sign-in account, chat questions linked to an account.

**If you read nothing else, do these five things, in this order:**

1. Stay calm. Write down the time and what you saw (section 5, evidence).
2. Tell the technical contact and the developer on call (section 2). Do not try to fix it alone in silence.
3. Kill the leaked thing: rotate the key or switch off the broken feature (section 4).
4. Write down every action with a time stamp in one shared note.
5. Do **not** delete logs, the database, or old app versions "to clean up". Evidence first.

---

## 1. Recognising an incident, and how serious it is

### 1.1 Signs that something is wrong

- A key or password pasted into chat, e-mail, a screenshot, a public repo, an issue, or a video.
- GitHub or another provider e-mails you "we found a secret in your repository" or "new sign-in from an unknown place".
- A cloud bill alert (Azure budget mail at 70 percent) or a sudden jump in AI or translation usage.
- Users report: "I got a login code I did not ask for", "my account shows someone else's name", "I was signed out of everything".
- The API starts failing right after a change nobody planned (database password changed, files missing).
- Unknown administrators in the member list, unknown admin actions, unexpected announcements or e-mails sent to members.
- Someone writes to the support mailbox claiming they have our data or can see members' details.
- The website or app shows content we did not publish; the domain points somewhere else.
- A bad app release: crashes on start, wrong data shown to users, sign-in broken for everyone.

If you are not sure whether it is an incident, **treat it as one for the first hour**. Downgrading is free; a late start is not.

### 1.2 Severity levels

| Level | Meaning | Examples in this project | Respond within | Who is told |
|-------|---------|--------------------------|----------------|-------------|
| **SEV1 Critical** | Personal data of members is exposed or can be read by outsiders, or an attacker can act as an admin, or the database or a cloud account is compromised | Database address or password leaked; admin account taken over; the API lets anyone read other members' data; signing secret for sessions leaked; domain hijacked | Start now. Containment within 1 hour | Owner, technical contact, developer on call; decide on notifications within 24 hours |
| **SEV2 High** | A secret that costs money or allows damage was exposed, but there is no sign yet that member data was reached | AI key, translation key, R2 key, e-mail service key, deploy token, Expo token, Docker Hub token leaked; a bad release that blocks sign-in for all users | Start within 4 hours | Owner and developer on call |
| **SEV3 Medium** | Weak spot found, or a limited problem | Secret in an old commit (revoked already); one account misbehaving; signed media links forged for a few files; test credentials in a doc | Within 1 working day | Developer, owner informed |
| **SEV4 Low** | No exposure, process problem | Stale unused secret still stored; missing two-factor on a minor account | Within 1 week | Logged in the quarterly review |

Raise the level if: members' personal data is involved; the attacker can still act now; you cannot tell how long it has been going on.
Lower it only after the containment step proves nothing was reached.

**Known open risk to remember (from `docs/security-member-auth.md`):** until the new session design is live, the shared key inside the app
(`EXPO_PUBLIC_MEMBER_PROXY_KEY`) lets a determined person act as any member and, by using an admin's e-mail address, as an admin. A report of
"someone is acting as another member" is therefore SEV1 until proven otherwise.

---

## 2. Roles

Fill in the blanks now, not during an incident. Keep a printed or offline copy of this table (if GitHub or e-mail is down you will not be able to read it online).

| Role | What they do | Person | Phone / secure channel | Backup |
|------|--------------|--------|------------------------|--------|
| **Incident owner** | Final decisions: shut down, notify, spend money. Speaks for the project | Dada (owner) | to confirm | to confirm |
| **Technical contact** | Knows the systems; leads containment and rotation | to confirm | to confirm | to confirm |
| **Developer on call** | Hands on the code, deploys, reads logs, runs scripts | to confirm | to confirm | to confirm |
| **Communications lead** | Writes messages to users, the authority, providers | Dada (owner) unless delegated: to confirm | to confirm | to confirm |
| **Legal adviser** | Reviews notifications and tells you if the law applies | to confirm (no lawyer is named in the repo) | to confirm | to confirm |
| **Scribe** | Keeps the time-stamped log of actions | to confirm (can be the developer on call) | | |

Account access you will need during an incident (confirm each person can log in **before** an incident; see the quarterly drill):

GitHub, Azure Portal and Azure CLI, Neon, Cloudflare, Expo, Docker Hub, Apple Developer and App Store Connect, Google Play Console, Google Cloud,
Microsoft Entra, domain registrar and DNS host, support mailbox. Who holds each: **to confirm** (see the open questions in the registry).

---

## 3. First hour checklist

Use this as a tick list. Times are targets, not laws.

**Minutes 0 to 10: Stop and record**

1. Write the start time and who reported it. Open one shared note called "Incident [DATE]-[short name]". Everything goes there.
2. Phone the technical contact and the developer on call (a call, not only a message).
3. Take screenshots or copies of what you saw: the e-mail, the post, the alert, the log line. Do not edit them.
4. Decide a first severity level (section 1.2). Say it out loud to the team.
5. Do not discuss it in public channels. Do not post publicly yet.

**Minutes 10 to 30: Contain**

6. Identify what leaked or broke, in one sentence. If it is a secret, find its name in the registry (section 3) and where it lives.
7. Rotate or disable it using the right playbook in section 4. If you cannot rotate yet, at least **turn off the thing it unlocks** (for example stop the API, remove a public link, disable the key in the provider's console).
8. If members' data may be reachable and you cannot close the hole quickly, consider taking the affected feature or the whole API offline. A short outage is better than a long leak. (Container Apps: scale the API to zero or stop ingress; website: leave on if it holds no data.) Decision by the incident owner.
9. Change the passwords and make sure two-factor is on for the accounts that gave access (GitHub, Azure, the provider in question).
10. If a device, laptop or phone with logins was lost or infected, sign it out everywhere (account security pages) and change passwords from another device.

**Minutes 30 to 60: Look and decide**

11. Preserve evidence (section 5) before logs rotate. Export the API logs for the last 7 days at minimum.
12. Check for misuse (playbook (a) table).
13. Estimate scope: what data, how many people, from when to when. A rough number is fine for now.
14. Re-set the severity level.
15. Decide: do we need to notify people or an authority? Start the clock: **the 72-hour period begins when you become aware of a breach of personal data** (section 6). Write down the time of awareness.
16. Send the first internal status update (template 7.3).
17. Plan the next check-in time (every 2 hours while SEV1, every 4 hours for SEV2).

---

## 4. Playbooks

### (a) A leaked API key or secret

Use for: AI keys, translation key, R2 keys, e-mail connection string, Docker Hub token, deploy tokens, Expo token, OAuth client secrets, Neon password.

1. **Name it.** Find the exact secret in `docs/service-registry.md`, section 3. Note where it lives (GitHub, Azure API app, website settings, Expo).
2. **Judge the exposure.** Was it in a public place (public repo, public chat, video, screenshot)? Assume it is already copied if yes. Assume it is still safe only if it was
   sent to one trusted person privately and deleted; even then, rotate.
3. **Rotate in this order if several are involved** (highest damage first):
   1. Neon `DATABASE_URL`
   2. Admin and trust keys: `ADMIN_API_KEY` / `ADMIN_API_KEY_HASH`, `MEMBER_PROXY_KEY`, `MEMBER_SESSION_SECRET` (once it exists)
   3. Cloud account access: GitHub tokens, Azure deploy identity and website deploy token, Expo token, Docker Hub token, Cloudflare tokens
   4. Money keys: Azure OpenAI, OpenAI, Google Translate
   5. Signing secrets: `RECORDING_SIGNING_SECRET`, `AUTHOR_STATS_PEPPER`
   6. Everything else (e-mail service, Sentry, sign-in client secrets)
4. **How to rotate each one:** the registry, section 4, has steps and what breaks. Short version: new key in the provider, then `gh secret set NAME`, then run the **Deploy** workflow
   (Actions, Deploy, Run workflow; tick `deploy_api` for the API, `deploy_web` for the website), then check, then delete the old key. If you changed an Azure Container App secret by
   hand, restart the app.
5. **Check for misuse.** Look at the provider side for use you do not recognise, for the whole period the key could have been exposed. If you do not know when it leaked, look back as far as logs allow.

   | Service | Where to look | What counts as suspicious |
   |---------|---------------|---------------------------|
   | Neon database | Neon console: monitoring graphs, connection and role pages, history (depth depends on plan: **to confirm**) | Connections at odd hours or from unknown places; new roles or branches; large data reads |
   | API (Azure Container Apps) | Azure Portal, Log Analytics workspace `prabhatai-law`, table `ContainerAppConsoleLogs_CL`; or `az containerapp logs show --name prabhatai-api --resource-group prabhatai-rg --tail 300` | Many 401/403 then a 200; calls to admin routes from unknown addresses; bursts of member lookups; requests with admin headers |
   | Azure subscription | Azure Portal, Monitor, Activity log; Cost Management | Resources created that we did not create; role assignments changed; a cost jump |
   | Azure OpenAI | The resource's Metrics (requests, tokens) and Cost Management | Usage while the app was quiet; usage far above the daily limits |
   | Google Translate | Google Cloud console, APIs and Services, Metrics for Cloud Translation | Calls above the usual 400,000 characters a month |
   | Cloudflare R2 | Cloudflare dashboard: R2 bucket metrics; Manage account, Audit log | Large downloads, new files we did not upload, deletes |
   | E-mail (Azure Communication Services) | The resource's metrics and logs | Sent-mail volume we did not cause; bounces and spam complaints |
   | GitHub | Repository, Actions run history; account Security log; (organisation audit log if you have an organisation) | Workflow runs you did not start; secrets changed; new deploy keys or collaborators; the workflow files edited |
   | Expo / EAS | expo.dev builds list; access tokens list; audit log if your plan has one | Builds you did not start; unknown tokens or members |
   | Docker Hub | Account settings, Security, token "last used"; repository tags | An image tag we did not push |
   | Apple and Google Play | App Store Connect and Play Console: Users and access; recent uploads | Unknown users; a build you did not upload |

6. **Remove the source of the leak.** If it was committed to git: rotating is the real fix. Rewriting git history does not un-leak a key that was public.
   Still remove it from the current files and add a scan (secret scanning) so it does not happen again.
7. **Record** what was leaked, since when, who could have seen it, what you rotated, when, and what you found when checking.
8. **Decide on notification** (section 6) only if personal data was reached. A leaked AI key that cost money but touched no member data is not a data breach.

**Special case: the shared key shipped in the app (`EXPO_PUBLIC_MEMBER_PROXY_KEY`).** It is public by design flaw, so "rotating" does not close it. The response is the new sign-in design
in `docs/security-member-auth.md`: issue session tokens, set `ALLOW_LEGACY_MEMBER_PRINCIPAL` to false after old versions are forced to update (`docs/forced-update.md`), and use `MEMBER_SESSION_SECRET`
as the emergency sign-out. Until then, treat any "someone acted as another member" report as SEV1 and use playbook (b).

### (b) Leaked member data (the database was exposed or read)

**What we store about people** (from the code; the live database may hold more, **to confirm**): sign-in identity (provider and id), e-mail address, display name, picture link, language and country,
phone number if the person added one, password **hashes** for e-mail sign-ins (bcrypt, not plain text), saved songs, Learn progress, quiz results, AI questions and chat memory linked to an
account, comments, uploaded recordings and who uploaded them, push notification tokens, feedback messages, notices. Anonymous app usage events carry no person.

1. **Contain.**
   1. Reset the Neon database password (registry 4.4) and deploy the new `DATABASE_URL`. If you are unsure how the attacker got in, also check there is no extra database role you do not recognise.
   2. If the cause is a code bug (for example an endpoint returning other people's data), switch the endpoint or feature off, or ship a fix. A kill-switch flag may exist for some features (`feature_flags`;
      see `docs/analytics-flags.md` when available). If the fix needs a new app version, use the forced update (`docs/forced-update.md`).
   3. Cut sessions: rotate `MEMBER_SESSION_SECRET` (once it exists; playbook (c)). Everyone signs in again.
   4. Close public access you do not need: Neon allow-lists, public buckets, public links.
2. **Preserve.** Before changing anything in the database: take a Neon branch or backup of the current state (a branch is a frozen copy and does not change the live data; name it `incident-[DATE]`). Export logs (section 5).
3. **Scope.** Answer in writing:
   - Which tables or files were reached? (Use the list above.)
   - Which people? All members, or a subset? How many? From which countries? (This decides which laws apply.)
   - From what time to what time?
   - Were any password hashes included? Were any phone numbers included? Were AI questions included?
   - Is the data readable (plain) or protected? (Hashes are protected but can still be attacked; e-mails and names are plain.)
   - Was it only read, or also changed or deleted? Compare with a backup.
4. **Fix passwords.** If the `user_credentials` data (password hashes) was reached, force a password reset for all e-mail-sign-in accounts and tell people to change that password anywhere else they reuse it.
5. **Risk assessment.** Ask: could this cause harm to people (identity theft, spam, harassment, exposure of their beliefs or practices, safety)? Spiritual or religious affiliation can be sensitive in some countries.
   Names and e-mails linked to a spiritual community, and phone numbers, justify a careful reading. Write the answer and the reason, with the lawyer if possible.
6. **Decide on notification** (section 6). Write down the time of awareness; the 72-hour limit for the authority starts then.
7. **Tell people** what to watch for: phishing mails pretending to be us. We never ask for passwords by e-mail.
8. **Follow up.** Watch the logs for a month for the same pattern. Run the after-incident review (section 8).

### (c) Leaked signing secrets

**`MEMBER_SESSION_SECRET`** (the key that signs member session tokens; being added, see the registry section 5)

Rotating it is the **intended emergency button**: every existing session token fails its check, so **everyone is signed out and must sign in again**. That is acceptable in an incident.

1. Make a new random value (registry 4.14, "How to make a good random value").
2. Put it on the API Azure Container App (and anywhere else the code verifies sessions) and in GitHub, then deploy or restart so every API copy uses the same new value. An API copy still using the old value will still accept old tokens, so confirm all copies restarted.
3. Test: sign in on the website and in the app. An old session should be refused.
4. Check whether the longer-lived refresh tokens (if the design stores them in the database) are also cut by the rotation. If not, revoke them in the database. **To confirm** against the final `docs/security-member-auth.md`.
5. Check for forged activity before the rotation: new admins (`user_accounts.is_admin` set to true for unknown people), changed profiles, deleted accounts, announcements sent, feedback or recordings removed. Compare against logs and a backup.
6. Tell members that they may need to sign in again, and why in one honest sentence (template 7.1, short form).

**`WEB_PROXY_KEY`** (website-to-API trust, being added)

1. New value in the API, website settings (SWA) and GitHub together (registry 4.3 and 4.14). Deploy the API and the website in the same window.
2. What breaks: signed-in website visitors fail until both sides match. The app is not affected.

**`MEMBER_PROXY_KEY`** (the older shared key; also inside the app)

1. Rotating it breaks member features in every installed app until users update, because the old value is inside them. The website must get the new value at the same moment.
2. Use it **only with** the forced update ready (`docs/forced-update.md`) and the new session design live. Otherwise the new app build contains the new key again and the problem returns.
3. Also affects: signed media links and listener statistics if `RECORDING_SIGNING_SECRET` or `AUTHOR_STATS_PEPPER` are not set (the code falls back to this key). Set those two first.

**`RECORDING_SIGNING_SECRET`**

1. Rotating invalidates **all signed recording links and upload tickets** at once. Playback links are re-requested by the app automatically; uploads in progress must be restarted. No one is signed out.
2. Anonymous "unique listener" counts restart because their hashes change (unless `AUTHOR_STATS_PEPPER` is set separately).
3. If it was **not set** in production, the code was using `MEMBER_PROXY_KEY` for signing: then the leaked proxy key could also forge recording links. Set `RECORDING_SIGNING_SECRET` as a separate value now.
4. Check the storage for files that should not be there and for unusual download volume (R2 metrics).

### (d) A compromised admin account

Use when someone with admin power (site admin in the member list, or an owner login to GitHub, Azure, Neon, Expo, Apple, Google Play, Cloudflare) is taken over, or an unknown person is an admin.

1. **Take away the power first.** In the member admin tools or the database (`user_accounts.is_admin`), remove admin from the account. For cloud accounts: reset the password, sign out all sessions, remove unknown devices, rotate tokens, remove unknown members and collaborators.
2. **Also look for e-mail based promotion.** The API grants admin to accounts whose e-mail is in `DEFAULT_ADMIN_EMAILS` or `PROTECTED_ADMIN_EMAILS` (set in the deploy scripts). If the owner's mailbox itself is taken over, the attacker can sign up with that address and become admin. Secure the mailbox first (reset, two-factor, recovery options), then check admin lists.
3. **Check the old "smoke" identities.** Today the API makes admin anyone whose subject or name contains a test word such as `deploy-smoke` (`docs/security-member-auth.md`). Look in the member list for such accounts and delete them. This weakness is meant to be removed by the new design.
4. **List what the account did.** Review API logs for admin routes in the period, the member list for new admins, announcements and e-mails sent, content changes, feedback and recording removals, anything deleted.
5. **Undo harmful changes** from a backup or the Neon point-in-time history (take a branch first, see (b) step 2).
6. **Rotate** the keys the account could have seen (playbook (a)). An admin could read data: if member data could have been read or exported, go to playbook (b) scope and notification.
7. **Two-factor** on every owner and admin login afterwards, with recovery codes stored offline.

### (e) A bad app release

Examples: the app crashes on start, sign-in is broken, wrong content, or it contains a secret or a harmful bug.

1. **Stop spreading it.** Pause the rollout: Google Play Console, the release, halt rollout; App Store Connect, remove the build from sale or do not submit it for review. Do not delete evidence (the build and its notes).
2. **Use the forced-update control** (the minimum-version setting described in `docs/forced-update.md`) to push users on the bad version to a good one. Read that page for the exact steps; it is being written, so check it exists before an incident. Do not set the minimum above a version that is actually live in the stores, or people are locked out of the app.
3. **Fix the server side if it helps.** Some problems can be shut off from the API without a new build: switch the feature off (feature flag, if one exists) or reject a bad request shape.
4. **Ship a fix**: bump version and build numbers, build in EAS, submit. Stores need review time (hours to days); say so in the status update. Ask for expedited review in App Store Connect if the problem is serious.
5. **Check whether the bad build leaked anything**: a key inside it, personal data sent to a wrong address, debug logging of private text. If yes, also run playbook (a) or (b). Remember that every `EXPO_PUBLIC_*` value is inside the build.
6. **Tell users** on the store page "What's new" and in the app (an in-app notice) what to do: update, and whether they need to do anything else.
7. **Review**: why did the checks in `docs/release-checks.md` and `DELIVERY_QA.md` not catch it?

---

## 5. Preserve evidence

Do this early; logs and records age out.

1. **Do not delete** anything that might be evidence: logs, database rows, old builds, chat messages, e-mails, the leaked file. Mark them "keep".
2. **Copy and date** screenshots and exports. Store them in one private folder with a note of who copied them and when. Do not edit the originals.
3. **API logs:** export from Log Analytics (`prabhatai-law`) for at least the last 7 days, wider if you can. Save the query you used. Container Apps and Log Analytics keep logs for a limited time (set in Azure; **to confirm** the current retention).
4. **Database:** make a Neon branch or backup named `incident-[DATE]`. A branch preserves the data as it is at that moment. Note the time. Neon keeps point-in-time history only for a limited window (depends on plan: **to confirm**), so act in the first hour.
5. **Cloud activity logs:** Azure Activity log (export), GitHub Actions run list and Security log, Cloudflare Audit log, Expo audit log (if your plan has it), provider billing pages.
6. **Git:** do not force-push or rewrite history while investigating. Record the commit hashes involved.
7. **Notes:** keep the time-stamped log of actions and decisions. It is also what you show a regulator.
8. **Access:** limit who can see the evidence folder. It may contain personal data itself.
9. **Keep for** at least the period your lawyer advises; if none is advised, keep it until the review is done and the legal deadlines have passed.

---

## 6. Communication: users, authorities, stores

> **Not legal advice. To be checked by a lawyer.** This section explains the rules in plain words so you know what questions to ask. The law that applies depends on where the affected
> people live and where the organisation is based. Get a lawyer's view as early as possible in any SEV1.

### 6.1 Who may need to be told

| Who | When | Plain-language rule of thumb |
|-----|------|------------------------------|
| **Data protection authority (EU / EEA / UK)** | A personal data breach affecting people in the EU or UK | Under the GDPR, notify the supervisory authority **without undue delay and, where feasible, within 72 hours of becoming aware** of the breach, **unless the breach is unlikely to result in a risk to people's rights and freedoms**. If you are late, say why. If you do not have all the facts, you can send what you know and add the rest later in stages |
| **The affected people** | The breach is likely to result in a **high risk** to them | Under the GDPR, tell them **without undue delay**, in clear plain language: what happened, what data, what we are doing, what they can do, who to contact. Not needed in some cases (for example, the data was strongly encrypted, or the risk was removed afterwards, or it would take disproportionate effort and a public notice works instead). Ask the lawyer |
| **India** | The affected people are in India, or we process data of people in India | The Digital Personal Data Protection Act, 2023 (DPDP Act) expects an organisation that handles personal data to report a personal data breach to the Data Protection Board of India and to each affected person, in the form and time the rules set. Details and deadlines are in the rules under the Act and can change: **a lawyer must confirm the current rules and how they apply to us** |
| **Other countries** | Members live there | Many countries and some US states have their own breach rules. Check the member countries (the database stores a country field for some accounts) |
| **Service providers** | A key or service of theirs was involved | Tell them (template 7.4) so they can lock the account, help with logs, and tell you about misuse |
| **Apple and Google (app stores)** | A leak affects what the privacy labels say, or the app itself is harmful | See 6.3 |
| **Insurers, partners, donors** | If contracts or policies require | Check contracts. **To confirm** whether the project has any |
| **Police** | Crime (extortion, stolen identity) | Ask the lawyer; keep evidence |

**Start the clock correctly.** The 72 hours run from the moment you become **aware** that a personal data breach has happened (reasonable certainty), not from when it started. Write the time down
(first-hour checklist item 15). Do not wait for a perfect picture: a first notice with "investigation continues" is better than silence.

**Is it a "personal data breach"?** Yes if personal data was lost, changed, shared or accessed by someone who should not have it, by accident or on purpose. A leaked AI key alone is not (no person's data),
unless it also let someone read people's data.

**What to include when you notify the authority** (the typical list; the authority's form decides): what happened and when; the kinds of data and the approximate number of people and records; the contact
person; the likely consequences; what we have done and will do. See template 7.2.

**What to tell affected people** (template 7.1): what happened, in simple words; what information was involved; what we have done; what they should do (change passwords, watch for fake mails); how to reach us.
No blame, no jargon, no minimising.

### 6.2 Be honest and consistent

- Say only what you know. Say what you do not know yet, and when you will update.
- Use the same facts everywhere (users, authority, stores, press).
- Do not promise "no data was taken" unless you can prove it. Say "we have no evidence that ..." only if you have looked.
- One person speaks for the project. Others forward questions to them.
- Keep a copy of everything you send, with the date and time.

### 6.3 App stores and privacy labels

- The app's privacy labels (Apple **App Privacy**, Google Play **Data safety**) must keep matching reality (`docs/play-data-safety.md`, `docs/ios-privacy-manifest.md`). If an incident shows we collect or share
  data we did not declare (for example, a new analytics or push service, or AI processing by a third party), update the labels and the in-app consent texts in the next release.
- The store pages list a privacy policy and an account deletion address (`https://www.prabhatasamgiita.org/privacy` and `/delete-account`). Update the privacy policy if the incident changes what you say about data.
- If the **app** is harmful or leaked something, consider telling Apple and Google through their developer support, and be ready for review questions. Read their current developer terms; they may require
  prompt notice of a serious security issue. **To confirm** with a lawyer and in each store's current terms.
- Do not remove the app from sale unless needed to protect users. If you must, use the console and keep the reason in your notes.
- Support mailbox: the store pages show a Gmail support address. Watch it during an incident; people will write there.

---

## 7. Message templates

Replace everything in [BRACKETS]. Keep the language short and honest. Have the lawyer read 7.1 and 7.2 before sending in a SEV1.

### 7.1 Message to users (e-mail, app notice, or website page)

Short form (forced sign-out only):

> **Subject:** You have been signed out of [APP NAME]
>
> For your safety we signed everyone out of [APP NAME] on [DATE]. Please sign in again with [GOOGLE / APPLE / E-MAIL]. Your songs, favourites and progress are safe. We will never ask you for your password by e-mail.
> Questions: [SUPPORT E-MAIL].

Full form (a data breach):

> **Subject:** Important: a security problem that affects your [APP NAME] account
>
> Dear [NAME or "member"],
>
> **What happened.** On [DATE], we found that [SHORT, PLAIN DESCRIPTION, for example "someone gained access to part of our member database"] between [START DATE/TIME] and [END DATE/TIME].
>
> **What information was involved.** [LIST: for example "your name and e-mail address". Say clearly if passwords, phone numbers or questions to the AI assistant were involved, or if they were NOT.]
>
> **What we have done.** [for example "We closed the access, changed our keys, signed everyone out, and asked [EXPERT/AUTHORITY] to help. We have told [AUTHORITY] on [DATE]."]
>
> **What you can do.**
> - [Change your password for [APP NAME]. If you used the same password elsewhere, change it there too.]
> - Be careful with messages that claim to be from us and ask for passwords or money. We do not ask for either.
> - [Any other step.]
>
> **We are sorry.** [One honest sentence of responsibility.]
>
> **Contact.** [NAME], [ROLE], [E-MAIL], [PHONE]. We will update this page at [URL] by [DATE/TIME].

### 7.2 Message to the supervisory authority

> **To:** [AUTHORITY NAME and notification address/portal]
> **Date and time:** [DATE TIME, TIME ZONE]
> **From:** [ORGANISATION], [ADDRESS], [REGISTRATION IF ANY]
> **Contact person:** [NAME], [ROLE], [E-MAIL], [PHONE]
> **Data protection officer (if any):** [NAME or "not appointed"]
>
> **1. Nature of the breach.** [What happened, how we found out, when it started, whether it is still going on.]
> **2. Time of awareness.** We became aware on [DATE TIME].
> **3. Data affected.** Categories: [E-MAIL, NAME, PHONE, PASSWORD HASHES, CHAT TEXT, OTHER]. Approximate number of people: [NUMBER or "under investigation"]. Countries: [LIST]. Approximate number of records: [NUMBER].
> **4. Likely consequences.** [For example risk of phishing, identity misuse, loss of privacy.]
> **5. Measures taken.** [Containment, key changes, sign-out, passwords reset, logs preserved.]
> **6. Measures planned.** [Fixes, monitoring, review.]
> **7. Notification of affected people.** [Done on DATE / planned for DATE / not required because REASON.]
> **8. Reason for any delay beyond 72 hours (if any).** [REASON.]
> **9. Next update.** We will send more information by [DATE].

### 7.3 Internal status update

> **Incident:** [NAME / ID] **Severity:** [SEV1-4] **Time of this update:** [DATE TIME]
> **Status:** [investigating / contained / recovering / closed]
> **What we know:** [3 to 5 short lines.]
> **What we do not know yet:** [short list.]
> **Done since last update:** [list with times.]
> **Next steps and owners:** [action, person, time.]
> **Decisions needed from the owner:** [list.]
> **Notifications:** authority [not needed / decided / sent TIME]; users [not needed / drafted / sent TIME]; stores [..]; providers [..]
> **Next update at:** [TIME]

### 7.4 Message to a service provider (support ticket or e-mail)

> **Subject:** Possible compromise of credentials on account [ACCOUNT / RESOURCE NAME]
>
> Hello [PROVIDER] support,
>
> We believe credentials for [SERVICE, RESOURCE, PROJECT OR APP ID] were exposed on [DATE]. We have [rotated / disabled] [WHICH KEY] at [TIME].
>
> Please can you: (1) confirm no other keys or users on the account were added since [DATE]; (2) send the access logs for [RESOURCE] from [START] to [END] if you can; (3) flag the account for review; (4) tell us whether any charges were caused by the activity and how to dispute them.
>
> Account owner: [NAME], [E-MAIL], [PHONE]. Account identifier: [ID]. Ticket reference: [IF ANY].
>
> Thank you, [NAME]

---

## 8. After-incident review (do within 10 working days of closing)

Run it as a no-blame conversation: the question is what let it happen, not who is at fault. Copy this into a new file named `incident-[DATE]-review` and fill it in.

```
Incident name / ID:
Dates: started [ ]  noticed [ ]  contained [ ]  closed [ ]
Severity at the start: [ ]   final: [ ]
People involved (roles):

1. Summary (5 lines, plain words):

2. Timeline (time, event, who):

3. Impact:
   - People affected (number, countries):
   - Data affected:
   - Money spent / lost:
   - Downtime:

4. Cause:
   - Direct cause:
   - Why it was possible (root causes):
   - Why we did not notice sooner:

5. What went well:

6. What went badly or slowly:

7. Notifications:
   - Authority: [no / yes, when, reference]
   - Users: [no / yes, when]
   - Stores: [no / yes]
   - Providers: [list]
   - Lawyer consulted: [yes / no]

8. Actions (each with an owner and a date):
   - Prevent (stop it happening again):
   - Detect (notice it faster):
   - Respond (react faster):
   - Update docs: service-registry.md, incident-response.md, security-member-auth.md, forced-update.md

9. Secrets rotated (names only, never values) and date:

10. Follow-up check in 30 days: [date, who]

Signed off by (owner): [name, date]
```

---

## 9. Quarterly drill checklist

Once every three months (put it in the calendar). Takes about two hours. Record the date and the result in the review notes.

**People and access**

- [ ] The roles table (section 2) is filled in with phone numbers. Each person can be reached.
- [ ] Each person who must act can log in to: GitHub, Azure Portal, Neon, Cloudflare, Expo, Docker Hub, Apple, Google Play, Google Cloud, Microsoft Entra, domain registrar, support mailbox.
- [ ] Two-factor is on for all owner accounts; recovery codes are stored offline in two places.
- [ ] People who left no longer have access anywhere (GitHub collaborators, Azure IAM, Expo members, Apple and Play users, Neon members).
- [ ] An offline copy of this plan and the contact list exists (printed or saved on a device not tied to the same accounts).

**Secrets**

- [ ] Walk the registry (`docs/service-registry.md`): every row still true? Remove secrets nobody uses (for example `PG_PASSWORD` if stale).
- [ ] Dates: Entra client secret expiry, Blob link `FAISS_INDEX_URL` expiry, Apple and Google certificates. Anything expiring in 90 days is renewed.
- [ ] Run a secret scan on the repository and its history (for example `gitleaks`); GitHub secret scanning alerts are reviewed.
- [ ] Rotate on a schedule the secrets that are cheap to rotate (AI, translation, Docker Hub, Expo tokens). Time the rotation and note what broke.
- [ ] Confirm `RECORDING_SIGNING_SECRET`, `AUTHOR_STATS_PEPPER` and `ADMIN_API_KEY_HASH` are set in production as separate values (no fallbacks).

**Practice one scenario** (pick a different one each quarter; use a test copy where possible, never the live system for destructive steps)

- [ ] Leaked key: pick a low-risk key (for example Google Translate), rotate it end to end through the registry steps, and check the verification list (registry section 6).
- [ ] Database: restore a Neon branch from a backup and confirm the data is readable. Note how long it took.
- [ ] Sessions: rotate `MEMBER_SESSION_SECRET` on a staging or test copy (once it exists) and confirm everyone is signed out.
- [ ] Bad release: read `docs/forced-update.md`, and rehearse where you would set the minimum version without applying it.
- [ ] Notice drill: fill in template 7.2 for an imaginary breach and time how long it takes. Have the lawyer read it once a year.

**Backups and logs**

- [ ] Neon point-in-time window is known (days). A branch or backup can be created by at least two people.
- [ ] Log retention in Log Analytics is known; at least 30 days is kept.
- [ ] Azure budget alert and cost alerts reach a mailbox someone reads.

**Wrap-up**

- [ ] Update this plan and the registry with what you learned. Date the "Last reviewed" line.

---

## 10. What cannot be checked without production

The repository cannot answer these. Someone with live console access must check, ideally before an incident:

- Who owns and who can log in to each account (GitHub, Azure, Neon, Expo, Apple, Google, Cloudflare, registrar, support mailbox).
- Whether production really has `RECORDING_SIGNING_SECRET`, `AUTHOR_STATS_PEPPER`, `ADMIN_API_KEY_HASH` set, and whether `MEMBER_PROXY_KEY` is random or the derived value (registry section 7).
- How long Azure Log Analytics and Neon keep their history (this limits how far back you can look).
- Whether the Docker Hub image is private; whether the old Azure Postgres server and old web Container App still exist.
- Whether the database holds more personal data than the code models show (for example data added by hand, or old tables).
- Whether anything is already leaked in git history (not scanned here).
- Whether the Cloudflare R2 bucket exists and is public.
- Which countries our members live in (this decides which breach laws apply).
- Whether a lawyer, insurer or data protection officer is already engaged.
- Whether Sentry, push (Expo, APNs, FCM) and the new session settings are actually deployed (they were being added in the working copy at the time of writing).
