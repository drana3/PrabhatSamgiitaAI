# Next release — parked observations

Code freeze: **2 Sep 2026**.  
This file is the parking lot for anything that arrives after freeze. Do not implement here until the 13/14 Sep stores ships are done.

**Shipped / in review (do not reopen unless a blocker)**

- iOS: 2.0.0 build 66 — App Store (Sep 2026)
- Android: 2.0.0 versionCode 59 — internal testers; Production for 13 Sep 2026

**Next local / store build**

- iOS build **67** / Android versionCode **60** — includes Sep 15 audio fixes (`788969d`, `79000ec`, `8cde288`) and refreshed production URLs in `app.json`

---

## Confirmed for next release

- Sargam on mobile for songs **1, 2, 27** (website already live; `SARGAM_FEATURE_ENABLED` is false on mobile)

## Strong candidates (from this cycle)

- Add `google-services.json` + Play **app-signing SHA-1** Android OAuth client so Play Google Sign-In is reliable
- Profile should show marketing version **and** build (`2.0.0 (59)` / iOS build number) so installs are identifiable
- Android song **autoplay** was turned off to stop native crashes; after 2.0.0 is proven stable, decide whether to restore tap-to-play-only or autoplay
- Community voices: mobile uses a **1 of N rotator** (not the website CSS marquee); optional later: marquee if Android layout is solved
- iOS **2.0.0** (build 55+) if 14 Sep ships 1.0.0 (54) only
- Play Production: countries + 100% rollout if still limited during internal testing

## How to add a new item

Paste under **Inbox** with date and who said it. Promote to “Confirmed” only when you agree it is in scope.

### Inbox

- (empty)
