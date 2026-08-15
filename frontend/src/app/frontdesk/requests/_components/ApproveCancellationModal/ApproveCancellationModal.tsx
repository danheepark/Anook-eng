'use client';

import React, { useState } from 'react';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import Button from '@/components/ui/Button/Button';
import { useTranslation } from '@/app/useTranslation';
import styles from './ApproveCancellationModal.module.css';

import useApproveCancellation from './useApproveCancellation';

export interface ApproveCancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: number;
  onSuccess?: () => void;
}

export default function ApproveCancellationModal({
  isOpen,
  onClose,
  requestId,
  onSuccess,
}: ApproveCancellationModalProps) {
  const { language } = useTranslation();
  const { approveCancellation, loading } = useApproveCancellation();

  const handleApprove = async () => {
    const success = await approveCancellation(requestId);
    if (success) {
      onClose();
      if (onSuccess) onSuccess();
    }
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalCard size="sm" onClose={onClose}>
        <div className={styles.textWrapper}>
          <h2 className={styles.title}>{language === 'ko' ? '취소 승인' : 'Approve Cancellation'}</h2>
          <p className={styles.subtitle}>
            {language === 'ko'
              ? '이 요청의 취소를 승인하시겠습니까? 요청이 즉시 취소 처리됩니다.'
              : 'Are you sure you want to approve this cancellation? The request will be cancelled immediately.'}
          </p>
        </div>

        <div className={styles.buttonGroup}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {language === 'ko' ? '아니오' : 'No'}
          </Button>
          <Button variant="primary" onClick={handleApprove} disabled={loading}>
            {language === 'ko' ? '승인하기' : 'Approve'}
          </Button>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
