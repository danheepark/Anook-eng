'use client';

import React, { useState } from 'react';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import Button from '@/components/ui/Button/Button';
import InputField from '@/components/ui/Inputfield/InputField';
import { useTranslation } from '@/app/useTranslation';
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
  const { language } = useTranslation();
  const [reason, setReason] = useState('');
  const { rejectEscalation, loading } = useRejectEscalation();
  const showToast = useUiStore((s) => s.showToast);

  const handleReject = async () => {
    if (!reason.trim()) {
      showToast(language === 'ko' ? '고객에게 안내할 반려 사유를 입력해주세요.' : 'Please enter the reason for rejection to inform the guest.', 'error');
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
        title={language === 'ko' ? '에스컬레이션 반려 및 고객 안내' : 'Reject Escalation & Notify Guest'}
        subtitle={language === 'ko'
          ? '요청 처리가 불가하여 반려합니다. 작성하신 사유는 고객의 대화창(상담 화면)으로 자동 전송됩니다.'
          : 'The request cannot be fulfilled and will be rejected. The reason entered will be automatically sent to the guest chat.'}
      >

        <div className={styles.inputGroup}>
          <InputField
            as="textarea"
            label={language === 'ko' ? '반려 사유 (고객 전송용 메시지)' : 'Rejection Reason (Message to Guest)'}
            value={reason}
            onChange={(e: any) => setReason(e.target.value)}
            disabled={loading}
            placeholder={language === 'ko'
              ? '예: 죄송합니다. 현재 하우스키핑 부서의 재고가 모두 소진되어...'
              : 'e.g., We apologize, but current inventory for this item is depleted...'}
            rows={5}
          />
        </div>

        <div className={styles.buttonGroup}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {language === 'ko' ? '아니오' : 'No'}
          </Button>
          <Button variant="danger" onClick={handleReject} disabled={loading}>
            {language === 'ko' ? '반려 및 전송' : 'Reject & Send'}
          </Button>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
