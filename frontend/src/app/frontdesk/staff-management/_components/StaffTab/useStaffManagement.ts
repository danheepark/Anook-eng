import { useState, useCallback } from 'react';
import { handleResponse } from '@/lib/api';

export interface Staff {
  id: number;
  name: string;
  pin: string;
  roleId: number;
  departmentId: string;
}

export interface CreateStaffCommand {
  name: string;
  roleId: number;
  departmentId: string;
}

export interface UpdateStaffCommand {
  name: string;
  roleId: number;
  departmentId: string;
}

export function useStaffManagement() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStaffList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/frontdesk/staff');
      const data = await handleResponse<Staff[]>(res);
      setStaffList(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createStaff = useCallback(async (command: CreateStaffCommand) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/frontdesk/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      });
      await handleResponse(res);
      await fetchStaffList(); // Refresh
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchStaffList]);

  const updateStaff = useCallback(async (id: number, command: UpdateStaffCommand) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/frontdesk/staff/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      });
      await handleResponse(res);
      await fetchStaffList(); // Refresh
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchStaffList]);

  const deleteStaff = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/frontdesk/staff/${id}`, {
        method: 'DELETE',
      });
      await handleResponse(res);
      await fetchStaffList(); // Refresh
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchStaffList]);

  return {
    staffList,
    loading,
    error,
    fetchStaffList,
    createStaff,
    updateStaff,
    deleteStaff,
  };
}
