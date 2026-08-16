'use client';

import React from 'react';
import { ModalOverlay, ModalCard } from '@/components/ui/Modal';
import { Edit2 } from 'lucide-react';
import Button from '@/components/ui/Button/Button';
import styles from './KnowledgeModal.module.css';
import { useTranslation } from '@/app/useTranslation';

export interface KnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  domainCode: string;
  question: string;
  answer: string;
  updatedAt: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

function formatKnowledgeDateTime(dateVal?: string | Date, language: string = 'en') {
  if (!dateVal) return '';
  let date: Date;
  if (dateVal instanceof Date) {
    date = dateVal;
  } else {
    date = new Date(String(dateVal).replace(' ', 'T'));
  }
  if (isNaN(date.getTime())) return String(dateVal);

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const year = date.getFullYear();
  const timeStr = `${hours}:${minutes}`;

  if (language === 'ko') {
    return `${timeStr} ${year}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const day = date.getDate();
  return `${timeStr} ${month} ${day} ${year}`;
}

export default function KnowledgeModal({
  isOpen,
  onClose,
  domainCode,
  question,
  answer,
  updatedAt,
  onEdit,
  onDelete
}: KnowledgeModalProps) {
  const { t, language } = useTranslation();

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalCard
        size="md"
        onClose={onClose}
        title={question}
      >
        
        {/* Body */}
        <div className={styles.body}>
          <div className={styles.descriptionBox}>
            {answer}
          </div>
        </div>
        
        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.dateInfo}>
            <span className={styles.dateText}>
              {formatKnowledgeDateTime(updatedAt, language)}
            </span>
          </div>
          <div className={styles.actionButtons} style={{ display: 'flex', gap: 'var(--space-8)' }}>
            {onDelete && (
              <Button variant="danger" onClick={onDelete} className={styles.editBtn}>
                {(t.common as any)?.delete || '삭제'}
              </Button>
            )}
            <Button variant="primary" onClick={onEdit} className={styles.editBtn}>
              <Edit2 size={16} />
              {(t.common as any)?.edit || '수정'}
            </Button>
          </div>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
