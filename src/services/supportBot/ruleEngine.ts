import type { IBotAnswer, IBotEngine } from './types';
import { knowledgeBase, ESCALATE_ACTION } from './knowledgeBase';
import type { IKbEntry } from './knowledgeBase';

/**
 * Rule-based answer engine.
 *
 * Scores the user's question against every knowledge-base entry and
 * answers only when the match is strong enough to be trustworthy. A weak
 * match becomes "did you mean…"; no match becomes a handoff to a human.
 * Guessing would be worse than admitting we don't know.
 */

/** Function words carry no intent — dropped from both sides before overlap. */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'i', 'im', 'my', 'me', 'we', 'our', 'us', 'is', 'are', 'am',
  'was', 'were', 'be', 'been', 'do', 'does', 'did', 'to', 'for', 'of', 'on', 'in',
  'at', 'it', 'its', 'this', 'that', 'these', 'those', 'you', 'your', 'yours',
  'and', 'or', 'but', 'if', 'so', 'as', 'with', 'from', 'by', 'will', 'would',
  'can', 'could', 'should', 'shall', 'may', 'might', 'have', 'has', 'had',
  'please', 'thanks', 'there', 'here', 'any', 'some', 'now', 'just', 'also',
]);

/**
 * Spelling and colloquial normalisation, applied per token. Covers the
 * misspellings we see most plus common Nigerian-English phrasing.
 */
const SYNONYMS: Record<string, string> = {
  // typos
  artizan: 'artisan', artisian: 'artisan', atisan: 'artisan', artsan: 'artisan',
  plumer: 'plumber', plummer: 'plumber', electrican: 'electrician',
  cancle: 'cancel', cancelled: 'cancel', canceling: 'cancel', cancelling: 'cancel',
  refuund: 'refund', refunds: 'refund', payed: 'paid', paymnt: 'payment',
  bookin: 'booking', servces: 'services', servicess: 'services',
  acount: 'account', acct: 'account', pasword: 'password', pwd: 'password',
  // shorthand
  u: 'you', ur: 'your', pls: 'please', plz: 'please', abeg: 'please',
  info: 'information', msg: 'message', num: 'number',
  // Nigerian English
  wetin: 'what', naira: 'price', kobo: 'price',
  // plurals / variants that should collapse
  prices: 'price', pricing: 'price', costs: 'cost', charges: 'charge',
  fees: 'fee', rates: 'rate', jobs: 'job', artisans: 'artisan',
  areas: 'area', reviews: 'review', ratings: 'rating', payments: 'payment',
  complaints: 'complain', complaint: 'complain', complaining: 'complain',
};

/** Strip punctuation/accents and collapse whitespace. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Very light stemming so tense and number don't block a match
 * ("showed"/"show", "booking"/"book"). Applied to both the question and
 * the stored phrasings, so the two sides always agree.
 */
function stem(token: string): string {
  if (token.length >= 6) {
    if (token.endsWith('ing')) return token.slice(0, -3);
    if (token.endsWith('ed')) return token.slice(0, -2);
  }
  return token;
}

/** Content tokens: normalised, synonym-folded, stemmed, stop-words removed. */
function tokenise(text: string): string[] {
  return normalise(text)
    .split(' ')
    .filter(Boolean)
    .map((t) => SYNONYMS[t] ?? t)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    .map(stem);
}

/** True when `a` and `b` differ by at most one edit. Guards against typos. */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.length - short.length > 1) return false;
  // Only fuzzy-match words long enough that one edit isn't a different word.
  if (short.length < 5) return false;

  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (short.length === long.length) {
      i += 1;
      j += 1;
    } else {
      j += 1; // skip the extra character in the longer word
    }
  }
  return edits + (long.length - j) + (short.length - i) <= 1;
}

/** True when `target` appears among `tokens`, tolerating a single typo. */
function hasToken(tokens: string[], target: string): boolean {
  return tokens.some((t) => withinOneEdit(t, target));
}

