import { useState, useEffect, useCallback } from 'react';
import { useSSE } from '../useSSE';

interface FrontdeskRequest {
  id: number;
  status: string;
  priority: string;
  departmentId: string;
  departmentName: string;
  summary: string;
  rawText?: string;
  roomNo: string;
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  createdAt: string;
  updatedAt: string;
  cancelRequested: boolean;
  cancelRequestedAt: string | null;
  entities?: Record<string, any>;
}

export default function useFrontdeskRequests(dept?: string, searchQuery: string = '', filterType: string = 'all', includeAllDepts: boolean = false) {
  const [requests, setRequests] = useState<FrontdeskRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { subscribe } = useSSE();

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      let url: string;
      if (includeAllDepts) {
        // 모든 부서 요청 조회 (프론트 데스크 취소 승인 대기 탭용)
        url = '/api/frontdesk/requests';
      } else if (dept) {
        url = `/api/frontdesk/requests?dept=${dept}`;
      } else {
        url = '/api/frontdesk/requests?exclude=FRONT,EMERGENCY';
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FrontdeskRequest[] = await res.json();
      setRequests(data);
    } catch (err: any) {
      setError(err.message || '요청 목록 로딩 실패');
    } finally {
      setLoading(false);
    }
  }, [dept, includeAllDepts]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // 실시간 웹소켓 구독
  useEffect(() => {
    const handleEvent = (data: any) => {
      // 새로운 요청, 상태 변경, 부서 변경 등 관련 이벤트 발생 시 리패치
      const updateEvents = [
        'NEW_REQUEST', 
        'STATUS_CHANGED', 
        'DEPARTMENT_CHANGED', 
        'CANCEL_REQUEST_RECEIVED', 
        'CANCEL_APPROVED', 
        'CANCEL_REJECTED'
      ];
      
      if (updateEvents.includes(data.type)) {
        fetchRequests();
      }
    };

    // 공통 어드민 채널 구독
    const unsubFrontdesk = subscribe('/topic/frontdesk', handleEvent);
    
    // 특정 부서 채널 구독 (전달된 dept가 있을 경우)
    let unsubDept = () => {};
    if (dept) {
      unsubDept = subscribe(`/topic/dept/${dept}`, handleEvent);
    }

    return () => {
      unsubFrontdesk();
      unsubDept();
    };
  }, [subscribe, fetchRequests, dept]);

  // 클라이언트 사이드 검색 및 필터링
  let filteredRequests = [...requests];

  if (searchQuery) {
    const lowerQ = searchQuery.toLowerCase();
    filteredRequests = filteredRequests.filter(r =>
      (r.summary && r.summary.toLowerCase().includes(lowerQ)) ||
      (r.roomNo && r.roomNo.includes(lowerQ)) ||
      (r.assignedStaffName && r.assignedStaffName.toLowerCase().includes(lowerQ))
    );
  }

  if (filterType === 'oldest') {
    filteredRequests.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else if (filterType === 'latest' || filterType === 'all') {
    filteredRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const safeParseTime = (dateStr?: string | null) => {
    if (!dateStr) return 0;
    const normalized = String(dateStr).replace(' ', 'T');
    const time = new Date(normalized).getTime();
    return isNaN(time) ? 0 : time;
  };

  const sortByPriorityAndCreatedAt = (reqList: FrontdeskRequest[]) => {
    return [...reqList].sort((a, b) => {
      const aUrgent = a.priority === 'URGENT';
      const bUrgent = b.priority === 'URGENT';
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;

      const timeA = safeParseTime(a.createdAt);
      const timeB = safeParseTime(b.createdAt);
      if (timeA !== timeB) return timeB - timeA;
      return b.id - a.id;
    });
  };

  const sortByCancelRequested = (reqList: FrontdeskRequest[]) => {
    return [...reqList].sort((a, b) => {
      if (a.cancelRequested && !b.cancelRequested) return -1;
      if (!a.cancelRequested && b.cancelRequested) return 1;

      const aUrgent = a.priority === 'URGENT';
      const bUrgent = b.priority === 'URGENT';
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;

      const timeA = safeParseTime(a.createdAt);
      const timeB = safeParseTime(b.createdAt);
      if (timeA !== timeB) return timeB - timeA;
      return b.id - a.id;
    });
  };

  const pending = sortByPriorityAndCreatedAt(filteredRequests.filter(r => r.status === 'PENDING' || r.status === 'ESCALATED'));
  const inProgress = sortByCancelRequested(filteredRequests.filter(r => r.status === 'ASSIGNED' || r.status === 'IN_PROGRESS'));
  const cancelPending = filteredRequests.filter(r => r.cancelRequested);
  const completed = filteredRequests
    .filter(r => r.status === 'COMPLETED' || r.status === 'CANCELLED')
    .sort((a, b) => {
      const timeA = safeParseTime(a.updatedAt || a.cancelRequestedAt || a.createdAt);
      const timeB = safeParseTime(b.updatedAt || b.cancelRequestedAt || b.createdAt);
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      return b.id - a.id;
    });

  return { requests: filteredRequests, pending, inProgress, cancelPending, completed, loading, error, refetch: fetchRequests };
}
