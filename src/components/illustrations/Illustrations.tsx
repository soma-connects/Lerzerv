import React from 'react';
import { motion } from 'framer-motion';
import './Illustrations.css';

/**
 * Lezerv's illustrations, drawn as SVG (shapes described in code) so they are
 * tiny to download, stay sharp on every screen and can move. The movement is
 * CSS animation (classes starting "il-", see Illustrations.css) plus a few
 * framer-motion touches that play when the drawing scrolls into view.
 *
 * Rule for animating SVG with CSS: an element that already has a transform=""
 * attribute must not also get an animation class (the animation would replace
 * it), so moving parts sit in their own <g> inside the positioned one.
 */

const C = {
  green: '#0e6e2f', deep: '#0b5a27', leaf: '#4fae6e', leafDark: '#2f8a4f', mint: '#e2f3e7', mint2: '#cdeed9',
  overalls: '#187a42', bib: '#22914f', trousers: '#1d3b2a',
  amber: '#f5a623', amberDeep: '#c97b12', amberDark: '#b86d0e', sun: '#f5c779',
  ink: '#13261a', wall: '#fffaf0', wallShade: '#f1e7d3', sky: '#cfe8f3',
  steel: '#8b877e', steelLight: '#d9d3c6', tank: '#22332b', tankRidge: '#33473d',
  panel: '#2b4a5e', panelLine: '#4b6b80', skin: '#7a4a2b', skinDark: '#5e3720', white: '#ffffff',
};

/** A 4-point sparkle centred on (x, y). */
const Sparkle: React.FC<{ x: number; y: number; r?: number; fill?: string; delay?: string }> = ({ x, y, r = 6, fill = C.sun, delay }) => (
  <path
    className="il-twinkle"
    style={delay ? { animationDelay: delay } : undefined}
    d={`M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`}
    fill={fill}
  />
);

const sunRays = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  return { x1: 500 + 44 * Math.cos(a), y1: 92 + 44 * Math.sin(a), x2: 500 + 56 * Math.cos(a), y2: 92 + 56 * Math.sin(a) };
});