// ── Scoring ─────────────────────────────────────────────────────────
const WEIGHT_KEYWORD = 3;   // a decisive word — the strongest signal
const WEIGHT_PATTERN = 6;   // how much of a known phrasing was reproduced
const WEIGHT_PHRASE = 5;    // the question is essentially a known one
/** Below this the phrase bonus is noise ("job" sits inside many patterns). */
const MIN_PHRASE_CHARS = 10;
/** A phrasing needs at least this many content words to be discriminating. */
const MIN_PATTERN_TOKENS = 2;

/** Answer outright. */
const CONFIDENT = 0.5;
/** Suggest likely questions instead of asserting an answer. */
const UNSURE = 0.2;

interface IScored {
  entry: IKbEntry;
  score: number;
  confidence: number;
}

/**
 * How well one knowledge-base entry matches the question.
 *
 * Three signals, weighted by how much they actually tell us:
 *   - a decisive keyword hit (strongest — these are what identify a topic);
 *   - how much of a known phrasing the question reproduces;
 *   - whether the question essentially *is* a known phrasing.
 *
 * Unbounded on purpose; `toConfidence` does the squashing.
 */
function scoreEntry(entry: IKbEntry, query: string, tokens: string[]): number {
  let score = 0;

  // 1. Decisive keywords. Run them through the same pipeline as the
  //    question so stemming and synonyms line up on both sides — a raw
  //    "hiring" would never meet the stemmed token "hir".
  for (const keyword of entry.keywords) {
    const keywordTokens = tokenise(keyword);
    if (keywordTokens.length === 0) continue;

    const hit = keyword.includes(' ')
      // Multi-word: the literal phrase, or all of its content words present.
      ? query.includes(keyword) || keywordTokens.every((kt) => hasToken(tokens, kt))
      : hasToken(tokens, keywordTokens[0]);
    if (hit) score += WEIGHT_KEYWORD;
  }

  // 2. Best overlap against any known phrasing of this question.
  let bestRatio = 0;
  let phraseHit = false;
  for (const pattern of entry.patterns) {
    const patternTokens = tokenise(pattern);
    // A phrasing that survives stop-word removal as a single word ("what
    // can you do" -> ["what"]) discriminates nothing: it would full-match
    // every question containing that word. Such patterns only ever count
    // through the phrase bonus below.
    if (patternTokens.length >= MIN_PATTERN_TOKENS) {
      const matched = patternTokens.filter((pt) => hasToken(tokens, pt)).length;
      // Scale by how much evidence there is, not just the proportion —
      // one word out of one is a far weaker signal than three out of three.
      const evidence = Math.min(1, matched / MIN_PATTERN_TOKENS);
      bestRatio = Math.max(bestRatio, (matched / patternTokens.length) * evidence);
    }

    if (query.length >= MIN_PHRASE_CHARS) {
      const normalisedPattern = normalise(pattern);
      if (normalisedPattern.includes(query) || query.includes(normalisedPattern)) {
        phraseHit = true;
      }
    }
  }
  score += bestRatio * WEIGHT_PATTERN;
  if (phraseHit) score += WEIGHT_PHRASE;

  return score;
}

/** Squash an unbounded score into 0–1 without a hard ceiling. */
function toConfidence(score: number): number {
  return score <= 0 ? 0 : score / (score + 6);
}

/**
 * Every entry that matched at all, best first. An empty result means the
 * question shared nothing with the knowledge base — straight to a human.
 */
