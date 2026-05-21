import { useState } from 'react';
import { handleResponse } from '@/lib/api';

export default function useApproveCancellation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approveCancellation = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/frontdesk/requests/${id}/cancellation/approve`, {
        method: 'PATCH',
      });
      await handleResponse(res);
      return true;
    } catch (err: any) {
      setError(err.message || '취소 승인 실패');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { approveCancellation, loading, error };
}
