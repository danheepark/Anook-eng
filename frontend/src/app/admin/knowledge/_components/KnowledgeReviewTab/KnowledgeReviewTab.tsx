'use client';

import React, { useState } from 'react';
import InputField from '@/components/ui/Inputfield/InputField';
import KnowledgeEditModal from '@/components/ui/Knowledge/KnowledgeEditModal';
import ConfirmModal from '@/components/ui/Modal/ConfirmModal';
import Button from '@/components/ui/Button/Button';
import RagCandidateCard from '@/components/ui/Card/RagCandidateCard';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import { useKnowledge, KnowledgeEntry } from '../../useKnowledge';
import styles from './KnowledgeReviewTab.module.css';
import { useTranslation } from '@/app/useTranslation';
import { handleResponse } from '@/lib/api';

interface KnowledgeReviewTabProps {
  domainCode: string; // 'ALL' 또는 도메인 코드
  searchValue: string;
}

export default function KnowledgeReviewTab({ domainCode, searchValue }: KnowledgeReviewTabProps) {
  const { t } = useTranslation();
  const { data, loading, error, deleteEntry, refresh } = useKnowledge(domainCode === 'ALL' ? undefined : domainCode);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KnowledgeEntry | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  // PENDING 상태만 필터링
  const pendingItems = data.filter(item => item.status === 'PENDING');

  // 검색 필터
  const filteredItems = pendingItems.filter(item =>
    item.question.toLowerCase().includes(searchValue.toLowerCase()) ||
    item.answer.toLowerCase().includes(searchValue.toLowerCase())
  );

  // RAG 등록 (APPROVED로 전환) — register-from-answer API 재사용
  const handleApprove = async (formData: { domainCode: string; question: string; answer: string }) => {
    if (!selectedItem) return;
    try {
      // 1. 기존 PENDING 항목 삭제
      await deleteEntry(selectedItem.id);
      // 2. APPROVED 상태로 새로 등록 (임베딩 생성 포함)
      const res = await fetch('/api/staff/knowledge/register-from-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: formData.question,
          answer: formData.answer,
          domainCode: formData.domainCode || 'COMMON',
          roomNo: '',
        }),
      });
      await handleResponse(res);
      await refresh();
    } catch (err) {
      console.error('[AiTraining] 승인 실패:', err);
    }
    setIsEditModalOpen(false);
    setSelectedItem(null);
  };

  // 제외 (삭제)
  const handleReject = async () => {
    if (deleteTargetId === null) return;
    try {
      await deleteEntry(deleteTargetId);
      setDeleteTargetId(null);
    } catch (err) {
      console.error('[AiTraining] 제외 실패:', err);
    }
  };

  const getDomainLabel = (code: string) => {
    const map: Record<string, string> = {
      HK: '하우스키핑',
      FB: 'F&B',
      FACILITY: '시설',
      CONCIERGE: '컨시어지',
      FRONT: '프론트데스크',
      EMERGENCY: '긴급',
      COMMON: '공통',
    };
    return map[code] || code;
  };

  return (
    <div className={styles.container}>
      {/* Content Section */}
      <div className={styles.cardList}>
        {loading ? (
          <div className={styles.emptyState}>{t.common.loading}</div>
        ) : error ? (
          <div className={styles.emptyState}>{error}</div>
        ) : filteredItems.length === 0 ? (
          <div className={styles.emptyState}>검토 대기 중인 항목이 없습니다.</div>
        ) : (
          filteredItems.map(item => (
            <RagCandidateCard
              key={item.id}
              department={getDomainLabel(item.domainCode)}
              question={item.question}
              answer={item.answer}
              timestamp={new Date(item.updatedAt).toLocaleDateString()}
              onAddRag={() => {
                setSelectedItem(item);
                setIsEditModalOpen(true);
              }}
              onReject={() => setDeleteTargetId(item.id)}
            />
          ))
        )}
      </div>

      {/* 지식 편집 모달 */}
      {selectedItem && isEditModalOpen && (
        <KnowledgeEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedItem(null);
          }}
          mode="register"
          initialDomainCode={selectedItem.domainCode}
          initialQuestion={selectedItem.question}
          initialAnswer={selectedItem.answer}
          onSave={handleApprove}
        />
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleReject}
        title="제외 확인"
        subtitle="이 항목을 정말 검토 목록에서 제외하시겠습니까?"
        status="danger"
        confirmText="제외"
      />
    </div>
  );
}
