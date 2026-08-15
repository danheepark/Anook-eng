'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ConfirmModal from '@/components/ui/Modal/ConfirmModal';
import Button from '@/components/ui/Button/Button';
import KnowledgeItem from '@/components/ui/Knowledge/KnowledgeItem';
import PendingKnowledgeItem from '@/components/ui/Knowledge/PendingKnowledgeItem';
import PendingKnowledgeHeader from '@/components/ui/Knowledge/PendingKnowledgeHeader';
import KnowledgeEditModal from '@/components/ui/Knowledge/KnowledgeEditModal';
import { useKnowledge } from '../../useKnowledge';
import styles from './KnowledgeReviewTab.module.css';
import { useTranslation } from '@/app/useTranslation';
import { useRagAnalysis } from './useRagAnalysis';
import ChatHistoryModal from '@/app/staff/_components/TaskDetailModal/ChatHistoryModal';

interface KnowledgeReviewTabProps {
  domainCode: string; // 'ALL' 또는 도메인 코드
  searchValue: string;
  onMatchesChange?: (matches: number[]) => void;
  activeMatchId?: number | null;
  onCandidateStateChange?: (isAnalyzed: boolean, count: number) => void;
}

interface LocalCandidate {
  question: string;
  answer: string;
  domainCode: string;
  selected: boolean;
}

