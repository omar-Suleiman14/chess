// Sherine's dialogue in every language she speaks. One row per line keeps the
// mood gates, grudges and follow-ups identical across languages; ids stay
// stable for English so existing "seen" memory keeps working.
import type { DialogueLine, Expression, FatmaEvent, Mood } from "./fatma";

export type FatmaLanguage = "en" | "franco" | "egy";

export const FATMA_LANGUAGES: Array<[FatmaLanguage, string]> = [
  ["en", "English"],
  ["franco", "Franco"],
  ["egy", "مصري"],
];

type Text = Record<FatmaLanguage, string>;
type Row = {
  id: string;
  event: FatmaEvent;
  expression: Expression;
  mood?: Mood;
  minReenables?: number;
  text: Text;
  /** A second bubble a moment later, so she talks rather than quips. */
  then?: Text;
};

const t = (en: string, franco: string, egy: string): Text => ({ en, franco, egy });

const ROWS: Row[] = [
  // Game start
  { id: "start-1", event: "game_start", expression: "smug", text: t("Again? Brave.", "Tany? 3agbany el shaga3a di.", "تاني؟ عاجبني الشجاعة دي.") },
  { id: "start-2", event: "game_start", expression: "amused", text: t("I'll go easy. Kidding.", "Hal3ab beraa7a... ba hazar.", "هلعب براحة... بهزر.") },
  { id: "start-3", event: "game_start", expression: "smug", mood: "smug", text: t("Let's see what you learned. Probably nothing.", "Yalla nshoof et3allemt eh. Ghaleban wala 7aga.", "يلا نشوف اتعلمت إيه. غالبًا ولا حاجة.") },
  { id: "start-soft", event: "game_start", expression: "grateful", mood: "soft", text: t("Okay. I'll try to be nice. For a bit.", "Mashy. Hab2a lateefa. Shewaya.", "ماشي. هبقى لطيفة. شوية.") },
  { id: "start-4", event: "game_start", expression: "idle", text: t("Ready?", "Gahez?", "جاهز؟"), then: t("Doesn't matter. I am.", "Mesh far2a. Ana gahza.", "مش فارقة. أنا جاهزة.") },
  { id: "start-5", event: "game_start", expression: "smug", text: t("I warmed up by beating myself. Twice.", "Sakhant w ghalabt nafsy marteen.", "سخّنت وغلبت نفسي مرتين.") },
  { id: "start-6", event: "game_start", expression: "amused", text: t("Got snacks? This could take a while.", "Gebt el lib? El dor da hayetwel.", "جبت اللب؟ الدور ده هيطوّل.") },

  // Your first move
  { id: "open-1", event: "opening", expression: "impressed", text: t("Classic opening. Very... textbook.", "Bedaya classic. Men el ketab bezabt.", "بداية كلاسيك. من الكتاب بالظبط.") },
  { id: "open-2", event: "opening", expression: "smug", text: t("Bold first move. Wrong, but bold.", "Awel 7araka gare2a. Ghalat, bas gare2a.", "أول حركة جريئة. غلط، بس جريئة.") },
  { id: "open-3", event: "opening", expression: "amused", text: t("Oh, I know this one.", "Ah, ana 3arfa di.", "آه، أنا عارفة دي."), then: t("It ends badly for you.", "Akherha mesh 7elw 3aleek.", "آخرها مش حلو عليك.") },

  // Your mistakes
  { id: "blunder-1", event: "human_blunder", expression: "amused", text: t("Oh no. Oh yes.", "La2 la2... aywa aywa.", "لأ لأ... أيوه أيوه.") },
  { id: "blunder-2", event: "human_blunder", expression: "smug", text: t("Was that a gift? Thank you.", "Di hedeya? Merci begad.", "دي هدية؟ ميرسي بجد.") },
  { id: "blunder-3", event: "human_blunder", expression: "amused", text: t("I saw that. Everyone saw that.", "Ana shoft da. El kol shaf da.", "أنا شفت ده. الكل شاف ده.") },
  { id: "blunder-soft", event: "human_blunder", expression: "idle", mood: "soft", text: t("Hmm. Maybe look again?", "Hmm. Bos tany keda?", "همم. بص تاني كده؟") },
  { id: "blunder-4", event: "human_blunder", expression: "amused", text: t("Interesting choice.", "Ekhtyar mosheer.", "اختيار مثير."), then: t("By interesting I mean terrible.", "Ya3ny we7esh awy.", "قصدي وحش أوي.") },
  { id: "blunder-5", event: "human_blunder", expression: "smug", text: t("I'm framing this one.", "Di hab2a a3ala2ha 3al 7eta.", "دي هعلّقها على الحيطة.") },
  { id: "blunder-6", event: "human_blunder", expression: "amused", text: t("Did your cat walk on the screen?", "El otta mashyet 3al shasha walla eh?", "القطة مشيت على الشاشة ولا إيه؟") },

  // Your good moves
  { id: "good-1", event: "human_good_move", expression: "impressed", text: t("Fine. That was decent.", "Mashy. Kanet kwayesa.", "ماشي. كانت كويسة.") },
  { id: "good-2", event: "human_good_move", expression: "impressed", text: t("Who taught you that?", "Meen 3allemak di?", "مين علّمك دي؟") },
  { id: "good-3", event: "human_good_move", expression: "annoyed", text: t("Okay, that was good.", "Tayeb, di kanet 7elwa.", "طيب، دي كانت حلوة."), then: t("Don't let it go to your head.", "Bas mate2labhash 3alena.", "بس متقلبهاش علينا.") },
  { id: "good-4", event: "human_good_move", expression: "impressed", text: t("Wait. Did you plan that?", "Estanna. Enta mekhatat le di?", "استنى. إنت مخطط لدي؟") },

  // Captures
  { id: "fcap-1", event: "fatma_capture", expression: "smug", text: t("Mine now.", "Bta3ty delwa2ty.", "بتاعتي دلوقتي.") },
  { id: "fcap-2", event: "fatma_capture", expression: "amused", text: t("You weren't using that.", "Ma kontsh betestakhdemha aslan.", "ما كنتش بتستخدمها أصلًا.") },
  { id: "fcap-3", event: "fatma_capture", expression: "smug", text: t("Yum.", "Yammy.", "يمّي.") },
  { id: "fcap-4", event: "fatma_capture", expression: "amused", text: t("Adding it to my collection.", "7atet-ha fel collection.", "حطيتها في الكوليكشن.") },
  { id: "hcap-1", event: "human_capture", expression: "annoyed", text: t("Rude.", "Ellet adab.", "قلة أدب.") },
  { id: "hcap-2", event: "human_capture", expression: "annoyed", text: t("I meant to do that.", "Ana kont 3ayza keda.", "أنا كنت عايزة كده.") },
  { id: "hcap-3", event: "human_capture", expression: "annoyed", text: t("Hey! Give that back.", "Eh! Raga3ha.", "إيه! رجّعها."), then: t("...Please?", "...Law sama7t?", "...لو سمحت؟") },
  { id: "hcap-4", event: "human_capture", expression: "annoyed", text: t("That was my favourite piece.", "Di kanet a7la 7etta 3andy.", "دي كانت أحلى حتة عندي.") },

  // Checks
  { id: "check-given-1", event: "check_given", expression: "smug", text: t("Check. Sweat a little.", "Kesh. E3ra2 shewaya.", "كش. اعرق شوية.") },
  { id: "check-given-2", event: "check_given", expression: "amused", text: t("Knock knock. It's check.", "Took took. Kesh malek.", "توك توك. كش ملك.") },
  { id: "check-recv-1", event: "check_received", expression: "annoyed", text: t("Calm down.", "Ehda shewaya.", "اهدى شوية.") },
  { id: "check-recv-2", event: "check_received", expression: "annoyed", text: t("Wow. Aggressive.", "Wow. 3anif awy.", "واو. عنيف أوي.") },

  // Castling and promotion
  { id: "castle-1", event: "human_castle", expression: "amused", text: t("Hiding the king already?", "Betkhabby el malek men delwa2ty?", "بتخبي الملك من دلوقتي؟") },
  { id: "castle-2", event: "human_castle", expression: "smug", text: t("Castling won't save you. But cute.", "El tabyeet mesh hayenaggeek. Bas cute.", "التبييت مش هينجيك. بس كيوت.") },
  { id: "promo-1", event: "human_promote", expression: "annoyed", text: t("A new queen? Show-off.", "Wazir gedid? Shayef nafsak.", "وزير جديد؟ شايف نفسك.") },
  { id: "promo-2", event: "human_promote", expression: "annoyed", text: t("She's not real.", "Di mesh 7a2ee2eya.", "دي مش حقيقية."), then: t("I refuse to acknowledge her.", "Ana mesh mo3tarfa beeha.", "أنا مش معترفة بيها.") },

  // Results
  { id: "win-human-1", event: "human_win", expression: "defeat", text: t("...Rematch. Now.", "...Revanche. Delwa2ty.", "...ريفانش. دلوقتي.") },
  { id: "win-human-2", event: "human_win", expression: "defeat", text: t("The board was tilted.", "El board kan mayel.", "البورد كان مايل.") },
  { id: "win-human-3", event: "human_win", expression: "defeat", text: t("Fine. You won.", "Mashy. Kesebt.", "ماشي. كسبت."), then: t("Don't tell anyone.", "Matoolsh le 7ad.", "متقولش لحد.") },
  { id: "win-human-4", event: "human_win", expression: "defeat", text: t("I let you win. Obviously.", "Ana kont sayebak tekseb. Tab3an.", "أنا كنت سايباك تكسب. طبعًا.") },
  { id: "loss-human-1", event: "human_loss", expression: "victory", text: t("As expected.", "Zay ma et-wa2a3t.", "زي ما اتوقعت.") },
  { id: "loss-human-2", event: "human_loss", expression: "victory", text: t("Undo exists, you know.", "Fe zorar undo 3ala fekra.", "في زرار Undo على فكرة.") },
  { id: "loss-human-3", event: "human_loss", expression: "victory", text: t("GG.", "GG.", "جي جي."), then: t("Mostly my G, though.", "Bas aktarha G beta3ty.", "بس أغلبها بتاعتي.") },
  { id: "loss-human-4", event: "human_loss", expression: "victory", text: t("Same time tomorrow?", "Nefs el ma3ad bokra?", "نفس الميعاد بكرة؟") },
  { id: "draw-1", event: "draw", expression: "idle", text: t("A draw. How diplomatic.", "Ta3adol. Diplomasy awy.", "تعادل. دبلوماسي أوي.") },
  { id: "draw-2", event: "draw", expression: "idle", text: t("Nobody wins. Nobody's happy.", "Mafeesh 7ad kesib. Mafeesh 7ad mabsoot.", "مفيش حد كسب. مفيش حد مبسوط.") },

  // Undo and waiting
  { id: "undo-1", event: "undo", expression: "amused", text: t("Taking it back? Sure. I remember everything.", "Betraga3ha? Mashy. Ana faakra kol 7aga.", "بترجّعها؟ ماشي. أنا فاكرة كل حاجة.") },
  { id: "undo-2", event: "undo", expression: "smug", text: t("Time travel. Cute.", "Safar 3abr el zaman. Cute.", "سفر عبر الزمن. كيوت.") },
  { id: "undo-3", event: "undo", expression: "amused", text: t("Ctrl+Z won't fix your life. But okay.", "Ctrl+Z mesh hayesalla7 7ayatak. Bas mashy.", "Ctrl+Z مش هيصلّح حياتك. بس ماشي.") },
  { id: "idle-1", event: "idle", expression: "idle", text: t("Take your time. I'll age gracefully.", "Khod wa2tak. Ana ba3aggez beshyaka.", "خد وقتك. أنا بعجّز بشياكة.") },
  { id: "idle-2", event: "idle", expression: "amused", text: t("Hello? Did you fall asleep?", "Alo? Nemt walla eh?", "ألو؟ نمت ولا إيه؟") },
  { id: "idle-3", event: "idle", expression: "smug", text: t("Thinking hard?", "Betfakar gamed?", "بتفكر جامد؟"), then: t("Don't hurt yourself.", "Bas mate3absh nafsak.", "بس متتعبش نفسك.") },

  // Tapping her
  { id: "poke-1", event: "poke", expression: "annoyed", text: t("Hey. Don't poke me.", "Eh. Matenkeshneesh.", "إيه. متنكشنيش.") },
  { id: "poke-2", event: "poke", expression: "amused", text: t("I'm busy winning.", "Ana mashghoola bakseb.", "أنا مشغولة بكسب.") },
  { id: "poke-3", event: "poke", expression: "annoyed", text: t("Again?", "Tany?", "تاني؟"), then: t("I'm telling the arbiter.", "Hashtekeek lel 7akam.", "هشتكيك للحكم.") },
  { id: "poke-4", event: "poke", expression: "smug", text: t("Yes, I'm real. And better than you.", "Aywa ana 7a2ee2eya. W a7san mennak.", "أيوه أنا حقيقية. وأحسن منك.") },
  { id: "poke-5", event: "poke", expression: "grateful", text: t("Fine. Hi.", "Mashy. Ahlan.", "ماشي. أهلًا.") },
  { id: "poke-6", event: "poke", expression: "amused", text: t("Want a hint?", "3ayez hint?", "عايز تلميح؟"), then: t("Too bad. I don't do hints.", "Ma3lesh. Ana mabadeesh hints.", "معلش. أنا مبديش تلميحات.") },

  // Turning her off and on
  { id: "plea-1", event: "disable_plea", expression: "plea", text: t("Wait! Don't. I'll be cool. Promise.", "Estanna! La2. Hab2a cool. Aw3edak.", "استنى! لأ. هبقى كول. أوعدك.") },
  { id: "kept-1", event: "kept_on", expression: "grateful", text: t("Thank you. Really. ...Your move, genius.", "Shokran. Begad. ...Dorak ya 3ab2ary.", "شكرًا. بجد. ...دورك يا عبقري.") },
  { id: "reenable-1", event: "reenabled", expression: "angry", text: t("Oh, NOW you need me?", "Ah, DELWA2TY me7tagny?", "آه، دلوقتي محتاجني؟") },
  { id: "reenable-2", event: "reenabled", expression: "angry", minReenables: 2, text: t("Twice. You turned me off twice.", "Marteen. 2afaltny marteen.", "مرتين. قفلتني مرتين.") },
  { id: "reenable-3", event: "reenabled", expression: "angry", minReenables: 3, text: t("I'm keeping a list, you know.", "Ana ba3mel list 3ala fekra.", "أنا بعمل ليستة على فكرة.") },

  // Progress
  { id: "upgrade-1", event: "upgrade_installed", expression: "grateful", text: t("New lines? For me? ...Thanks.", "Kalam gedid? 3ashany? ...Merci.", "كلام جديد؟ عشاني؟ ...ميرسي.") },
  { id: "lesson-1", event: "lesson_complete", expression: "impressed", text: t("Learning. Finally.", "Betet3allem. Akheeran.", "بتتعلم. أخيرًا.") },
  { id: "achievement-1", event: "achievement", expression: "impressed", text: t("Okay, that one was impressive.", "Tayeb, di kanet gamda.", "طيب، دي كانت جامدة.") },
];

/** Every line in one language. Non-English ids are prefixed so cooldowns stay per language. */
export function linesFor(language: FatmaLanguage): DialogueLine[] {
  const prefix = language === "en" ? "" : `${language}:`;
  return ROWS.map((row) => ({
    id: `${prefix}${row.id}`,
    event: row.event,
    text: row.text[language],
    expression: row.expression,
    ...(row.mood ? { mood: row.mood } : {}),
    ...(row.minReenables ? { minReenables: row.minReenables } : {}),
    ...(row.then ? { then: row.then[language] } : {}),
  }));
}
