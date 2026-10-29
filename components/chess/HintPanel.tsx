"use client";

import type { HintEvidence, HintLanguage } from "@/lib/chess/hints";
import { genericHint } from "@/lib/chess/hints";

export const HINT_COPY = {
  en: { hint: "Hint", clue: "Clue", highlight: "Highlight", show: "Show move", next: "Next hint", close: "Close hint", unavailable: "Hint unavailable", preparing: "Finding the next hint…", consent: "Using a hint makes this game unrated.", accept: "Use hint", cancel: "Keep rated", error: "Could not save assistance. Try again when connected." },
  egy: { hint: "تلميح", clue: "فكرة", highlight: "بص هنا", show: "ورّيني النقلة", next: "التلميح اللي بعده", close: "اقفل التلميح", unavailable: "التلميح مش متاح", preparing: "بندور على التلميح اللي بعده…", consent: "استخدام التلميح بيخلّي الدور من غير تصنيف.", accept: "استخدم تلميح", cancel: "خلّي الدور بتصنيف", error: "مقدرناش نحفظ المساعدة. جرّب تاني لما الاتصال يرجع." },
  franco: { hint: "Talmee7", clue: "Fekra", highlight: "Bos hena", show: "Warriny el na2la", next: "El talmee7 elly ba3do", close: "E2fel el talmee7", unavailable: "El talmee7 mesh mota7", preparing: "Benedawwar 3ala el talmee7 elly ba3do…", consent: "Estekhdam el talmee7 bey5ally el dor men gheer tasneef.", accept: "Estakhdem talmee7", cancel: "Khally el dor be tasneef", error: "Ma2dernash ne7faz el mosa3da. Garrab tany lama el etesal yerga3." },
};

export function HintPanel({ stage, evidence, unavailable, language, onNext, onClose }: { stage: 1 | 2 | 3; evidence: HintEvidence | null; unavailable: boolean; language: HintLanguage; onNext: () => void; onClose: () => void }) {
  const copy = HINT_COPY[language];
  return <section aria-label={copy.hint} dir={language === "egy" ? "rtl" : "ltr"} className="grid gap-2 rounded-2xl border border-line bg-surface p-3 text-sm">
    <div className="flex items-center justify-between gap-2"><h2 className="font-semibold"><span dir="ltr">{stage}/3</span> · {stage === 1 ? copy.clue : stage === 2 ? copy.highlight : copy.show}</h2><button onClick={onClose} aria-label={copy.close} className="grid h-11 w-11 place-items-center rounded-full">×</button></div>
    <p aria-live="polite" aria-atomic="true">{stage === 1 ? evidence?.clue ?? genericHint(language) : stage === 2 ? evidence?.highlight ?? copy.unavailable : evidence ? <><bdi className="font-mono font-bold">{evidence.move.san}</bdi> · {evidence.why}</> : copy.unavailable}</p>
    {stage < 3 && <button onClick={onNext} disabled={!evidence} className="min-h-11 rounded-xl bg-surface-2 px-3 font-semibold disabled:opacity-60">{evidence ? copy.next : unavailable ? copy.unavailable : copy.preparing}</button>}
  </section>;
}
