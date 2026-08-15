import React, { useState, useEffect, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import useFrontdeskRequests from '@/app/frontdesk/useFrontdeskRequests';
import useEscalations from '@/app/frontdesk/requests/useEscalations';
import RejectCancellationModal from '@/app/frontdesk/requests/_components/RejectCancellationModal/RejectCancellationModal';
import RejectEscalationModal from '@/app/frontdesk/requests/_components/RejectEscalationModal/RejectEscalationModal';
import RequestDetailModal from '@/app/frontdesk/requests/_components/RequestDetailModal/RequestDetailModal';
import { useUiStore } from '@/stores/useUiStore';
import { useTranslation } from '@/app/useTranslation';
import NotificationCard from '@/components/ui/NotificationCard/NotificationCard';
import styles from './HeaderNotification.module.css';

export default function HeaderNotification() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const popupRef = useRef<HTMLDivElement>(null);
  const { showToast } = useUiStore();
  const { language } = useTranslation();

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

  const allNotifications = [
    ...delayedCancelRequests.map(req => ({ type: 'cancel' as const, data: req, time: req.cancelRequestedAt || req.createdAt })),
    ...nonEmergencyEscalations.map(req => ({ type: 'escalation' as const, data: req as any, time: req.updatedAt || req.createdAt }))
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const totalNotifications = allNotifications.length;

  const handleApproveCancel = async (id: number) => {
    try {
      const res = await fetch(`/api/frontdesk/requests/${id}/cancellation/approve`, { method: 'PATCH' });
      if (res.ok) {
        showToast(language === 'en' ? 'Cancellation approved.' : '취소가 승인되었습니다.', 'success');
        refetchRequests();
      } else {
        showToast(language === 'en' ? 'Failed to approve cancellation.' : '취소 승인에 실패했습니다.', 'error');
      }
    } catch (e) { 
      console.error(e);
      showToast(language === 'en' ? 'An error occurred during approval.' : '취소 승인 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleRejectCancel = (id: number) => {
    setCancelRejectTarget(id);
  };

  const handleApproveEscalation = async (id: number) => {
    try {
      const target = escalations.find(r => r.id === id);
      const res = await fetch(`/api/frontdesk/requests/${id}/escalate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId: target?.departmentId || 'FRONT', priority: 'NORMAL' })
      });
      if (res.ok) {
        showToast(language === 'en' ? 'Transfer request approved.' : '이관 요청이 승인되었습니다.', 'success');
        refetchEscalations();
      } else {
        showToast(language === 'en' ? 'Failed to approve transfer.' : '이관 승인에 실패했습니다.', 'error');
      }
    } catch (e) { 
      console.error(e);
      showToast(language === 'en' ? 'An error occurred during transfer approval.' : '이관 승인 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleRejectEscalation = (id: number) => {
    setEscalationRejectTarget(id);
  };

  const formatDeptName = (codeOrName: string) => {
    if (!codeOrName) return '';
    const upper = codeOrName.toUpperCase();
    if (upper.includes('HK') || upper.includes('HOUSEKEEPING') || upper.includes('하우스키핑')) {
      return language === 'en' ? 'Housekeeping' : '하우스키핑';
    }
    if (upper.includes('FB') || upper.includes('FNB') || upper.includes('식음료')) {
      return language === 'en' ? 'F&B' : 'F&B';
    }
    if (upper.includes('FACILITY') || upper.includes('MAINTENANCE') || upper.includes('시설')) {
      return language === 'en' ? 'Facility' : '시설관리';
    }
    if (upper.includes('CONCIERGE') || upper.includes('컨시어지')) {
      return language === 'en' ? 'Concierge' : '컨시어지';
    }
    if (upper.includes('EMERGENCY') || upper.includes('긴급')) {
      return language === 'en' ? 'Emergency' : '긴급대응팀';
    }
    if (upper.includes('FRONT') || upper.includes('프론트')) {
      return language === 'en' ? 'Front Desk' : '프론트데스크';
    }
    return codeOrName;
  };

  return (
    <>
    <div className={styles.container} ref={popupRef}>
      <button className={styles.bellButton} onClick={() => setIsOpen(!isOpen)} aria-label={language === 'en' ? 'Notifications' : '알림'}>
        <Bell size={18} color="currentColor" />
        {totalNotifications > 0 && (
          <span className={styles.unreadDot} />
        )}
      </button>

      {isOpen && (
        <div className={styles.popup}>
          <div className={styles.header}>
            <h3 className={styles.title}>
              {language === 'en' ? 'Pending Approvals' : '타 부서 이관/취소 승인 대기함'}
            </h3>
            <button className={styles.closeButton} onClick={() => setIsOpen(false)} aria-label={language === 'en' ? 'Close' : '닫기'}>
              <X size={20} />
            </button>
          </div>

          <div className={styles.content}>
            {totalNotifications === 0 ? (
              <div className={styles.empty}>
                {language === 'en' ? 'No pending requests.' : '대기 중인 요청이 없습니다.'}
              </div>
            ) : (
              <div className={styles.list}>
                {allNotifications.map(({ type, data: req, time }) => {
                  if (type === 'cancel') {
                    const rawParts = req.rawText ? req.rawText.split('\n|||TRANSFER_REASON|||') : [];
                    let cleanDesc = rawParts[0] || '';
                    cleanDesc = cleanDesc.split(/\[주문\s*상세\]/i)[0].trim();
                    cleanDesc = cleanDesc.replace(/^details:\s*/i, '').trim();
                    
                    return (
                    <NotificationCard
                      key={`cancel-${req.id}`}
                      variant="cancel"
                      title={req.summary}
                      description={cleanDesc}
                      roomNumber={req.roomNo}
                      departmentName={formatDeptName(req.departmentName)}
                      createdAt={time}
                      priority={req.priority}
                      primaryLabel={language === 'en' ? 'Approve Cancel' : '취소 승인'}
                      secondaryLabel={language === 'en' ? 'Reject' : '반려'}
                      onPrimaryClick={() => handleApproveCancel(req.id)}
                      onSecondaryClick={() => handleRejectCancel(req.id)}
                      onClick={() => setDetailTarget(req.id)}
                    />
                    );
                  } else {
                    const rawParts = req.rawText ? req.rawText.split('\n|||TRANSFER_REASON|||') : [];
                    const lastTransferPart = rawParts.length > 1 ? rawParts[rawParts.length - 1].trim() : '';
                    
                    let senderDeptName = req.departmentName;
                    let transferReason = '';

                    // 1. 발신 부서 파싱: "[HK] 사유" 형태
                    const match = lastTransferPart.match(/^\[([A-Z_]+)\]/);
                    if (match) {
                      senderDeptName = match[1];
                    } else if (senderDeptName === '프론트데스크' || senderDeptName === 'Front Desk') {
                      senderDeptName = 'HK';
                    }

                    // 2. 이관 사유 중 상세 설명만 추출: "[HK] 제목\n상세설명" -> "상세설명"
                    const cleanPart = lastTransferPart.replace(/^\[[A-Z0-9_]+\]\s*[^\n]*/i, '').trim();
                    transferReason = cleanPart;
                    
                    return (
                    <NotificationCard
                      key={`esc-${req.id}`}
                      variant="escalation"
                      title={req.summary}
                      description={transferReason}
                      roomNumber={req.roomNo}
                      departmentName={formatDeptName(senderDeptName)}
                      createdAt={time}
                      priority={req.priority}
                      primaryLabel={language === 'en' ? 'Accept (Assign)' : '수락 (배정)'}
                      secondaryLabel={language === 'en' ? 'Reject' : '반려'}
                      onPrimaryClick={() => handleApproveEscalation(req.id)}
                      onSecondaryClick={() => handleRejectEscalation(req.id)}
                      onClick={() => setDetailTarget(req.id)}
                    />
                    );
                  }
                })}
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
