import { useState, useEffect, useCallback } from 'react';
import { handleResponse } from '@/lib/api';

export interface VocItem {
  id: number;
  roomNo: string;
  guestId: number | null;
  sentiment: 'POSITIVE' | 'NEGATIVE';
  content: string;
  aiReply: string;
  createdAt: string;
}

export function useVocList() {
  const [vocList, setVocList] = useState<VocItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/messages/vocs', {
        headers: { 'Content-Type': 'application/json' },
      });
      const data: VocItem[] = await handleResponse(response);
      setVocList(data);
    } catch (err) {
      console.error('VOC 목록 조회 실패:', err);
      setError(err instanceof Error ? err.message : 'VOC 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVocs();
  }, [fetchVocs]);

  return { vocList, loading, error, refetch: fetchVocs };
}
