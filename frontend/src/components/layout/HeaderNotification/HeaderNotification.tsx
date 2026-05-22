import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import useFrontdeskRequests from '@/app/frontdesk/useFrontdeskRequests';
import useEscalations from '@/app/frontdesk/requests/useEscalations';
import RejectCancellationModal from '@/app/frontdesk/requests/_components/RejectCancellationModal/RejectCancellationModal';
import RejectEscalationModal from '@/app/frontdesk/requests/_components/RejectEscalationModal/RejectEscalationModal';
import RequestDetailModal from '@/app/frontdesk/requests/_components/RequestDetailModal/RequestDetailModal';
import { useUiStore } from '@/stores/useUiStore';
import NotificationCard from '@/components/ui/NotificationCard/NotificationCard';
import styles from './HeaderNotification.module.css';

export default function HeaderNotification() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const popupRef = useRef<HTMLDivElement>(null);
  const { showToast } = useUiStore();

  // 반려 모달 상태
  const [cancelRejectTarget, setCancelRejectTarget] = useState<number | null>(null);
  const [escalationRejectTarget, setEscalationRejectTarget] = useState<number | null>(null);
  
  // 상세 모달 상태
  const [detailTarget, setDetailTarget] = useState<number | null>(null);

  // 데이터 패치
  const { requests: allRequests, refetch: refetchRequests } = useFrontdeskRequests(undefined, '', 'all', true);
  const { escalations, refetch: refetchEscalations } = useEscalations();

  // 30초마다 현재 시간 갱신 (1분 30초 지연 계산용)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // 1분 30초 초과된 취소 요청 필터링
  const delayedCancelRequests = allRequests.filter(r => {
    if (!r.cancelRequested || !r.cancelRequestedAt) return false;
    const requestedTime = new Date(r.cancelRequestedAt).getTime();
    return (currentTime - requestedTime) > 90 * 1000;
  });

  // 타 부서 긴급 이관 제외 (프론트가 처리할 이관 요청)
  const nonEmergencyEscalations = escalations.filter(r => r.priority !== 'EMERGENCY');

  const totalNotifications = delayedCancelRequests.length + nonEmergencyEscalations.length;

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

  const handleApproveCancel = async (id: number) => {
    try {
      const res = await fetch(`/api/frontdesk/requests/${id}/cancellation/approve`, { method: 'PATCH' });
      if (res.ok) {
        showToast('취소가 승인되었습니다.', 'success');
        refetchRequests();
      } else {
        showToast('취소 승인에 실패했습니다.', 'error');
      }
    } catch (e) { 
      console.error(e);
      showToast('취소 승인 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleRejectCancel = (id: number) => {
    setCancelRejectTarget(id);
  };

  const handleApproveEscalation = async (id: number) => {
    try {
      // 이관 승인: 현재 부서 유지 + NORMAL 우선순위로 에스컬레이션 처리
      const target = escalations.find(r => r.id === id);
      const res = await fetch(`/api/frontdesk/requests/${id}/escalate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId: target?.departmentId || 'FRONT', priority: 'NORMAL' })
      });
      if (res.ok) {
        showToast('이관 요청이 승인되었습니다.', 'success');
        refetchEscalations();
      } else {
        showToast('이관 승인에 실패했습니다.', 'error');
      }
    } catch (e) { 
      console.error(e);
      showToast('이관 승인 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleRejectEscalation = (id: number) => {
    setEscalationRejectTarget(id);
  };

  return (
    <>
    <div className={styles.container} ref={popupRef}>
      <button className={styles.bellButton} onClick={() => setIsOpen(!isOpen)}>
        <Bell size={24} color="var(--color-gray-600)" />
        {totalNotifications > 0 && (
          <span className={styles.badge}>{totalNotifications}</span>
        )}
      </button>

      {isOpen && (
        <div className={styles.popup}>
          <div className={styles.header}>
            <h3 className={styles.title}>타 부서 이관/취소 승인 대기함</h3>
          </div>

          <div className={styles.content}>
            {totalNotifications === 0 ? (
              <div className={styles.empty}>대기 중인 요청이 없습니다.</div>
            ) : (
              <div className={styles.list}>
                {delayedCancelRequests.map(req => (
                  <NotificationCard
                    key={`cancel-${req.id}`}
                    variant="cancel"
                    title={req.summary}
                    description={req.rawText}
                    roomNumber={req.roomNo}
                    departmentName={req.departmentName}
                    createdAt={req.createdAt}
                    priority={req.priority}
                    primaryLabel="취소 승인"
                    secondaryLabel="반려"
                    onPrimaryClick={() => handleApproveCancel(req.id)}
                    onSecondaryClick={() => handleRejectCancel(req.id)}
                    onClick={() => setDetailTarget(req.id)}
                  />
                ))}
                
                {nonEmergencyEscalations.map(req => (
                  <NotificationCard
                    key={`esc-${req.id}`}
                    variant="escalation"
                    title={req.summary}
                    roomNumber={req.roomNo}
                    departmentName={req.departmentName}
                    createdAt={req.createdAt}
                    priority={req.priority}
                    primaryLabel="수락 (배정)"
                    secondaryLabel="반려"
                    onPrimaryClick={() => handleApproveEscalation(req.id)}
                    onSecondaryClick={() => handleRejectEscalation(req.id)}
                    onClick={() => setDetailTarget(req.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>

      {/* 취소 반려 모달 */}
      {cancelRejectTarget !== null && (
        <RejectCancellationModal
          isOpen={true}
          onClose={() => setCancelRejectTarget(null)}
          requestId={cancelRejectTarget}
          onSuccess={() => { setCancelRejectTarget(null); refetchRequests(); }}
        />
      )}

      {/* 이관 반려 모달 */}
      {escalationRejectTarget !== null && (
        <RejectEscalationModal
          isOpen={true}
          onClose={() => setEscalationRejectTarget(null)}
          requestId={escalationRejectTarget}
          onSuccess={() => { setEscalationRejectTarget(null); refetchEscalations(); }}
        />
      )}

      {/* 상세 모달 */}
      {detailTarget !== null && (
        <RequestDetailModal
          isOpen={true}
          onClose={() => setDetailTarget(null)}
          requestId={detailTarget}
          onUpdate={() => {
            refetchRequests();
            refetchEscalations();
          }}
          callerDepartment="FRONT" // 알림을 확인하는 건 프론트데스크이므로 FRONT 전달
        />
      )}
    </>
  );
}