function rank(question: string): IScored[] {
  const query = normalise(question);
  const tokens = tokenise(question);
  if (tokens.length === 0) return [];

  return knowledgeBase
    .map((entry) => {
      const score = scoreEntry(entry, query, tokens);
      return { entry, score, confidence: toConfidence(score) };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

// ── Small talk ──────────────────────────────────────────────────────
const GREETINGS = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'howfar', 'hola'];
const THANKS = ['thanks', 'thank', 'thankyou', 'appreciate', 'nice', 'awesome', 'ok', 'okay', 'cool'];
const FAREWELLS = ['bye', 'goodbye', 'later', 'thats all', 'that is all', 'no thanks'];

const DEFAULT_SUGGESTIONS = [
  'How do I book a service?',
  'How much does it cost?',
  'Which areas do you cover?',
  'How do I become an artisan?',
];

/**
 * Handle greetings, thanks and goodbyes before scoring, so "hi" opens a
 * conversation rather than being escalated as an unanswerable question.
 * Returns null when the input is not small talk.
 */
function smallTalk(question: string): IBotAnswer | null {
  const query = normalise(question);
  if (!query) return null;
  const words = query.split(' ');
  const isShort = words.length <= 4;

  const matches = (list: string[]) =>
    list.some((phrase) => (phrase.includes(' ') ? query.includes(phrase) : words.includes(phrase)));

  if (isShort && matches(FAREWELLS)) {
    return {
      id: 'smalltalk-bye',
      text: 'Anytime. If anything else comes up, I am right here — and I can always put you through to a human.',
      confidence: 1,
      actions: [],
      followUps: [],
      resolved: true,
      topic: 'smalltalk',
    };
  }

  if (isShort && matches(THANKS)) {
    return {
      id: 'smalltalk-thanks',
      text: 'You are welcome. Anything else I can help with?',
      confidence: 1,
      actions: [],
      followUps: DEFAULT_SUGGESTIONS.slice(0, 3),
      resolved: true,
      topic: 'smalltalk',
    };
  }

  if (isShort && matches(GREETINGS)) {
    return {
      id: 'smalltalk-greeting',
      text: 'Hello! I am the Lezerv assistant. I can help you book a service, find an artisan, check prices, or sort out an account problem.\n\nWhat do you need?',
      confidence: 1,
      actions: [],
      followUps: DEFAULT_SUGGESTIONS,
      resolved: true,
      topic: 'smalltalk',
    };
  }

  return null;
}

// ── Answer assembly ─────────────────────────────────────────────────
function fromEntry(entry: IKbEntry, confidence: number): IBotAnswer {
  return {
    id: entry.id,
    text: entry.answer,
    confidence,
    actions: entry.actions ?? [],
    followUps: entry.followUps ?? [],
    // Topics that inherently need a person stay "unresolved" so the widget
    // keeps the handoff on offer even though we did answer.
    resolved: !entry.alwaysOfferHuman,
    topic: entry.topic,
  };
}

/**
 * The honest dead end: say we don't know, offer a human, and surface any
 * near-misses so the user can self-serve if one of them is what they meant.
 */
function unresolved(suggestions: string[], topic: string | null): IBotAnswer {
  return {
    id: 'unresolved',
    text:
      'I could not find a confident answer to that, and I would rather not guess.\n\nI can hand you over to a Lezerv human who will sort it out properly — or try one of these:',
    confidence: 0,
    actions: [{ label: 'Talk to our team', to: ESCALATE_ACTION }],
    followUps: suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS,
    resolved: false,
    topic,
  };
}

/**
 * Pick readable "did you mean" prompts from the near-misses — the first
 * pattern of each candidate, sentence-cased.
 */
function suggestionsFrom(scored: IScored[]): string[] {
  return scored
    .slice(0, 3)
    .map((s) => s.entry.patterns[0])
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1) + '?');
}

export const ruleEngine: IBotEngine = {
  name: 'lezerv-kb',

  // The knowledge base is stateless, so history is not consulted here —
  // the parameter stays in `IBotEngine` for engines that would use it.
  async answer(question: string): Promise<IBotAnswer> {
    const small = smallTalk(question);
    if (small) return small;

    const scored = rank(question);
    if (scored.length === 0) return unresolved([], null);

    const top = scored[0];
    if (top.confidence >= CONFIDENT) {
      return fromEntry(top.entry, top.confidence);
    }

    if (top.confidence >= UNSURE) {
      // Close enough to guess at, not close enough to assert.
      return {
        id: 'ambiguous',
        text: 'I want to make sure I answer the right thing. Did you mean one of these?',
        confidence: top.confidence,
        actions: [{ label: 'None of these — talk to a human', to: ESCALATE_ACTION }],
        followUps: suggestionsFrom(scored),
        resolved: false,
        topic: top.entry.topic,
      };
    }

    return unresolved(suggestionsFrom(scored), top.entry.topic);
  },
};
