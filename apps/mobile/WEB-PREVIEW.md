# Browser preview of the redesign

Look at the redesign in a desktop browser. It needs no Expo account, no Apple
account, no Xcode and no phone.

```bash
cd apps/mobile
npm install --legacy-peer-deps
npm run web
```

Open http://localhost:8081/phone.html: a phone frame with buttons that jump
to each screen. Click inside the phone like on a real one.

This is a preview, not the real app. Audio playback, haptics, glass blur and
the lock screen behave differently or not at all in a browser. Use a real
build to judge feel and gestures.

Routes to try: /v2/today, /v2/songs, /v2/player, /v2/learn, /search-v2,
/song-v2/ps-1, /profile-sheet, /assistant, /harmonium-v2, /storage.

`npm run web` also starts a small local proxy (`scripts/cors-proxy.js`, port
8100) that adds the CORS headers the API does not send, so songs and stories
load. Stop it with `pkill -f cors-proxy.js` when you finish.
