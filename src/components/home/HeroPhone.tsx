import React, { useEffect, useState } from 'react';
import { BadgeCheck, Check, MapPin, Star, Zap, Droplets, Eraser, ChefHat, Shirt } from 'lucide-react';
import './HeroPhone.css';

/**
 * The hero's phone: plays the real booking flow instead of a static picture.
 *
 * Built as markup, not a video: a few KB, sharp at any density, never buffers on a
 * dropping connection, and can't drift out of date like a screen recording. The story
 * matches what Lezerv does today (see Terms.tsx): a request, a verified artisan accepts,
 * the price is agreed in chat, a start code at the door, then a rating. No in-app card
 * payment is shown because there isn't one yet.
 *
 * Accessibility: the phone is one role="img" whose label narrates the whole story; the
 * screens inside are aria-hidden so a screen reader hears it once. The dots are real
 * buttons with 44px hit areas; using one stops the auto-advance. Reduced motion holds
 * the first step until the visitor picks another.
 */

const STEPS = ['Request', 'Matched', 'Price', 'Start code', 'Done'] as const;
const STEP_MS = 3000;

const STORY =
  'A Lezerv booking: you request AC servicing in Lekki Phase 1; Emeka, a verified artisan ' +
  '2.1 km away, accepts; you agree ₦25,000 in chat; when he arrives you give him your ' +
  '4-digit start code; the job is done and you rate it five stars.';

export const HeroPhone: React.FC = () => {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!auto || reduce) return;
    const t = window.setInterval(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS);
    return () => window.clearInterval(t);
  }, [auto]);

  const pick = (i: number) => { setAuto(false); setStep(i); };
  const on = (i: number) => (step === i ? ' is-on' : '');

  return (
    <div className="hp">
      <div className="hp-phone" role="img" aria-label={STORY}>
        <div className="hp-notch" />
        <div className="hp-screen" aria-hidden="true">
          <div className="hp-status"><span>9:41</span><span className="hp-dots-sig" /></div>

          {/* 1. Request */}
          <div className={`hp-scene${on(0)}`}>
            <p className="hp-eyebrow">What do you need?</p>
            <div className="hp-chips">
              <span className="hp-chip"><Eraser size={13} />Cleaning</span>
              <span className="hp-chip"><Droplets size={13} />Water</span>
              <span className="hp-chip hp-chip-on"><Zap size={13} />Power &amp; AC</span>
              <span className="hp-chip"><ChefHat size={13} />Cooking</span>
              <span className="hp-chip"><Shirt size={13} />Laundry</span>
            </div>
            <div className="hp-card">
              <p className="hp-card-title">AC not cooling</p>
              <p className="hp-muted"><MapPin size={12} /> Lekki Phase 1 · Today, 4pm</p>
            </div>
            <span className="hp-btn">Send request</span>
          </div>

          {/* 2. Matched */}
          <div className={`hp-scene${on(1)}`}>
            <p className="hp-eyebrow">Your request was accepted</p>
            <div className="hp-card hp-artisan">
              <span className="hp-avatar">EO</span>
              <div>
                <p className="hp-card-title">Emeka O. <BadgeCheck size={14} className="hp-verified" /></p>
                <p className="hp-muted"><Star size={11} className="hp-star" /> 4.9 · 2.1 km away</p>
              </div>
            </div>
            <div className="hp-map">
              <span className="hp-pin hp-pin-you" />
              <span className="hp-pin hp-pin-artisan" />
              <span className="hp-route" />
            </div>
            <p className="hp-tag"><BadgeCheck size={12} /> ID-checked by Lezerv</p>
          </div>

          {/* 3. Price in chat */}
          <div className={`hp-scene${on(2)}`}>
            <p className="hp-eyebrow">Chat with Emeka</p>
            <p className="hp-bubble hp-them">Gas top-up and full service: ₦25,000</p>
            <p className="hp-bubble hp-me">Okay, see you at 4pm</p>
            <p className="hp-system"><Check size={12} /> Price agreed · ₦25,000</p>
          </div>

          {/* 4. Start code */}
          <div className={`hp-scene${on(3)}`}>
            <p className="hp-eyebrow">Emeka is at your door</p>
            <div className="hp-code">
              {'4827'.split('').map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <p className="hp-muted hp-center">Give your start code only when the artisan you booked is in front of you.</p>
          </div>

          {/* 5. Done */}
          <div className={`hp-scene${on(4)}`}>
            <span className="hp-done"><Check size={28} /></span>
            <p className="hp-card-title hp-center">Job complete</p>
            <p className="hp-muted hp-center">How did Emeka do?</p>
            <div className="hp-stars">
              {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={20} style={{ animationDelay: `${i * 90}ms` }} />)}
            </div>
          </div>
        </div>
      </div>

      <div className="hp-float hp-float-a" aria-hidden="true"><BadgeCheck size={16} /> Verified artisans</div>
      <div className="hp-float hp-float-b" aria-hidden="true"><Check size={16} /> Price agreed before work</div>

      <div className="hp-steps" aria-label="Booking steps">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            className="hp-step"
            aria-label={label}
            aria-current={step === i ? 'step' : undefined}
            onClick={() => pick(i)}
          >
            <span />
          </button>
        ))}
      </div>
    </div>
  );
};