/** The home page hero: a Nigerian home, its machines running, an artisan arriving. */
export const HeroScene: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={`il il-hero ${className}`} viewBox="0 0 600 460" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="il-blob" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#e9f6ec" />
        <stop offset="1" stopColor="#d2edda" />
      </linearGradient>
      <clipPath id="il-solar-clip"><polygon points="366,156 430,204 438,194 374,146" /></clipPath>
    </defs>

    {/* soft background shape that slowly breathes */}
    <path className="il-breathe" d="M310 38C430 38 528 118 526 232C524 350 430 430 306 430C182 430 78 352 80 232C82 118 190 38 310 38Z" fill="url(#il-blob)" />

    {/* sun with turning rays */}
    <g className="il-spin-slow">
      {sunRays.map((r, i) => <line key={i} {...r} stroke={C.sun} strokeWidth="6" strokeLinecap="round" />)}
    </g>
    <circle cx="500" cy="92" r="32" fill={C.sun} />
    <circle cx="490" cy="84" r="9" fill="#fbe0a6" />

    {/* drifting clouds */}
    <g className="il-drift">
      <circle cx="132" cy="96" r="16" fill={C.white} />
      <circle cx="154" cy="86" r="22" fill={C.white} />
      <circle cx="178" cy="97" r="15" fill={C.white} />
      <rect x="120" y="96" width="72" height="16" rx="8" fill={C.white} />
    </g>
    <g className="il-drift il-drift-slow">
      <circle cx="388" cy="56" r="9" fill={C.white} />
      <circle cx="402" cy="50" r="13" fill={C.white} />
      <rect x="380" y="55" width="40" height="10" rx="5" fill={C.white} />
    </g>

    {/* two birds crossing the sky */}
    <g className="il-fly-across">
      <path d="M0 150q5-6 10 0q5-6 10 0" stroke={C.ink} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.55" />
      <path d="M22 140q4-5 8 0q4-5 8 0" stroke={C.ink} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.4" />
    </g>

    {/* ground */}
    <ellipse cx="310" cy="398" rx="262" ry="20" fill="#cfe9d7" />

    {/* generator, humming, with exhaust puffs */}
    <circle className="il-puff" cx="154" cy="328" r="6" fill={C.steelLight} />
    <circle className="il-puff" style={{ animationDelay: '0.8s' }} cx="154" cy="328" r="6" fill={C.steelLight} />
    <circle className="il-puff" style={{ animationDelay: '1.6s' }} cx="154" cy="328" r="6" fill={C.steelLight} />
    <g className="il-buzz">
      <rect x="150" y="334" width="8" height="14" rx="2" fill={C.steel} />
      <path d="M100 346v-8h48v8" stroke={C.ink} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="88" y="346" width="72" height="42" rx="7" fill={C.amber} />
      <rect x="98" y="356" width="30" height="20" rx="3" fill={C.amberDeep} />
      <rect x="102" y="361" width="10" height="3" rx="1.5" fill={C.sun} />
      <rect x="102" y="367" width="18" height="3" rx="1.5" fill={C.sun} />
      <circle cx="143" cy="366" r="6" fill={C.ink} />
      <circle cx="143" cy="366" r="2.5" fill={C.amber} />
      <circle cx="100" cy="390" r="6" fill={C.ink} />
      <circle cx="148" cy="390" r="6" fill={C.ink} />
    </g>

    {/* AC outdoor unit with a spinning fan */}
    <rect x="178" y="388" width="8" height="6" rx="2" fill={C.steel} />
    <rect x="220" y="388" width="8" height="6" rx="2" fill={C.steel} />
    <rect x="174" y="344" width="58" height="46" rx="6" fill="#f6f4ee" stroke={C.steelLight} strokeWidth="2" />
    <circle cx="198" cy="367" r="15" fill="#e7e2d8" />
    <g className="il-spin-fast">
      <ellipse cx="198" cy="359" rx="4" ry="8" fill="#b9b2a4" />
      <ellipse cx="198" cy="359" rx="4" ry="8" fill="#b9b2a4" transform="rotate(120 198 367)" />
      <ellipse cx="198" cy="359" rx="4" ry="8" fill="#b9b2a4" transform="rotate(240 198 367)" />
    </g>
    <circle cx="198" cy="367" r="3" fill={C.steel} />
    {[355, 363, 371, 379].map((y) => <line key={y} x1="218" y1={y} x2="226" y2={y} stroke={C.steelLight} strokeWidth="2" strokeLinecap="round" />)}

    {/* the house */}
    <rect x="240" y="214" width="200" height="176" rx="8" fill={C.wall} />
    <rect x="240" y="214" width="200" height="16" fill={C.wallShade} />
    <polygon points="224,226 340,138 456,226" fill={C.deep} stroke={C.deep} strokeWidth="10" strokeLinejoin="round" />
    <polyline points="250,214 340,148 430,214" fill="none" stroke={C.green} strokeWidth="5" strokeLinejoin="round" opacity="0.6" />

    {/* solar panel with a light glint sweeping across */}
    <polygon points="366,156 430,204 438,194 374,146" fill={C.panel} />
    <line x1="387" y1="172" x2="395" y2="162" stroke={C.panelLine} strokeWidth="1.5" />
    <line x1="409" y1="188" x2="417" y2="178" stroke={C.panelLine} strokeWidth="1.5" />
    <g clipPath="url(#il-solar-clip)">
      <g className="il-glint">
        <rect x="340" y="130" width="12" height="90" fill={C.white} opacity="0.55" transform="rotate(37 346 175)" />
      </g>
    </g>

    {/* windows */}
    {[262, 372].map((x) => (
      <g key={x}>
        <rect x={x} y="262" width="46" height="40" rx="5" fill={C.sky} />
        <rect x={x} y="262" width="46" height="40" rx="5" fill="none" stroke={C.white} strokeWidth="3" />
        <line x1={x + 23} y1="262" x2={x + 23} y2="302" stroke={C.white} strokeWidth="3" />
        <line x1={x} y1="282" x2={x + 46} y2="282" stroke={C.white} strokeWidth="3" />
        <rect x={x - 3} y="301" width="52" height="5" rx="2.5" fill={C.wallShade} />
      </g>
    ))}

    {/* door with a little light above */}
    <circle className="il-twinkle il-twinkle-soft" cx="340" cy="290" r="4" fill={C.sun} />
    <rect x="317" y="300" width="46" height="90" rx="5" fill={C.amberDeep} />
    <rect x="323" y="308" width="34" height="32" rx="3" fill={C.amberDark} />
    <rect x="323" y="346" width="34" height="36" rx="3" fill={C.amberDark} />
    <circle cx="354" cy="348" r="3" fill={C.sun} />
    <rect x="309" y="388" width="62" height="5" rx="2.5" fill="#c9bfa9" />

    {/* water tank on its stand */}
    <line x1="480" y1="262" x2="476" y2="396" stroke={C.steel} strokeWidth="5" strokeLinecap="round" />
    <line x1="530" y1="262" x2="534" y2="396" stroke={C.steel} strokeWidth="5" strokeLinecap="round" />
    <line x1="478" y1="300" x2="532" y2="350" stroke={C.steel} strokeWidth="3" strokeLinecap="round" />
    <line x1="532" y1="300" x2="478" y2="350" stroke={C.steel} strokeWidth="3" strokeLinecap="round" />
    <rect x="468" y="256" width="74" height="8" rx="3" fill={C.steel} />
    <rect x="475" y="194" width="60" height="64" rx="14" fill={C.tank} />
    {[212, 228, 244].map((y) => <line key={y} x1="477" y1={y} x2="533" y2={y} stroke={C.tankRidge} strokeWidth="3" />)}
    <ellipse cx="505" cy="196" rx="18" ry="5" fill={C.tankRidge} />
    <path d="M475 246H452V300H440" stroke={C.steel} strokeWidth="4" fill="none" strokeLinejoin="round" />

    {/* bushes */}
    <g className="il-sway">
      <circle cx="450" cy="383" r="11" fill={C.leaf} />
      <circle cx="462" cy="377" r="13" fill={C.leafDark} />
    </g>
    <g className="il-sway" style={{ animationDelay: '1s' }}>
      <circle cx="62" cy="384" r="12" fill={C.leafDark} />
      <circle cx="76" cy="379" r="14" fill={C.leaf} />
    </g>

    {/* location pin dropping onto the roof */}
    <ellipse className="il-ring" cx="340" cy="134" rx="16" ry="5" fill="none" stroke={C.amber} strokeWidth="3" />
    <g transform="translate(340 96)">
      <g className="il-pin">
        <path d="M0-26C-15-26-24-15-24-3C-24 12 0 30 0 30S24 12 24-3C24-15 15-26 0-26Z" fill={C.amber} />
        <circle cx="0" cy="-3" r="9" fill={C.white} />
        <circle cx="0" cy="-3" r="4" fill={C.green} />
      </g>
    </g>

    {/* the artisan, walking up with a toolbox */}
    <ellipse cx="279" cy="395" rx="22" ry="4" fill={C.ink} opacity="0.12" />
    <g transform="translate(262 316) scale(0.72)">
      <g className="il-bob">
        <line x1="12" y1="30" x2="6" y2="58" stroke={C.skinDark} strokeWidth="9" strokeLinecap="round" />
        <rect x="12" y="70" width="11" height="36" rx="5" fill={C.trousers} />
        <rect x="26" y="70" width="11" height="36" rx="5" fill={C.trousers} />
        <rect x="9" y="102" width="17" height="8" rx="4" fill={C.ink} />
        <rect x="25" y="102" width="19" height="8" rx="4" fill={C.ink} />
        <rect x="6" y="22" width="38" height="54" rx="13" fill={C.overalls} />
        <rect x="13" y="30" width="24" height="20" rx="5" fill={C.bib} />
        <rect x="18" y="34" width="13" height="10" rx="2" fill={C.white} />
        <circle cx="21.5" cy="39" r="2" fill={C.green} />
        <rect x="20" y="13" width="10" height="11" fill={C.skin} />
        <circle cx="19" cy="9" r="3" fill={C.skinDark} />
        <circle cx="25" cy="8" r="14" fill={C.skin} />
        <path d="M11 4a14 13 0 0 1 28 0Z" fill={C.green} />
        <rect x="30" y="1" width="16" height="5" rx="2.5" fill={C.deep} />
        <circle cx="32" cy="9" r="1.8" fill={C.ink} />
        <path d="M29 15q4 3 8-1" stroke={C.ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <line x1="38" y1="30" x2="46" y2="56" stroke={C.skin} strokeWidth="9" strokeLinecap="round" />
        <g className="il-swing">
          <path d="M40 62v-6h16v6" stroke={C.ink} strokeWidth="3" fill="none" strokeLinejoin="round" />
          <rect x="33" y="61" width="30" height="20" rx="3" fill={C.amber} />
          <rect x="33" y="68" width="30" height="4" fill={C.amberDeep} />
        </g>
      </g>
    </g>

    <Sparkle x={86} y={210} r={7} />
    <Sparkle x={560} y={300} r={6} fill={C.leaf} delay="0.9s" />
  </svg>
);

