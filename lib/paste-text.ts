/** Clipboard line breaks create sibling topics; blank lines are separators. */
export function clipboardTextLines(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.some(line => line.length > 1000)) throw new Error('Cada linha pode ter no máximo 1.000 caracteres.');
  return lines;
}
