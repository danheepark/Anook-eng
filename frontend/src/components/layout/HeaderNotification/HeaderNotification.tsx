import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import useAdminRequests from '@/app/admin/useAdminRequests';
import useEscalations from '@/app/admin/front-desk/useEscalations';
import styles from './HeaderNotification.module.css';

export default function HeaderNotification() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const popupRef = useRef<HTMLDivElement>(null);

  // 데이터 패치
  const { requests: allRequests, refetch: refetchRequests } = useAdminRequests(undefined, '', 'all', true);
  const { escalations, refetch: refetchEscalations } = useEscalations();

  // 1분마다 현재 시간 갱신 (3분 지연 계산용)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 3분 초과된 취소 요청 필터링
  const delayedCancelRequests = allRequests.filter(r => {
    if (!r.cancelRequested || !r.cancelRequestedAt) return false;
    const requestedTime = new Date(r.cancelRequestedAt).getTime();
    return (currentTime - requestedTime) > 3 * 60 * 1000;
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
      const res = await fetch(`/api/admin/requests/${id}/cancel/approve`, { method: 'POST' });
      if (res.ok) refetchRequests();
    } catch (e) { console.error(e); }
  };

  const handleRejectCancel = async (id: number) => {
    const reason = window.prompt('반려 사유를 입력해주세요 (선택)');
    if (reason === null) return; // 취소
    try {
      const res = await fetch(`/api/admin/requests/${id}/cancel/reject`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: reason || '프론트데스크 직권 거절' })
      });
      if (res.ok) refetchRequests();
    } catch (e) { console.error(e); }
  };

  const handleApproveEscalation = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/requests/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ASSIGNED' })
      });
      if (res.ok) refetchEscalations();
    } catch (e) { console.error(e); }
  };

  const handleRejectEscalation = async (id: number) => {
    if (!window.confirm('이관 요청을 반려하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/admin/requests/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED' })
      });
      if (res.ok) refetchEscalations();
    } catch (e) { console.error(e); }
  };

  return (
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
                  <div key={`cancel-${req.id}`} className={styles.item}>
                    <div className={styles.itemHeader}>
                      <span className={styles.tagCancel}>취소 요청 지연</span>
                      <span className={styles.roomNo}>객실 {req.roomNo}</span>
                    </div>
                    <p className={styles.summary}>{req.summary}</p>
                    <div className={styles.actions}>
                      <button className={styles.btnApprove} onClick={() => handleApproveCancel(req.id)}>취소 승인</button>
                      <button className={styles.btnReject} onClick={() => handleRejectCancel(req.id)}>반려</button>
                    </div>
                  </div>
                ))}
                
                {nonEmergencyEscalations.map(req => (
                  <div key={`esc-${req.id}`} className={styles.item}>
                    <div className={styles.itemHeader}>
                      <span className={styles.tagEscalate}>이관 요청</span>
                      <span className={styles.roomNo}>객실 {req.roomNo}</span>
                    </div>
                    <p className={styles.summary}>{req.summary}</p>
                    <div className={styles.actions}>
                      <button className={styles.btnApprove} onClick={() => handleApproveEscalation(req.id)}>수락 (배정)</button>
                      <button className={styles.btnReject} onClick={() => handleRejectEscalation(req.id)}>반려</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
