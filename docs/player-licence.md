# Player licence: react-native-track-player v5 / @rntp/player

Checked on 9 November 2026 against the primary sources listed at the end (the authors' own pages, the npm
registry, and the licence file installed in `apps/mobile/node_modules`). This is a reading of public texts,
not legal advice. Nothing has been sent to the authors.

## Short answer

1. **The app is NOT free to use under the new v5 licence.** The owner's assumption ("it is non-profit, so it
   is free") does not match the authors' terms. They say that any use that is not purely personal or purely
   educational is commercial, and they name non-profit organisations in that list.
2. **But the app does not use that licence today.** The pinned package
   `react-native-track-player@5.0.0-alpha0` was published on 12 August 2025 under **Apache-2.0** (npm metadata
   and the `LICENSE` file inside the installed package both say so). Apache-2.0 is free for any use, including
   commercial, and a version that was published under it stays under it. The new commercial licence applies to
   the new package `@rntp/player` (first versions in March 2026), which is a different npm package.
3. **So the 5.0.0-alpha0 pin is legally safe**, with technical risks (below). A paid licence is needed only if
   the team moves to `@rntp/player` (for example to get CarPlay, Android Auto and Cast).

## What the v5 terms say (the `@rntp/player` package)

Source: https://rntp.dev/terms (last updated 18 June 2026), https://rntp.dev/pricing, https://www.rntp.dev/llms.txt.

| Question | What the sources say |
|---|---|
| Who is free | "Personal use": a private individual, "solely for personal, non-professional purposes, with no connection to any business activity or revenue". "Educational use": a qualified academic institution, "strictly for instructional or non-commercial research activities". |
| Non-profit | Not free. Terms section 3: anything that does not strictly qualify as personal or educational use is commercial, "including any use within a for-profit company, non-profit organization, or government entity". |
| Free development | Allowed "solely for development, testing, evaluation, and pre-production prototyping". It ends when an app containing the software is deployed (section 4). A TestFlight or store release is a deployment. |
| Price | RNTP Pro: 99 EUR per month or 999 EUR per year, one commercial app. RNTP Studio: 249 EUR per month or 2,499 EUR per year, up to five apps. Platform/OEM: custom. Plus taxes. Licences are per organisation. |
| Discount | "Launch Credit": a 6-month complimentary commercial licence, invite-only, "at our discretion", for indie developers and small teams, not for funded or enterprise projects. It renews at the normal price unless cancelled. |
| Pre-releases | The terms do not mention alpha or beta versions. |
| Contact | support@rntp.dev (pricing page); team@doublesymmetry.com (the package README). |

One inconsistency worth knowing: the package README and `license.txt` header say "Free for non-commercial
use", which a non-profit might read as covering it. The terms page defines "non-commercial" narrowly (personal
or educational only) and lists non-profits as commercial. The longer text and the pricing page agree with each
other, so assume the strict reading until the authors say otherwise in writing.

## Is the 5.0.0-alpha0 pin safe?

**Legally: yes, as far as the public sources show.**

- `apps/mobile/package.json` pins the exact version `react-native-track-player` `5.0.0-alpha0` (no caret).
- npm registry: that version was published 2025-08-12, licence field `Apache-2.0`. The installed copy has the
  full Apache License 2.0 text in `LICENSE`, and `package.json` says `"license": "Apache-2.0"`.
- The same registry entry shows the `4.x` line and the `5.0.0-alpha0-nightly-*` builds also as Apache-2.0.
  The licence change came with the new package name `@rntp/player` (first published 2026-03-12, field
  "SEE LICENSE IN license.txt").
