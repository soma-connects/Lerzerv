import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

vi.mock('framer-motion', () => {
  return {
    motion: {
      div: React.forwardRef(({ children, ...props }: any, ref: any) => {
        const {
          initial,
          animate,
          exit,
          transition,
          whileHover,
          whileTap,
          viewport,
          whileInView,
          ...rest
        } = props;
        return React.createElement('div', { ref, ...rest }, children);
      }),
      section: React.forwardRef(({ children, ...props }: any, ref: any) => {
        const {
          initial,
          animate,
          exit,
          transition,
          whileHover,
          whileTap,
          viewport,
          whileInView,
          ...rest
        } = props;
        return React.createElement('section', { ref, ...rest }, children);
      }),
    },
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
  };
});
