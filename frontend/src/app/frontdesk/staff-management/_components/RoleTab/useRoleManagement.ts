import { useState, useCallback } from 'react';
import { handleResponse } from '@/lib/api';

export interface Role {
  id: number;
  departmentId: string;
  name: string;
}

export interface CreateRoleCommand {
  departmentId: string;
  name: string;
}

export interface UpdateRoleCommand {
  departmentId: string;
  name: string;
}

export function useRoleManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/frontdesk/roles');
      const data = await handleResponse<Role[]>(res);
      setRoles(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createRole = useCallback(async (command: CreateRoleCommand) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/frontdesk/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      });
      await handleResponse(res);
      await fetchRoles(); // Refresh
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchRoles]);

  const updateRole = useCallback(async (id: number, command: UpdateRoleCommand) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/frontdesk/roles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      });
      await handleResponse(res);
      await fetchRoles(); // Refresh
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchRoles]);

  const deleteRole = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/frontdesk/roles/${id}`, {
        method: 'DELETE',
      });
      await handleResponse(res);
      await fetchRoles(); // Refresh
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchRoles]);

  return {
    roles,
    loading,
    error,
    fetchRoles,
    createRole,
    updateRole,
    deleteRole,
  };
}
