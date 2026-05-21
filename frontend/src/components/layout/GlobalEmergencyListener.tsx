'use client';

import React, { useEffect, useState } from 'react';
import { useSSE } from '@/app/useSSE';
import EmergencyBanner from '@/components/ui/EmergencyBanner/EmergencyBanner';

export default function GlobalEmergencyListener() {
  const { subscribe } = useSSE();
  const [emergencyAlert, setEmergencyAlert] = useState<{
    requestId: number;
    roomNo: string;
    summary: string;
    category: string;
  } | null>(null);

  useEffect(() => {
    const handleEvent = (data: unknown) => {
      const event = data as {
        type?: string;
        priority?: string;
        entities?: Record<string, unknown>;
        requestId?: number;
        roomNo?: string;
        summary?: string;
      };

      if (!event || !event.type) return;

      if (
        event.type === 'NEW_REQUEST' &&
        event.priority === 'EMERGENCY' &&
        event.entities &&
        (event.entities.emergency_category || event.entities.intent)
      ) {
        setEmergencyAlert({
          requestId: event.requestId ?? 0,
          roomNo: event.roomNo ?? '',
          summary: event.summary ?? '긴급 상황 발생',
          category: (event.entities.emergency_category || event.entities.intent) as string,
        });
      }
    };

    const unsubscribeFrontdesk = subscribe('/topic/frontdesk', handleEvent);
    
    return () => {
      unsubscribeFrontdesk();
    };
  }, [subscribe]);

  if (!emergencyAlert) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 'var(--space-24)',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      width: 'auto',
      minWidth: '400px'
    }}>
      <EmergencyBanner
        alert={emergencyAlert}
        onDismiss={() => setEmergencyAlert(null)}
        onClick={() => {
          window.location.href = '/frontdesk/requests';
        }}
      />
    </div>
  );
}
