import { formatPrice, type Bouquet, type Occasion } from "@/components/shop/products";
import type { FinderInput, FinderResult } from "./bouquet-finder.shared";

/**
 * Rule-based bouquet matching for when the AI florist is unavailable (no LOVABLE_API_KEY,
 * credits ran out, gateway down). It only ever chooses from `candidates`, which
 * `pickCandidates` has already limited to the shopper's budget.
 */

// Checked in this order, so "sorry for your loss" is sympathy before "sorry" reads as an apology.
const OCCASION_CUES: [Occasion, RegExp][] = [
  [
    "sympathy",
    /sympathy|condolence|funeral|memorial|passed away|passing|bereave|griev|grief|lost (?:her|his|their|my|our)|loss\b|rest in peace|\brip\b/i,
  ],
  [
    "anniversary",
    /anniversar|romanc|romantic|valentine|\blove\b|wife|husband|girlfriend|boyfriend|fianc|partner|date night|propos|wedding|engage/i,
  ],
  [
    "birthday",
    /birthday|b-?day|turning \d+|\d+(?:st|nd|rd|th)\b|celebrat|congrat|graduat|promotion|new job|new baby/i,
  ],
  [
    "just-because",
    /just because|cheer|thank|grateful|apolog|sorry|miss you|thinking of|get well|recover|surprise|treat/i,
  ],
];

const COLOUR_CUES: [RegExp, string[]][] = [
  [
    /\b(?:bright|vibrant|colou?rful|bold|happy|sunny)/i,
    ["yellow", "orange", "coral", "sunny", "candy"],
  ],
  [/\b(?:soft|pastel|gentle|subtle|muted)/i, ["soft", "pale", "blush", "cream", "dusty"]],
  [/\b(?:white|ivory)/i, ["white", "cream"]],
  [/\b(?:pink|blush)/i, ["pink", "blush"]],
  [/\b(?:yellow|gold)/i, ["yellow", "golden", "buttery"]],
  [/\b(?:orange|coral|peach)/i, ["orange", "coral", "peach"]],
  [/\bblue/i, ["blue"]],
  [/\b(?:neutral|earthy|rustic|boho)/i, ["cream", "wheat", "dusty"]],
];

/** Words that say nothing about which stems the shopper wants. */
const FILLER = new Set(
  "with some very like that this them they want would prefer please also more less anything else flower bouquet colour color scent nice lovely really just maybe mostly".split(
    " ",
  ),
);

const HEADLINES: Record<Occasion, string> = {
  birthday: "A bright bouquet for their big day",
  anniversary: "Romance, hand-tied for the two of you",
  sympathy: "Calm, gentle and quietly respectful",
  "just-because": "A little joy, just because",
};

const CARD_NOTES: Record<Occasion, string> = {
  birthday: "Happy birthday! Wishing you a year as bright and joyful as these blooms.",
  anniversary: "Every year with you is my favourite. Happy anniversary, my love.",
  sympathy: "Thinking of you and holding you close in these difficult days.",
  "just-because": "No reason at all — just thinking of you and wanted to make you smile.",
};

/** "Peonies" → "peony", "lilies" → "lily", "roses" → "rose": enough to match catalog stems. */
function stem(word: string): string {
  const w = word.toLowerCase().trim();
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith("es") && /(?:ss|sh|ch|x)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1);
  return w;
}

/** Meaningful, singularised words; stemming both sides keeps "ranunculus" matching itself. */
function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+/g) ?? [])
    .map(stem)
    .filter((w) => w.length >= 4 && !FILLER.has(w));
}

/** Flowers the shopper asked to leave out: "no lilies", "avoid roses", "allergic to pollen". */
function avoidedWords(text: string): Set<string> {
  const avoided = new Set<string>();
  const pattern = /\b(?:no|not|avoid|without|except|hate|allergic to|nothing)\s+([a-z]+)/gi;
  for (const match of text.matchAll(pattern)) if (match[1]) avoided.add(stem(match[1]));
  return avoided;
}

/** ["a", "b", "c"] → "a, b and c". */
function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export function detectOccasion(text: string): Occasion | null {
  for (const [occasion, cue] of OCCASION_CUES) if (cue.test(text)) return occasion;
  return null;
}

function bouquetWords(b: Bouquet): Set<string> {
  return new Set(words(`${b.name} ${b.flowers.join(" ")} ${b.palette} ${b.blurb}`));
}

export function matchBouquet<T extends Bouquet>(
  candidates: readonly T[],
  input: FinderInput,
  overBudget: boolean,
): FinderResult {
  const text = `${input.occasion}. ${input.flowers}`;
  const occasion = detectOccasion(text);
  const avoided = avoidedWords(text);
  const wanted = words(input.flowers).filter((w) => !avoided.has(w));
  const colours = COLOUR_CUES.filter(([cue]) => cue.test(text)).flatMap(([, hints]) => hints);
  // Condolences call for calm colours even when the shopper doesn't say so.
  if (occasion === "sympathy") colours.push("white", "cream", "soft", "pale");

  const scored = candidates.map((b) => {
    const detailWords = bouquetWords(b);
    const matchedFlowers = wanted.filter((w) => detailWords.has(w));
    let score = 0;
    if (occasion && b.occasions.includes(occasion)) score += 4;
    // Never send a bright party bouquet to a funeral.
    if (occasion === "sympathy" && !b.occasions.includes("sympathy")) score -= 3;
    score += 3 * new Set(matchedFlowers).size;
    score += 1.5 * colours.filter((c) => b.palette.toLowerCase().includes(c)).length;
    // "No lilies" outranks everything else the shopper said.
    if ([...avoided].some((w) => detailWords.has(w))) score -= 20;
    // Small nudge towards a fuller bouquet that still fits the budget.
    score += Math.min(1, b.price / Math.max(1, input.budget));
    return { b, score, matchedFlowers: [...new Set(matchedFlowers)] };
  });
  scored.sort((x, y) => y.score - x.score);

  const best = scored[0];
  if (!best) throw new Error("matchBouquet needs at least one candidate");
  const alternate = scored.find((s) => s.b.id !== best.b.id);
  const mood = occasion ?? best.b.occasions[0] ?? "just-because";

  // Quote the catalog's own stem names ("ranunculus"), not the singularised match words.
  const askedFor = best.b.flowers.filter((f) =>
    words(f).some((w) => best.matchedFlowers.includes(w)),
  );
  const asked = askedFor.length > 0 ? ` — including the ${joinList(askedFor)} you asked for` : "";
  const value = overBudget
    ? `It's ${formatPrice(best.b.price)}.`
    : `At ${formatPrice(best.b.price)} it sits within your ${formatPrice(input.budget)} budget.`;

  return {
    bestId: best.b.id,
    alternateId: alternate ? alternate.b.id : null,
    headline: HEADLINES[mood],
    reason: `${best.b.name} by ${best.b.maker} brings ${joinList(best.b.flowers.slice(0, 3))} in ${best.b.palette}${asked}. ${value}`,
    cardNote: CARD_NOTES[mood],
    overBudget,
  };
}