- The v5.0.0 release notes (https://newreleases.io/project/github/doublesymmetry/react-native-track-player/release/v5.0.0)
  say v4 stays Apache-2.0 on its own branch, and that the v5 alpha and beta versions are superseded.
- Apache-2.0 gives a perpetual, irrevocable grant for the copies that were published under it. Keep the
  `LICENSE` text and the notices if the library is ever redistributed in source form. Store builds only need the
  usual open-source notices page (see below).

**Not verified (say so to the authors, see the draft):** whether the authors consider the alpha builds to be
covered by the old licence. The registry and the shipped file say yes; nobody wrote it down for the alpha
specifically.

**Technically: a real risk, not a legal one.**

- It is an alpha. The authors point everyone to `@rntp/player`. The 4.x branch is frozen ("will not receive
  further updates"). So the alpha will not get fixes for new iOS or Android versions, new React Native versions
  or security issues. Plan to test every new OS release before it reaches people.
- The v5 docs describe CarPlay, Android Auto and Cast. `docs/native-integrations.md` already notes the alpha may
  not have those APIs. Getting them means moving to `@rntp/player` and so to a paid licence.
- Keep the version pinned exactly. Do not take a nightly or a newer v5 by a range: a newer `@rntp/player` would
  silently bring the paid terms.

## Options for the owner

| Option | Cost | Notes |
|---|---|---|
| A. Stay on `5.0.0-alpha0` (recommended now) | 0 | Legally fine, keeps what works today. Test on each new OS release. Needs a fallback plan if a new OS breaks it. |
| B. Move to `@rntp/player` and buy RNTP Pro | 999 EUR per year (or 99 per month) | Needed for CarPlay, Android Auto, Cast from the authors' own code. Paid by the organisation that owns the app. Ask first for the Launch Credit and for a non-profit arrangement (draft below). |
| C. Stay on v4 (`4.1.2`) | 0 | Apache-2.0, stable, but frozen and older; the app code was written for the v5 alpha API. A move back is work and not checked. |
| D. Another audio library (expo-audio, own native module) | 0 to engineering time | Checked nowhere in this repository; lock-screen and background behaviour would need testing. |

The recommendation is A until the product needs CarPlay or Cast, then ask the authors (B) before building.

## Open-source notices screen

Whatever is chosen, the app should list its open-source licences somewhere (Settings, About). Apache-2.0
requires keeping the licence text when redistributing. This repository was not checked for such a screen.

## Draft e-mail to the authors (NOT SENT; owner decides who sends it and from which address)

To: support@rntp.dev
Cc: team@doublesymmetry.com
Subject: Licence question for a non-profit spiritual music app (react-native-track-player 5.0.0-alpha0 / @rntp/player)

Hello,

We build a free mobile app (iOS and Android, React Native) that plays devotional songs and talks of a
non-profit spiritual organisation. There are no ads, no purchases and no subscriptions. The app is owned and
published by a registered non-profit.

We have two questions.

1. Our app currently uses react-native-track-player 5.0.0-alpha0 from npm (published 12 August 2025, licence
   field Apache-2.0, with the Apache-2.0 LICENSE file in the package). Do you confirm that this exact version
   and the other pre-licence-change v5 alpha builds stay under Apache-2.0 for our use, including in a public
   store release? A short written confirmation would be enough for our records.

2. We may later want CarPlay, Android Auto and casting, which means moving to @rntp/player. Your terms say
   non-profit organisations need a commercial licence. Is there a reduced-price or free arrangement for a
   small non-profit running a free app (for example the Launch Credit, or a non-profit discount)? If not, we
   will plan for RNTP Pro and need to know the licence holder you would expect (the organisation that
   publishes the app).

Please also tell us if there is anything in the alpha licence history we should know about.

Thank you,
[name, role, organisation, contact e-mail]

## Sources (all read on 9 November 2026)

- https://rntp.dev/terms (terms, sections 2, 3, 4, 6, 8, 12, last updated 18 June 2026)
- https://rntp.dev/pricing (tiers, per organisation, launch credit, contact)
- https://www.rntp.dev/llms.txt (summary of the same terms)
- https://cdn.jsdelivr.net/npm/@rntp/player@5.7.0/README.md and its `license.txt` (the package's own licence text)
- https://newreleases.io/project/github/doublesymmetry/react-native-track-player/release/v5.0.0 (release notes: v5
  commercially licensed, new package name, v4 Apache-2.0 frozen)
- https://registry.npmjs.org/react-native-track-player and https://registry.npmjs.org/@rntp%2fplayer (versions, dates,
  licence fields)
- `apps/mobile/node_modules/react-native-track-player/package.json` and `LICENSE` (what is installed)

Not read or not found: https://rntp.dev/docs/license answered 404, so the terms page was used. Summaries of web pages
were produced by a text-extraction step; before signing or paying anything, read the terms page itself.
