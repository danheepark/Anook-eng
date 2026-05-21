import React, { ButtonHTMLAttributes } from 'react';
import styles from './GlassButton.module.css';

export interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'cancel' | 'primary';
  domainCode?: string;
  fullWidth?: boolean;
}

export default function GlassButton({
  variant = 'default',
  domainCode,
  fullWidth = false,
  className = '',
  children,
  style,
  ...props
}: GlassButtonProps) {
  const baseClass = styles.glassBtn;
  const variantClass = variant === 'cancel' ? styles.cancelBtn : variant === 'primary' ? styles.primaryBtn : '';
  const widthClass = fullWidth ? styles.fullWidth : '';

  const customStyle = variant === 'primary' && domainCode ? {
    ...style,
    '--btn-bg': `color-mix(in srgb, color-mix(in srgb, var(--color-dept-${domainCode.toLowerCase()}-bg, rgba(255, 255, 255, 0.8)) 90%, var(--color-dept-${domainCode.toLowerCase()}-text, var(--color-gray-900))) 60%, transparent)`,
    '--btn-bg-hover': `color-mix(in srgb, color-mix(in srgb, var(--color-dept-${domainCode.toLowerCase()}-bg, rgba(255, 255, 255, 0.8)) 90%, var(--color-dept-${domainCode.toLowerCase()}-text, var(--color-gray-900))) 75%, transparent)`,
    '--btn-bg-active': `color-mix(in srgb, color-mix(in srgb, var(--color-dept-${domainCode.toLowerCase()}-bg, rgba(255, 255, 255, 0.8)) 90%, var(--color-dept-${domainCode.toLowerCase()}-text, var(--color-gray-900))) 45%, transparent)`,
    '--btn-text': `var(--color-dept-${domainCode.toLowerCase()}-text, var(--color-gray-900))`,
  } as React.CSSProperties : style;

  return (
    <button
      className={`${baseClass} ${variantClass} ${widthClass} ${className}`}
      style={customStyle}
      {...props}
    >
      <span className={styles.btnText}>{children}</span>
    </button>
  );
}
