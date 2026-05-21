'use client';

import React, { useState } from 'react';
import InputField from '@/components/ui/Inputfield/InputField';
import KnowledgeEditModal from '@/components/ui/Knowledge/KnowledgeEditModal';
import ConfirmModal from '@/components/ui/Modal/ConfirmModal';
import Button from '@/components/ui/Button/Button';
import KnowledgeItem from '@/components/ui/Knowledge/KnowledgeItem';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import { useKnowledge, KnowledgeEntry } from '../../useKnowledge';
import styles from './KnowledgeReviewTab.module.css';
import { useTranslation } from '@/app/useTranslation';
import { handleResponse } from '@/lib/api';

interface KnowledgeReviewTabProps {
  domainCode: string; // 'ALL' 또는 도메인 코드
  searchValue: string;
  onMatchesChange?: (matches: number[]) => void;
  activeMatchId?: number | null;
}

export default function KnowledgeReviewTab({ domainCode, searchValue, onMatchesChange, activeMatchId }: KnowledgeReviewTabProps) {
  const { t } = useTranslation();
  const { data, loading, error, deleteEntry, refresh } = useKnowledge(domainCode === 'ALL' ? undefined : domainCode);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KnowledgeEntry | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  // PENDING 상태만 필터링
  const pendingItems = data.filter(item => item.status === 'PENDING');

  // 검색 필터
  const filteredItems = pendingItems.filter(item => {
    const q = item.question || '';
    const a = item.answer || '';
    const search = searchValue || '';
    return q.toLowerCase().includes(search.toLowerCase()) ||
           a.toLowerCase().includes(search.toLowerCase());
  });

  const matches = filteredItems.map(item => item.id);

  // matches 변경 시 부모 컴포넌트에 알림
  React.useEffect(() => {
    onMatchesChange?.(matches);
  }, [JSON.stringify(matches)]);

  // activeMatchId 변경 시 해당 카드로 스크롤
  React.useEffect(() => {
    if (activeMatchId) {
      setTimeout(() => {
        const el = document.getElementById(`candidate-${activeMatchId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    }
  }, [activeMatchId]);

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
    // t.rag.tabs has the department mappings we need
    return (t.frontdeskPage.rag.tabs as Record<string, string>)[code] || code;
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
          <div className={styles.emptyState}>{t.frontdeskPage?.aiTraining?.empty || '검토 대기 중인 항목이 없습니다.'}</div>
        ) : (
          filteredItems.map(item => (
            <KnowledgeItem
              key={item.id}
              id={item.id}
              domainCode={item.domainCode}
              question={item.question}
              answer={item.answer}
              updatedAt={(() => {
                const d = new Date(item.updatedAt);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
              })()}
              onClick={() => {
                setSelectedItem(item);
                setIsEditModalOpen(true);
              }}
              onEdit={(e) => {
                e.stopPropagation();
                setSelectedItem(item);
                setIsEditModalOpen(true);
              }}
              onDelete={(e) => {
                e.stopPropagation();
                setDeleteTargetId(item.id);
              }}
              isActiveMatch={activeMatchId === item.id}
              highlightQuery={searchValue}
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
        title={t.frontdeskPage?.aiTraining?.rejectTitle || '제외 확인'}
        subtitle={t.frontdeskPage?.aiTraining?.rejectSubtitle || '이 항목을 정말 검토 목록에서 제외하시겠습니까?'}
        status="danger"
        confirmText={t.frontdeskPage?.aiTraining?.rejectConfirm || '제외'}
      />
    </div>
  );
}
