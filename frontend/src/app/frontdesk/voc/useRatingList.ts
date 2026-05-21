import { useState, useEffect, useCallback } from 'react';
import { handleResponse } from '@/lib/api';

interface RatingItem {
  requestId: number;
  roomNo: string;
  summary: string;
  rating: number;
  staffName: string;
  createdAt: string;
  updatedAt: string;
}

export function useRatingList() {
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRatings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/frontdesk/messages/ratings', {
        headers: { 'Content-Type': 'application/json' },
      });
      const data: RatingItem[] = await handleResponse(response);
      setRatings(data);
    } catch (err) {
      console.error('별점 목록 조회 실패:', err);
      setError(err instanceof Error ? err.message : '별점 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRatings();
  }, [fetchRatings]);

  // 평균 별점 계산
  const averageRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
    : 0;

  return { ratings, loading, error, averageRating, refetch: fetchRatings };
}
