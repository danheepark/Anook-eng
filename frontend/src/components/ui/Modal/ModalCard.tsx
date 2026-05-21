'use client';

import React from 'react';
import styles from './ModalCard.module.css';
import { CancelIcon } from '@/components/icons';

interface ModalCardProps {
  size?: 'sm' | 'md' | 'lg';
  overflowVisible?: boolean;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function ModalCard({
  size = 'sm',
  overflowVisible = false,
  onClose,
  title,
  subtitle,
  children,
}: ModalCardProps) {
  const sizeClass = size === 'sm' ? styles.sizeSm : size === 'md' ? styles.sizeMd : styles.sizeLg;
  const overflowClass = overflowVisible ? styles.overflowVisible : '';

  return (
    <div className={`${styles.modalCard} ${sizeClass} ${overflowClass}`} onClick={(e) => e.stopPropagation()}>
      {onClose && (
        <button className={styles.closeButton} onClick={onClose} aria-label="닫기">
          <CancelIcon />
        </button>
      )}
      {(title || subtitle) && (
        <div className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
