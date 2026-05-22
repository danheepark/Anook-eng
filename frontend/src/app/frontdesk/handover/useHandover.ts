import { useState, useEffect } from 'react';
import { handleResponse } from '@/lib/api';

export interface HandoverBriefing {
  id: string | number;
  shiftStart: string;
  shiftEnd: string;
  totalRequestCount: number;
  pendingCount: number;
  escalatedCount: number;
  summary: string;
  createdAt: string;
}

export interface HandoverItem {
  id: string | number;
  status: string;
  category: string;
  roomNumber: string;
  summary: string;
  author: string;
  time: string;
}

export function useHandover() {
  const [targetDate, setTargetDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [shiftType, setShiftType] = useState<string>('DAY');
  const [managerName, setManagerName] = useState<string>('미배정');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [briefingData, setBriefingData] = useState<HandoverBriefing | null>(null);
  const [itemsData, setItemsData] = useState<HandoverItem[]>([]);

  // Fetch handover data from BFF
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/frontdesk/handover?date=${targetDate}&shiftType=${shiftType}`)
      .then((res) => handleResponse<any>(res))
      .then((data) => {
        if (!active) return;
        
        // Set the dynamic manager names from the API response
        setManagerName(data.managerNames || '미배정');

        const [start, end] = data.shiftTimeLabel ? data.shiftTimeLabel.split(' - ') : ['-', '-'];

        setBriefingData({
          id: '-',
          shiftStart: start,
          shiftEnd: end,
          totalRequestCount: data.totalRequestCount,
          pendingCount: data.pendingCount,
          escalatedCount: 0,
          summary: '자동 생성된 인수인계 브리핑입니다.',
          createdAt: (() => {
            const d = new Date();
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
          })(),
        });

        const mappedItems = data.tasks.map((task: any, index: number) => {
          let displayStatus = task.status || 'PENDING';
          if (displayStatus === 'COMPLETED') {
            displayStatus = 'DONE';
          }
          return {
            id: index + 1,
            status: displayStatus,
            category: task.category || '기타',
            roomNumber: task.roomNo || '-',
            summary: task.summary || '-',
            author: task.author || '미배정',
            time: task.time || '-',
          };
        });
        setItemsData(mappedItems);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [targetDate, shiftType]);

  return {
    targetDate,
    setTargetDate,
    shiftType,
    setShiftType,
    managerName,
    loading,
    error,
    briefingData,
    itemsData,
  };
}
