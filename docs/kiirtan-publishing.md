# Kiirtan and Bhajan publishing: live at once, checked after

Decision (Dada): there is NO pre-moderation. A team member or an author who uploads a Kiirtan or a Bhajan gets
it published immediately. The team looks afterwards. A recording that breaks the content rules is removed, and the
author gets a notice with the reason and how to answer. This file is the operating guide. The code is
`apps/api/app/api/v1/recordings.py` (API) and `apps/mobile/lib/kirtan/*` (phone).

## Резюме по-русски

### Как это работает

1. Человек входит в аккаунт (гость загружать не может), выбирает аудиофайл (MP3, M4A, WAV, OGG, FLAC, до 60 МБ),
   пишет название и исполнителя, отмечает «Я автор или исполнитель» и один раз соглашается с правилами контента
   (версия правил и время согласия хранятся на телефоне и уходят на сервер как `terms_version`).
2. Приложение трижды обращается к API: просит адрес загрузки (`POST /recordings/uploads`), отправляет файл
   (`PUT` в R2 или в сам API при разработке), публикует (`POST /recordings`). Запись видна всем сразу.
3. Точная копия уже опубликованного файла (SHA-256) блокируется до отправки файла. Похожая запись (отпечаток
   Chromaprint) не блокируется: автору задают вопрос «это другое исполнение?», при ответе «да» запись публикуется.
   Подробно про дубликаты, мантры и лимиты: раздел «Duplicates» ниже.
4. Команда проверяет после публикации. Нарушение: запись снимается (`remove`) с причиной, автор получает
   уведомление и видит карточку «Удалено командой» с причиной, кнопкой «Связаться» и «Загрузить исправленную версию».

### Ежедневная работа админа

Ключ админа идёт в заголовке `X-Admin-Key`. Раз в день:

- `GET /api/v1/admin/recordings?filter=new` — всё, что ещё не просмотрено. Послушать, затем
  `POST /admin/recordings/{id}/reviewed` (всё хорошо) или `POST /admin/recordings/{id}/remove` с `reason`
  (3-500 знаков, это текст, который прочтёт автор).
- `GET /api/v1/admin/recordings?filter=flagged` — записи, на которые пожаловались. Жалоба на авторские права
  сразу переводит запись в flagged; остальные причины требуют `RECORDING_FLAG_THRESHOLD` (по умолчанию 3) жалоб.
  Запись в статусе flagged остаётся в эфире, пока команда не решит. Проверить в тот же день.
- `filter=removed` — снятые записи. Ошибка: `POST /admin/recordings/{id}/restore` возвращает запись в эфир.
- Жалобы на авторские права обрабатывать в первую очередь.

### Шаблон предупреждения автору (поле `reason`)

Пишите коротко, по-человечески, одним-двумя предложениями: что не так, что делать.

- Авторские права: «Это коммерческая запись, и мы не можем делить ею без разрешения владельца. Если у вас есть
  разрешение, загрузите запись заново и напишите нам.»
- Оскорбительное: «В записи есть слова, которые задевают людей. Загрузите версию без них, если хотите.»
- Неверные данные: «Название или автор указаны неверно. Загрузите запись заново с правильными данными.»

Автор может ответить через «Связаться с нами» (`/feedback`) и загрузить исправленную версию из карточки.
Это и есть путь обжалования: он написан и на странице правил контента (раздел «Appeal»).

### Требования магазинов (UGC)

- Apple App Store 1.2: фильтр или правила контента, механизм жалобы на каждую запись, возможность заблокировать
  автора, быстрые ответы на жалобы и контакт для связи. В приложении: правила (`/content-rules`), жалоба на
  каждой записи (меню плеера, меню строки), «Заблокировать автора» (прячет на устройстве и отправляется в API),
  согласие с правилами перед первой загрузкой, вход до загрузки.
- Google Play, раздел UGC: то же самое плюс удаление нарушающего контента. Заполнить в Play Console анкету
  о пользовательском контенте и указать ссылку на правила контента.
- Срок реакции: жалобы смотреть ежедневно. В описании для рецензентов указать, где найти жалобу и блокировку.

### Что нужно для настоящей работы (от Dada)

Сейчас нет: бакета и ключей. Нужны:

1. Бакет R2 (Cloudflare), публичный домен для файлов и ключи доступа: `RECORDING_S3_ENDPOINT`,
   `RECORDING_S3_BUCKET`, `RECORDING_S3_ACCESS_KEY_ID`, `RECORDING_S3_SECRET_ACCESS_KEY`,
   `RECORDING_PUBLIC_BASE_URL`, затем `RECORDING_STORAGE_BACKEND=s3`. Значения не коммитить.
2. `RECORDING_SIGNING_SECRET` (случайная строка) и ключ админа `X-Admin-Key` на сервере.
3. Деплой API с миграцией Alembic `0027_recordings`. Деплоя в этой работе не было.
4. Установка `expo-document-picker` в мобильное приложение: без него на телефоне нельзя выбрать файл (в веб-превью
   выбор файла работает). Метка `TODO(native)` в `app/add-kirtan.tsx`.
5. Push-уведомления об удалении: сейчас приложение узнаёт об удалении при обновлении списка
   (`GET /recordings/mine`) и кладёт уведомление во входящие. Push нужен отдельно (см. `notifications.md`).

## English summary

- No pre-moderation. Upload goes live the moment the publish call returns; the team reviews afterwards.
- Statuses on the phone: `uploading`, `published`, `failed`, `removed`. On the server: `published`, `flagged`
  (still live: a copyright report, or three reports of other kinds), `removed`.
- Daily admin work (`X-Admin-Key`): `GET /admin/recordings?filter=new|flagged|removed`, then `/reviewed`, `/remove`
  with a reason of 3 to 500 characters, or `/restore`. Copyright reports flag at once, so look at them first.
- The removal reason is what the author reads. Keep it short: what is wrong, what to do. The author sees a "Removed
  by the team" card with the reason, Contact us (`/feedback`) and "Upload a corrected version".
- Store rules (Apple 1.2, Google Play UGC): content rules page, a report on every recording, block author, terms
  agreement before the first upload, sign-in before upload, and a contact route. All are in the app.
- Exact duplicate (SHA-256) is refused before the bytes are sent; a similar recording (Chromaprint) only asks the
  author to confirm.
- Needs real infrastructure from Dada: an R2 bucket and keys, a signing secret, the admin key, an API deploy with
  migration `0027_recordings`, and `expo-document-picker` for the native file picker.
- Verified: 28 API tests on SQLite and the mobile vitest suite. Not verified: a real database (Postgres), a real R2
  bucket, a real phone.

## Duplicates

The same chant is sung by many people, so the library separates three things: the same file (a duplicate, refused),
a recording that sounds like another (a warning, the author decides), and another performance of the same
recording (not a duplicate, a version of it). Five levels do this. Code: `apps/api/app/services/recordings.py`,
`recording_fingerprint.py`, `apps/api/app/api/v1/recordings.py`, `apps/mobile/lib/kirtan/*`.

### Level 1: the same file

- At `POST /recordings/uploads` the phone sends the SHA-256 of the file. If a live recording has it, the API answers
  409 `{code: "duplicate", message: "This file is already in the library.", duplicate_of: {id, title, author, audio_url, kind}}`
  and no URL is issued, so no bytes travel. The app shows "This file is already in the library", the recording that
  is there with a "Play it" button, and "Choose a different file".
- Race guard: the unique index `ix_recordings_audio_sha256` decides when two uploads of one file finish together.
  The second `POST /recordings` gets an IntegrityError, which the API turns into the same 409 and deletes the stored file.
- A file the team removed counts too: removed files must not come back. That upload gets 409 `removed_duplicate`
  ("This file was removed by the team earlier ... If you have a corrected version, upload that"), with no link.

### Level 2: sounds like a recording in the library (a warning)

- A Chromaprint fingerprint (`fpcalc`, package `libchromaprint-tools`) is taken after the file is stored and kept in
  `recordings.audio_fingerprint`. A new recording is compared with the library (similarity 0.80 or more, linear scan).
- A close match makes `POST /recordings` answer 409 `{code: "similar_recording", similar: [...]}` and the file stays
  stored. The app lists the similar ones with "Play" and asks "Is this a different performance?". "Yes" sends the
  same publish again with `confirm_different=true` (the pair is remembered, the file is not uploaded twice); "No" calls
  `POST /recordings/uploads/discard {key}`, which deletes the stored file.
- Degrades safely: when `fpcalc` is missing or fails, `compute_fingerprint` returns nothing, the check is skipped
  and the upload is published. Nothing is blocked because the tool is not there.
