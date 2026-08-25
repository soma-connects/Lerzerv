/**
 * Shared contracts for the support bot.
 *
 * The widget talks to an `IBotEngine` and nothing else. Today the only
 * implementation is the rule-based `ruleEngine` (a curated Lezerv
 * knowledge base, no API keys, no per-message cost). Swapping in an
 * AI-backed engine later means implementing this one interface — the
 * UI, the escalation flow and the ticket schema stay untouched.
 */

export type TBotRole = 'user' | 'bot';

export interface IBotMessage {
  role: TBotRole;
  text: string;
  /** ISO timestamp — travels with the ticket transcript. */
  at: string;
}

/** A link the bot offers inline: either an in-app route or an external URL. */
export interface IBotAction {
  label: string;
  /** Router path (`/post-job`) or absolute URL when `external` is true. */
  to: string;
  external?: boolean;
}

export interface IBotAnswer {
  /** Knowledge-base entry id, or `unresolved` when nothing matched. */
  id: string;
  text: string;
  /** 0–1. Drives whether we answer, disambiguate, or hand off. */
  confidence: number;
  /** Where the user can go next. */
  actions: IBotAction[];
  /** Tappable follow-up questions. */
  followUps: string[];
  /**
   * False means the bot could not answer — the widget then offers the
   * handoff to a human instead of pretending it helped.
   */
  resolved: boolean;
  /** Coarse subject, stored on the ticket so admins can triage. */
  topic: string | null;
}

export interface IBotEngine {
  /** Identifies the engine in transcripts and logs. */
  readonly name: string;
  /**
   * Answer a question. `history` is the conversation so far, oldest
   * first, so an engine can use context (the rule engine mostly does not;
   * an AI engine would).
   */
  answer(question: string, history: IBotMessage[]): Promise<IBotAnswer>;
}
