import React from 'react';
import styles from './SummaryCard.module.css';

export interface SummaryCardProps {
  title: string;
  value: string | number;
  changeValue?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  size?: 'sm' | 'md';
  onClick?: () => void;
}

export default function SummaryCard({
  title,
  value,
  changeValue,
  changeType = 'neutral',
  size = 'md',
  onClick
}: SummaryCardProps) {
  const sizeClass = size === 'sm' ? styles.sm : styles.md;
  const clickableClass = onClick ? styles.clickable : '';
  return (
    <div className={`${styles.summaryCard} ${sizeClass} ${clickableClass}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      <span className={styles.title}>{title}</span>
      <div className={styles.bottomRow}>
        <span className={styles.value}>{value}</span>
        {changeValue && (
          <span className={`${styles.change} ${styles[changeType]}`}>
            {changeValue}
          </span>
        )}
      </div>
    </div>
  );
}