- Setting: `RECORDING_FPCALC_PATH` (default `fpcalc`). The API `Dockerfile` installs `libchromaprint-tools`.

### Level 3: one mantra, five types, and the form

There is ONE mantra in the app: Baba Nam Kevalam. Every Kiirtan recording is a version of it, in one list. There is no
mantra field, no autocomplete, no "N versions" line, no browse-by-mantra page and no merge endpoint (removed; the
`mantra_groups` table and the mantra columns were dropped from the models; migration 0029 was amended before deploy and
tidies a database that ran the old draft, see the checklist).

- Type (field `kind`, kept under that name): `kiirtan` (always Baba Nam Kevalam), `bhajan`, `prabhat_samgiita`, and since
  migration 0032 `spiritual_song` and `dance_song` (see "Five types, languages and dances" below).
  "Devotional song" was removed as a type: it is not offered in the form, the chips or the API (`kind=devotional_song`
  is a 422). Old rows keep `kind = 'devotional_song'` in the database (the check constraint still allows it, so no
  migration is needed) and are read, filtered and shown as Bhajan everywhere (`public_kind` / `stored_kinds` in
  `app/models/recordings.py`; `normalizeKind` on the phone). For `prabhat_samgiita` the
  uploader picks the song number 1 to 5018 with the song picker (`ps_song_number`, required for that type and refused
  for the others). The recording is stored and listed in the library under that type, with the song number.
- The uploader types the TITLE (required). Performer (required, prefilled from the profile name; stored in the
  existing `author` column). `language` (an ISO code from the catalog, or `other` with a name; see the
  language rule below: required for Bhajan and Spiritual song; never asked for Kiirtan, which is always Baba Nam Kevalam). Optional, `credits` ("Words and
  music by"; asked for Bhajan), `year` (1900 up to this year, not in the future), `notes` (up to
  500 characters). The duration is read from the file. Checks: "I am the author or I perform this" and the content rules.
- Language rule: ONE table per side, `KIND_LANGUAGE_RULE` (phone `lib/kirtan/types.ts`, API `app/models/recordings.py`;
  a test pins them, see below). Kiirtan: none (a sent `language` is ignored). Bhajan and Spiritual song: REQUIRED.
  Prabhat Samgiita: optional. Dance song: optional (the dance is what is required). The rule is for NEW uploads: a
  Bhajan stored before it (no language, including the old `devotional_song` id, which still reads as Bhajan) stays valid
  and listed. There is no endpoint that edits a recording yet, so no "Add language" prompt exists for old Bhajans.
- Public listing: `GET /recordings?kind=&song_number=&sort=` filters by type (`kind=bhajan` includes old
  devotional-song rows), plus `language=` and `dance=` for the two new types. My uploads and the Kiirtan page show the
  type on every recording (a tag, and the chips All, Kiirtan, Bhajan, Prabhat Samgiita, Spiritual song, Dance song).
- The old "Kiirtan or Bhajan" sub-types (Dharmacakra, Akhanda, ...) stay as an optional `type` for the Kiirtan area.

### Five types, languages and dances

Added with migration `0032_recording_sets_and_categories` (additive and idempotent; it never rewrites a row).

- Types: Kiirtan, Bhajan, Prabhat Samgiita, **Spiritual song** (`spiritual_song`) and **Dance song** (`dance_song`).
  The `kind` check constraint grows by the two values; old rows are untouched.
- Dance song: Tandava or Kaoshiki is REQUIRED (`dance`, ids in `DANCES`, `app/models/recordings.py`; phone
  `lib/kirtan/types.ts`). Missing: a 422 with "Choose the dance: Tandava or Kaoshiki." on the API, an inline error and a blocked button on the form, a
  "Dance missing" line on a queue row, and the import script rejects the CSV row. A `dance` on another type is a 422.
  The Russian label for Kaoshiki ("Каушики") is not checked by a Russian speaker yet.
- Bhajan and Spiritual song: the language is REQUIRED (a 422 with "Choose the language of this song."; the form shows it above "More details" with the red Required marker). "Other" needs its name (up to 80 characters)
  for every type that has a language.
