'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import styles from './RequestDetailPanel.module.css';
import Button from '@/components/ui/Button/Button';
import { useUiStore } from '@/stores/useUiStore';
import ConfirmModal from '@/components/ui/Modal/ConfirmModal';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import RejectEscalationModal from '../RejectEscalationModal/RejectEscalationModal';
import ApproveCancellationModal from '../ApproveCancellationModal/ApproveCancellationModal';
import RejectCancellationModal from '../RejectCancellationModal/RejectCancellationModal';
import useApproveEscalation from '../ApproveEscalationModal/useApproveEscalation';
import useRequestDetail from '../RequestDetailModal/useRequestDetail';
import ManualAssignModal from '../ManualAssignModal/ManualAssignModal';
import { useTranslation } from '@/app/useTranslation';

interface Department {
  id: string;
  name: string;
}

interface RequestDetail {
  id: number;
  status: string;
  priority: string;
  departmentId: string;
  departmentName: string;
  entities: Record<string, any> | null;
  rawText: string;
  summary: string;
  confidence: number;
  roomNo: string;
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  cancelRequestedAt: string | null;
  imageUrl?: string | null;
  reasoning?: string;
}

interface RequestDetailPanelProps {
  requestId: number;
  onUpdate: () => void;
  onClose?: () => void;
  onMobileBack?: () => void;
}

const STATUS_MAP: Record<string, { text: string; variant: 'red' | 'purple' | 'green' | 'gray' }> = {
  PENDING: { text: '대기 중', variant: 'red' },
  ASSIGNED: { text: '배정됨', variant: 'purple' },
  IN_PROGRESS: { text: '처리 중', variant: 'green' },
  COMPLETED: { text: '완료', variant: 'gray' },
  ESCALATED: { text: '에스컬레이션', variant: 'red' },
};

