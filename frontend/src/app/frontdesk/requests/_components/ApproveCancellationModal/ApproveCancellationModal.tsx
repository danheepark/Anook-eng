'use client';

import React, { useState } from 'react';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import Button from '@/components/ui/Button/Button';
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
          <h2 className={styles.title}>취소 승인</h2>
          <p className={styles.subtitle}>이 요청의 취소를 승인하시겠습니까? 요청이 즉시 취소 처리됩니다.</p>
        </div>

        <div className={styles.buttonGroup}>
          <Button variant="secondary" style={{ flex: 1 }} onClick={onClose} disabled={loading}>
            아니오
          </Button>
          <Button variant="primary" style={{ flex: 1 }} onClick={handleApprove} disabled={loading}>
            승인하기
          </Button>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
