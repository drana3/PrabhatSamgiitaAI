# Notifications

Phase 1 runs on the phone only. Phase 2 adds a server. The bell, the centre (the list the bell opens) and the settings screen are the same in both.

This page is the policy: what exists, how long things stay, what the person sees and when, what happens in the odd cases, and how to add a new kind. Numbers are written where they are decided, each with its reason. Where the code does a thing, the file is named. Where it does not yet, the text says so ("Not built").

Contents: 1 Kinds - 2 Life of a notification - 3 Retention - 4 Unread, read, badge - 5 In the centre - 6 Scheduling and delivery - 7 Odd cases - 8 Permission - 9 How it looks on a phone - 10 Settings - 11 Phase 2: server - 12 Privacy and rate limits - 13 Adding a notice kind - 14 Not verified, not built

## 1. Kinds

One table in the code says what each kind is: `lib/notifications/kinds.ts` (`KIND_META`). Everything below is read from it.

| Kind | Trigger | Source | Text (English) | Tap opens | Android channel | Kept |
| --- | --- | --- | --- | --- | --- | --- |
| `song` | 8:00 local by default; the person sets up to 3 times a day, any minute | local, `lib/notifications/schedule.ts` | "Start the day with {title}." / "{title} was composed on this day in {year}." / "Open today's song." | `/song-v2/ps-N`, or `/v2/today` when the phone does not know the song yet | `reminders` | 14 days |
| `festival` | 17:00 on the eve of a festival, from `data/festivals.ts` | local | "Festival tomorrow" / "{title} is tomorrow. Prabhat Samgiita for this day is ready in the app." (the second sentence only when `data/festivalSongs.ts` has songs for it) | `/festival/<id>` | `festivals` | 14 days |
| `words` | 18:00 by default; up to 5 times a day; only when words are due (word cards in `stores/learnStore.ts`) | local | "{n} words are due. It takes a minute." | `/learn/words` | `reminders` | 14 days |
| `streak` | 20:00, only when a streak of 2+ days could end today; off by default | local | "{n} days in a row. Keep it going." | `/v2/learn` | `reminders` | 14 days |
| `story` | a new story | server (fixture in the preview; no trigger yet) | "New story" / "The story behind PS 1 is ready to read." | `/story-sheet/<slug>` | `team` | 30 days |
| `live` | a live Kiirtan broadcast starts; not a setting, not scheduled on the phone | server only | "Starts in 15 minutes." | `/kiirtan-live?id=<id>` | `team` | 2 days |
| `announcement` | a message from the team | server (no trigger yet) | "From the team" + the message | `/v2/today` or the given route | `team` | 30 days |
| `upload` | the team removed a Kiirtan or Bhajan the person uploaded (a published one needs no notice: the author sees it live) | built in `stores/kirtanStore.ts` from the server's "my uploads" list; copy in `lib/notifications/serverKinds.ts` | "Kiirtan removed" + the reason in the team's words | `/v2/kiirtan` | `notices` | 90 days (180 while unread) |

Planned, not built (each is one entry in the registry, section 13):

