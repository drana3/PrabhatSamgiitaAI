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
a recording that sounds like another (a warning, the author decides), and another performance of the same mantra
(not a duplicate, a version of it). Five levels do this. Code: `apps/api/app/services/recordings.py`,
`recording_fingerprint.py`, `mantras.py`, `apps/api/app/api/v1/recordings.py`, `apps/mobile/lib/kirtan/*`.

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

### Level 3: mantras and versions

- The uploader may type a free-text mantra (and a year). The API makes a key from it: lower case, accents of Latin
  letters removed, only letters and digits kept. "Baba Nam Kevalam", "Bábá Nám Kevalam" and "baba-nam-kevalam" are one
  mantra; Cyrillic and Devanagari keep their letters. The phone has the same rule (`lib/kirtan/mantras.ts`).
- One row per (kind, key) in `mantra_groups`. A merged group points to the one it was merged into
  (`merged_into_id`), so old links keep working. Recordings keep `mantra` (as typed) and `mantra_group_id`.
- Public endpoints (no sign-in): `GET /recordings/mantras?kind=&q=`, `GET /recordings/mantras/suggest?q=&kind=`
  (autocomplete, those starting with the text first), `GET /recordings/mantras/lookup?title=&kind=` (how many versions
  of exactly this mantra), `GET /recordings/mantras/{id}?sort=newest|plays` (the versions).
- Admin, to fix a split: `POST /admin/recordings/mantras/merge {source_id, target_id, title?}`.
- App: the add form has a Mantra field with suggestions and "N versions of this mantra" with "See all versions"; the
  Kiirtan page has "Browse by mantra" (`app/kirtan-mantra.tsx`): the list of mantras, and the versions of one.

### Level 4: reports, removal, limits

- Report reason "Duplicate" (`reason: "duplicate"`). It follows the normal threshold (`RECORDING_FLAG_THRESHOLD`).
- Admin: `POST /admin/recordings/{id}/duplicate-of {original_id, reviewer?}` removes the recording as a copy, writes the
  notice "Removed as a copy of ...", and moves its plays to the original. The author's card has "Listen to the original".
- Per-author limit: 20 uploads in 24 hours, counted from the database, so it holds after a restart and on every
  server. Setting: `RECORDING_UPLOADS_PER_DAY` (default 20). Over the limit: 429 with the header
  `X-Error-Code: upload_daily_limit`; the app says "You have added a lot of recordings today. Please come back tomorrow
  to add more. Thank you for sharing." The old hourly limiter stays as a second brake (60 an hour).
- The same author with the same title and a similar sound is refused: 409 `own_duplicate` ("You already added this one").

### Level 5: bulk import

`apps/api/scripts/import_kiirtan_library.py` imports a folder of audio and a CSV (`title`, `performer`, `mantra`,
`year`, `file`; `type` optional).

    python scripts/import_kiirtan_library.py --folder ~/Kiirtan --csv ~/Kiirtan/table.csv            # dry run (default)
    python scripts/import_kiirtan_library.py --folder ... --csv ... --limit 50 --execute              # pilot
    python scripts/import_kiirtan_library.py --folder ... --csv ... --execute                         # the rest

- Dry run is the default and writes nothing. `--execute` asks for confirmation (`--yes` skips it).
- Per file: same SHA-256 (in the library or earlier in this run) is skipped; a close fingerprint is NOT imported and goes
  to the report CSV for a person to decide; the rest is converted to MP3 128 kbps with ffmpeg (MP3 and M4A are kept),
  stored with the API's storage backend, and published with its mantra group.
- The hash of the SOURCE file is stored, so the same file sent later from the app is refused.
- The state file (`<table>.import-state.json`) is written after every file: a stopped run continues. The report is
  `<table>.import-report.csv`. Without `fpcalc` the script refuses `--execute` unless `--allow-no-fingerprint`.
- Imported recordings have no member account, are marked reviewed and are credited to `--added-by`.

### Deploy checklist

1. Alembic migration `0029_recording_duplicates` (adds the unique hash index, `audio_fingerprint`, `mantra`, `year`,
   `mantra_groups`, `mantra_group_id`, and the duplicate fields). It stops with a clear error if two recordings already
   share one hash: look at those first.
2. `fpcalc` on the server: rebuild the API image (the `Dockerfile` has `libchromaprint-tools`).
3. Environment: `RECORDING_UPLOADS_PER_DAY` (optional, 20), `RECORDING_FPCALC_PATH` (optional).
4. Ship the app build that has the mantra field and the new cards.

### Limits (honest)

- The similarity scan is linear in the size of the library. It is fine for thousands of recordings; for tens of
  thousands it needs an index.
- Chromaprint finds the same recording and re-encodes. It does not know "the same mantra by another singer"; that is
  what mantra groups are for, and they depend on what the uploader types (the admin can merge two spellings).
- There are no server-side likes yet, so plays are the only measure that moves on removal as a copy.
- Verified here: API tests on SQLite, the migration on SQLite, the import script with a fake storage, the mobile
  vitest suite, the 390 px preview of the form, the mantra pages and the cards. Not verified: Postgres, the Docker
  build, a real `fpcalc` on the server, R2, a real phone.

### Резюме по-русски: дубликаты

- Уровень 1: точный файл (SHA-256) блокируется до отправки, сообщение «Этот файл уже есть в библиотеке», ссылка на
  существующую запись; гонку двух загрузок решает уникальный индекс.
- Уровень 2: похожее звучание (Chromaprint, порог 0,80) даёт предупреждение «это другое исполнение?»; без `fpcalc`
  проверка тихо пропускается и запись публикуется.
- Уровень 3: мантра вводится текстом, ключ не зависит от написания; группы, список, версии, подсказки, слияние админом.
- Уровень 4: причина жалобы «Дубликат», админ «это копия записи X» (удаление с уведомлением, прослушивания
  переносятся), лимит 20 загрузок в сутки на автора (`RECORDING_UPLOADS_PER_DAY`), свой дубль с тем же названием
  и звучанием отклоняется.
- Уровень 5: скрипт `scripts/import_kiirtan_library.py`, по умолчанию пробный прогон, `--execute` по-настоящему,
  состояние и отчёт в файлах.
- Для деплоя: миграция `0029_recording_duplicates`, `fpcalc` в образе API, переменные окружения. Деплоя не было.
