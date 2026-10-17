/** Mesma normalização da busca no servidor: minúsculas, sem acentos, espaços simples. */
export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');

/** Partes do nome original com o trecho buscado marcado; a comparação ignora acentos, o texto exibido não. */
export function highlightParts(name: string, term: string): Array<{ text: string; match: boolean }> {
  const needle = normalizeSearch(term).trim();
  if (!needle) return [{ text: name, match: false }];
  // Normaliza caractere a caractere para manter a correspondência de posições com o nome original.
  const chars = [...name];
  const folded = chars.map((char) => normalizeSearch(char));
  const haystack = folded.join('');
  const start = haystack.indexOf(needle);
  if (start < 0) return [{ text: name, match: false }];
  let offset = 0, from = -1, to = chars.length;
  for (let index = 0; index < chars.length; index++) {
    if (from < 0 && offset >= start) from = index;
    offset += folded[index]!.length;
    if (from >= 0 && offset >= start + needle.length) { to = index + 1; break; }
  }
  return [{ text: chars.slice(0, from).join(''), match: false }, { text: chars.slice(from, to).join(''), match: true }, { text: chars.slice(to).join(''), match: false }].filter((part) => part.text);
}
