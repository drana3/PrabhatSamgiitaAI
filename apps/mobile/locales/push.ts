/**
 * Words of the push switch in the notification settings (components/notifications/PushRepliesRow.tsx). The push itself is
 * written by the server in the language the app reports (apps/api services/push.py). English is the source; ru and es
 * mirror it key for key and start unreviewed by a native speaker.
 */
export const pushEn = {
  "push.section": "Messages",
  "push.replies": "Replies to my comments",
  "push.replies.sub": "A notification when somebody answers a comment you wrote.",
  "push.failed": "Could not save. Check the connection and try again.",
} as const

export const pushRu: Record<keyof typeof pushEn, string> = {
  "push.section": "Сообщения",
  "push.replies": "Ответы на мои комментарии",
  "push.replies.sub": "Уведомление, когда кто-то отвечает на ваш комментарий.",
  "push.failed": "Не удалось сохранить. Проверьте соединение и попробуйте ещё раз.",
}

export const pushEs: Record<keyof typeof pushEn, string> = {
  "push.section": "Mensajes",
  "push.replies": "Respuestas a mis comentarios",
  "push.replies.sub": "Una notificación cuando alguien responde a un comentario tuyo.",
  "push.failed": "No se pudo guardar. Revisa la conexión e inténtalo de nuevo.",
}
