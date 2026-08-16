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

  const formatExactDateTime = (createdAt?: string) => {
    if (!createdAt) return '';
    const createdDate = new Date(createdAt.replace(' ', 'T'));
    if (isNaN(createdDate.getTime())) return createdAt;

    const hours = String(createdDate.getHours()).padStart(2, '0');
    const minutes = String(createdDate.getMinutes()).padStart(2, '0');
    const year = createdDate.getFullYear();
    const timeStr = `${hours}:${minutes}`;

    if (language === 'ko') {
      return `${timeStr} ${year}년 ${createdDate.getMonth() + 1}월 ${createdDate.getDate()}일`;
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[createdDate.getMonth()];
    const day = createdDate.getDate();

    return `${timeStr} ${month} ${day} ${year}`;
  };

  interface ReasoningItem {
    label: string;
    content: string;
  }

  const extractReasoningItems = (reasoningStr?: string | null, entitiesReasoning?: any, lang: string = 'en'): ReasoningItem[] => {
    const raw = reasoningStr || entitiesReasoning || '';
    if (!raw) return [];

    const rawLines = String(raw)
      .replace(/\\n/g, '\n')
      .replace(/([^\n])\s*([•·\*\-])\s+/g, '$1\n$2 ')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '' && !line.toLowerCase().includes('confidence:'));

    const cleanedLines = rawLines.map(line => {
      let clean = line.replace(/^[•·\*\-]\s*/, '').trim();
      clean = clean.replace(/^Handover\s*reason:\s*/i, '').trim();
      clean = clean.replace(/^Guest\s*context:\s*/i, '').trim();
      clean = clean.replace(/^이관\s*사유:\s*/i, '').trim();
      clean = clean.replace(/^손님\s*특이사항:\s*/i, '').trim();
      clean = clean.replace(/^고객\s*특이사항:\s*/i, '').trim();
      return clean;
    }).filter(line => line !== '');

    if (cleanedLines.length === 0) return [];

    const items: ReasoningItem[] = [];

    // 1st: Handover reason (Always)
    if (cleanedLines[0]) {
      items.push({
        label: lang === 'ko' ? '이관 사유' : (lang === 'ja' ? '引き継ぎ理由' : (lang === 'zh' ? '移交原因' : 'Why it was handed over')),
        content: cleanedLines[0],
      });
    }

    // 2nd: Guest context (Only if present)
    if (cleanedLines[1]) {
      items.push({
        label: lang === 'ko' ? '고객 특이사항' : (lang === 'ja' ? 'お客様の特記事項' : (lang === 'zh' ? '客人特殊需求' : 'Guest context')),
        content: cleanedLines[1],
      });
    }

    for (let i = 2; i < cleanedLines.length; i++) {
      items.push({
        label: `${lang === 'ko' ? '추가 정보' : 'Additional info'} ${i - 1}`,
        content: cleanedLines[i],
      });
    }

    return items;
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
        {/* 1. Created at 일시 */}
        {detail.createdAt && (
          <div className={styles.reasoningItem}>
            <span className={styles.secondaryLabel}>
              {language === 'ko' ? '요청 일시' : 'Created at'}
            </span>
            <p className={styles.reasoningText}>
              {formatExactDateTime(detail.createdAt)}
            </p>
          </div>
        )}

        {/* 2. Reasoning 섹션 (Why it was handed over / Guest context) */}
        {(() => {
          const items = extractReasoningItems(detail.reasoning, detail.entities?.reasoning, language);
          if (items.length === 0) return null;
          return items.map((item, idx) => (
            <div key={idx} className={styles.reasoningItem}>
              <span className={styles.secondaryLabel}>{item.label}</span>
              <p className={styles.reasoningText}>{item.content}</p>
            </div>
          ));
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
          {!showManualAssign && detail.status !== 'COMPLETED' && detail.status !== 'CANCELLED' && (
            <Button size="large" variant="primary" fullWidth onClick={() => setShowManualAssign(true)}>
              {t.frontdeskPage?.requestDetailModal?.manualAssign || '수동 배정'}
            </Button>
          )}

          {detail.status === 'ESCALATED' && (
            <>
              <Button size="large" variant="primary" fullWidth onClick={() => setConfirmType('approve')} disabled={saving || loading}>
                {t.frontdeskPage?.requestDetailModal?.approveEscalation || '에스컬레이션 승인'}
              </Button>
              <Button size="large" variant="secondary" fullWidth onClick={() => setConfirmType('reject')} style={{ color: 'var(--color-error)' }} disabled={saving || loading}>
                {t.frontdeskPage?.requestDetailModal?.rejectEscalation || '에스컬레이션 반려'}
              </Button>
            </>
          )}

          {detail.cancelRequested && (
            <>
              <Button size="large" variant="primary" fullWidth onClick={() => setConfirmType('cancelApprove')} disabled={saving || loading}>
                {t.frontdeskPage?.requestDetailModal?.approveCancel || '취소 승인'}
              </Button>
              <Button size="large" variant="secondary" fullWidth onClick={() => setConfirmType('cancelReject')} style={{ color: 'var(--color-error)' }} disabled={saving || loading}>
                {t.frontdeskPage?.requestDetailModal?.rejectCancel || '취소 반려'}
              </Button>
            </>
          )}

          {!detail.cancelRequested && detail.status !== 'ESCALATED' && detail.status !== 'COMPLETED' && detail.status !== 'CANCELLED' && (
            <div className={styles.cancelActionGroup}>
              <Button size="large" variant="secondary" fullWidth onClick={() => setConfirmType('cancel')} style={{ color: 'var(--color-error)' }}>
                {t.frontdeskPage?.requestDetailModal?.forceCancelRequest || '강제 요청 취소'}
              </Button>
              <div className={styles.cancelNote}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={styles.shieldIcon}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span>
                  {language === 'en'
                    ? 'Cancelling will notify the guest and close this request.'
                    : '취소 시 고객에게 알림이 전송되고 요청이 종료됩니다.'}
                </span>
              </div>
            </div>
          )}
        </div>

        <ConfirmModal
          isOpen={confirmType === 'cancel'}
          onClose={() => setConfirmType('none')}
          onConfirm={handleCancel}
          title={language === 'ko' ? '요청 취소' : 'Cancel Request'}
          subtitle={language === 'ko' ? '정말 요청을 취소하시겠습니까?' : 'Are you sure you want to cancel this request?'}
          status="danger"
          cancelText={language === 'ko' ? '아니오' : 'No'}
          confirmText={language === 'ko' ? '예, 취소합니다' : 'Yes, cancel'}
        />

        <ConfirmModal
          isOpen={confirmType === 'approve'}
          onClose={() => setConfirmType('none')}
          onConfirm={handleApproveEscalation}
          title={language === 'ko' ? '에스컬레이션 승인' : 'Approve Escalation'}
          subtitle={language === 'ko'
            ? `선택한 부서(${departments.find(d => d.id === editDeptId)?.name || '...'})로 재배정하며 승인합니다.`
            : `Reassign to ${departments.find(d => d.id === editDeptId)?.name || 'the selected department'} and approve.`}
          cancelText={language === 'ko' ? '아니오' : 'No'}
          confirmText={language === 'ko' ? '승인하기' : 'Approve'}
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