/** Step 1: a phone with the request form, a paper plane flying off. */
export const RequestArt: React.FC = () => (
  <svg className="il il-step" viewBox="0 0 200 130" aria-hidden="true" focusable="false">
    <circle cx="100" cy="70" r="56" fill={C.mint} />
    <path className="il-dash" d="M126 94Q166 84 170 34" stroke={C.amber} strokeWidth="2.5" strokeDasharray="4 6" fill="none" strokeLinecap="round" />
    <rect x="66" y="8" width="64" height="114" rx="12" fill={C.ink} />
    <rect x="71" y="18" width="54" height="96" rx="6" fill={C.white} />
    <rect x="88" y="11" width="20" height="3" rx="1.5" fill="#2f4436" />
    <rect x="76" y="24" width="30" height="5" rx="2.5" fill={C.green} />
    <rect x="76" y="35" width="44" height="11" rx="3" fill="#efebe3" />
    <rect x="79" y="39" width="22" height="3" rx="1.5" fill="#c9c2b4" />
    <rect x="76" y="51" width="44" height="11" rx="3" fill="#efebe3" />
    <rect x="79" y="55" width="16" height="3" rx="1.5" fill="#c9c2b4" />
    <rect x="76" y="67" width="44" height="18" rx="3" fill="#efebe3" />
    <rect x="76" y="92" width="44" height="13" rx="6.5" fill={C.green} />
    <rect x="88" y="97" width="20" height="3" rx="1.5" fill={C.white} opacity="0.85" />
    <g transform="translate(166 30)">
      <g className="il-float">
        <path d="M-12 6L14-8L2 10Z" fill={C.amber} />
        <path d="M-12 6L14-8L-2 3Z" fill={C.amberDeep} />
      </g>
    </g>
    <Sparkle x={36} y={34} r={6} />
    <Sparkle x={172} y={108} r={5} fill={C.leaf} delay="1s" />
  </svg>
);

