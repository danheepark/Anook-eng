'use client';

import React from 'react';
import styles from './ConfirmModal.module.css';
import ModalOverlay from './ModalOverlay';
import ModalCard from './ModalCard';
import { AttentionIcon, CancelIcon } from '@/components/icons';
import Button from '@/components/ui/Button/Button';
import { useTranslation } from '@/app/useTranslation';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  subtitle?: string;
  status?: 'default' | 'danger';
  requireCheckbox?: boolean;
  checkboxLabel?: string;
  cancelText?: string;
  confirmText?: string;
  hideCancel?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  status = 'default',
  requireCheckbox = false,
  checkboxLabel,
  cancelText,
  confirmText,
  hideCancel = false,
}: ConfirmModalProps) {
  const { t } = useTranslation();

  const finalCancelText = cancelText || t.common.cancel || '취소';
  const finalConfirmText = confirmText || t.common.confirm || '확인';

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalCard size="sm">
        {/* 상단바 (status===danger일때만) */}
        {status === 'danger' && (
          <div className={styles.topBar}>
            <AttentionIcon />
            <CancelIcon style={{ cursor: 'pointer', color: 'var(--color-gray-500)' }} onClick={onClose} />
          </div>
        )}

        {/* 텍스트 영역 */}
        <div className={styles.textWrapper}>
          <h2 className={styles.title}>{title}</h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>


        {/* 버튼 그룹 */}
        <div className={styles.buttonGroup}>
          {!hideCancel && (
            <Button variant="secondary" style={{ flex: 1, padding: 0 }} onClick={onClose}>
              {finalCancelText}
            </Button>
          )}
          <Button
            variant={status === 'danger' ? 'danger' : 'primary'}
            style={{ flex: 1, padding: 0 }}
            onClick={onConfirm}
          >
            {finalConfirmText}
          </Button>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
