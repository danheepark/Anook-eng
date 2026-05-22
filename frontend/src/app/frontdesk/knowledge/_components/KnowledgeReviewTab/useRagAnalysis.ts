import { useState } from 'react';
import { handleResponse } from '@/lib/api';

export interface KnowledgeCandidate {
  question: string;
  answer: string;
  domainCode: string;
  confidence: number;
}

export function useRagAnalysis() {
  const [analyzing, setAnalyzing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzePending = async (pendingIds: number[]) => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/staff/knowledge/extract-from-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingIds }),
      });
      const data = await handleResponse(res);
      return data as KnowledgeCandidate[];
    } catch (err: any) {
      console.error(err);
      setError(err.message || '상담 데이터 RAG 자동 분석에 실패했습니다.');
      return null;
    } finally {
      setAnalyzing(false);
    }
  };

  const batchRegisterApproved = async (pendingIds: number[], items: Omit<KnowledgeCandidate, 'confidence'>[]) => {
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch('/api/staff/knowledge/batch-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendingKnowledgeIds: pendingIds,
          items,
        }),
      });
      await handleResponse(res);
      return true;
    } catch (err: any) {
      console.error(err);
      setError(err.message || '지식 일괄 등록에 실패했습니다.');
      return false;
    } finally {
      setRegistering(false);
    }
  };

  return {
    analyzePending,
    batchRegisterApproved,
    analyzing,
    registering,
    error,
  };
}
