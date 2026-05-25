'use client';

import React, { useState, useEffect } from 'react';
import { ModalOverlay, ModalCard } from '@/components/ui/Modal';
import Button from '@/components/ui/Button/Button';
import { useTranslation } from '@/app/useTranslation';
import { useExtractKnowledge } from './useExtractKnowledge';
import Dropdown from '@/components/ui/Dropdown/Dropdown';
import InputField from '@/components/ui/Inputfield/InputField';
import styles from './RegisterTrainingModal.module.css';

interface RegisterTrainingModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentId?: string;
  summary?: string;
  roomNo?: string;
}

interface LocalCandidate {
  question: string;
  answer: string;
  domainCode: string;
  selected: boolean;
}

export default function RegisterTrainingModal({
  isOpen,
  onClose,
  departmentId = '',
  summary = '',
  roomNo = '',
  requestId,
}: RegisterTrainingModalProps & { requestId?: number }) {
  const { t } = useTranslation();
  const { extractFromChat, batchRegister, extracting, registering, error } = useExtractKnowledge();
  const [localCandidates, setLocalCandidates] = useState<LocalCandidate[]>([]);

  useEffect(() => {
    if (isOpen && roomNo) {
      setLocalCandidates([]);
      extractFromChat(roomNo).then(data => {
        if (data && Array.isArray(data)) {
          setLocalCandidates(
            data.map(item => ({
              question: item.question || '',
              answer: item.answer || '',
              domainCode: item.domainCode || departmentId || 'COMMON',
              selected: true, // Default to selected
            }))
          );
        }
      });
    }
  }, [isOpen, roomNo, departmentId]);

  const DOMAIN_OPTIONS = [
    { value: 'FRONT', label: (t.frontdeskPage?.rag?.tabs as any)?.FRONT || '프론트' },
    { value: 'HK', label: (t.frontdeskPage?.rag?.tabs as any)?.HK || '하우스키핑' },
    { value: 'FACILITY', label: (t.frontdeskPage?.rag?.tabs as any)?.FACILITY || '시설관리' },
    { value: 'FB', label: (t.frontdeskPage?.rag?.tabs as any)?.FB || '식음료' },
    { value: 'CONCIERGE', label: (t.frontdeskPage?.rag?.tabs as any)?.CONCIERGE || '컨시어지' },
    { value: 'EMERGENCY', label: (t.frontdeskPage?.rag?.tabs as any)?.EMERGENCY || '긴급' },
    { value: 'COMMON', label: (t.frontdeskPage?.rag?.tabs as any)?.COMMON || '공통' },
  ];

  const handleToggle = (index: number) => {
    setLocalCandidates(prev =>
      prev.map((item, idx) => (idx === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleTextChange = (index: number, field: 'question' | 'answer', value: string) => {
    setLocalCandidates(prev =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleDomainChange = (index: number, value: string) => {
    setLocalCandidates(prev =>
      prev.map((item, idx) => (idx === index ? { ...item, domainCode: value } : item))
    );
  };

  const allSelected = localCandidates.length > 0 && localCandidates.every(item => item.selected);
  
  const handleSelectAll = () => {
    setLocalCandidates(prev =>
      prev.map(item => ({ ...item, selected: !allSelected }))
    );
  };

  const handleSave = async () => {
    const selectedItems = localCandidates.filter(c => c.selected);
    if (selectedItems.length === 0) {
      alert('등록할 항목을 선택해주세요.');
      return;
    }

    const payload = selectedItems.map(c => ({
      question: c.question,
      answer: c.answer,
      domainCode: c.domainCode,
      roomNo, // Pass roomNo to clear any existing PENDING statuses
    }));

    const success = await batchRegister(payload);
    if (success) {
      if (requestId) {
        const saved = localStorage.getItem('registeredRagIds');
        const set = saved ? new Set(JSON.parse(saved)) : new Set();
        set.add(requestId);
        localStorage.setItem('registeredRagIds', JSON.stringify(Array.from(set)));
        window.dispatchEvent(new CustomEvent('ragRegistered', { detail: requestId }));
      }
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalCard
        size="md"
        onClose={onClose}
        title="AI RAG 지식 추출 및 등록"
        subtitle={"상담 대화 내용에서 RAG 학습에 적합한 Q&A 지식을 AI가 분석하고 추출했습니다.\n내용을 검토 및 수정 후 등록하세요."}
      >
        <div className={styles.container}>

          {extracting ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner} />
              <div>상담 대화 내용을 AI 분석 중입니다...</div>
            </div>
          ) : error ? (
            <div className={styles.errorBox}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          ) : localCandidates.length === 0 ? (
            <div className={styles.emptyState}>
              상담 대화에서 추출된 Q&A 후보가 없습니다. 대화 내용에 명확한 답변이 적재되었는지 확인해주세요.
            </div>
          ) : (
            <div className={styles.candidatesContainer}>
              <div className={styles.listToolbar}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    className={styles.checkboxInput}
                  />
                  <span className={styles.selectAllText}>
                    전체 선택 ({localCandidates.filter(c => c.selected).length}/{localCandidates.length})
                  </span>
                </label>
              </div>

              <div className={styles.candidatesList}>
                {localCandidates.map((item, idx) => (
                  <div key={idx} className={`${styles.candidateCard} ${item.selected ? styles.selectedCard : ''}`}>
                    <div className={styles.cardHeader}>
                      <label className={styles.cardCheckboxLabel}>
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => handleToggle(idx)}
                          className={styles.checkboxInput}
                        />
                        <span className={styles.candidateNumber}>지식 후보 {idx + 1}</span>
                      </label>
                    </div>

                    <div className={styles.cardBody}>
                      <div className={styles.domainSelectWrapper}>
                        <span className={styles.domainLabel}>분류 부서</span>
                        <Dropdown
                          options={DOMAIN_OPTIONS}
                          value={item.domainCode}
                          onChange={(val) => handleDomainChange(idx, val)}
                          className={styles.domainDropdown}
                        />
                      </div>
                      <InputField
                        as="textarea"
                        label="질문"
                        value={item.question}
                        onChange={(e) => handleTextChange(idx, 'question', e.target.value)}
                        placeholder="질문을 입력하세요..."
                        className={`${styles.cardInput} ${styles.questionInput}`}
                        rows={1}
                      />
                      <InputField
                        as="textarea"
                        label="답변"
                        value={item.answer}
                        onChange={(e) => handleTextChange(idx, 'answer', e.target.value)}
                        placeholder="답변을 입력하세요..."
                        className={styles.cardInput}
                        rows={3}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.footer}>
            <Button variant="secondary" onClick={onClose} disabled={registering}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={extracting || registering || localCandidates.length === 0}
            >
              {registering ? '등록 중...' : '선택 항목 등록하기'}
            </Button>
          </div>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