/** Step 2: an ID card that gets a "verified" tick when it scrolls into view. */
export const VerifiedArt: React.FC = () => (
  <svg className="il il-step" viewBox="0 0 200 130" aria-hidden="true" focusable="false">
    <circle cx="100" cy="70" r="56" fill={C.mint} />
    <g className="il-float il-float-slow">
      <rect x="28" y="32" width="132" height="84" rx="12" fill={C.white} stroke="#e3ddd2" strokeWidth="2" />
      <path d="M28 44a12 12 0 0 1 12-12h108a12 12 0 0 1 12 12v6H28Z" fill={C.green} />
      <rect x="40" y="38" width="34" height="5" rx="2.5" fill={C.white} opacity="0.8" />
      <circle cx="62" cy="84" r="19" fill={C.mint} />
      <circle cx="62" cy="79" r="7" fill={C.green} />
      <path d="M49 98q13-14 26 0" fill={C.green} />
      <rect x="90" y="66" width="54" height="6" rx="3" fill="#d9d3c6" />
      <rect x="90" y="79" width="40" height="6" rx="3" fill="#e7e2d8" />
      <rect x="90" y="92" width="48" height="6" rx="3" fill={C.mint2} />
    </g>
    <circle className="il-ring" cx="158" cy="36" r="18" fill="none" stroke={C.leaf} strokeWidth="3" />
    <motion.g
      initial={{ scale: 0 }}
      whileInView={{ scale: 1 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.3 }}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
    >
      <circle cx="158" cy="36" r="19" fill={C.green} stroke={C.white} strokeWidth="4" />
      <motion.path
        d="M149 36l6 6 12-12"
        stroke={C.white}
        strokeWidth="4.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.4, delay: 0.65 }}
      />
    </motion.g>
  </svg>
);

