import { useState, useEffect, useCallback } from 'react';
import { useSSE } from '@/app/useSSE';

interface EscalatedRequest {
  id: number;
  status: string;
  priority: string;
  departmentId: string;
  departmentName: string;
  summary: string;
  roomNo: string;
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function useEscalations() {
  const [escalations, setEscalations] = useState<EscalatedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEscalations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/frontdesk/requests/escalations');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: EscalatedRequest[] = await res.json();
      setEscalations(data);
    } catch (err: any) {
      setError(err.message || '에스컬레이션 목록 로딩 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEscalations();
  }, [fetchEscalations]);

  const { subscribe } = useSSE();

  useEffect(() => {
    const handleEvent = (message: any) => {
      fetchEscalations();
    };

    const unsubFrontdesk = subscribe('/topic/frontdesk', handleEvent);
    return () => {
      unsubFrontdesk();
    };
  }, [subscribe, fetchEscalations]);

  return { escalations, loading, error, refetch: fetchEscalations };
}