export default function KnowledgeReviewTab({
  domainCode,
  searchValue,
  onMatchesChange,
  activeMatchId,
  onCandidateStateChange,
}: KnowledgeReviewTabProps) {
  const { t, language } = useTranslation();
  const aiTraining = (t.frontdeskPage as any)?.aiTraining;
  const { data, loading, error, deleteEntry, refresh } = useKnowledge(
    domainCode === 'ALL' ? undefined : domainCode
  );

  const {
    analyzePending,
    batchRegisterApproved,
    analyzing,
    registering,
    error: analysisError,
  } = useRagAnalysis();

  // PENDING 상태만 필터링
  const pendingItems = data.filter(item => item.status === 'PENDING');

  // 검색 필터
  const filteredItems = pendingItems.filter(item => {
    const q = item.question || '';
    const a = item.answer || '';
    const search = searchValue || '';
    return (
      q.toLowerCase().includes(search.toLowerCase()) ||
      a.toLowerCase().includes(search.toLowerCase())
    );
  });

  const matches = searchValue.trim() ? filteredItems.map(item => item.id) : [];

  // matches 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    onMatchesChange?.(matches);
  }, [JSON.stringify(matches)]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // RAG 분석 후보 상태
  const [candidates, setCandidates] = useState<LocalCandidate[]>([]);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [analyzedPendingIds, setAnalyzedPendingIds] = useState<number[]>([]);

  useEffect(() => {
    onCandidateStateChange?.(isAnalyzed, candidates.length);
  }, [isAnalyzed, candidates.length]);

  // 단일 삭제/제외 확인 모달
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  // 채팅 히스토리 모달
  const [chatHistoryRoomNo, setChatHistoryRoomNo] = useState<string | null>(null);

  // 후보 항목 수정 모달
  const [editCandidateIndex, setEditCandidateIndex] = useState<number | null>(null);
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);

  // activeMatchId 스크롤
  useEffect(() => {
    if (activeMatchId && !isAnalyzed) {
      const element = document.getElementById(`knowledge-${activeMatchId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeMatchId, searchValue, isAnalyzed]);

  const DOMAIN_OPTIONS = [
    { value: 'UNKNOWN', label: language === 'en' ? 'Unknown' : '미분류' },
    { value: 'FRONT', label: (t.frontdeskPage?.rag?.tabs as any)?.FRONT || '프론트' },
    { value: 'HK', label: (t.frontdeskPage?.rag?.tabs as any)?.HK || '하우스키핑' },
    { value: 'FACILITY', label: (t.frontdeskPage?.rag?.tabs as any)?.FACILITY || '시설관리' },
    { value: 'FB', label: (t.frontdeskPage?.rag?.tabs as any)?.FB || '식음료' },
    { value: 'CONCIERGE', label: (t.frontdeskPage?.rag?.tabs as any)?.CONCIERGE || '컨시어지' },
    { value: 'EMERGENCY', label: (t.frontdeskPage?.rag?.tabs as any)?.EMERGENCY || '긴급' },
    { value: 'COMMON', label: (t.frontdeskPage?.rag?.tabs as any)?.COMMON || '공통' },
  ];

  // RAG 분석 실행 (모든 pendingItems 분석)
  const handleAnalyze = async () => {
    const ids = filteredItems.map(item => item.id);
    if (ids.length === 0) return;

    setAnalyzedPendingIds(ids);
    const data = await analyzePending(ids);
    if (data && Array.isArray(data)) {
      setCandidates(
        data.map(item => ({
          question: item.question || '',
          answer: item.answer || '',
          domainCode: item.domainCode || 'UNKNOWN',
          selected: true,
        }))
      );
      setIsAnalyzed(true);
    }
  };

  const handleCancelAnalysis = () => {
    setIsAnalyzed(false);
    setCandidates([]);
    setAnalyzedPendingIds([]);
  };

  const handleToggle = (index: number) => {
    setCandidates(prev =>
      prev.map((c, idx) => (idx === index ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleTextChange = (index: number, field: 'question' | 'answer', value: string) => {
    setCandidates(prev =>
      prev.map((c, idx) => (idx === index ? { ...c, [field]: value } : c))
    );
  };

  const handleDomainChange = (index: number, value: string) => {
    setCandidates(prev =>
      prev.map((c, idx) => (idx === index ? { ...c, domainCode: value } : c))
    );
  };

  const allSelected = candidates.length > 0 && candidates.every(c => c.selected);

  const handleSelectAll = () => {
    setCandidates(prev =>
      prev.map(c => ({ ...c, selected: !allSelected }))
    );
  };

  const handleBatchRegister = async () => {
    const selectedCandidates = candidates.filter(c => c.selected);
    if (selectedCandidates.length === 0) {
      alert('등록할 항목을 선택해주세요.');
      return;
    }

    try {
      await batchRegisterApproved(
        analyzedPendingIds,
        selectedCandidates.map(c => ({
          question: c.question,
          answer: c.answer,
          domainCode: c.domainCode,
        }))
      );
      setIsAnalyzed(false);
      setCandidates([]);
      setAnalyzedPendingIds([]);
      await refresh();
    } catch (err: any) {
      console.error('[KnowledgeReviewTab] 일괄 등록 실패:', err);
    }
  };

  const handleReject = async () => {
    if (deleteTargetId === null) return;
    try {
      await deleteEntry(deleteTargetId);
      setDeleteTargetId(null);
    } catch (err) {
      console.error('[KnowledgeReviewTab] 제외 실패:', err);
    }
  };

  // 로딩 및 에러 화면
  if (loading && !isAnalyzed) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>{t.common.loading}</div>
      </div>
    );
  }

  if (error && !isAnalyzed) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Render Portal in the Top Section Header Actions */}
      {mounted && typeof window !== 'undefined' && document.getElementById('pending-knowledge-header-actions') && (
        createPortal(
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isAnalyzed ? (
              <>
                <Button variant="secondary" onClick={handleCancelAnalysis} disabled={registering}>
                  {t.common?.cancel || (language === 'en' ? 'Cancel' : '취소')}
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleBatchRegister} 
                  disabled={registering || candidates.filter(c => c.selected).length === 0}
                >
                  {registering 
                    ? (aiTraining?.registering || (language === 'en' ? 'Registering...' : '등록 중...')) 
                    : (language === 'en'
                        ? `Register Selected (${candidates.filter(c => c.selected).length})`
                        : (aiTraining?.registerSelected?.replace('{{count}}', candidates.filter(c => c.selected).length.toString()) || `선택 항목 등록하기 (${candidates.filter(c => c.selected).length}건)`))}
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                onClick={handleAnalyze}
                disabled={analyzing || filteredItems.length === 0}
              >
                {analyzing ? (language === 'en' ? 'Analyzing...' : 'AI 분석 중...') : (language === 'en' ? 'Add Knowledge' : '지식 추가')}
              </Button>
            )}
          </div>,
          document.getElementById('pending-knowledge-header-actions')!
        )
      )}

      {/* Main Content Area */}
      {analyzing ? (
        <div className={styles.loadingBox}>
          <div className={styles.spinner} />
          <div>{aiTraining?.analyzingText || '선택하신 상담 대화 내역에서 AI가 지식 데이터를 추출하는 중입니다...'}</div>
        </div>
      ) : analysisError ? (
        <div className={styles.errorBox}>
          <span>⚠️</span>
          <span>{analysisError}</span>
        </div>
      ) : isAnalyzed ? (
        // RAG 분석 결과 (KnowledgeItem 컴포넌트 목록 사용)
        <div className={styles.candidateContainer}>
          <PendingKnowledgeHeader
            allSelected={allSelected}
            onSelectAll={handleSelectAll}
            title="Q&A"
            deptLabel={language === 'en' ? 'Department' : '부서'}
          />

          <div className={styles.cardList}>
            {candidates.length === 0 ? (
              <div className={styles.emptyState}>
                {aiTraining?.noCandidates || '분석된 Q&A 후보가 없습니다. 대화 내용에 적합한 답변이 존재하는지 확인해주세요.'}
              </div>
            ) : (
              candidates.map((item, idx) => (
                <PendingKnowledgeItem
                  key={idx}
                  id={idx}
                  domainCode={item.domainCode}
                  question={item.question}
                  answer={item.answer}
                  selected={item.selected}
                  onSelect={() => handleToggle(idx)}
                  onQuestionChange={(val) => handleTextChange(idx, 'question', val)}
                  onAnswerChange={(val) => handleTextChange(idx, 'answer', val)}
                  questionPlaceholder={aiTraining?.questionPlaceholder || (language === 'en' ? 'Enter question...' : '질문을 입력하세요...')}
                  answerPlaceholder={aiTraining?.answerPlaceholder || (language === 'en' ? 'Enter answer...' : '답변을 입력하세요...')}
                  domainOptions={DOMAIN_OPTIONS}
                  onDomainChange={(val) => handleDomainChange(idx, val)}
                  onDelete={() => {
                    setCandidates(prev => prev.filter((_, i) => i !== idx));
                  }}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        // 기본 대기 목록 (분석 전)
        <div className={styles.cardList}>
          {filteredItems.length === 0 ? (
            <div className={styles.emptyState}>
              {aiTraining?.empty || '검토 대기 중인 항목이 없습니다.'}
            </div>
          ) : (
            filteredItems.map(item => (
              <KnowledgeItem
                key={item.id}
                id={item.id}
                domainCode={(!item.domainCode || item.domainCode === 'COMMON' || item.domainCode === 'UNKNOWN') ? 'UNKNOWN' : item.domainCode}
                question={item.question}
                answer={item.answer || '대화 내용 요약: ' + item.question}
                updatedAt={(() => {
                  const d = new Date(item.updatedAt);
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
                    d.getDate()
                  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
                    d.getMinutes()
                  ).padStart(2, '0')}`;
                })()}
                onClick={() => {
                  if (item.roomNo) {
                    setChatHistoryRoomNo(item.roomNo);
                  } else {
                    alert('대화 내역 정보가 없는 항목입니다.');
                  }
                }}
                onEdit={(e) => {
                  e.stopPropagation();
                  setDeleteTargetId(item.id);
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
      )}

      {/* 제외/삭제 확인 모달 */}
      <ConfirmModal
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleReject}
        title={aiTraining?.rejectTitle || '제외 확인'}
        subtitle={aiTraining?.rejectSubtitle || '이 항목을 정말 검토 목록에서 제외하시겠습니까?'}
        confirmText={aiTraining?.rejectConfirm || '제외'}
        cancelText={t.common?.cancel || '취소'}
        status="danger"
      />

      {/* 후보 지식 수정 모달 */}
      {isCandidateModalOpen && editCandidateIndex !== null && candidates[editCandidateIndex] && (
        <KnowledgeEditModal
          isOpen={isCandidateModalOpen}
          onClose={() => {
            setIsCandidateModalOpen(false);
            setEditCandidateIndex(null);
          }}
          mode="edit"
          initialQuestion={candidates[editCandidateIndex].question}
          initialAnswer={candidates[editCandidateIndex].answer}
          initialDomainCode={candidates[editCandidateIndex].domainCode}
          domainOptions={DOMAIN_OPTIONS}
          onSave={({ domainCode, question, answer }) => {
            setCandidates(prev =>
              prev.map((c, i) => (i === editCandidateIndex ? { ...c, domainCode, question, answer } : c))
            );
            setIsCandidateModalOpen(false);
            setEditCandidateIndex(null);
          }}
        />
      )}

      {/* 채팅 히스토리 모달 */}
      {chatHistoryRoomNo && (
        <ChatHistoryModal
          isOpen={!!chatHistoryRoomNo}
          roomNumber={chatHistoryRoomNo}
          onClose={() => setChatHistoryRoomNo(null)}
        />
      )}
    </div>
  );
}
