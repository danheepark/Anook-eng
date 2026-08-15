'use client';

import React from 'react';
import styles from './PendingKnowledgeHeader.module.css';
import { useTranslation } from '@/app/useTranslation';

export interface PendingKnowledgeHeaderProps {
  allSelected?: boolean;
  onSelectAll?: (checked: boolean) => void;
  title?: string;
  deptLabel?: string;
}

export default function PendingKnowledgeHeader({
  allSelected = false,
  onSelectAll,
  title = 'Q&A',
  deptLabel,
}: PendingKnowledgeHeaderProps) {
  const { language } = useTranslation();
  const defaultDeptLabel = deptLabel || (language === 'en' ? 'Department' : '부서');

  return (
    <div className={styles.headerContainer}>
      <div className={styles.headerCheckbox}>
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => onSelectAll?.(e.target.checked)}
          className={styles.checkboxInput}
          aria-label={language === 'en' ? 'Select All' : '전체 선택'}
        />
      </div>

      <div className={styles.headerQA}>
        <span>{title}</span>
      </div>

      <div className={styles.headerDept}>
        <span>{defaultDeptLabel}</span>
      </div>

      <div className={styles.headerActionsPlaceholder} />
    </div>
  );
}