export default function RequestDetailPanel({
  requestId,
  onUpdate,
  onClose,
  onMobileBack,
}: RequestDetailPanelProps) {
  const { approveEscalation } = useApproveEscalation();
  const { detail, fetchDetail, changePriority, changeDepartment, cancelRequest, loading } = useRequestDetail();

  const [editPriority, setEditPriority] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmType, setConfirmType] = useState<'none' | 'cancel' | 'approve' | 'reject' | 'cancelApprove' | 'cancelReject'>('none');
  const [showManualAssign, setShowManualAssign] = useState(false);
  const showToast = useUiStore((s) => s.showToast);
  const { t, language } = useTranslation();

  useEffect(() => {
    if (requestId) {
      fetchDetail(requestId);
    }
  }, [requestId]);

  useEffect(() => {
    if (detail) {
      setEditPriority(detail.priority);
      setEditDeptId(detail.departmentId);
    }
  }, [detail]);

  useEffect(() => {
    fetch('/api/frontdesk/departments')
      .then(res => res.json())
      .then((data: Department[]) => setDepartments(data.filter(d => d.id !== 'EMERGENCY')))
      .catch(() => { });
  }, []);

  if (!detail) return null;

  const getTranslatedStatus = (status: string, defaultText: string) => {
    if (detail.departmentId === 'FRONT') {
      if (status === 'PENDING') return language === 'en' ? 'Pending' : '접수 중';
      if (status === 'IN_PROGRESS' || status === 'ASSIGNED') return language === 'en' ? 'Active Chat' : '상담 중';
    }
    if (!t.status) return defaultText;
    if (status === 'PENDING') return t.status.pending || defaultText;
    if (status === 'ASSIGNED') return t.status.assigned || defaultText;
    if (status === 'IN_PROGRESS') return t.status.inProgress || defaultText;
    if (status === 'COMPLETED') return t.status.completed || defaultText;
    if (status === 'CANCELLED') return t.status.cancelled || defaultText;
    if (status === 'ESCALATED') return t.status.escalated || defaultText;
    return defaultText;
  };

  let variant = STATUS_MAP[detail.status]?.variant || ('gray' as const);
  if (detail.departmentId === 'FRONT') {
    if (detail.status === 'PENDING') variant = 'red';
    if (detail.status === 'IN_PROGRESS' || detail.status === 'ASSIGNED') variant = 'green';
  }

  const statusInfo = STATUS_MAP[detail.status]
    ? { text: getTranslatedStatus(detail.status, STATUS_MAP[detail.status].text), variant }
    : { text: detail.status, variant: 'gray' as const };

  const hasChanges =
    editPriority !== detail.priority ||
    editDeptId !== detail.departmentId;

  const handleSave = async (newDeptId: string, newPriority: string, newSummary?: string, newDescription?: string) => {
    setSaving(true);
    let changed = false;

    if (newPriority !== detail.priority) {
      const ok = await changePriority(detail.id, newPriority);
      if (ok) changed = true;
    }

    // 항상 배정/저장 API를 호출하여 태스크 티켓이 발행되도록 보장
    if (newDeptId) {
      const ok = await changeDepartment(detail.id, newDeptId, newSummary, newDescription);
      if (ok) changed = true;
    }

    setSaving(false);
    if (changed) {
      onUpdate();
      setShowManualAssign(false);
      onClose?.();
    }
  };

  const handleCancel = async () => {
    setConfirmType('none');
    setSaving(true);
    const ok = await cancelRequest(detail.id);
    setSaving(false);
    if (ok) {
      showToast(language === 'en' ? 'Request has been cancelled.' : '요청이 취소되었습니다.', 'success');
      onUpdate();
      onClose?.();
    } else {
      showToast(language === 'en' ? 'Failed to cancel request.' : '요청 취소에 실패했습니다.', 'error');
    }
  };

  const handleApproveEscalation = async () => {
    setConfirmType('none');

    setSaving(true);
    // 상세 모달 내에서 직접 승인할 때는 현재 모달에 세팅된 editDeptId와 editPriority 값을 전달합니다.
    const ok = await approveEscalation(detail.id, editDeptId, editPriority);
    setSaving(false);
    if (ok) {
      showToast(language === 'en' ? 'Escalation approved and pending reassignment.' : '에스컬레이션이 승인되어 재배정 대기 상태가 되었습니다.', 'success');
      onUpdate();
      onClose?.();
    } else {
      showToast(language === 'en' ? 'Failed to approve escalation.' : '승인 처리에 실패했습니다.', 'error');
    }
  };

  const formatTimeDisplay = (createdAt: string, status: string) => {
    if (!createdAt) return '';
    const createdDate = new Date(createdAt);
    const isFinished = status === 'COMPLETED' || status === 'CANCELLED';

    if (isFinished) {
      if (language === 'ko') {
        const yyyy = createdDate.getFullYear();
        const m = createdDate.getMonth() + 1;
        const d = createdDate.getDate();
        let hours = createdDate.getHours();
        const ampm = hours >= 12 ? '오후' : '오전';
        hours = hours % 12 || 12;
        const minutes = String(createdDate.getMinutes()).padStart(2, '0');
        return `${yyyy}년 ${m}월 ${d}일 · ${ampm} ${hours}:${minutes}`;
      }
      return (
        createdDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }) +
        ' · ' +
        createdDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      );
    }

    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - createdDate.getTime());
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (language === 'ko') {
      if (diffMins < 1) return '방금 전 요청됨';
      if (diffMins < 60) return `${diffMins}분 전 요청됨`;
      if (diffHours < 24) return `${diffHours}시간 전 요청됨`;
      return `${diffDays}일 전 요청됨`;
    }

    if (diffMins < 1) return 'Requested just now';
    if (diffMins === 1) return 'Requested 1 min ago';
    if (diffMins < 60) return `Requested ${diffMins} mins ago`;
    if (diffHours === 1) return 'Requested 1 hr ago';
    if (diffHours < 24) return `Requested ${diffHours} hrs ago`;
    return `Requested ${diffDays} days ago`;
  };

  const extractReasoningBullets = (reasoningStr?: string | null, entitiesReasoning?: any): string[] => {
    const raw = reasoningStr || entitiesReasoning || '';
    if (!raw) return [];
    return String(raw)
      .replace(/\\n/g, '\n')
      .replace(/([^\n])\s*([•·\*\-])\s+/g, '$1\n$2 ')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '' && !line.toLowerCase().includes('confidence:'))
      .map(line => /^[•·\*\-]\s*/.test(line) ? line.replace(/^[·\*\-]\s*/, '• ') : `• ${line}`);
  };

  return (
    <div className={styles.panel}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {onMobileBack && (
            <button className={styles.mobileBackBtn} onClick={onMobileBack} aria-label={language === 'en' ? 'Go to chat' : '채팅으로 가기'}>
              <ChevronLeft size={22} />
            </button>
          )}
          <h2 className={styles.title}>{t.frontdeskPage?.requestDetailModal?.title || '요청 상세'}</h2>
        </div>
        <div className={styles.headerRight}>
          <StatusBadge variant={statusInfo.variant}>{statusInfo.text}</StatusBadge>
        </div>
      </div>

      <div className={styles.detailContent}>
        {/* 1. 최상단 시간 표시 */}
        <div className={styles.timeSection}>
          <span className={styles.timeText}>
            {formatTimeDisplay(detail.createdAt, detail.status)}
          </span>
        </div>

        {/* 2. Review required 섹션 */}
        {(() => {
          const bullets = extractReasoningBullets(detail.reasoning, detail.entities?.reasoning);
          if (bullets.length === 0) return null;
          return (
            <div className={styles.reviewSection}>
              <h3 className={styles.reviewTitle}>
                {language === 'en' ? 'Review required' : '검토 필요 사항'}
              </h3>
              <div className={styles.bulletList}>
                {bullets.map((bullet, idx) => (
                  <div key={idx} className={styles.bulletItem}>
                    {bullet}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* 3. 첨부 사진 */}
        {detail.imageUrl && (
          <div className={styles.photoSection}>
            <h3 className={styles.photoTitle}>{language === 'en' ? 'Attached Photo' : '첨부 사진'}</h3>
            <div className={styles.photoBox}>
              <img src={detail.imageUrl} alt={language === 'en' ? 'Attached Photo' : '첨부 사진'} className={styles.photoImg} />
            </div>
          </div>
        )}

        <div className={styles.footer}>
          <div className={styles.footerRight}>
            {!showManualAssign && detail.status !== 'COMPLETED' && detail.status !== 'CANCELLED' && (
              <Button variant="primary" onClick={() => setShowManualAssign(true)}>
                {t.frontdeskPage?.requestDetailModal?.manualAssign || '수동 배정'}
              </Button>
            )}
            {detail.status === 'ESCALATED' ? (
              <Button variant="primary" onClick={() => setConfirmType('approve')} disabled={saving || loading}>
                {t.frontdeskPage?.requestDetailModal?.approveEscalation || '에스컬레이션 승인'}
              </Button>
            ) : null}
          </div>

          {detail.status === 'ESCALATED' ? (
            <Button variant="secondary" onClick={() => setConfirmType('reject')} style={{ color: 'var(--color-error)' }} disabled={saving || loading}>
              {t.frontdeskPage?.requestDetailModal?.rejectEscalation || '에스컬레이션 반려'}
            </Button>
          ) : detail.cancelRequested ? (
            <>
              <Button variant="secondary" onClick={() => setConfirmType('cancelReject')} style={{ color: 'var(--color-error)' }} disabled={saving || loading}>
                {t.frontdeskPage?.requestDetailModal?.rejectCancel || '취소 반려'}
              </Button>
              <Button variant="primary" onClick={() => setConfirmType('cancelApprove')} disabled={saving || loading}>
                {t.frontdeskPage?.requestDetailModal?.approveCancel || '취소 승인'}
              </Button>
            </>
          ) : detail.status !== 'COMPLETED' && detail.status !== 'CANCELLED' ? (
            <Button variant="secondary" onClick={() => setConfirmType('cancel')} style={{ color: 'var(--color-error)' }}>
              {t.frontdeskPage?.requestDetailModal?.forceCancelRequest || '강제 요청 취소'}
            </Button>
          ) : null}
        </div>

        <ConfirmModal
          isOpen={confirmType === 'cancel'}
          onClose={() => setConfirmType('none')}
          onConfirm={handleCancel}
          title="요청 취소"
          subtitle="정말 요청을 취소하시겠습니까?"
          status="danger"
          cancelText="아니오"
          confirmText="예, 취소합니다"
        />

        <ConfirmModal
          isOpen={confirmType === 'approve'}
          onClose={() => setConfirmType('none')}
          onConfirm={handleApproveEscalation}
          title="에스컬레이션 승인"
          subtitle={`선택한 부서(${departments.find(d => d.id === editDeptId)?.name || '...'})로 재배정하며 승인합니다.`}
          cancelText="아니오"
          confirmText="승인하기"
        />

        {confirmType === 'reject' && detail && (
          <RejectEscalationModal
            isOpen={true}
            onClose={() => setConfirmType('none')}
            requestId={detail.id}
            onSuccess={() => {
              onUpdate();
              onClose?.();
            }}
          />
        )}

        {confirmType === 'cancelApprove' && detail && (
          <ApproveCancellationModal
            isOpen={true}
            onClose={() => setConfirmType('none')}
            requestId={detail.id}
            onSuccess={() => {
              onUpdate();
              onClose?.();
            }}
          />
        )}

        {confirmType === 'cancelReject' && detail && (
          <RejectCancellationModal
            isOpen={true}
            onClose={() => setConfirmType('none')}
            requestId={detail.id}
            onSuccess={() => {
              onUpdate();
              onClose?.();
            }}
          />
        )}

        {detail && (
          <ManualAssignModal
            isOpen={showManualAssign}
            onClose={() => setShowManualAssign(false)}
            detail={{
              ...detail,
              description: ''
            }}
            departments={departments}
            onSave={handleSave}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}
