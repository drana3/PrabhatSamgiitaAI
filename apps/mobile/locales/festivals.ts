/**
 * Russian and Spanish captions for the festival calendar (data/festivals.ts), kept apart so the team's
 * calendar file stays as it is. English is the calendar's own text and is the fallback.
 *
 * Keyed by the festival id without its year ("ru-day-2026", "ru-day-2027" and "ru-day-2028" all use "ru-day").
 * A `title` appears only where the English title is an English phrase; Sanskrit and Bengali names
 * (Diipavalii, Kiirtana Divas, Sharadotsava...) are never translated and stay as in the calendar.
 */
export type FestivalCaption = { title?: string; subtitle: string }

export const festivalCaptionsRu: Readonly<Record<string, FestivalCaption>> = {
  "ru-day": { title: "День R.U.", subtitle: "Подборка песен для служения, совместного действия и подъёма." },
  niilakantha: { subtitle: "Песни глубокого памятования и внутренней тишины." },
  vasantotsava: { subtitle: "Яркое весеннее настроение обновления и нежности." },
  dadhicii: { subtitle: "Песни мужества, преданности делу и бескорыстного служения." },
  navavarsa: { subtitle: "Светлая подборка к новому году и новым началам." },
  "ananda-purnima": { subtitle: "Светлая подборка для радостной медитации в полнолуние: день рождения Бабы." },
  "prout-day": { title: "День PROUT", subtitle: "Песни, несущие видение, достоинство и общественный подъём." },
  shravanii: { subtitle: "Вдумчивая подборка для преданности в конце сезона дождей." },
  kaoshiki: { subtitle: "Вдохновляющие песни для движения и мантры." },
  "ps-divasa": { subtitle: "В честь самих песен и их многообразия." },
  sharadotsava: {
    title: "Шарадотсава и День детей",
    subtitle: "S'as't'hii · выставки, спорт и общие трапезы для детей.",
  },
  "public-day": { title: "Публичный день", subtitle: "Saptamii · выставки здоровья молодёжи и силы взрослых." },
  "fine-arts": { title: "День изящных искусств", subtitle: "As't'amii · литературные встречи и выставки изящных искусств." },
  "music-day": { title: "День музыки", subtitle: "Navamii · инструментальная музыка и танец." },
  vijayotsava: { subtitle: "Шествия, táńd́ava и победа добра." },
  kiirtana: { subtitle: "Вдохновляющая подборка для совместного пения и преданности." },
  navanna: { subtitle: "Песни благодарности за урожай, природу и общее изобилие." },
  diipavalii: { subtitle: "Песни света, надежды и духовного пробуждения." },
  bhratrdvitiya: { subtitle: "Тёплая подборка о привязанности, семье и человеческих связях." },
  "baba-birthday": { title: "День рождения Бабы", subtitle: "Песни благодарности и памяти ко дню рождения Бабы." },
}

export const festivalCaptionsEs: Readonly<Record<string, FestivalCaption>> = {
  "ru-day": { title: "Día R.U.", subtitle: "Un conjunto de canciones con espíritu de servicio, para la acción colectiva y la elevación." },
  niilakantha: { subtitle: "Canciones para el recuerdo profundo y la quietud interior." },
  vasantotsava: { subtitle: "Un ánimo primaveral y luminoso de renovación y ternura." },
  dadhicii: { subtitle: "Canciones de valor, entrega y servicio desinteresado." },
  navavarsa: { subtitle: "Una selección llena de esperanza para el nuevo año y los nuevos comienzos." },
  "ananda-purnima": { subtitle: "Una selección luminosa para la meditación gozosa de luna llena: el cumpleaños de Bábá." },
  "prout-day": { title: "Día de PROUT", subtitle: "Canciones que llevan visión, dignidad y elevación social." },
  shravanii: { subtitle: "Una selección reflexiva para la devoción al final de la temporada de lluvias." },
  kaoshiki: { subtitle: "Canciones que elevan, para el movimiento y el mantra." },
  "ps-divasa": { subtitle: "En honor a las canciones mismas y a su amplitud." },
  sharadotsava: {
    title: "Sharadotsava y Día de la Infancia",
    subtitle: "S'as't'hii · exposiciones, deportes y banquetes colectivos para los niños.",
  },
  "public-day": { title: "Día Público", subtitle: "Saptamii · exposiciones de salud juvenil y de fuerza de los adultos." },
  "fine-arts": { title: "Día de las Bellas Artes", subtitle: "As't'amii · encuentros literarios y exposiciones de bellas artes." },
  "music-day": { title: "Día de la Música", subtitle: "Navamii · música instrumental y danza." },
  vijayotsava: { subtitle: "Procesiones, táńd́ava y la victoria de la bondad." },
  kiirtana: { subtitle: "Una selección que eleva, para el canto colectivo y la devoción." },
  navanna: { subtitle: "Canciones de gratitud por la cosecha, la naturaleza y la abundancia compartida." },
  diipavalii: { subtitle: "Canciones de luz, esperanza y despertar espiritual." },
  bhratrdvitiya: { subtitle: "Una selección cálida sobre el cariño, la familia y los lazos humanos." },
  "baba-birthday": { title: "Cumpleaños de Bábá", subtitle: "Canciones de gratitud y recuerdo por el día en que nació Bábá." },
}
