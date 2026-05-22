import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { useUiStore } from '@/stores/useUiStore';
import { useTranslation } from '@/app/useTranslation';
import { useSSE } from '@/app/useSSE';
import { handleResponse } from '@/lib/api';
import NotificationCard from '@/components/ui/NotificationCard/NotificationCard';
import styles from './StaffNotification.module.css';

export interface StaffTask {
  id: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ESCALATED';
  priority: 'NORMAL' | 'URGENT';
  departmentId: string;
  summary: string;
  roomNumber: string;
  cancelRequested: boolean;
  version: number;
  rawText?: string;
  departmentName?: string;
  createdAt?: string;
}

export default function StaffNotification() {
  const [isOpen, setIsOpen] = useState(false);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [loading, setLoading] = useState(false);
  
  const popupRef = useRef<HTMLDivElement>(null);
  const { showToast } = useUiStore();
  const { t } = useTranslation();
  const { subscribe } = useSSE();

  // 1. 부서 ID 세션 조회
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.departmentId) {
          setDepartmentId(data.departmentId);
        }
      })
      .catch(err => console.error('[StaffNotification] Session fetch failed:', err));
  }, []);

  // 2. 부서 작업 목록 패치
  const fetchRequests = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/staff?action=requests');
      const data = await handleResponse<StaffTask[]>(res);
      setTasks(data);
    } catch (err) {
      console.error('[StaffNotification] Fetch failed:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (departmentId) {
      fetchRequests();
    }
  }, [departmentId, fetchRequests]);

  // 3. 실시간 WebSocket(SSE) 구독
  useEffect(() => {
    if (!departmentId) return;

    const handleEvent = (data: any) => {
      if (!data || !data.type) return;
      if (['NEW_REQUEST', 'STATUS_CHANGED', 'CANCEL_REQUEST_RECEIVED', 'CANCEL_APPROVED', 'CANCEL_REJECTED', 'GRACE_EXPIRED'].includes(data.type)) {
        fetchRequests(true);
      }
    };

    const unsubscribeFrontdesk = subscribe('/topic/frontdesk', handleEvent);
    const deptChannel = `/topic/dept/${departmentId}`;
    const unsubscribeDept = subscribe(deptChannel, handleEvent);

    return () => {
      unsubscribeFrontdesk();
      unsubscribeDept();
    };
  }, [subscribe, fetchRequests, departmentId]);

  // 바깥 클릭 시 패널 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // 4. 취소 대기 중인 항목만 필터링
  const pendingCancellations = tasks.filter(
    task => task.cancelRequested && task.status === 'IN_PROGRESS'
  );

  const totalNotifications = pendingCancellations.length;

  // 5. 승인/반려 핸들러
  const handleApproveCancel = async (id: number, version: number) => {
    try {
      const res = await fetch(`/api/staff?action=approveCancellation&id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version })
      });
      if (res.ok) {
        showToast('취소가 승인되었습니다.', 'success');
        fetchRequests(true);
      } else {
        showToast('취소 승인에 실패했습니다.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('취소 승인 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleRejectCancel = async (id: number, version: number) => {
    try {
      const res = await fetch(`/api/staff?action=rejectCancellation&id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version })
      });
      if (res.ok) {
        showToast('취소 요청이 반려되었습니다.', 'success');
        fetchRequests(true);
      } else {
        showToast('취소 반려에 실패했습니다.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('취소 반려 중 오류가 발생했습니다.', 'error');
    }
  };

  return (
    <div className={styles.container} ref={popupRef}>
      <button className={styles.bellButton} onClick={() => setIsOpen(!isOpen)} aria-label="부서 알림함">
        <Bell size={24} color="var(--color-gray-600)" />
        {totalNotifications > 0 && (
          <span className={styles.badge}>{totalNotifications}</span>
        )}
      </button>

      {isOpen && (
        <div className={styles.popup}>
          <div className={styles.header}>
            <h3 className={styles.title}>부서 취소 승인 대기함</h3>
          </div>

          <div className={styles.content}>
            {totalNotifications === 0 ? (
              <div className={styles.empty}>대기 중인 요청이 없습니다.</div>
            ) : (
              <div className={styles.list}>
                {pendingCancellations.map(req => (
                  <NotificationCard
                    key={`cancel-${req.id}`}
                    variant="cancel"
                    title={req.summary}
                    description={req.rawText}
                    roomNumber={req.roomNumber}
                    departmentName={req.departmentName}
                    createdAt={req.createdAt}
                    priority={req.priority}
                    primaryLabel="취소 승인"
                    secondaryLabel="반려"
                    onPrimaryClick={() => handleApproveCancel(req.id, req.version)}
                    onSecondaryClick={() => handleRejectCancel(req.id, req.version)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
