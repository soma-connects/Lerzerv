import React from 'react';
import './BrandLogo.css';

/**
 * The Lezerv emblem + wordmark.
 * tone="dark"  → dark text, for light backgrounds (header)
 * tone="light" → white text, for dark backgrounds (footer). The emblem sits
 *                on a white tile there, because its green disappears on green.
 */
export const BrandLogo: React.FC<{ tone?: 'dark' | 'light' }> = ({ tone = 'dark' }) => (
  <span className={`brand brand-${tone}`}>
    <span className="brand-mark">
      <img src="/brand/lezerv-mark-96.png" alt="" width={48} height={48} />
    </span>
    <span className="brand-word">Lezerv</span>
  </span>
);
