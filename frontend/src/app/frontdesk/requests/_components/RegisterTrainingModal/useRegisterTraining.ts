import { useState } from 'react';
import { handleResponse } from '@/lib/api';

export interface RegisterTrainingPayload {
  question: string;
  answer: string;
  domainCode: string;
  roomNo: string;
}

export function useRegisterTraining() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registerTraining = async (payload: RegisterTrainingPayload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/staff/knowledge/register-from-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          status: 'APPROVED', // 즉시 RAG 등록 (PENDING은 '나중에 하기'에서만 사용)
        }),
      });

      // 공통 API 에러 처리 헬퍼 사용
      await handleResponse(res);
      return true;
    } catch (err: any) {
      console.error(err);
      setError(err.message || '학습 데이터 등록에 실패했습니다.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { registerTraining, loading, error };
}
