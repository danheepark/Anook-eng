'use client';

import React from 'react';
import styles from './Tabs.module.css';

export interface TabOption {
  value: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  /** 출력할 탭 데이터 목록 */
  options: TabOption[];
  /** 현재 선택된 탭의 value */
  activeValue: string;
  onChange: (value: string) => void;
  className?: string;
  variant?: 'line' | 'pill';
}

export default function Tabs({
  options,
  activeValue,
  onChange,
  className = '',
  variant = 'line'
}: TabsProps) {
  const isPill = variant === 'pill';
  const containerClass = isPill ? styles.variantPill : styles.variantLine;

  return (
    <div className={`${styles.container} ${containerClass} ${className}`.trim()} role="tablist">
      {options.map((option) => {
        const isActive = option.value === activeValue;
        
        let tabClass = styles.tabButton;
        if (isPill) {
          tabClass += ` ${styles.pillTab} ${isActive ? styles.pillTabActive : ''}`;
        } else {
          tabClass += ` ${styles.lineTab} ${isActive ? styles.lineTabActive : ''}`;
        }

        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={isActive}
            className={tabClass.trim()}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={styles.countBadge}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
