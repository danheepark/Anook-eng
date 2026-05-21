'use client';

import React, { useState } from 'react';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import Button from '@/components/ui/Button/Button';
import InputField from '@/components/ui/Inputfield/InputField';
import styles from './RejectEscalationModal.module.css';
import { useUiStore } from '@/stores/useUiStore';
import useRejectEscalation from './useRejectEscalation';

export interface RejectEscalationModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: number;
  onSuccess?: () => void;
}

export default function RejectEscalationModal({
  isOpen,
  onClose,
  requestId,
  onSuccess,
}: RejectEscalationModalProps) {
  const [reason, setReason] = useState('');
  const { rejectEscalation, loading } = useRejectEscalation();
  const showToast = useUiStore((s) => s.showToast);

  const handleReject = async () => {
    if (!reason.trim()) {
      showToast('고객에게 안내할 반려 사유를 입력해주세요.', 'error');
      return;
    }
    const success = await rejectEscalation(requestId, reason);
    if (success) {
      setReason('');
      onClose();
      if (onSuccess) onSuccess();
    }
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalCard
        size="md"
        onClose={onClose}
        title="에스컬레이션 반려 및 고객 안내"
        subtitle="요청 처리가 불가하여 반려합니다. 작성하신 사유는 고객의 대화창(상담 화면)으로 자동 전송됩니다."
      >

        <div className={styles.inputGroup}>
          <InputField
            as="textarea"
            label="반려 사유 (고객 전송용 메시지)"
            value={reason}
            onChange={(e: any) => setReason(e.target.value)}
            disabled={loading}
            placeholder="예: 죄송합니다. 현재 하우스키핑 부서의 재고가 모두 소진되어..."
            rows={5}
          />
        </div>

        <div className={styles.buttonGroup}>
          <Button variant="secondary" style={{ flex: 1 }} onClick={onClose} disabled={loading}>
            아니오
          </Button>
          <Button variant="danger" style={{ flex: 1 }} onClick={handleReject} disabled={loading}>
            반려 및 전송
          </Button>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
