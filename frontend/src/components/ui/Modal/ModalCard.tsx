'use client';

import React from 'react';
import styles from './ModalCard.module.css';

interface ModalCardProps {
  size?: 'sm' | 'md' | 'lg';
  padding?: string | number;
  overflowVisible?: boolean;
  children: React.ReactNode;
}

export default function ModalCard({ size = 'sm', padding, overflowVisible = false, children }: ModalCardProps) {
  const sizeClass = size === 'sm' ? styles.sizeSm : size === 'md' ? styles.sizeMd : styles.sizeLg;
  const overflowClass = overflowVisible ? styles.overflowVisible : '';

  return (
    <div className={`${styles.modalCard} ${sizeClass} ${overflowClass}`} style={{ padding }} onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}
