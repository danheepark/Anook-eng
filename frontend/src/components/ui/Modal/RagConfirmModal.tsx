'use client';

import React from 'react';
import styles from './RagConfirmModal.module.css';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import { CancelIcon } from '@/components/icons';
import Button from '@/components/ui/Button/Button';
import { useTranslation } from '@/app/useTranslation';

export interface RagConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onLater: () => void;
  onSkip: () => void;
  onCancel: () => void;
}

export default function RagConfirmModal({
  isOpen,
  onConfirm,
  onLater,
  onSkip,
  onCancel,
}: RagConfirmModalProps) {
  const { t } = useTranslation();

  return (
    <ModalOverlay isOpen={isOpen} onClose={onCancel}>
      <ModalCard 
        size="sm"
        onClose={onCancel}
        title={t.chatPanel?.registerAiKnowledgeTitle as string || 'AI 지식 등록'}
        subtitle={t.chatPanel?.registerAiKnowledgeDesc as string || '이 상담 내용을 AI 지식 데이터로 등록하시겠습니까? 등록하면 AI가 동일한 질문에 자동으로 답변할 수 있습니다.'}
      >
        <div className={styles.buttonGroup}>
          <Button variant="primary" onClick={onConfirm} style={{ width: '100%' }}>
            {t.chatPanel?.registerNow || '지금 등록하기'}
          </Button>
          <Button variant="secondary" onClick={onLater} style={{ width: '100%' }}>
            {t.chatPanel?.registerLater || '나중에 하기'}
          </Button>
          <Button variant="ghost" onClick={onSkip} style={{ width: '100%' }}>
            {t.chatPanel?.doNotRegister || '등록하지 않기'}
          </Button>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
