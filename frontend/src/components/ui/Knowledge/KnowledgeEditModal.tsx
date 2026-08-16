'use client';

import React, { useState } from 'react';
import { ModalOverlay, ModalCard } from '@/components/ui/Modal';
import Button from '@/components/ui/Button/Button';
import InputField from '@/components/ui/Inputfield/InputField';
import Dropdown from '@/components/ui/Dropdown/Dropdown';
import { ConfirmModal } from '@/components/ui/Modal';
import { useUiStore } from '@/stores/useUiStore';
import styles from './KnowledgeEditModal.module.css';
import { useTranslation } from '@/app/useTranslation';

export interface KnowledgeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'register' | 'edit';
  initialDomainCode?: string;
  initialQuestion?: string;
  initialAnswer?: string;
  domainOptions?: { value: string; label: string }[];
  onSave?: (data: { domainCode: string; question: string; answer: string }) => void;
}

export default function KnowledgeEditModal({
  isOpen,
  onClose,
  mode = 'edit',
  initialDomainCode = '',
  initialQuestion = '',
  initialAnswer = '',
  domainOptions = [
    { value: 'FRONT', label: '프론트 데스크 (FRONT)' },
    { value: 'HK', label: '하우스키핑 (HK)' },
    { value: 'FACILITY', label: '시설관리 (FACILITY)' },
    { value: 'FB', label: '식음료 (FB)' },
    { value: 'CONCIERGE', label: '컨시어지 (CONCIERGE)' },
    { value: 'COMMON', label: '공통 (COMMON)' }
  ],
  onSave
}: KnowledgeEditModalProps) {
  const isRegister = mode === 'register';
  const [domainCode, setDomainCode] = useState(initialDomainCode);
  const [question, setQuestion] = useState(initialQuestion);
  const [answer, setAnswer] = useState(initialAnswer);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const showToast = useUiStore(state => state.showToast);
  const { t } = useTranslation();
  const ragModal = (t.frontdeskPage?.rag as any)?.modal;

  return (
    <>
      <ModalOverlay isOpen={isOpen} onClose={() => setIsConfirmOpen(true)}>
        <ModalCard
          size="md"
          onClose={() => setIsConfirmOpen(true)}
          title={isRegister ? (ragModal?.registerTitle || '지식 데이터 등록') : (ragModal?.editTitle || '지식 정보 수정')}
        >

        {/* Body */}
        <div className={styles.body}>
          <Dropdown
            label={ragModal?.domainLabel || 'Department'}
            options={domainOptions}
            value={domainCode}
            onChange={(val) => setDomainCode(val as string)}
            placeholder={ragModal?.domainPlaceholder || 'Select department'}
          />

          <InputField
            label={ragModal?.titleLabel || 'Title'}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={ragModal?.titlePlaceholder || 'Enter expected question or title'}
          />

          <InputField
            as="textarea"
            label={ragModal?.contentLabel || 'Content'}
            value={answer}
            onChange={(e: any) => setAnswer(e.target.value)}
            placeholder={ragModal?.contentPlaceholder || 'Enter answer or manual details'}
            rows={4}
          />
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <Button variant="secondary" onClick={() => setIsConfirmOpen(true)} className={styles.btn}>
            {t.common?.cancel || '취소'}
          </Button>
          <Button variant="primary" onClick={() => {
            if (onSave) onSave({ domainCode, question, answer });
            showToast(isRegister ? (ragModal?.registerSuccess || '지식 데이터가 성공적으로 등록되었습니다.') : (ragModal?.editSuccess || '지식 정보가 성공적으로 수정되었습니다.'), 'success');
          }} className={styles.btn}>
            {isRegister ? (ragModal?.registerBtn || '등록하기') : (ragModal?.saveBtn || '변경사항 저장하기')}
          </Button>
        </div>
      </ModalCard>
    </ModalOverlay>
    {isConfirmOpen && (
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false);
          onClose();
        }}
        title={ragModal?.cancelEditTitle || '수정 취소'}
        subtitle={ragModal?.cancelEditSubtitle || '수정 중인 내용이 저장되지 않습니다. 정말 취소하시겠습니까?'}
        confirmText={ragModal?.cancelConfirm || '네, 취소할게요'}
        cancelText={ragModal?.cancelKeep || '계속 작성하기'}
        status="danger"
      />
    )}
    </>
  );
}
