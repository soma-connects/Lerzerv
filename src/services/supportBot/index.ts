import type { IBotEngine } from './types';
import { ruleEngine } from './ruleEngine';

export type { IBotAction, IBotAnswer, IBotEngine, IBotMessage, TBotRole } from './types';
export { ESCALATE_ACTION, WHATSAPP_URL } from './knowledgeBase';
export { ruleEngine } from './ruleEngine';

/**
 * The engine the widget uses. Swapping in an AI-backed engine later is a
 * one-line change here — everything downstream depends on `IBotEngine`.
 */
export const supportBotEngine: IBotEngine = ruleEngine;
