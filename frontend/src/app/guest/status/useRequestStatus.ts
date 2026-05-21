import { useState, useEffect } from 'react';
import { useSSE } from '@/app/useSSE';

export interface RequestStatusItem {
  id: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SETTLED' | 'CANCELLED';
  domainCode: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export function useRequestStatus(roomNo: string = '707') {
  const [requests, setRequests] = useState<RequestStatusItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { subscribe } = useSSE();

  // 초기 데이터 조회
  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/chat/${roomNo}/requests`);
        if (!res.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
        const data = await res.json();
        setRequests(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
  }, [roomNo]);

  // WebSocket 구독 (실시간 상태 업데이트)
  useEffect(() => {
    const unsubscribe = subscribe(`/topic/room/${roomNo}`, (payload: any) => {
      if (payload.type === 'NEW_REQUEST') {
        setRequests(prev => [
          {
            id: payload.requestId,
            status: payload.status,
            domainCode: payload.domainCode,
            summary: payload.summary,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ...prev
        ]);
      } else if (payload.type === 'STATUS_CHANGED') {
        setRequests(prev => prev.map(req => 
          req.id === payload.requestId 
            ? { ...req, status: payload.status, updatedAt: new Date().toISOString() }
            : req
        ));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [roomNo, subscribe]);

  return { requests, isLoading, error };
}
