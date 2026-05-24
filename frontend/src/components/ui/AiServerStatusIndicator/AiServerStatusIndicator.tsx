'use client';

import { useCallback, useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { useSSE } from '@/app/useSSE';
import Tag from '@/components/ui/StatusBadge/StatusBadge';
import styles from './AiServerStatusIndicator.module.css';

type AiServerStatus = 'HEALTHY' | 'UNHEALTHY';

interface AiStatusPayload {
  type?: string;
  status?: AiServerStatus;
  since?: string | null;
}

export default function AiServerStatusIndicator() {
  const { subscribe } = useSSE();
  const [status, setStatus] = useState<AiServerStatus>('HEALTHY');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch('/api/frontdesk/ai-status');
        if (!res.ok || aborted) return;
        const data = (await res.json()) as { status: AiServerStatus };
        setStatus(data.status);
      } catch {
        // SSE로도 갱신되므로 초기 실패는 무시
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  useEffect(() => {
    const handler = (raw: unknown) => {
      const data = raw as AiStatusPayload;
      if (!data || data.type !== 'AI_SERVER_STATUS') return;
      if (data.status === 'HEALTHY' || data.status === 'UNHEALTHY') {
        setStatus(data.status);
      }
    };
    const unsub = subscribe('/topic/frontdesk', handler);
    return () => unsub();
  }, [subscribe]);

  const handleCheck = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    try {
      const res = await fetch('/api/frontdesk/ai-status/check', { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as { status: AiServerStatus };
        setStatus(data.status);
      }
    } catch {
      // 무시
    } finally {
      setTimeout(() => setChecking(false), 5000);
    }
  }, [checking]);

  const isHealthy = status === 'HEALTHY';
  const label = isHealthy ? 'AI LIVE' : 'AI DISCONNECT';

  return (
    <div
      className={styles.container}
      role="status"
      aria-live="polite"
    >
      <Tag
        variant={isHealthy ? 'green' : 'red'}
        className={styles.statusTag}
      >
        <span className={`${styles.dot} ${isHealthy ? styles.dotHealthy : styles.dotUnhealthy}`} />
        <span className={styles.label}>
          {label}
        </span>
      </Tag>
      <button
        type="button"
        className={styles.checkButton}
        onClick={handleCheck}
        disabled={checking}
        aria-label="AI 연결 확인"
        title="AI 연결 확인"
      >
        <RotateCw size={12} className={checking ? styles.spinning : ''} strokeWidth={2.5} />
      </button>
    </div>
  );
}
