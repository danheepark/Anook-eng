import React from 'react';
import styles from './QuickActionCards.module.css';

export interface QuickActionCardProps {
  domain: 'HK' | 'FB' | 'CONCIERGE' | 'FACILITY' | 'FRONT';
  icon: React.ElementType;
  line1: string;
  line2: string;
  onClick: () => void;
  disabled?: boolean;
}

export default function QuickActionCard({
  domain,
  icon: Icon,
  line1,
  line2,
  onClick,
  disabled = false,
}: QuickActionCardProps) {
  const cardBgClass = styles[`cardBg${domain}`] || styles.cardBgHK;
  const bgClass = styles[`bg${domain}`] || styles.bgHK;

  return (
    <button
      className={`glass-panel ${styles.card} ${cardBgClass}`}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      <div className={`${styles.iconContainer} ${bgClass}`}>
        <Icon size={20} />
      </div>
      <div className={styles.textWrapper}>
        <span className={styles.line}>{line1}</span>
        <span className={styles.line}>{line2}</span>
      </div>
    </button>
  );
}