- Chord proposal result (approved / not approved, with the reviewer's words): important tier, account-bound, `notices` channel, opens the song page.
- Reply to your comment on a song: needs a server push and a per-kind switch in settings. No server trigger exists.
- "Your Kiirtan is live": deliberately not sent. The author sees it published at once (`docs/kiirtan-publishing.md`).

The copy is short, sentence case, no exclamation marks, verb first where there is an action.

## 2. Life of a notification

```
planned        the scheduler (pure) says what should reach the person: id, time, text, target
   |
scheduled      the phone holds it (iOS / Android local notification), under its id
   |           (server kinds: the server sends a push, or the app asks for the notices when it opens)
delivered      the phone shows it at the minute: lock screen / banner / shade, with a sound
   |           (while the app is open: a banner, no sound)
received       the app puts it in the centre, with its time (only what the phone was told to deliver)
   |
shown          a row in the centre, with a dot while unread
   |
read           a tap opens the target and marks it read; "Mark all read"; a tap on the system notification
   |
gone           deleted by the person (swipe, X, Clear all) | outlived its keep time | pushed out by the cap
```

Ids are deterministic (`song:2026-11-05@0745`, `festival:<id>`, `upload:<recordingId>:removed`): the same event always has the same id, so scheduling again replaces, receiving again changes nothing, and a deleted item does not come back.

## 3. Retention

How long an item stays in the centre. Code: `lib/notifications/retention.ts`, per kind in `kinds.ts`; applied by `pruneInbox` in `lib/notifications.ts` each time something is received and at start.

| Rule | Number | Reason |
| --- | --- | --- |
| A reminder (`song`, `words`, `streak`, `festival`) | 14 days | A reminder is worth something on its day. A short history lets someone find yesterday's song or last week's festival; beyond two weeks it is noise. |
| `story`, `announcement` | 30 days | Content a person may read later, not tied to a minute. |
| `live` | 2 days | Useless once the broadcast has ended. |
| Notice about the person's own content (`upload` now; chord results later) | 90 days once read; 180 days while unread | These carry a reason and a way to answer. A person who opens the app rarely must still find it. After 180 days an unread one goes too: a notice cannot be an obligation for ever. |
| Cap on ordinary items | 100, the newest kept | About 10 days at the busiest settings (up to 10 a day). Bounds storage and the length of the list. |
| Cap on important items | 50, separate | Reminders can never push a removal notice out. |
| Deleted-ids memory (stops a deleted item from coming back) | 90 days | As long as the longest-lived read item can still be received again. |
| Read-ids memory | the last 300 | A read id is tiny; the cap stops it from growing for ever. |
| A delivered notification left in the lock screen and shade | 48 hours, or as soon as it is read in the app | iOS and Android keep a notification until it is swiped away. `dismissStalePresented` in `native.ts` clears read and old ones at start, on return to the front, and when something is read. |

Pinned notices: an unread important item is shown in its own section on top, "Needs your attention", whatever its age (up to its 180 days). Once read it falls into Today / Earlier by its date. It is not pinned for ever: pinning something the person has already seen is clutter.

(Before this policy every item was kept 30 days with no cap. Reminders went from 30 to 14 days; the rest is new.)

## 4. Unread, read, badge

- Unread: not opened. A reminder that stayed unread for 7 days stops counting as unread (no dot, not in the badge): a month of unread song reminders must not become a badge of 30 on the icon. Important items never go stale.
- The dot, the bell's count on Home, the "N new" under the title and the icon badge all use the same rule (`isUnread` in `retention.ts`).
- Badge on the app icon: the unread count, at most 99. It is 0 when the master switch is off or the system permission is denied. It updates at once when something is read, not at the next scheduling.
- Read on open: a tap on a row marks it read and opens the target. A tap on the system notification also marks it read (`listenForTaps`). Opening the centre does not mark everything read: "Mark all read" is explicit, and what the person has not looked at stays unread.
- Read state is on the phone. Server notices carry `read_at` (`POST /recordings/notices/{id}/read` exists) and will sync both ways in phase 2.

## 5. In the centre

Screen: `app/notifications.tsx`. Sections: "Needs your attention" (unread important), "Today", "Earlier"; newest first; an empty section is left out.

- Grouping: three or more reminders of one groupable kind (`song`, `words`) on the same local day fold into one card: "Words to repeat, 4 reminders - {newest text}", with a dot when any is unread; a tap opens it in place, each child still swipeable. Two stay separate. `lib/notifications/grouping.ts`, `GROUP_MIN = 3` (below that a group saves no space). Festival, streak and every server kind never group: each is a distinct event.
- Delete: swipe a row to the left (it follows the finger, lands by the throw, springs back if released short), or the X, or the screen reader's "delete" action. A bar says "Notification deleted - Undo" for 5 seconds. Undo restores the item and forgets the delete.
- Clear all: a pill under the title, shown when there is anything. It asks first ("Clear all notifications? Everything is removed from this list. This cannot be undone.") and keeps unread important notices, saying so in the same card ("1 notice about your upload stays until you open it."). Afterwards a bar says "Cleared".
- Empty state: the logo, "You're all caught up." and one line on what will show here.
- Banner above the list, one at a time, the most blocking first: system permission denied ("Reminders cannot reach you" - Open settings), never asked ("Get your reminders" - Allow notifications), the phone refused to schedule some ("Some reminders were not set" - Try again). Hidden when the master switch is off (the person chose that).
- Target gone: see section 7.
- Preview URLs: `/notifications`; `?at=2026-11-07T18:30` moves the clock; `?permission=denied|undetermined` and `?failed=1` show the banners.

## 6. Scheduling and delivery

Phase 1 is local.

- `lib/notifications/schedule.ts` is pure. `plan(input, from, to)` returns notifications with deterministic ids. A time the person chose is in the id (`@HHMM`); moving a time changes its id, so the old one is cancelled and the new one scheduled.
- Horizon: songs and festivals up to 30 days ahead, words and streak up to 7 (they depend on what the person does). iOS keeps 64 pending local notifications at most, so the soonest 60 are scheduled (`capForPlatform`) and the app refills when it runs.
- `lib/notifications/native.ts` is the only file that touches `expo-notifications`. On the web preview every call is a no-op.
- `components/notifications/NotificationsHost.tsx` (mounted once in `app/_layout.tsx`) reschedules on start, when the app comes to the front, and when a setting, the word cards, the song list or the language change. It never asks for permission.
- What the phone is handed per notification (`lib/notifications/content.ts`): title, body, `data {id, target, kind}`, a sound, the iOS category `ps.<kind>`, the iOS interruption level (`passive` for the streak reminder, `active` for the rest, never `timeSensitive`), and the Android channel by kind.
- The centre takes in only what the phone was told to deliver (the ledger kept at the last scheduling) and only while the permission is granted: a reminder that never arrived is not in the bell.
- A phone that refuses some of the reminders (`applySchedule` catches each one) sets `scheduleFailed` (`stores/notificationHealthStore.ts`); the centre shows "Some reminders were not set" with "Try again", which schedules again.

## 7. Odd cases

| Case | What happens |
| --- | --- |
| Target no longer exists (song out of the library, festival not in the calendar, a link from a newer app) | `resolveTarget` (`lib/notifications/target.ts`) checks before navigating. When it is gone the app opens the kind's fallback (song: `/v2/songs`; festival: `/festivals`; stories and team messages: `/v2/today`; uploads and live: `/v2/kiirtan`; words and streak: `/v2/learn`), marks the item read, and a bar says why the next time the person is back on the centre ("That song is not in the library any more. Here are all songs."): the fallback screen is on top right after the tap, so the bar waits for the return. A song is called missing only when the phone has a saved catalogue and the number is not in it. A target that is not an app route (a URL, `//host`) is never opened. A tap from the lock screen falls back the same way, silently. A feature can register a check for its own routes (`registerTargetCheck`). |
| Time zone changes (travel) | A scheduled notification is an absolute instant, computed in the zone the phone was in when the app last ran. When the app comes to the front it plans again in the new zone and the same ids replace the old ones, so "8:00" is 8:00 where the person now is. If the app is not opened after landing, the old instants fire (8:00 in Delhi arrives at 2:30 in London). Not built: a time-zone-change listener; the next open fixes it. DST: each day is planned from its own local midnight, so a time stays at the same wall-clock time across a change. |
| Quiet hours and Do Not Disturb | The app has none of its own for local reminders: the person picks exact times, and a second window that moved them would silently change a time they typed. System Focus (iOS) and Do Not Disturb (Android) apply as usual; nothing is `timeSensitive`, so none breaks through. Server pushes (phase 2) hold `announcement` and `story` outside 08:00-21:00 in the device's time zone (`device_tokens.tz`); notices about the person's own content and `live` are not held. |
| Duplicates | Deterministic ids: scheduling again replaces; the centre skips an id it has or knows as deleted; server and local items use different id prefixes. An `upload` notice id is `upload:<recordingId>:<decision>`, the same whether it came from the "my uploads" list or from `GET /recordings/notices`. |
| Rate | Local: at most 10 a day (3 song times + 5 word times + the festival eve + the streak reminder) by construction; a test fails if the settings could allow more (`MAX_LOCAL_PER_DAY`). Server: see section 12. |
| App start with scheduled-but-expired items | Anything whose time has passed fired by itself while the app was closed; at start the centre takes in what the ledger says fired since the last look (`syncedAt`), skipping what is already past its keep time. Scheduled items in the past are not scheduled again (the plan only looks forward) and the phone drops them. |
| Offline | Local reminders need no network. Server notices are to be fetched when the app opens or comes to the front (at most once in 15 minutes), merged by id and sorted by time, so the order on screen is the order they happened, whatever order they arrived in. Not built yet (no client for `GET /recordings/notices`). |
| Reinstall or new device | The centre and the settings live on the phone and are not carried over: a new phone starts with the defaults and an empty centre, and the permission is asked again in context. Server notices (a removal with its reason) come back at sign-in because the server keeps them and their read state (once the client exists). |
| Signed out | Local reminders (song, festival, words, streak) work without an account. Account-bound items (`upload`, chord results) are removed from the phone at sign-out and come back at the next sign-in (`wipeLocalUserData`, through `isAccountBound`). Team messages for everyone stay. |
| Language changes | Pending reminders are planned again in the new language; the Android channel names are renamed. Items already in the centre keep the language they arrived in. |
| Master switch off | Everything scheduled is cancelled, the badge is 0, no reminder reaches the phone; the centre keeps what is already there. |

## 8. Permission

Asked in context, never at first launch: when the person turns a reminder on in settings, taps "Allow notifications", or saves their first song or word card while the OS has never been asked (`shouldAskInContext`).

| Platform and state | What the person sees | The way back |
| --- | --- | --- |
| iOS, never asked | The system sheet, once. Declining is final for the app. | Settings: "Allow notifications" asks; after a decline only system settings can. |
| iOS, denied | Settings: "Notifications are off in system settings" with "Open settings"; the centre: the banner "Reminders cannot reach you" with "Open settings". | iOS Settings > Prabhat Samgiita AI > Notifications. |
| Android 13 and later | The runtime permission (`POST_NOTIFICATIONS`, declared by expo-notifications). After two refusals the system stops asking. | The same two banners; "Open settings" opens the app's page. |
| Android 12 and earlier | Granted by default: no sheet. A person can still switch the app off in system settings; the same denied banner appears. | System settings. |
| Android, one channel muted | Reminders of that class are silent or hidden; the app cannot see it. | System settings > the app > the channel (named in the app language). |
| Android, exact alarms | From Android 12 the app needs exact alarms to fire on the minute; without them expo-notifications falls back to inexact and the system may delay a reminder by minutes. | Not exposed in the app. See section 14. |
| Web preview | No permission and no scheduling; the centre fills from the plan so it can be looked at. | none |

## 9. How it looks on a phone

Drawn with real texts in `Для-Дады/уведомления/` (boards 2 and 3). In short:

iPhone: the notification is a rounded card with the app icon, the app name, the time, a bold title and a few lines of body. On the lock screen they stack newest first; iOS stacks all of an app's notifications into one pile because a local notification cannot carry a thread id with expo-notifications 0.32 (section 14). The streak reminder is `passive`: it goes to the list without waking the screen or making a sound. Notices about the person's own content use the category `ps.upload` with a private preview: if the person hides previews, the lock screen shows "You have a notice about your upload." instead of the text. The badge on the icon is the unread count. While the app is open: a banner, no sound.

Android: a heads-up banner only for the `notices` channel (importance high). The rest are default importance: a status-bar icon, a row in the shade, the default sound. The small icon is the monochrome `assets/notification-icon.png` tinted with the accent colour `#B94D0C` (set in `app.json`, plugin `expo-notifications`). The system may bundle the notifications of one channel together in the shade. The `notices` channel hides the text on a secured lock screen.

Android channels (named in the app language, `lib/notifications/channelNames.ts`):

| Channel id | Name (en) | Group | Importance | Kinds |
| --- | --- | --- | --- | --- |
| `reminders` | Reminders | Reminders | default | song, words, streak |
| `festivals` | Festivals | Reminders | default | festival |
| `team` | From the team | Messages | default | story, live, announcement, unknown kinds |
| `notices` | About your uploads | Messages | high | upload, chord results |

`reminders` is the original id (its name and the person's own choices are kept). A person mutes a class in system settings, so a kind that should be mutable alone has its own channel. Android never lets an app raise a channel's importance after it was created; a new channel is the only way, which is why the loud one is separate from the start.

Sound: iOS plays the system sound (`sound: true`); Android plays the channel's sound (default importance and up). There is no custom sound: a reminder should sound like the system's.

In the app (the centre): rows are cards with corner radius 22, round pills, a tile of the kind's colour with its glyph (a song's own cover when the song is known). States: empty, unread, mixed read, grouped, unread notice on top, permission banner, failed banner, delete bar, clear-all confirm (board 4).

## 10. Settings

Screen: `app/notification-settings.tsx`. Per-kind switches exist for the four local kinds; times are free.

- Master switch (cancels everything scheduled when off).
- Song of the day: on, 1 to 3 times a day, any minute (default 8:00).
- Festivals: on; always 17:00 on the eve.
- Words to repeat: on, 1 to 5 times a day (default 18:00); only when words are due.
- Learning streak: off by default; 20:00; only when a streak of 2+ days could end today.
- Permission card (ask, or denied with "Open settings") above the switches.
- Footer notes: how times work, the fixed times, how long things stay in the centre.

Not built, on purpose: switches for server kinds (`announcement`, `story`, `live`) before a server push exists: a switch that controls nothing would be a lie (the same reason the live reminders were removed). They arrive with phase 2 as one switch, "Messages from the team" (announcement, story). Notices about the person's own content cannot be switched off in the app (they carry a reason and an appeal path); the OS channel or the master switch stops the push, and the centre still lists them.

Time picker: tapping a time (or "Add time") opens a bottom sheet with an hour wheel and a minute wheel; nothing is saved until Done. At the limit "Add time" is disabled and the row says "Up to 3 times a day.".

### What changed in version 2 (kept for the record)

- Times are free, several a day. A saved version 1 `at` becomes `times: [at]`.
- Live Kiirtan reminders are gone from the phone (a bell that schedules nothing would be a lie). The `live` kind stays for a server push.
- Quiet hours and the daily cap of 2 are gone: the person's own times are the limit.
- Migration: `migrateSettings` reads versions 0, 1 and 2 the same way and drops `live` and `quiet`.

## 11. Phase 2: server

Local stays for everything the phone can know alone (song of the day, words, streak, festivals). The server adds what the phone cannot know: team announcements, upload and chord review results, new stories, live broadcasts.

What exists already: `member_notices` and `GET /recordings/notices` (the last 50, `unread_only`), and `POST /recordings/notices/{id}/read` (`apps/api/app/api/v1/recordings.py`). The mobile app does not call them yet; the takedown notice is derived from the "my uploads" list.

Proposed tables for broadcast kinds:

```
notifications(id, kind, audience, payload, target, created_at, expires_at)
notification_reads(user_id, notification_id)
device_tokens(user_id, token, platform, locale, tz)
```

- `audience`: `all`, a group, or one user id. `payload` is the title and text per locale. `target` is an app route, the same routes the local kinds use.
- A job every minute picks what is due, resolves the audience to device tokens and sends through Expo push (APNs and FCM), idempotent by notification id and token.
- The push payload carries `channelId` (one of the four above), `categoryId` (`ps.<kind>`), `data {id, kind, target}`, and `interruptionLevel` as the kind's registry entry says. Without `channelId` Android puts the push in "Miscellaneous". (A default channel in `app.json` needs a new native build: not done.)
- The app lists items from the server (not expired, minus reads) and merges them into the centre by id with `useNotificationsStore.getState().receive(items, now)`; the registry decides how long each is kept. Read state syncs through the read endpoints.
- `device_tokens` is written only after the person has allowed notifications. Sign-out deletes the row. Server-side expiry equals the registry's keep time, so a notice never outlives what the phone would keep.

## 12. Privacy and rate limits

- Phase 1 sends nothing off the phone. Settings, the centre and word cards stay on the device.
- Phase 2 stores a device token, platform, locale and time zone per user, and nothing about what the person learns or plays. Targeting is by audience only, never by listening history.
- No sensitive text in a notification body: nothing about health, location or private notes. A removal notice states the reason in the team's words, so on iOS its lock-screen text is hidden when previews are hidden (category `ps.upload`), and on Android the `notices` channel hides it on a secured lock screen.
- Local limits: the person's own times (at most 10 a day, tested). No quiet hours, no other daily cap.
- Server limits (to build into the job): non-important kinds at most 1 push a person per day and 3 a week (announcement, story), `live` at most 2 a day; important notices are not capped but are deduplicated by id. Nothing is sent to a device that has not allowed notifications. If volume grows, the cap is shown on the settings page.
- Permission is asked in context, never at first launch. Turning the master switch off cancels everything scheduled and, in phase 2, stops pushes for that device.

## 13. Adding a notice kind

Example: the result of a chord proposal. Four steps, none of them in the centre screen.

1. Registry: add one entry to `KIND_META` in `lib/notifications/kinds.ts`. The type `NotificationKind` follows from the keys.

   ```ts
   chordReview: { source: "server", tier: "important", keepDays: 90, unreadKeepDays: 180, priority: 5,
     groupable: false, accountBound: true, channel: "notices", ios: "active", icon: "check", tone: "sage",
     fallback: "/v2/songs" },
   ```

   `tier: "important"` gives it the top section while unread, the 90/180-day keep, its own cap, no stale-unread, and (iOS) a private-preview category registered at start. `accountBound` removes it at sign-out. `icon` and `tone` are names (see `kindIcon` and `kindTile` in `components/notifications/kindVisual.ts`; a new glyph is one line there). `channel` is one of the four.
2. Builder: next to `uploadDecisionNotification` in `lib/notifications/serverKinds.ts`, a small function returning an `AppNotification`: a stable id (`chordReview:<proposalId>:<decision>`), a short title, the text with the reviewer's reason, `target` (the song page), `firedAt`. Add its words to a locale module (en, ru, es) and to `locales/review.json`.
3. Hand it to the centre: `useNotificationsStore.getState().receive([item], Date.now())`, from wherever the news arrives (a list from the API, a push handler). The same id twice changes nothing; a deleted one does not return.
4. If the target can disappear (a deleted proposal), register a check once at module load: `registerTargetCheck("/chords-review", (route) => stillExists(route))`. A missing target then opens the kind's `fallback` with a bar that explains.

Test it: the "registry" block in `__tests__/notificationsPolicy.test.ts` checks fallback, channel, priority and category for every kind in the table.

An unknown kind (from a newer server) is not an error: it is kept 30 days as a plain reminder from the team, with a bell icon, on the `team` channel (`kindMeta`).

## 14. Not verified, not built

Not verified on a real phone (this work was checked with unit tests and the web preview only):

- Native scheduling of several times a day; iOS delivery with 60 pending; Android exact alarms (without the exact-alarm permission the system may delay a reminder by minutes).
- The Android channels, channel groups and lock-screen visibility; the iOS category and its private preview; `interruptionLevel: passive`; the sound on both platforms.
- `dismissStalePresented` (the unit of `Notification.date` differs by platform; it is normalised, not seen).
- A push from a server (there is none yet).

Not built, and why:

- iOS `threadIdentifier` and an Android group key on local notifications: expo-notifications 0.32 has no such field in the content it accepts, so iOS stacks by app and Android by channel. A per-kind thread would need a native module or a notification service extension (a new native build).
- A time-zone-change listener (the next open fixes the times).
- Server push, the notices client, the server-side caps, the "Messages from the team" switch.
- Notification action buttons (iOS categories carry none; a category with no actions only sets the private preview).
- A default Android channel in `app.json` for pushes without `channelId` (needs a new native build).
