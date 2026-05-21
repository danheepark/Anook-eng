import { useState } from 'react';
import { handleResponse } from '@/lib/api';

export default function useRejectCancellation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rejectCancellation = async (id: number, reason?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/frontdesk/requests/${id}/cancellation/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: reason || '' }),
      });
      await handleResponse(res);
      return true;
    } catch (err: any) {
      setError(err.message || '취소 반려 실패');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { rejectCancellation, loading, error };
}
