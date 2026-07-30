'use client';

import { useState, useCallback } from 'react';
import { handleResponse } from '@/lib/api';

export interface Guest {
  id: number;
  roomNumber: string;
  name: string;
  phone: string | null;
  accessCode: string; // ★ 추가
  checkinDate: string;
  checkoutDate: string;
  specialNotes?: string | null;
}

interface CheckInPayload {
  roomNumber: string;
  name: string;
  phone: string;
  checkoutDate: string;
  specialNotes?: string;
}

export default function useGuests() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGuests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pms/guests');
      const data = await handleResponse<Guest[]>(res);
      setGuests(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkIn = useCallback(async (payload: CheckInPayload) => {
    setError(null);
    try {
      const res = await fetch('/api/pms/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await handleResponse(res);
      await fetchGuests();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [fetchGuests]);

  const checkOut = useCallback(async (guestId: number) => {
    setError(null);
    try {
      const res = await fetch(`/api/pms/guests/${guestId}`, { method: 'DELETE' });
      await handleResponse(res);
      await fetchGuests();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [fetchGuests]);

  return { guests, loading, error, fetchGuests, checkIn, checkOut };
}
