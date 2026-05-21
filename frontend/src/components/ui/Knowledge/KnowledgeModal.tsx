'use client';

import React from 'react';
import { ModalOverlay, ModalCard } from '@/components/ui/Modal';
import { Clock, Edit2 } from 'lucide-react';
import Button from '@/components/ui/Button/Button';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import styles from './KnowledgeModal.module.css';

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
  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalCard size="lg" onClose={onClose}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <StatusBadge variant="gray">{domainCode}</StatusBadge>
            <h2 className={styles.title}>{question}</h2>
          </div>
        </div>
        
        {/* Body */}
        <div className={styles.body}>
          <div className={styles.descriptionBox}>
            {answer}
          </div>
        </div>
        
        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.dateInfo}>
            <Clock size={16} className={styles.clockIcon} />
            <span className={styles.dateText}>최종 업데이트: {updatedAt}</span>
          </div>
          <div className={styles.actionButtons} style={{ display: 'flex', gap: 'var(--space-8)' }}>
            {onDelete && (
              <Button variant="danger" onClick={onDelete} className={styles.editBtn}>
                삭제
              </Button>
            )}
            <Button variant="primary" onClick={onEdit} className={styles.editBtn}>
              <Edit2 size={16} />
              정보 수정하기
            </Button>
          </div>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
