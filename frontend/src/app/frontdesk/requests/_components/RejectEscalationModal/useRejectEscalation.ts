import { useState } from 'react';
import { handleResponse } from '@/lib/api';

export default function useRejectEscalation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rejectEscalation = async (id: number, reason: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/frontdesk/requests/${id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: reason }),
      });
      await handleResponse(res);
      return true;
    } catch (err: any) {
      setError(err.message || '반려 실패');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { rejectEscalation, loading, error };
}
