/**
 * Some catalog titles are stored in capitals ("ÁNDHÁRA SHEŚE ÁLORA DESHE"). The design shows them in
 * title case, so a title with no lowercase letter is lowered and each word gets a capital. Titles
 * that already have mixed case are left alone.
 */
export function readableTitle(title: string): string {
  const text = title.trim()
  if (!text || text !== text.toUpperCase() || text === text.toLowerCase()) return text
  return text
    .toLowerCase()
    .replace(/(^|[\s\-(])(\p{L})/gu, (_match, lead: string, letter: string) => lead + letter.toUpperCase())
}
