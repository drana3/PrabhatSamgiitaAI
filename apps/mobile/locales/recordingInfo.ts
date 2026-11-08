/**
 * Words for how a recording was made and how it sounds (docs/kiirtan-recording-info.md): the type of recording (studio, live at a
 * programme, at home, made by AI), the tempo, solo or group, the note that tells the listener about an AI recording, and the
 * two sentences of the upload form (type of recording missing, a Kiirtan title not in English). English is the source of truth;
 * ru and es mirror it key for key (the parity test checks it). "Kiirtan" is always written with two i's in English.
 */
export const recordingInfoEn = {
  "recinfo.type.field": "How was it recorded?",
  "recinfo.type.hint": "Required. Pick the nearest.",
  "recinfo.type.hintOptional": "Optional. Helps listeners find what they like.",
  "recinfo.type.studio": "Studio",
  "recinfo.type.live": "Live at a programme",
  "recinfo.type.home": "At home or on a phone",
  "recinfo.type.ai": "Made by AI",
  "recinfo.type.aiNote": "Listeners will be told that this recording was made by AI.",
  "recinfo.type.aiBadge": "Made by AI",
  "recinfo.type.aiBanner": "This recording was made with an AI tool. It is not a recording of people singing.",
  "recinfo.tempo.field": "Tempo",
  "recinfo.tempo.slow": "Slow",
  "recinfo.tempo.medium": "Medium",
  "recinfo.tempo.fast": "Fast",
  "recinfo.performance.field": "Solo or group",
  "recinfo.performance.solo": "Solo",
  "recinfo.performance.group": "Group or choir",
  "ugc.form.error.recordingType": "Say how this Kiirtan was recorded.",
  "ugc.form.error.titleEnglish": "Write the title of a Kiirtan in English, with Latin letters.",
  "recinfo.title.hint": "The title of a Kiirtan is written in English, with Latin letters.",
} as const

export const recordingInfoRu: Record<keyof typeof recordingInfoEn, string> = {
  "recinfo.type.field": "Как сделана запись?",
  "recinfo.type.hint": "Обязательно. Выберите ближайшее.",
  "recinfo.type.hintOptional": "По желанию. Помогает слушателям найти то, что им нравится.",
  "recinfo.type.studio": "Студия",
  "recinfo.type.live": "Живая запись на программе",
  "recinfo.type.home": "Дома или на телефон",
  "recinfo.type.ai": "Сделано ИИ",
  "recinfo.type.aiNote": "Слушатели увидят, что эта запись сделана ИИ.",
  "recinfo.type.aiBadge": "Сделано ИИ",
  "recinfo.type.aiBanner": "Эта запись сделана с помощью ИИ. Это не запись поющих людей.",
  "recinfo.tempo.field": "Темп",
  "recinfo.tempo.slow": "Медленный",
  "recinfo.tempo.medium": "Средний",
  "recinfo.tempo.fast": "Быстрый",
  "recinfo.performance.field": "Соло или группа",
  "recinfo.performance.solo": "Соло",
  "recinfo.performance.group": "Группа или хор",
  "ugc.form.error.recordingType": "Укажите, как сделана эта запись киртана.",
  "ugc.form.error.titleEnglish": "Название киртана пишется по-английски, латинскими буквами.",
  "recinfo.title.hint": "Название киртана пишется по-английски, латинскими буквами.",
}

export const recordingInfoEs: Record<keyof typeof recordingInfoEn, string> = {
  "recinfo.type.field": "¿Cómo se grabó?",
  "recinfo.type.hint": "Obligatorio. Elige lo más cercano.",
  "recinfo.type.hintOptional": "Opcional. Ayuda a los oyentes a encontrar lo que les gusta.",
  "recinfo.type.studio": "Estudio",
  "recinfo.type.live": "En vivo, en un programa",
  "recinfo.type.home": "En casa o con un teléfono",
  "recinfo.type.ai": "Hecha con IA",
  "recinfo.type.aiNote": "Se avisará a los oyentes de que esta grabación está hecha con IA.",
  "recinfo.type.aiBadge": "Hecha con IA",
  "recinfo.type.aiBanner": "Esta grabación se hizo con una herramienta de IA. No es una grabación de personas cantando.",
  "recinfo.tempo.field": "Tempo",
  "recinfo.tempo.slow": "Lento",
  "recinfo.tempo.medium": "Medio",
  "recinfo.tempo.fast": "Rápido",
  "recinfo.performance.field": "Solo o grupo",
  "recinfo.performance.solo": "Solo",
  "recinfo.performance.group": "Grupo o coro",
  "ugc.form.error.recordingType": "Di cómo se grabó este Kiirtan.",
  "ugc.form.error.titleEnglish": "Escribe el título de un Kiirtan en inglés, con letras latinas.",
  "recinfo.title.hint": "El título de un Kiirtan se escribe en inglés, con letras latinas.",
}