/** Step 3: the front door and a start code being typed in, digit by digit. */
export const StartCodeArt: React.FC = () => (
  <svg className="il il-step" viewBox="0 0 200 130" aria-hidden="true" focusable="false">
    <circle cx="100" cy="70" r="56" fill={C.mint} />
    <rect x="30" y="14" width="70" height="112" rx="6" fill="#e9e4da" />
    <rect x="37" y="20" width="56" height="106" rx="4" fill={C.amberDeep} />
    <rect x="44" y="30" width="42" height="34" rx="3" fill={C.amberDark} />
    <rect x="44" y="72" width="42" height="44" rx="3" fill={C.amberDark} />
    <circle cx="84" cy="76" r="3.5" fill={C.sun} />
    <g className="il-float il-float-slow">
      <path d="M118 80l-8 13 20-13Z" fill={C.white} />
      <rect x="108" y="32" width="84" height="50" rx="12" fill={C.white} stroke="#e3ddd2" strokeWidth="2" />
      <text x="120" y="49" className="il-text-small" fill={C.steel}>Start code</text>
      {['4', '8', '2', '1'].map((d, i) => (
        <text key={i} x={121 + i * 17} y="71" className="il-text-code il-type" style={{ animationDelay: `${i * 0.35}s` }} fill={C.green}>{d}</text>
      ))}
    </g>
    <Sparkle x={168} y={106} r={6} />
    <Sparkle x={22} y={40} r={5} fill={C.leaf} delay="0.7s" />
  </svg>
);

/** Safety: a shield whose tick draws itself, with a slow orbit around it. */
export const SafetyArt: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={`il il-safety ${className}`} viewBox="0 0 220 200" aria-hidden="true" focusable="false">
    <circle cx="110" cy="100" r="92" fill={C.mint} />
    <g className="il-spin-slow">
      <circle cx="110" cy="100" r="80" fill="none" stroke={C.mint2} strokeWidth="2.5" strokeDasharray="4 9" />
      <circle cx="190" cy="100" r="7" fill={C.amber} />
      <circle cx="70" cy="169" r="6" fill={C.leaf} />
      <circle cx="70" cy="31" r="5" fill={C.green} />
    </g>
    <g className="il-float il-float-slow">
      <path d="M110 30L162 48V98C162 134 138 156 110 170C82 156 58 134 58 98V48Z" fill={C.green} />
      <path d="M110 30L162 48V98C162 134 138 156 110 170Z" fill={C.deep} opacity="0.35" />
      <path d="M110 44L150 58V98C150 126 132 144 110 156C88 144 70 126 70 98V58Z" fill="none" stroke={C.white} strokeOpacity="0.25" strokeWidth="3" />
      <motion.path
        d="M88 100l15 15 30-33"
        stroke={C.white}
        strokeWidth="11"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
      />
    </g>
    <Sparkle x={40} y={70} r={7} />
    <Sparkle x={182} y={150} r={6} fill={C.leaf} delay="1.1s" />
  </svg>
);

