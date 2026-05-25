'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ConfirmModal from '@/components/ui/Modal/ConfirmModal';
import Button from '@/components/ui/Button/Button';
import KnowledgeItem from '@/components/ui/Knowledge/KnowledgeItem';
import { useKnowledge } from '../../useKnowledge';
import styles from './KnowledgeReviewTab.module.css';
import { useTranslation } from '@/app/useTranslation';
import { useRagAnalysis } from './useRagAnalysis';

interface KnowledgeReviewTabProps {
  domainCode: string; // 'ALL' 또는 도메인 코드
  searchValue: string;
  onMatchesChange?: (matches: number[]) => void;
  activeMatchId?: number | null;
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
}: KnowledgeReviewTabProps) {
  const { t, language } = useTranslation();
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

  const matches = filteredItems.map(item => item.id);

  // matches 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    onMatchesChange?.(matches);
  }, [JSON.stringify(matches)]);

  // activeMatchId 변경 시 해당 카드로 스크롤 (분석 전 리스트 상태일 때만)
  useEffect(() => {
    if (activeMatchId && !isAnalyzed) {
      setTimeout(() => {
        const el = document.getElementById(`candidate-${activeMatchId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    }
  }, [activeMatchId]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // AI 분석 테이블 제어용 로컬 상태
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [candidates, setCandidates] = useState<LocalCandidate[]>([]);
  const [analyzedPendingIds, setAnalyzedPendingIds] = useState<number[]>([]);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const DOMAIN_OPTIONS = [
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
          domainCode: item.domainCode || 'COMMON',
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

    const payload = selectedCandidates.map(c => ({
      question: c.question,
      answer: c.answer,
      domainCode: c.domainCode,
    }));

    const success = await batchRegisterApproved(analyzedPendingIds, payload);
    if (success) {
      setIsAnalyzed(false);
      setCandidates([]);
      setAnalyzedPendingIds([]);
      await refresh();
    }
  };

  // 개별 pending 항목 제외 (삭제)
  const handleReject = async () => {
    if (deleteTargetId === null) return;
    try {
      await deleteEntry(deleteTargetId);
      setDeleteTargetId(null);
    } catch (err) {
      console.error('[AiTraining] 제외 실패:', err);
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
      {/* Header Area (Only rendered if analyzed or portal is NOT active, to prevent empty gray border line) */}
      {(isAnalyzed || !mounted || typeof window === 'undefined' || !document.getElementById('knowledge-header-actions')) && (
        <div className={styles.headerArea}>
          <div className={styles.headerTitle}>
            {isAnalyzed && (
              <>
                <span>AI RAG 분석 결과</span>
                <span className={styles.headerCount}>{candidates.length}건의 지식 후보</span>
              </>
            )}
          </div>
          {(!mounted || typeof window === 'undefined' || !document.getElementById('knowledge-header-actions')) && (
            <div>
              {isAnalyzed ? (
                <Button variant="secondary" onClick={handleCancelAnalysis} disabled={registering}>
                  목록으로 돌아가기
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleAnalyze}
                  disabled={analyzing || filteredItems.length === 0}
                >
                  {analyzing ? (language === 'en' ? 'Analyzing...' : 'AI 분석 중...') : (language === 'en' ? 'Organize' : '지식으로 정리')}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Render Portal in the background when active */}
      {mounted && typeof window !== 'undefined' && document.getElementById('knowledge-header-actions') && (
        createPortal(
          <div>
            {isAnalyzed ? (
              <Button variant="secondary" onClick={handleCancelAnalysis} disabled={registering}>
                목록으로 돌아가기
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleAnalyze}
                disabled={analyzing || filteredItems.length === 0}
              >
                {analyzing ? (language === 'en' ? 'Analyzing...' : 'AI 분석 중...') : (language === 'en' ? 'Organize' : '지식으로 정리')}
              </Button>
            )}
          </div>,
          document.getElementById('knowledge-header-actions')!
        )
      )}

      {/* Main Content Area */}
      {analyzing ? (
        <div className={styles.loadingBox}>
          <div className={styles.spinner} />
          <div>선택하신 상담 대화 내역에서 AI가 RAG 지식을 추출하는 중입니다...</div>
        </div>
      ) : analysisError ? (
        <div className={styles.errorBox}>
          <span>⚠️</span>
          <span>{analysisError}</span>
        </div>
      ) : isAnalyzed ? (
        // RAG 분석 결과 인라인 테이블
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={`${styles.th} ${styles.thCheckbox}`}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    className={styles.checkboxInput}
                  />
                </th>
                <th className={`${styles.th} ${styles.thQuestion}`}>질문 (Question)</th>
                <th className={`${styles.th} ${styles.thAnswer}`}>답변 (Answer)</th>
                <th className={`${styles.th} ${styles.thDomain}`}>분류 부서</th>
              </tr>
            </thead>
            <tbody>
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.emptyState}>
                    분석된 Q&A 후보가 없습니다. 대화 내용에 적합한 답변이 존재하는지 확인해주세요.
                  </td>
                </tr>
              ) : (
                candidates.map((item, idx) => (
                  <tr key={idx}>
                    <td className={`${styles.td} ${styles.tdCheckbox}`}>
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => handleToggle(idx)}
                        className={styles.checkboxInput}
                      />
                    </td>
                    <td className={styles.td}>
                      <textarea
                        value={item.question}
                        onChange={(e) => handleTextChange(idx, 'question', e.target.value)}
                        className={styles.cellTextarea}
                        placeholder="질문을 입력하세요..."
                      />
                    </td>
                    <td className={styles.td}>
                      <textarea
                        value={item.answer}
                        onChange={(e) => handleTextChange(idx, 'answer', e.target.value)}
                        className={styles.cellTextarea}
                        placeholder="답변을 입력하세요..."
                      />
                    </td>
                    <td className={styles.td}>
                      <select
                        value={item.domainCode}
                        onChange={(e) => handleDomainChange(idx, e.target.value)}
                        className={styles.selectInput}
                      >
                        {DOMAIN_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {candidates.length > 0 && (
            <div className={styles.tableFooter}>
              <div className={styles.analysisFooter}>
                <Button variant="secondary" onClick={handleCancelAnalysis} disabled={registering}>
                  취소
                </Button>
                <Button variant="primary" onClick={handleBatchRegister} disabled={registering}>
                  {registering ? '등록 중...' : `선택 항목 등록하기 (${candidates.filter(c => c.selected).length}건)`}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // 기본 대기 목록 (분석 전)
        <div className={styles.cardList}>
          {filteredItems.length === 0 ? (
            <div className={styles.emptyState}>
              {t.frontdeskPage?.aiTraining?.empty || '검토 대기 중인 항목이 없습니다.'}
            </div>
          ) : (
            filteredItems.map(item => (
              <KnowledgeItem
                key={item.id}
                id={item.id}
                domainCode={item.domainCode}
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
                  setDeleteTargetId(item.id);
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

      {/* 개별 pending 항목 제외 (삭제) 모달 */}
      <ConfirmModal
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleReject}
        title={t.frontdeskPage?.aiTraining?.rejectTitle || '제외 확인'}
        subtitle={
          t.frontdeskPage?.aiTraining?.rejectSubtitle ||
          '이 항목을 정말 검토 목록에서 제외하시겠습니까?'
        }
        status="danger"
        confirmText={t.frontdeskPage?.aiTraining?.rejectConfirm || '제외'}
      />
    </div>
  );
}
