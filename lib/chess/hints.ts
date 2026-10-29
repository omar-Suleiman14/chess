import { applyUci, pieceName, type AppliedMove } from "./rules";

export type HintLanguage = "en" | "egy" | "franco";
const COPY = {
  en: { generic: "Look for checks and loose pieces.", capture: "Look for a capture.", check: "Look for a check.", castle: "Consider castling.", promotion: "A pawn can reach the last rank.", highlight: "Look at the", on: "on", whyCapture: "This move captures a piece.", whyCheck: "This move gives check.", whyMate: "This move is checkmate.", whyCastle: "Castle with your king and rook.", whyPromotion: "Promote your pawn.", whyQuiet: "The engine prefers this continuation." },
  egy: { generic: "دوّر على كش أو قطعة مش محمية.", capture: "بص على فرص أكل القطع.", check: "دوّر على نقلة فيها كش.", castle: "فكّر في التبييت.", promotion: "في بيدق يقدر يوصل لآخر صف.", highlight: "بص على", on: "في", whyCapture: "النقلة دي بتاكل قطعة.", whyCheck: "النقلة دي بتعمل كش.", whyMate: "النقلة دي كش مات.", whyCastle: "بيّت بالملك والطابية.", whyPromotion: "رقّي البيدق بتاعك.", whyQuiet: "المحرك بيفضّل التكملة دي." },
  franco: { generic: "Dawwar 3ala kesh aw 2et3a mesh ma7meya.", capture: "Bos 3ala foras akl el 2eta3.", check: "Dawwar 3ala na2la feeha kesh.", castle: "Fakkar fel tabyeet.", promotion: "Fee bayda2 ye2dar yewsal le akher saff.", highlight: "Bos 3ala", on: "fi", whyCapture: "El na2la di betakol 2et3a.", whyCheck: "El na2la di bete3mel kesh.", whyMate: "El na2la di kesh mate.", whyCastle: "Bayyet bel malek wel tabya.", whyPromotion: "Ra22y el bayda2 beta3ak.", whyQuiet: "El mo7arrek beyfaddal el takmela di." },
};
const PIECES = { egy: { p: "البيدق", n: "الحصان", b: "الفيل", r: "الطابية", q: "الوزير", k: "الملك" }, franco: { p: "el bayda2", n: "el 7osan", b: "el feel", r: "el tabya", q: "el wazeer", k: "el malek" } };
export function genericHint(language: HintLanguage) { return COPY[language].generic; }
export type HintEvidence = { move: AppliedMove; clue: string; highlight: string; why: string };

/** Concrete advice requires a scored current-position search and a legal move. */
export function buildHint(fen: string, bestmove: string | null | undefined, depth: number | undefined, language: HintLanguage): HintEvidence | null {
  if (!bestmove || (depth ?? 0) < 10) return null;
  const move = applyUci(fen, bestmove);
  if (!move) return null;
  const copy = COPY[language];
  const castle = move.flags.includes("k") || move.flags.includes("q");
  const name = language === "en" ? pieceName(move.piece) : PIECES[language][move.piece];
  return {
    move,
    clue: move.check ? copy.check : move.captured ? copy.capture : move.promotion ? copy.promotion : castle ? copy.castle : copy.generic,
    highlight: `${copy.highlight} ${name} ${copy.on} ${move.from}.`,
    why: move.checkmate ? copy.whyMate : move.check ? copy.whyCheck : move.captured ? copy.whyCapture : move.promotion ? copy.whyPromotion : castle ? copy.whyCastle : copy.whyQuiet,
  };
}
