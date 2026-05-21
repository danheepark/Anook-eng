import { useState } from 'react';

interface CreateRequestPayload {
  departmentId: string;
  roomNo: string;
  summary: string;
  rawText?: string;
  priority?: string;
  assignedStaffId?: number;
}

export default function useCreateRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRequest = async (payload: CreateRequestPayload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/frontdesk/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (err: any) {
      setError(err.message || '요청 생성 실패');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { createRequest, loading, error };
}
