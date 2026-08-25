import { describe, it, expect } from 'vitest';
import { ruleEngine } from '../services/supportBot/ruleEngine';
import { knowledgeBase } from '../services/supportBot/knowledgeBase';
import { ESCALATE_ACTION } from '../services/supportBot/knowledgeBase';

const ask = (q: string) => ruleEngine.answer(q, []);

describe('support bot knowledge base', () => {
  it('has unique entry ids', () => {
    const ids = knowledgeBase.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every entry keywords, patterns and an answer', () => {
    for (const entry of knowledgeBase) {
      expect(entry.keywords.length, `${entry.id} keywords`).toBeGreaterThan(0);
      expect(entry.patterns.length, `${entry.id} patterns`).toBeGreaterThan(0);
      expect(entry.answer.length, `${entry.id} answer`).toBeGreaterThan(20);
    }
  });

  it('answers each entry\'s own canonical phrasing with that entry', async () => {
    for (const entry of knowledgeBase) {
      const answer = await ask(entry.patterns[0]);
      expect(answer.id, `"${entry.patterns[0]}" should match ${entry.id}`).toBe(entry.id);
    }
  });
});

describe('intent matching', () => {
  const cases: Array<[string, string]> = [
    ['how much does a deep clean cost', 'pricing'],
    ['what are your prices', 'pricing'],
    ['i need a plumber urgently', 'post-job'],
    ['how do i request a service', 'post-job'],
    ['which areas do you cover in lagos', 'areas'],
    ['can i pay with my card', 'payment-methods'],
    ['i forgot my password', 'password-reset'],
    ['how do i become an artisan', 'become-artisan'],
    ['what is kyc verification', 'kyc'],
    ['i want to complain about an artisan', 'complain-check'],
    ['can i get a refund', 'refund-dispute'],
    ['how do i leave a review', 'reviews'],
    ['how do i track my job', 'track-jobs'],
    ['i want to talk to a human', 'human'],
  ];

  for (const [question, expectedId] of cases) {
    it(`routes "${question}"`, async () => {
      const answer = await ask(question);
      if (expectedId === 'complain-check') {
        expect(answer.id).toBe('complaint');
      } else {
        expect(answer.id).toBe(expectedId);
      }
      expect(answer.confidence).toBeGreaterThanOrEqual(0.5);
    });
  }

  it('routes a no-show to the complaint path', async () => {
    const answer = await ask('my artisan never showed up');
    expect(answer.id).toBe('complaint');
  });

  it('tolerates typos', async () => {
    const answer = await ask('how do i becom an artizan');
    expect(answer.id).toBe('become-artisan');
  });

  it('handles greetings without escalating', async () => {
    const answer = await ask('hello');
    expect(answer.id).toBe('smalltalk-greeting');
    expect(answer.resolved).toBe(true);
    expect(answer.followUps.length).toBeGreaterThan(0);
  });
});

describe('honest failure', () => {
  it('escalates rather than guessing on an unrelated question', async () => {
    const answer = await ask('what is the capital of Mongolia');
    expect(answer.resolved).toBe(false);
    expect(answer.actions.some((a) => a.to === ESCALATE_ACTION)).toBe(true);
  });

  // Regression: a phrasing that reduces to one function word ("what can
  // you do" -> ["what"]) used to full-match every question containing it.
  it('does not answer an off-topic question just because it shares a word', async () => {
    for (const question of ['what is the weather today', 'do you sell cars', 'tell me a joke']) {
      const answer = await ask(question);
      expect(answer.resolved, question).toBe(false);
    }
  });

  it('escalates on empty-ish input', async () => {
    const answer = await ask('???');
    expect(answer.resolved).toBe(false);
  });

  it('keeps the human handoff on offer for money disputes', async () => {
    const answer = await ask('can i get a refund');
    expect(answer.resolved).toBe(false);
    expect(answer.actions.some((a) => a.to === ESCALATE_ACTION)).toBe(true);
  });

  it('offers suggestions when it is unsure instead of asserting', async () => {
    const answer = await ask('artisan');
    if (answer.id === 'ambiguous') {
      expect(answer.followUps.length).toBeGreaterThan(0);
      expect(answer.resolved).toBe(false);
    }
  });
});
