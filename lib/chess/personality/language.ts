import type { FatmaLanguage } from "./lines";

/** Arabic script wins in mixed messages; Arabizi needs a word, never a bare number. */
export function detectLanguage(text: string, locales: readonly string[] = []): FatmaLanguage {
  if (/[\u0600-\u06ff]/u.test(text)) return "egy";
  const speech = text.replace(/\b(?:[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h][1-8](?:[a-h][1-8][qrbn]?)?|O-O(?:-O)?)\b/gi, "");
  if (/\b(?:[a-z]+[23789][a-z23789]*|[23789][a-z][a-z23789]*)\b/i.test(speech) || /\b(?:yalla|mashy|keda|mesh|enta|ana|eh|ezayak|3amel)\b/i.test(speech)) return "franco";
  if (text.trim()) return "en";
  const preferred = locales.find((locale) => /^(ar|en)(?:-|$)/i.test(locale));
  return preferred && /^ar(?:-|$)/i.test(preferred) ? "egy" : "en";
}
