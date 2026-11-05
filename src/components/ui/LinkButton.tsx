import React from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import './Button.css';

/**
 * A link that looks like a button.
 *
 * Use this instead of <Link><Button/></Link>: putting a <button> inside an <a>
 * is invalid HTML, so keyboards and screen readers meet two controls where
 * there should be one. This renders a single <a> with the button styles.
 */
interface LinkButtonProps extends LinkProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'text' | 'light' | 'outline-light' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const LinkButton: React.FC<LinkButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth,
  leftIcon,
  rightIcon,
  className = '',
  ...props
}) => (
  <Link
    className={['btn', `btn-${variant}`, `btn-${size}`, fullWidth ? 'btn-full-width' : '', className].filter(Boolean).join(' ')}
    {...props}
  >
    {leftIcon && <span className="btn-icon-left" aria-hidden="true">{leftIcon}</span>}
    <span className="btn-content">{children}</span>
    {rightIcon && <span className="btn-icon-right" aria-hidden="true">{rightIcon}</span>}
  </Link>
);
