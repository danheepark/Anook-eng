import { useState, useCallback } from 'react';
import { handleResponse } from '@/lib/api';

export interface Department {
  id: string;
  name: string;
}

export function useDepartmentManagement() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/frontdesk/departments');
      const data = await handleResponse<Department[]>(res);
      setDepartments(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    departments,
    loading,
    error,
    fetchDepartments,
  };
}