- Languages: ISO 639 codes, one catalog of 49 (`app/services/recording_languages.py`, phone
  `lib/kirtan/languages.ts`), labels in en, ru and es (`locales/recordingLanguages.ts`), a searchable picker with
  "Other (name it)". The database stores the code only, so a new language needs no migration. The old words
  (`bengali`, `hindi`, ...) read as codes; stored rows keep working. To add a language: add it on both sides and a
  `lang.<code>` label in the three dictionaries; `__tests__/kirtanLanguages.test.ts` and
  `apps/api/tests/test_recording_sets_languages.py` fail when the two lists drift.
- Bulk queue: the form's language and dance apply to every row unless a row has its own. A row that still misses a
  required field says what, and is passed over (the rest go). "Apply to all rows" (language or dance) overwrites every
  row that can still be sent. The upload button stays blocked until every open row is complete.
- The Kiirtan screens have chips for the two types and, inside them, filters by dance and by language (only the
  languages that occur). A filter that leaves nothing says so and is not the empty catalog.
- Import script: CSV `category` accepts `spiritual_song` and `dance_song`; `language` is a code or an English name;
  `dance` is a column; a missing required value fails that row only.

### Playlists from an event

A concert, a retreat or a satsang can go up as one playlist with a title, dates, place and its tracks in order. The
whole thing (model, flow, limits and why, edge cases) is in `docs/kiirtan-sets.md`.

### Level 4: reports, removal, limits

- Report reason "Duplicate" (`reason: "duplicate"`). It follows the normal threshold (`RECORDING_FLAG_THRESHOLD`).
- Admin: `POST /admin/recordings/{id}/duplicate-of {original_id, reviewer?}` removes the recording as a copy, writes the
  notice "Removed as a copy of ...", and moves its plays to the original. The author's card has "Listen to the original".
- Per-author limit: 20 uploads in 24 hours, counted from the database, so it holds after a restart and on every
  server. Setting: `RECORDING_UPLOADS_PER_DAY` (default 20). Over the limit: 429 with the header
  `X-Error-Code: upload_daily_limit`; the app says "You have added a lot of recordings today. Please come back tomorrow
  to add more. Thank you for sharing." The old hourly limiter stays as a second brake (60 an hour).
- The same author with the same title and a similar sound is refused: 409 `own_duplicate` ("You already added this one").

### Bulk upload from the app (queue)

One screen sends many files: pick the type and the shared choices once (performer, language, credits, year, notes,
the song for Prabhat Samgiita, the checks), pick many audio files (`expo-document-picker`, `multiple`; the browser has
a hidden multi-file input), and press Upload. Code: `lib/kirtan/queue.ts` (pure rows and loop),
`stores/uploadQueueStore.ts`, `components/kirtan/add/QueueRows.tsx`, `app/add-kirtan.tsx`.

- Each file is a row with its file name, an editable title (the name without extension, underscores read as spaces),
  a status and a remove button. A row without a title stops the start and shows what is missing. A file that is not
  audio or is too large is marked "Not uploaded" at once and is not part of the progress.
- Files go one after another (the same single-file route and rules). A progress bar shows how many rows are settled.
- Row states: waiting, uploading, published, already in the library (with "Listen" to the existing recording),
  needs your decision (sounds like a recording in the library: the row carries its own "different performance?"
  question and the rest carries on), left for tomorrow (daily limit), not uploaded (anything else, with "Try again").
- The queue lives in memory in the app, so it survives leaving the screen while the app is open; failed rows are
  resumed with "Try again" or "Try N again". It is not saved to disk: closing the app empties it.
- The end summary reads like "2 uploaded, 1 already in the library, 1 needs your decision".
- Daily limit (default 20, `RECORDING_UPLOADS_PER_DAY`): a team member (`is_team_member`: `is_admin`, `is_super_admin`
  or an email in the owner lists; there is no separate team role) has no daily limit and the hourly brake is 600.
  Everyone else: the queue stops with "Daily limit reached. N files are left for tomorrow" and keeps those rows.
- The duplicate rules (same file, sounds like, own duplicate) are the same as for one file.

### Level 5: bulk import

`apps/api/scripts/import_kiirtan_library.py` imports a folder of audio and a CSV (`title` required; `performer`, `category`,
`language`, `credits`, `year`, `song`, `file` optional; `type` optional). `category` is kiirtan (default), bhajan
or prabhat_samgiita (an old `devotional_song` in a CSV is read as bhajan); `song` (1 to 5018) is required for prabhat_samgiita and refused otherwise. There
is no `mantra` column any more.

    python scripts/import_kiirtan_library.py --folder ~/Kiirtan --csv ~/Kiirtan/table.csv            # dry run (default)
    python scripts/import_kiirtan_library.py --folder ... --csv ... --limit 50 --execute              # pilot
    python scripts/import_kiirtan_library.py --folder ... --csv ... --execute                         # the rest

