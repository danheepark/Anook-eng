import { useState, useEffect } from 'react';

export interface AiLogSummary {
  averageLatencyMs: number;
  totalTokens: number;
  routingSuccessRate: number;
  fallbackRate: number;
}

export interface AiLogDetail {
  id: number;
  rawPrompt: string;
  rawResponse: string;
  modelName: string;
  totalTokens: number;
  latencyMs: number;
  isFallback: boolean;
  createdAt: string;
}

export interface AiRatingItem {
  requestId: number;
  roomNo: string;
  departmentId: string;
  summary: string;
  rating: number;
  createdAt: string;
}

interface AiRatingsData {
  averageRating: number;
  totalCount: number;
  ratings: AiRatingItem[];
}

export default function useAiLogs() {
  const [summary, setSummary] = useState<AiLogSummary | null>(null);
  const [logs, setLogs] = useState<AiLogDetail[]>([]);
  const [ratingsData, setRatingsData] = useState<AiRatingsData>({ averageRating: 0, totalCount: 0, ratings: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAiLogs = async () => {
      setLoading(true);
      try {
        const [summaryRes, listRes, ratingsRes] = await Promise.all([
          fetch('/api/frontdesk/ai-logs/summary'),
          fetch('/api/frontdesk/ai-logs'),
          fetch('/api/frontdesk/ai-logs/ratings')
        ]);
        
        if (!summaryRes.ok || !listRes.ok) {
          throw new Error('데이터를 불러오는데 실패했습니다.');
        }

        const summaryData = await summaryRes.json();
        const listData = await listRes.json();

        setSummary(summaryData);
        // Pageable response has 'content' array
        setLogs(listData.content || []);

        if (ratingsRes.ok) {
          const ratData = await ratingsRes.json();
          setRatingsData(ratData);
        }
      } catch (err: any) {
        setError(err.message || '알 수 없는 오류');
      } finally {
        setLoading(false);
      }
    };

    fetchAiLogs();
  }, []);

  return { summary, logs, ratingsData, loading, error };
}
