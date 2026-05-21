import { useState, useEffect } from 'react';

interface StaffMember {
  id: number;
  name: string;
  departmentId: string;
}

export default function useAssignRequest() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await fetch('/api/frontdesk/staff');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: StaffMember[] = await res.json();
        setStaffList(data);
      } catch (err: any) {
        console.error('직원 목록 로딩 실패:', err);
      }
    };
    fetchStaff();
  }, []);

  const assignRequest = async (requestId: number, staffId: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/frontdesk/requests/${requestId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (err: any) {
      setError(err.message || '배정 실패');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { staffList, assignRequest, loading, error };
}
