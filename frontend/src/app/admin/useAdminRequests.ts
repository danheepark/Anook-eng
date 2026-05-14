import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../useWebSocket';

interface AdminRequest {
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

export default function useAdminRequests(dept?: string, searchQuery: string = '', filterType: string = 'all', includeAllDepts: boolean = false) {
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { subscribe } = useWebSocket();

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      let url: string;
      if (includeAllDepts) {
        // 모든 부서 요청 조회 (프론트 데스크 취소 승인 대기 탭용)
        url = '/api/admin/requests';
      } else if (dept) {
        url = `/api/admin/requests?dept=${dept}`;
      } else {
        url = '/api/admin/requests?exclude=FRONT,EMERGENCY';
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AdminRequest[] = await res.json();
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
    const unsubAdmin = subscribe('/topic/admin', handleEvent);
    
    // 특정 부서 채널 구독 (전달된 dept가 있을 경우)
    let unsubDept = () => {};
    if (dept) {
      unsubDept = subscribe(`/topic/dept/${dept}`, handleEvent);
    }

    return () => {
      unsubAdmin();
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

  const pending = filteredRequests.filter(r => r.status === 'PENDING');
  const inProgress = filteredRequests.filter(r => r.status === 'ASSIGNED' || r.status === 'IN_PROGRESS');
  
  // inProgress 배열 내에서 취소 대기(cancelRequested) 항목을 최상단으로 정렬
  inProgress.sort((a, b) => {
    if (a.cancelRequested && !b.cancelRequested) return -1;
    if (!a.cancelRequested && b.cancelRequested) return 1;
    return 0; // fallback to existing sort (createdAt)
  });

  const cancelPending = filteredRequests.filter(r => r.cancelRequested);
  const completed = filteredRequests.filter(r => r.status === 'COMPLETED' || r.status === 'CANCELLED');

  return { requests: filteredRequests, pending, inProgress, cancelPending, completed, loading, error, refetch: fetchRequests };
}
