/**
 * Interface strings of the app shell and the honest states that replaced the placeholder content:
 * not-found, "could not load, try again", the festival calendar, the Learn gates. English is the source
 * of truth; ru and es mirror it key for key (the parity test checks them once these objects are spread into
 * locales/en.ts, ru.ts and es.ts). "Kiirtan" is always written with two i's.
 */
export const appShellEn = {
  "notFound.title": "Page not found",
  "notFound.body": "This link is not part of the app. Head home to continue.",
  "notFound.home": "Go home",
  "notice.retry": "Try again",
  "notice.goBack": "Go back",
  "story.sheet.label": "Story",
  "story.sheet.openSong": "Open the song",
  "story.sheet.loading": "Loading the story…",
  "story.sheet.failed": "Could not load the story. Try again.",
  "story.sheet.retryLabel": "Try loading the story again",
  "learn.gate.eyebrow": "Being checked",
  "learn.gate.back": "Back to Learn",
  "learn.gate.hub": "Word cards and the quiz are being checked against the songs and will come back in an update. Until then you can listen, play along and read the stories.",
  "learn.gate.words.title": "Word cards are being checked",
  "learn.gate.words.text": "The meanings of the words are being checked against the songs before they are taught here. Nothing is lost: your song list stays as it is.",
  "learn.gate.quiz.title": "The quiz is being checked",
  "learn.gate.quiz.text": "The questions are being checked against the songs before they count towards your progress. They will come back in an update.",
} as const

export const appShellRu: Record<keyof typeof appShellEn, string> = {
  "notFound.title": "Страница не найдена",
  "notFound.body": "Этой ссылки нет в приложении. Вернитесь на главную.",
  "notFound.home": "На главную",
  "notice.retry": "Попробовать снова",
  "notice.goBack": "Назад",
  "story.sheet.label": "История",
  "story.sheet.openSong": "Открыть песню",
  "story.sheet.loading": "Загружаем историю…",
  "story.sheet.failed": "Не удалось загрузить историю. Попробуйте снова.",
  "story.sheet.retryLabel": "Попробовать загрузить историю снова",
  "learn.gate.eyebrow": "Проверяется",
  "learn.gate.back": "Назад в «Учить»",
  "learn.gate.hub": "Карточки слов и викторина проходят сверку с песнями и вернутся с обновлением. А пока можно слушать, играть вместе и читать истории.",
  "learn.gate.words.title": "Карточки слов проверяются",
  "learn.gate.words.text": "Значения слов сверяются с песнями, прежде чем их здесь преподавать. Ничего не потеряно: список ваших песен остаётся как есть.",
  "learn.gate.quiz.title": "Викторина проверяется",
  "learn.gate.quiz.text": "Вопросы сверяются с песнями, прежде чем засчитываться в ваш прогресс. Они вернутся с обновлением.",
}

export const appShellEs: Record<keyof typeof appShellEn, string> = {
  "notFound.title": "Página no encontrada",
  "notFound.body": "Este enlace no es parte de la app. Vuelve al inicio para continuar.",
  "notFound.home": "Ir al inicio",
  "notice.retry": "Intentar de nuevo",
  "notice.goBack": "Volver",
  "story.sheet.label": "Historia",
  "story.sheet.openSong": "Abrir la canción",
  "story.sheet.loading": "Cargando la historia…",
  "story.sheet.failed": "No se pudo cargar la historia. Inténtalo de nuevo.",
  "story.sheet.retryLabel": "Intentar cargar la historia de nuevo",
  "learn.gate.eyebrow": "En revisión",
  "learn.gate.back": "Volver a Aprender",
  "learn.gate.hub": "Las tarjetas de palabras y el cuestionario se están revisando con las canciones y volverán en una actualización. Mientras tanto puedes escuchar, tocar junto y leer las historias.",
  "learn.gate.words.title": "Las tarjetas de palabras se están revisando",
  "learn.gate.words.text": "Los significados de las palabras se revisan con las canciones antes de enseñarlos aquí. No se pierde nada: tu lista de canciones sigue igual.",
  "learn.gate.quiz.title": "El cuestionario se está revisando",
  "learn.gate.quiz.text": "Las preguntas se revisan con las canciones antes de contar para tu progreso. Volverán en una actualización.",
}
