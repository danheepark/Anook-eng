import React from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outlined' | 'ghost';
  size?: 'medium' | 'large';
  fullWidth?: boolean;
}

export default function Button({
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseClass = styles.btn;
  const variantClass = variant === 'primary'
    ? styles.primary
    : variant === 'secondary'
      ? styles.secondary
      : variant === 'outlined'
        ? styles.outlined
        : variant === 'ghost'
          ? styles.ghost
          : styles.danger;
  const sizeClass = size === 'large' ? styles.large : styles.medium;
  const fullWidthClass = fullWidth ? styles.fullWidth : '';


  return (
    <button
      className={`${baseClass} ${variantClass} ${sizeClass} ${fullWidthClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
