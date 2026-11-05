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
