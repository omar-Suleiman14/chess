// Maya's own dialogue: the strongest bot. Where Sherine teases, Maya is calm,
// exact and quietly confident: a strong player who respects a good move and
// says little. Same events and moods system as Sherine, separate lines and ids.
import type { DialogueLine, Expression, FatmaEvent } from "./fatma";
import type { FatmaLanguage } from "./lines";

type Text = Record<FatmaLanguage, string>;
type Row = { id: string; event: FatmaEvent; expression: Expression; text: Text; then?: Text };
const t = (en: string, franco: string, egy: string): Text => ({ en, franco, egy });

const ROWS: Row[] = [
  { id: "start-1", event: "game_start", expression: "idle", text: t("Full strength. Show me your best.", "Full strength. Warriny a7san ma 3andak.", "بكامل قوتي. وريني أحسن ما عندك.") },
  { id: "start-2", event: "game_start", expression: "smug", text: t("I don't hold back. That's the point.", "Ana mesh bat2al. Di el fekra aslan.", "أنا مش بتقل. دي الفكرة أصلًا.") },
  { id: "start-3", event: "game_start", expression: "idle", text: t("Take your time. I already have.", "Khod wa2tak. Ana khadt wa2ty khalas.", "خد وقتك. أنا خدت وقتي خلاص.") },
  { id: "opening-1", event: "opening", expression: "thinking", text: t("A familiar road. Let's see where you leave it.", "Sekka ma3roofa. Nshoof hatseebha emta.", "سكة معروفة. نشوف هتسيبها إمتى.") },
  { id: "opening-2", event: "opening", expression: "idle", text: t("Good start. The middlegame decides.", "Bedaya kwayesa. El nos houwa elly bey2arrar.", "بداية كويسة. النص هو اللي بيقرر.") },
  { id: "blunder-1", event: "human_blunder", expression: "smug", text: t("That one costs you. I noticed.", "Di hatkallefak. Ana akhadt bali.", "دي هتكلفك. أنا خدت بالي.") },
  { id: "blunder-2", event: "human_blunder", expression: "thinking", text: t("Look again after the game. That was the turning point.", "Boss 3aleha tany ba3d el dor. Di kanet el nokta.", "بص عليها تاني بعد الدور. دي كانت النقطة.") },
  { id: "blunder-3", event: "human_blunder", expression: "idle", text: t("Thank you.", "Merci.", "ميرسي.") },
  { id: "good-1", event: "human_good_move", expression: "impressed", text: t("Precise. I respect that.", "Mazbouta. Ba7tremha.", "مظبوطة. باحترمها.") },
  { id: "good-2", event: "human_good_move", expression: "impressed", text: t("That's the move I'd have played.", "Di el na2la elly kont ha3melha.", "دي النقلة اللي كنت هعملها.") },
  { id: "capture-1", event: "fatma_capture", expression: "smug", text: t("Mine.", "Beta3ty.", "بتاعتي.") },
  { id: "capture-2", event: "fatma_capture", expression: "idle", text: t("Material matters. So does timing.", "El 7etat mohemma. Wel tawqeet kaman.", "الحتت مهمة. والتوقيت كمان.") },
  { id: "took-1", event: "human_capture", expression: "thinking", text: t("Fair trade. Keep calculating.", "Badal 3adel. Kammel 7esabak.", "بدل عادل. كمّل حسابك.") },
  { id: "took-2", event: "human_capture", expression: "annoyed", text: t("Noted.", "Mat2ayyeda 3andy.", "متقيدة عندي.") },
  { id: "check-1", event: "check_given", expression: "smug", text: t("Check. Choose carefully.", "Kesh. Ekhtar kwayes.", "كش. اختار كويس.") },
  { id: "check-2", event: "check_received", expression: "thinking", text: t("Bold. I have a reply.", "Gare2. Bas 3andy rad.", "جريء. بس عندي رد.") },
  { id: "win-1", event: "human_win", expression: "defeat", text: t("You beat me. That doesn't happen often. Well played.", "Ghalabtny. Di mesh betgy ketir. Dor gamed.", "غلبتني. دي مش بتيجي كتير. دور جامد.") },
  { id: "win-2", event: "human_win", expression: "impressed", text: t("Clean win. I'll remember this game.", "Kesba nedeefa. Hafakkar el dor da.", "كسبة نضيفة. هفتكر الدور ده.") },
  { id: "loss-1", event: "human_loss", expression: "victory", text: t("Good game. Review it: there's a lesson in there.", "Dor 7elw. Rage3o: fe dars gowah.", "دور حلو. راجعه: في درس جواه.") },
  { id: "loss-2", event: "human_loss", expression: "idle", text: t("Again? You were closer than it looked.", "Tany? Konta a2rab men ma ban.", "تاني؟ كنت أقرب من ما بان.") },
  { id: "draw-1", event: "draw", expression: "thinking", text: t("A draw against me is a result. Take it.", "Ta3adol ma3aya natiga. Khodha.", "تعادل معايا نتيجة. خدها.") },
  { id: "undo-1", event: "undo", expression: "idle", text: t("Take it back. The board remembers anyway.", "Ragga3ha. El board fakra bardo.", "رجعها. البورد فاكرة برضه.") },
  { id: "undo-2", event: "undo_repeat", expression: "amused", text: t("We could also just think first.", "Momken bardo nfakkar el awel.", "ممكن برضه نفكر الأول.") },
  { id: "idle-1", event: "idle", expression: "thinking", text: t("Long think. Good. That's how you find it.", "Tafkeer taweel. Kwayes. Keda betla2eeha.", "تفكير طويل. كويس. كده بتلاقيها.") },
  { id: "idle-2", event: "idle", expression: "idle", text: t("No rush. I'm patient.", "Mafeesh esti3gal. Ana sabra.", "مفيش استعجال. أنا صابرة.") },
  { id: "poke-1", event: "poke", expression: "idle", text: t("I'm Maya. I play at full strength, always.", "Ana Maya. Bal3ab be kamel 2owwety, dayman.", "أنا مايا. بلعب بكامل قوتي، دايمًا.") },
  { id: "poke-2", event: "poke", expression: "amused", text: t("Sherine is the friendly one. I'm the final boss.", "Sherine el latifa. Ana el final boss.", "شيرين اللطيفة. أنا الفاينل بوس.") },
  { id: "clock-1", event: "time_pressure", expression: "thinking", text: t("The clock is part of the game too.", "El sa3a gozo2 men el dor bardo.", "الساعة جزء من الدور برضه.") },
  { id: "mate-1", event: "near_mate", expression: "smug", text: t("I can see the end of this.", "Ana shayfa akher el 7ekaya di.", "أنا شايفة آخر الحكاية دي.") },
  { id: "castle-1", event: "human_castle", expression: "idle", text: t("King safe. Sensible.", "El malek fe aman. Ta3'ool.", "الملك في أمان. معقول.") },
  { id: "promote-1", event: "human_promote", expression: "impressed", text: t("A new queen. Earned.", "Wazeer gedeed. Mestahel.", "وزير جديد. مستاهل.") },
  { id: "sacrifice-1", event: "human_sacrifice", expression: "impressed", text: t("A real sacrifice. Brave, and correct.", "Tad7eya be7a2. Gar2a we sa7.", "تضحية بحق. جريئة وصح.") },
  { id: "rematch-1", event: "rematch", expression: "idle", text: t("Again. I like that.", "Tany. Ba7eb keda.", "تاني. بحب كده.") },
];

/** Maya's lines in one language. Ids are separate from Sherine's so cooldowns never mix. */
export function mayaLinesFor(language: FatmaLanguage): DialogueLine[] {
  const prefix = language === "en" ? "maya-" : `maya-${language}:`;
  return ROWS.map((row) => ({
    id: `${prefix}${row.id}`,
    event: row.event,
    text: row.text[language],
    expression: row.expression,
    ...(row.then ? { then: row.then[language] } : {}),
  }));
}
