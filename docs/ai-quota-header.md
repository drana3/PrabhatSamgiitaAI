# Daily AI question allowance: what the API reports

The assistant shows "N questions left today". The number is the server's own count (the same one that enforces the
daily limit in `app/services/ai_quota.py`), not a tally kept on the phone. Status: built and tested, not deployed.

## Headers

Every `POST /api/v1/ai/explain` reply (the streaming reply, and the limit notice too) carries:

| header | value |
|---|---|
| `X-RateLimit-Limit` | questions allowed today for this caller (guest or signed-in member) |
| `X-RateLimit-Remaining` | questions left today, after this one if it was counted. Never below 0 |
| `X-RateLimit-Reset` | whole seconds until the count starts again (the next UTC midnight) |

The existing `X-Error-Code` (`quota_exceeded`, ...) is unchanged and travels next to them. A reply that is refused
before the count is read (`song_not_found`, `question_not_allowed`) has no `X-RateLimit-*`. When the count cannot be
read the headers are left out; the app then shows no counter rather than a guess. The three headers are listed in
the CORS `expose_headers`, so a browser build can read them.

Only the deeper questions that reach the model are counted (greeting, direct and structured answers and cached
answers are free), so "Remaining" is the real number of those left. The reply to a free question reports the
unchanged number.

Guests are counted per IP address (`X-Forwarded-For`), members per account. People behind one address share a guest
count.

## `GET /api/v1/ai/quota`

The same numbers without asking a question, so the screen can show the counter as soon as it opens. Same caller
identity as `/ai/explain`. 60 per minute per address.

```json
{ "scope": "guest", "limit": 15, "used": 3, "remaining": 12, "resets_in_seconds": 41200 }
```

503 when the count cannot be read. It sends no user text, so it does not need the AI consent.

## The app

`packages/core/src/daily-quota.ts` reads the headers and the JSON (a value that does not parse is "not reported").
`streamExplanation` takes an optional last argument `onQuota`; `api.fetchDailyQuota()` calls the endpoint. The Ask
screen (`hooks/useAssistantChat.ts`, `lib/assistantServerQuota.ts`, `stores/assistantServerQuotaStore.ts`) asks when
it opens and updates from every answer, and shows the line under the song chip. Hidden when the server has not
reported, when the app is offline at start, or after the reported reset time has passed. The limits are no longer
copied into the app for this label.
