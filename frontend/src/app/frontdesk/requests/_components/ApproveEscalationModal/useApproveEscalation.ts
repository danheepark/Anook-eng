import { useState } from 'react';
import { handleResponse } from '@/lib/api';

export default function useApproveEscalation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approveEscalation = async (id: number, departmentId: string, priority: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/frontdesk/requests/${id}/escalate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId, priority }),
      });
      await handleResponse(res);
      return true;
    } catch (err: any) {
      setError(err.message || '승인 실패');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { approveEscalation, loading, error };
}
