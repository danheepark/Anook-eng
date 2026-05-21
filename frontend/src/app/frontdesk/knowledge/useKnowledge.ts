import { useState, useEffect, useCallback } from 'react';
import { handleResponse } from '@/lib/api';

export interface KnowledgeEntry {
  id: number;
  question: string;
  answer: string;
  domainCode: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function useKnowledge(domainCode?: string) {
  const [data, setData] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = domainCode 
        ? `/api/frontdesk/knowledge?domain=${domainCode}` 
        : `/api/frontdesk/knowledge`;
      const response = await fetch(url);
      const result = await handleResponse(response);
      setData(Array.isArray(result) ? (result as KnowledgeEntry[]) : []);
    } catch (err: any) {
      setError(err.message || '지식 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [domainCode]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const createEntry = async (payload: { question: string; answer: string; domainCode: string }) => {
    try {
      const response = await fetch('/api/frontdesk/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      await handleResponse(response);
      await fetchList(); // 목록 새로고침
    } catch (err: any) {
      throw new Error(err.message || '지식 추가에 실패했습니다.');
    }
  };

  const updateEntry = async (id: number, payload: { question: string; answer: string; domainCode: string }) => {
    try {
      const response = await fetch(`/api/frontdesk/knowledge/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      await handleResponse(response);
      await fetchList(); // 목록 새로고침
    } catch (err: any) {
      throw new Error(err.message || '지식 수정에 실패했습니다.');
    }
  };

  const deleteEntry = async (id: number) => {
    try {
      const response = await fetch(`/api/frontdesk/knowledge/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('지식 삭제에 실패했습니다.');
      }
      await fetchList(); // 목록 새로고침
    } catch (err: any) {
      throw new Error(err.message || '지식 삭제에 실패했습니다.');
    }
  };

  return {
    data,
    loading,
    error,
    createEntry,
    updateEntry,
    deleteEntry,
    refresh: fetchList
  };
}
