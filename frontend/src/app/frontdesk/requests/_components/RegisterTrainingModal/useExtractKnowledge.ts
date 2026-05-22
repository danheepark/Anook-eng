import { useState } from 'react';
import { handleResponse } from '@/lib/api';

export interface KnowledgeCandidate {
  question: string;
  answer: string;
  domainCode: string;
  confidence: number;
}

export function useExtractKnowledge() {
  const [extracting, setExtracting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<KnowledgeCandidate[]>([]);

  const extractFromChat = async (roomNo: string) => {
    setExtracting(true);
    setError(null);
    setCandidates([]);
    try {
      const res = await fetch('/api/staff/knowledge/extract-from-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomNo }),
      });
      const data = await handleResponse(res) as KnowledgeCandidate[];
      setCandidates(data || []);
      return data;
    } catch (err: any) {
      console.error(err);
      setError(err.message || '상담 대화 분석에 실패했습니다.');
      return null;
    } finally {
      setExtracting(false);
    }
  };

  const batchRegister = async (items: Omit<KnowledgeCandidate, 'confidence'>[]) => {
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch('/api/staff/knowledge/batch-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      await handleResponse(res);
      return true;
    } catch (err: any) {
      console.error(err);
      setError(err.message || '선택 항목 등록에 실패했습니다.');
      return false;
    } finally {
      setRegistering(false);
    }
  };

  return {
    extractFromChat,
    batchRegister,
    extracting,
    registering,
    error,
    candidates,
    setCandidates,
  };
}