- Dry run is the default and writes nothing. `--execute` asks for confirmation (`--yes` skips it).
- Per file: same SHA-256 (in the library or earlier in this run) is skipped; a close fingerprint is NOT imported and goes
  to the report CSV for a person to decide; the rest is converted to MP3 128 kbps with ffmpeg (MP3 and M4A are kept),
  stored with the API's storage backend, and published in its category.
- The hash of the SOURCE file is stored, so the same file sent later from the app is refused.
- The state file (`<table>.import-state.json`) is written after every file: a stopped run continues. The report is
  `<table>.import-report.csv`. Without `fpcalc` the script refuses `--execute` unless `--allow-no-fingerprint`.
- Imported recordings have no member account, are marked reviewed and are credited to `--added-by`.

### Deploy checklist

1. Alembic migration `0029_recording_duplicates`, AMENDED (idempotent, safe to run twice; it was never deployed): it adds
   the unique hash index, `audio_fingerprint`, `year`, `language`, `credits`, `notes`, `ps_song_number`, the four-value
   `kind` constraints and the duplicate fields, with no mantra objects. Step 3 drops `mantra_title`, `mantra_group_id`
   and the table `mantra_groups` if an older draft of 0029 made them (a development database). It stops with a clear
   error if two recordings already share one hash: look at those first. Back up the database before running it.
2. `fpcalc` on the server: rebuild the API image (the `Dockerfile` has `libchromaprint-tools`).
3. Environment: `RECORDING_UPLOADS_PER_DAY` (optional, 20), `RECORDING_FPCALC_PATH` (optional).
4. Ship the app build with the type selector, the queue and the new cards.

### Limits (honest)

- The similarity scan is linear in the size of the library. It is fine for thousands of recordings; for tens of
  thousands it needs an index.
- Chromaprint finds the same recording and re-encodes. "The same chant by another singer" is simply another version in
  the list; nothing groups them beyond the type.
- A Prabhat Samgiita recording is listed in the library under its type with the song number. It is not yet shown in
  the Recordings section of that song's page (the song page plays the catalogue's own audio list; wiring uploaded
  versions into its player queue is a separate piece of work).
- The catalogue fetch of the app asks for up to 100 recordings; paging is not built.
- There are no server-side likes yet, so plays are the only measure that moves on removal as a copy.
- Verified here: API tests on SQLite, the migration on SQLite, the import script with a fake storage, the mobile
  vitest suite, the 390 px preview of the form, the queue states (a temporary fixture page, since removed), the cards. Not verified: a real file picker on a phone, a real server upload of many files, : Postgres, the Docker
  build, a real `fpcalc` on the server, R2, a real phone.

### Резюме по-русски: дубликаты

- Уровень 1: точный файл (SHA-256) блокируется до отправки, сообщение «Этот файл уже есть в библиотеке», ссылка на
  существующую запись; гонку двух загрузок решает уникальный индекс.
- Уровень 2: похожее звучание (Chromaprint, порог 0,80) даёт предупреждение «это другое исполнение?»; без `fpcalc`
  проверка тихо пропускается и запись публикуется.
- Уровень 3: одна мантра, Baba Nam Kevalam; все записи киртана в одном списке. Типы: Киртан, Бхаджан, Песня преданности, Prabhat Samgiita (номер песни 1-5018). Название вводит загрузчик; исполнитель, язык, авторы, год, заметка. Много файлов сразу: очередь, итог, дневной лимит не мешает команде.
- Уровень 4: причина жалобы «Дубликат», админ «это копия записи X» (удаление с уведомлением, прослушивания
  переносятся), лимит 20 загрузок в сутки на автора (`RECORDING_UPLOADS_PER_DAY`), свой дубль с тем же названием
  и звучанием отклоняется.
- Уровень 5: скрипт `scripts/import_kiirtan_library.py`, по умолчанию пробный прогон, `--execute` по-настоящему,
  состояние и отчёт в файлах.
- Для деплоя: миграция `0029_recording_duplicates`, `fpcalc` в образе API, переменные окружения. Деплоя не было.