/** "Are you an artisan?" card: a toolbox with a wrench that wiggles. Drawn for a dark green background. */
export const ToolboxArt: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={`il ${className}`} viewBox="0 0 160 120" aria-hidden="true" focusable="false">
    <g className="il-wiggle">
      <g transform="rotate(-18 50 70)">
        <rect x="45" y="22" width="10" height="50" rx="4" fill="#dfe9e2" />
        <circle cx="50" cy="20" r="12" fill="#dfe9e2" />
        <circle cx="50" cy="13" r="5.5" fill={C.deep} />
      </g>
    </g>
    <g transform="rotate(16 110 66)">
      <rect x="106" y="40" width="5" height="28" fill="#dfe9e2" />
      <rect x="102" y="16" width="13" height="26" rx="5" fill={C.sun} />
    </g>
    <path d="M62 58V48h36v10" stroke={C.amberDeep} strokeWidth="6" fill="none" strokeLinejoin="round" />
    <rect x="30" y="56" width="100" height="54" rx="9" fill={C.amber} />
    <rect x="30" y="56" width="100" height="16" rx="8" fill="#e8950f" />
    <rect x="73" y="64" width="14" height="12" rx="2" fill={C.amberDeep} />
    <Sparkle x={140} y={30} r={7} fill={C.sun} />
    <Sparkle x={18} y={50} r={5} fill="#c4ebd0" delay="0.8s" />
  </svg>
);

/** "Refer & earn" card: a gift box whose lid hops, with confetti. */
export const GiftArt: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={`il ${className}`} viewBox="0 0 160 120" aria-hidden="true" focusable="false">
    {[
      { x: 52, c: C.green, dx: '-14px', d: '0s' },
      { x: 70, c: C.amberDeep, dx: '-4px', d: '0.15s' },
      { x: 90, c: C.leaf, dx: '6px', d: '0.05s' },
      { x: 108, c: C.green, dx: '16px', d: '0.2s' },
    ].map((p, i) => (
      <rect key={i} className="il-confetti" x={p.x} y="40" width="6" height="6" rx="1.5" fill={p.c}
        style={{ animationDelay: p.d, ['--dx' as string]: p.dx } as React.CSSProperties} />
    ))}
    <rect x="40" y="60" width="80" height="52" rx="6" fill={C.green} />
    <rect x="40" y="60" width="80" height="52" rx="6" fill={C.deep} opacity="0.2" />
    <rect x="74" y="60" width="12" height="52" fill={C.amber} />
    <g className="il-hop">
      <rect x="34" y="46" width="92" height="18" rx="5" fill={C.overalls} />
      <rect x="74" y="46" width="12" height="18" fill={C.amber} />
      <ellipse cx="70" cy="41" rx="12" ry="7" fill={C.amber} transform="rotate(-25 70 41)" />
      <ellipse cx="90" cy="41" rx="12" ry="7" fill={C.amber} transform="rotate(25 90 41)" />
      <circle cx="80" cy="44" r="5" fill={C.amberDeep} />
    </g>
    <Sparkle x={24} y={40} r={7} fill={C.amber} />
    <Sparkle x={140} y={70} r={6} fill={C.green} delay="1s" />
  </svg>
);
