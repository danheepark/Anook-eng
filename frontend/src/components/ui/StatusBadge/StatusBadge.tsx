import React from 'react';
import styles from './StatusBadge.module.css';

export interface TagProps {
  // 의미론적(Semantic) 색상 배지 지정
  variant?: 'red' | 'orange' | 'purple' | 'green' | 'gray' | 'hk' | 'fb' | 'facility' | 'concierge' | 'front' | 'emergency';
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function StatusBadge({ variant = 'gray', children, className = '', style }: TagProps) {
  // variant 이름이 그대로 styles 객체의 클래스 이름(red, purple 등)으로 매핑됩니다.
  return (
    <span style={style} className={`${styles.tag} ${styles[variant] || styles.gray} ${className}`.trim()}>
      {children}
    </span>
  );
}
