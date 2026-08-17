'use client';

import React, { useState, useEffect } from 'react';
import { History } from 'lucide-react';
import styles from './RequestDetailModal.module.css';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import Button from '@/components/ui/Button/Button';
import Dropdown from '@/components/ui/Dropdown/Dropdown';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import { useUiStore } from '@/stores/useUiStore';
import ConfirmModal from '@/components/ui/Modal/ConfirmModal';
import RejectEscalationModal from '../RejectEscalationModal/RejectEscalationModal';
import ApproveCancellationModal from '../ApproveCancellationModal/ApproveCancellationModal';
import RejectCancellationModal from '../RejectCancellationModal/RejectCancellationModal';
import useApproveEscalation from '../ApproveEscalationModal/useApproveEscalation';
import useRequestDetail from './useRequestDetail';
import ManualAssignModal from '../ManualAssignModal/ManualAssignModal';
import ChatHistoryModal from '@/app/staff/_components/TaskDetailModal/ChatHistoryModal';
import { useTranslation } from '@/app/useTranslation';
import { useTranslationApi } from '@/app/useTranslationApi';
import { useRouter } from 'next/navigation';

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
  cancelRequested?: boolean;
  cancelRequestedAt: string | null;
  imageUrl?: string | null;
  reasoning?: string;
}

interface RequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: number;
  onUpdate: () => void;
  /** 모달을 연 페이지의 부서 ID. FRONT가 아닌 경우 부서 변경 시 이관 요청(ESCALATED)으로 처리 */
  callerDepartment?: string;
}



const STATUS_VARIANT_MAP: Record<string, 'red' | 'purple' | 'green' | 'gray'> = {
  PENDING: 'red',
  ASSIGNED: 'purple',
  IN_PROGRESS: 'green',
  COMPLETED: 'gray',
  CANCELLED: 'gray',
  ESCALATED: 'red',
};

/** 직원에게 보여줄 필요 없는 내부 키 (섹션 표시 판단 + 순회에서 모두 제외) */
const HIDDEN_ENTITY_KEYS = new Set(['intent', 'allergen_warning', 'item_requests', 'service_requests', 'target_time', 'tasks', 'task']);

/** 배열 타입 특수 렌더러가 필요한 키 (key-value 순회에서만 스킵, 섹션 표시 판단에서는 포함) */
const ARRAY_KEYS = new Set(['items', 'menu_items']);

interface TaskReasoningItem {
  label: string;
  content: string;
}

const getDeptDisplayName = (deptId?: string, deptName?: string, lang: string = 'en') => {
  if (lang === 'ko') {
    if (deptId === 'HK') return '하우스키핑';
    if (deptId === 'FB') return '식음료(F&B)';
    if (deptId === 'FACILITY') return '시설관리';
    if (deptId === 'CONCIERGE') return '컨시어지';
    if (deptId === 'FRONT') return '프론트데스크';
    return deptName || '해당 부서';
  }
  if (deptId === 'HK') return 'Housekeeping';
  if (deptId === 'FB') return 'Food & Beverage';
  if (deptId === 'FACILITY') return 'Facility Management';
  if (deptId === 'CONCIERGE') return 'Concierge';
  if (deptId === 'FRONT') return 'Front Desk';
  return deptName || 'this department';
};

const cleanTitleSummary = (text?: string) => {
  if (!text) return '';
  return text
    .replace(/\s+at\s+\d{1,2}:\d{2}(\s*(?:AM|PM|am|pm))?/gi, '')
    .replace(/\s+at\s+\d{1,2}\s*(?:AM|PM|am|pm)/gi, '')
    .trim();
};

const extractTaskReasoningItems = (
  reasoningStr?: string | null,
  entitiesReasoning?: any,
  deptId?: string,
  deptName?: string,
  lang: string = 'en',
  targetTime?: string
): TaskReasoningItem[] => {
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
    clean = clean.replace(/^What the guest requested:\s*/i, '').trim();
    clean = clean.replace(/^Guest request:\s*/i, '').trim();
    clean = clean.replace(/^Why this task belongs to [^:]+:\s*/i, '').trim();
    clean = clean.replace(/^Operational context:\s*/i, '').trim();
    clean = clean.replace(/^Special considerations:\s*/i, '').trim();
    clean = clean.replace(/^고객 요청 내용:\s*/i, '').trim();
    clean = clean.replace(/^고객 요청:\s*/i, '').trim();
    clean = clean.replace(/^배정 사유:\s*/i, '').trim();
    clean = clean.replace(/^특이사항:\s*/i, '').trim();
    return clean;
  }).filter(line => {
    if (!line) return false;
    const lower = line.toLowerCase();
    // 1) 'Why this task belongs to [department]' 등 당연한 배정 설명 제외
    if (
      lower.includes('falls under') ||
      lower.includes('belongs to') ||
      lower.includes('is handled by') ||
      lower.includes('responsibilities') ||
      lower.includes('responsibility') ||
      lower.includes('배정 사유') ||
      lower.includes('부서 업무')
    ) {
      return false;
    }
    // 2) 'The request is clear and does not require...' 등 무의미한 filler 문장 제외
    if (
      lower.includes('does not require additional') ||
      lower.includes('no additional operational context') ||
      lower.includes('no additional context') ||
      lower.includes('standard operational procedure') ||
      lower.includes('no special requirements') ||
      lower.includes('no special operational') ||
      lower === 'none' ||
      lower === 'none.'
    ) {
      return false;
    }
    return true;
  });

  if (cleanedLines.length === 0) return [];

  const items: TaskReasoningItem[] = [];

  // 1st: Guest request (간결하게 정제)
  if (cleanedLines[0]) {
    let text = cleanedLines[0];
    if (text.toLowerCase().startsWith('the guest requested')) {
      text = text.replace(/^the guest requested (a |an |to |for )?/i, '').trim();
      if (text.endsWith('.')) text = text.slice(0, -1).trim();
      if (targetTime && text.toLowerCase().includes('at a specific time')) {
        text = text.replace(/at a specific time/i, `at ${targetTime}`);
      }
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }
    items.push({
      label: lang === 'ko' ? '고객 요청' : 'Guest request',
      content: text,
    });
  }

  // 2nd: Operational context (의미 있는 특이사항이 있을 때만 표시)
  if (cleanedLines[1]) {
    items.push({
      label: lang === 'ko' ? '특이사항' : 'Operational context',
      content: cleanedLines[1],
    });
  }

  // 3rd+: Additional info
  for (let i = 2; i < cleanedLines.length; i++) {
    items.push({
      label: lang === 'ko' ? `추가 정보 ${i - 1}` : `Additional info ${i - 1}`,
      content: cleanedLines[i],
    });
  }

  return items;
};

function renderEntities(entities: Record<string, any>, t: any, language: string): React.ReactNode {
  const rendered: React.ReactNode[] = [];

  // 0) 정규화: item 키 단독 혹은 item+count 플랫 키 → items 배열로 통일 (AI 응답 형식 불일치 보정)
  if (entities.item && !entities.items?.length) {
    entities = { ...entities, items: [{ item: entities.item, count: entities.count || 1 }] };
    delete entities.item;
    delete entities.count;
  }

  const labels = t.frontdeskPage.requestDetailModal.entityLabels;

  // 1) 배열 타입 특수 렌더링
  if (entities.items?.length > 0) {
    rendered.push(
      <div key="items" className={styles.reasoningItem}>
        <span className={styles.secondaryLabel}>{labels.items}</span>
        <div className={styles.reasoningText}>
          {entities.items.map((it: any, idx: number) => {
            const itemText = typeof it.item === 'object' && it.item !== null ? (it.item.name || it.item.id || '') : it.item;
            return <div key={idx}>• {itemText} - {it.count}{labels.countSuffix}</div>;
          })}
        </div>
      </div>
    );
  }
  if (entities.menu_items?.length > 0) {
    rendered.push(
      <div key="menu_items" className={styles.reasoningItem}>
        <span className={styles.secondaryLabel}>{labels.menu_items}</span>
        <div className={styles.reasoningText}>
          {entities.menu_items.map((mi: any, idx: number) => (
            <div key={idx}>
              • {mi.name} - {mi.quantity}{labels.countSuffix}
              {mi.selected_option && mi.selected_option !== '없음' && mi.selected_option !== 'None' && ` (${labels.option}: ${mi.selected_option})`}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2) 일반 Key-Value 렌더링
  for (const [key, value] of Object.entries(entities)) {
    // 숨길 키이거나 이미 처리된 배열 키면 스킵
    if (HIDDEN_ENTITY_KEYS.has(key) || ARRAY_KEYS.has(key) || key === 'reasoning') continue;
    // 값이 비어있으면 스킵
    if (value === null || value === undefined || value === '' || value === false || value === '없음' || value === 'None') continue;

    const label = labels[key as keyof typeof labels] || key; // 매핑 없으면 영어 키 그대로 표시 (폴백)

    // boolean true인 경우 라벨만 표시 (예: is_contactless -> "비대면 배달")
    if (value === true) {
      rendered.push(
        <div key={key} className={styles.reasoningItem}>
          <span className={styles.secondaryLabel}>{label}</span>
        </div>
      );
      continue;
    }

    const displayValue = typeof value === 'object' && value !== null
      ? (value.name || value.id || JSON.stringify(value))
      : String(value);

    rendered.push(
      <div key={key} className={styles.reasoningItem}>
        <span className={styles.secondaryLabel}>{label}</span>
        <p className={styles.reasoningText} style={{ fontWeight: 600 }}>{displayValue}</p>
      </div>
    );
  }

  return rendered.length > 0 ? rendered : null;
}

export default function RequestDetailModal({
  isOpen,
  onClose,
  requestId,
  onUpdate,
  callerDepartment = 'FRONT',
}: RequestDetailModalProps) {
  const { approveEscalation } = useApproveEscalation();
  const { detail, fetchDetail, changePriority, changeDepartment, requestEscalation, cancelRequest, loading } = useRequestDetail();
  const router = useRouter();

  const activeDetail = detail;

  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false);
  const [showManualAssign, setShowManualAssign] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const { showToast } = useUiStore();
  const { t, language } = useTranslation();
  const { translatedText: translatedSummary } = useTranslationApi(activeDetail?.summary, language);

  const [editPriority, setEditPriority] = useState(activeDetail?.priority || 'NORMAL');
  const [editDeptId, setEditDeptId] = useState(activeDetail?.departmentId || 'HK');
  const [saving, setSaving] = useState(false);
  const [confirmType, setConfirmType] = useState<'none' | 'cancel' | 'approve' | 'reject' | 'cancelApprove' | 'cancelReject'>('none');

  useEffect(() => {
    if (activeDetail) {
      setEditPriority(activeDetail.priority);
      setEditDeptId(activeDetail.departmentId);
    }
  }, [activeDetail]);

  useEffect(() => {
    if (isOpen && requestId) {
      fetchDetail(requestId);
    }
  }, [isOpen, requestId, fetchDetail]);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/frontdesk/departments')
      .then(res => res.json())
      .then((data: Department[]) => setDepartments(data.filter(d => d.id !== 'EMERGENCY')))
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  if (loading || !activeDetail) {
    return (
      <ModalOverlay isOpen={isOpen} onClose={onClose}>
        <ModalCard size="md" overflowVisible={false} onClose={onClose}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '260px', color: 'var(--color-gray-400)', font: 'var(--text-body-medium)' }}>
            <span>{t.common?.loading || 'Loading...'}</span>
          </div>
        </ModalCard>
      </ModalOverlay>
    );
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING': return t.cardUI.status.pending;
      case 'ASSIGNED': return t.status.assigned || 'Assigned';
      case 'IN_PROGRESS': return t.cardUI.status.inProgress;
      case 'COMPLETED': return t.cardUI.status.completedMark;
      case 'CANCELLED': return t.cardUI.status.cancelled;
      case 'ESCALATED': return t.cardUI.status.escalated;
      default: return status;
    }
  };

  const statusInfo = {
    text: getStatusText(activeDetail.status),
    variant: STATUS_VARIANT_MAP[activeDetail.status] ?? 'gray',
  };

  const hasChanges =
    editPriority !== activeDetail.priority ||
    editDeptId !== activeDetail.departmentId;

  const handleSave = async () => {
    setSaving(true);
    let changed = false;

    if (editPriority !== activeDetail.priority) {
      const ok = await changePriority(activeDetail.id, editPriority);
      if (ok) changed = true;
    }

    if (editDeptId !== activeDetail.departmentId) {
      const deptChangeOk = callerDepartment === 'FRONT'
        ? await changeDepartment(activeDetail.id, editDeptId)
        : await requestEscalation(activeDetail.id, editDeptId);
      if (deptChangeOk) changed = true;
    }

    setSaving(false);
    if (changed) {
      onUpdate();
      onClose();
    }
  };

  const handleManualSave = async (newDeptId: string, newPriority: string, newSummary?: string, newDescription?: string) => {
    setSaving(true);
    let changed = false;

    if (newPriority !== activeDetail.priority) {
      const ok = await changePriority(activeDetail.id, newPriority);
      if (ok) changed = true;
    }

    if (newDeptId) {
      const ok = await changeDepartment(activeDetail.id, newDeptId, newSummary, newDescription);
      if (ok) changed = true;
    }

    setSaving(false);
    if (changed) {
      onUpdate();
      setShowManualAssign(false);
      onClose();
    }
  };

  const handleCancel = async () => {
    setConfirmType('none');
    setSaving(true);
    const ok = await cancelRequest(activeDetail.id);
    setSaving(false);
    if (ok) {
      onUpdate();
      onClose();
    }
  };

  const handleApproveEscalation = async () => {
    setConfirmType('none');
    setSaving(true);
    const ok = await approveEscalation(activeDetail.id, editDeptId, editPriority);
    setSaving(false);
    if (ok) {
      onUpdate();
      onClose();
    }
  };

  const formatTimeDateOrder = (dt: string | Date | undefined) => {
    if (!dt) return '';
    const d = new Date(typeof dt === 'string' ? dt.replace(' ', 'T') : dt);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    if (language === 'ko') {
      return `${timeStr} ${year}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[d.getMonth()];
    const day = d.getDate();
    return `${timeStr} ${month} ${day} ${year}`;
  };

  const getRelativeTimeString = (dateString: string | Date | undefined): string => {
    if (!dateString) return '';
    const date = new Date(typeof dateString === 'string' ? dateString.replace(' ', 'T') : dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return `${diffDays}${language === 'en' ? ' ' : ''}${language === 'ko' ? '일 전' : 'days ago'}`;
    } else if (diffHours > 0) {
      return `${diffHours}${language === 'en' ? ' ' : ''}${language === 'ko' ? '시간 전' : 'hrs ago'}`;
    } else if (diffMins > 0) {
      return `${diffMins}${language === 'en' ? ' ' : ''}${language === 'ko' ? '분 전' : 'mins ago'}`;
    } else {
      return language === 'ko' ? '방금 전' : 'Just now';
    }
  };

  const formatModalDateTime = (dt: string | undefined, isCompleted: boolean) => {
    if (!dt) return '';
    if (isCompleted) {
      return formatTimeDateOrder(dt);
    }
    return getRelativeTimeString(dt);
  };

  const roomPrefix = language === 'ko' ? `${activeDetail.roomNo}호` : `NO.${activeDetail.roomNo}`;
  const rawSummary = translatedSummary || activeDetail.summary;
  const cleanSummary = cleanTitleSummary(rawSummary);
  const modalTitle = cleanSummary ? `${roomPrefix} ${cleanSummary}` : roomPrefix;

  return (
    <>
      <ModalOverlay isOpen={isOpen && !showManualAssign && !isChatHistoryOpen} onClose={onClose}>
        <ModalCard size="md" overflowVisible={false} onClose={onClose}>
        {/* 헤더 */}
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <StatusBadge variant={statusInfo.variant}>{statusInfo.text}</StatusBadge>
            {activeDetail.cancelRequested && (
              <StatusBadge variant="red">{t.frontdeskPage.requestDetailModal.status.cancelRequested}</StatusBadge>
            )}
          </div>
          <h2 className={styles.title}>{modalTitle}</h2>
        </div>

        <div className={styles.modalBody}>
          {/* 1. Created at 일시 */}
          {activeDetail.createdAt && (
            <div className={styles.reasoningItem}>
              <span className={styles.secondaryLabel}>
                {language === 'ko' ? '요청 일시' : 'Created at'}
              </span>
              <p className={styles.reasoningText}>
                {formatModalDateTime(activeDetail.createdAt, activeDetail.status === 'COMPLETED')}
              </p>
            </div>
          )}

          {/* Accepted by 수락 담당자 및 시간 */}
          {activeDetail.assignedStaffName && (
            <div className={styles.reasoningItem}>
              <span className={styles.secondaryLabel}>
                {language === 'ko' ? '수락 담당자' : 'Accepted by'}
              </span>
              <p className={styles.reasoningText}>
                {activeDetail.updatedAt
                  ? `${activeDetail.assignedStaffName} at ${formatModalDateTime(activeDetail.updatedAt, activeDetail.status === 'COMPLETED')}`
                  : activeDetail.assignedStaffName}
              </p>
            </div>
          )}

          {/* 2. AI 분석 엔티티 (Task Requests, Target Time, Items 등) */}
          {activeDetail.entities && renderEntities(activeDetail.entities, t, language)}

          {/* 3. Reasoning (Task Ticket 전용 구조화 렌더링) */}
          {(() => {
            const items = extractTaskReasoningItems(
              activeDetail.reasoning,
              activeDetail.entities?.reasoning,
              activeDetail.departmentId,
              activeDetail.departmentName,
              language,
              activeDetail.entities?.target_time
            );
            if (items.length === 0) return null;
            return items.map((item, idx) => (
              <div key={idx} className={styles.reasoningItem}>
                <span className={styles.secondaryLabel}>{item.label}</span>
                <p className={styles.reasoningText}>{item.content}</p>
              </div>
            ));
          })()}

          {/* 4. 첨부 사진 */}
          {activeDetail.imageUrl && (
            <div className={styles.photoSection}>
              <h3 className={styles.photoTitle}>{t.frontdeskPage.requestDetailModal.photo || (language === 'en' ? 'Attached Photo' : '첨부 사진')}</h3>
              <div className={styles.photoBox}>
                <img src={activeDetail.imageUrl} alt={t.frontdeskPage.requestDetailModal.photo || 'Attached Photo'} className={styles.photoImg} />
              </div>
            </div>
          )}
        </div>


        {/* 하단 버튼 */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.chatHistoryBtn}
            onClick={() => setIsChatHistoryOpen(true)}
          >
            <History size={16} />
            <span>{language === 'en' ? 'Chat History' : '대화 내역'}</span>
          </button>

          <div className={styles.footerRight}>
            {activeDetail.status === 'ESCALATED' && (
              <>
                <Button className={styles.footerButton} variant="secondary" onClick={() => setConfirmType('reject')} style={{ color: 'var(--color-error)' }} disabled={saving || loading}>
                  {t.frontdeskPage.requestDetailModal.buttons.rejectEscalation}
                </Button>
                <Button className={styles.footerButton} variant="primary" onClick={() => setConfirmType('approve')} disabled={saving || loading}>
                  {t.frontdeskPage.requestDetailModal.buttons.approveEscalation}
                </Button>
              </>
            )}

            {activeDetail.cancelRequested && (
              <>
                <Button className={styles.footerButton} variant="secondary" onClick={() => setConfirmType('cancelReject')} style={{ color: 'var(--color-error)' }} disabled={saving || loading}>
                  {t.frontdeskPage.requestDetailModal.buttons.rejectCancel}
                </Button>
                <Button className={styles.footerButton} variant="primary" onClick={() => setConfirmType('cancelApprove')} disabled={saving || loading}>
                  {t.frontdeskPage.requestDetailModal.buttons.approveCancel}
                </Button>
              </>
            )}

            {!activeDetail.cancelRequested && activeDetail.status !== 'ESCALATED' && activeDetail.status !== 'COMPLETED' && activeDetail.status !== 'CANCELLED' && (
              <>
                <Button className={styles.footerButton} variant="secondary" onClick={() => setConfirmType('cancel')} style={{ color: 'var(--color-error)' }}>
                  {t.frontdeskPage.requestDetailModal.buttons.forceCancel}
                </Button>
                <Button className={styles.footerButton} variant="primary" onClick={() => setShowManualAssign(true)}>
                  {language === 'en' ? 'Assign Task' : '업무 배정'}
                </Button>
                {hasChanges && (
                  <Button className={styles.footerButton} variant="primary" onClick={handleSave} disabled={saving || loading}>
                    {saving ? t.frontdeskPage.requestDetailModal.buttons.saving : t.frontdeskPage.requestDetailModal.buttons.save}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </ModalCard>
    </ModalOverlay>

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

    {confirmType === 'reject' && activeDetail && (
      <RejectEscalationModal
        isOpen={true}
        onClose={() => setConfirmType('none')}
        requestId={activeDetail.id}
        onSuccess={() => {
          onUpdate();
          onClose();
        }}
      />
    )}

    {confirmType === 'cancelApprove' && activeDetail && (
      <ApproveCancellationModal
        isOpen={true}
        onClose={() => setConfirmType('none')}
        requestId={activeDetail.id}
        onSuccess={() => {
          onUpdate();
          onClose();
        }}
      />
    )}

    {confirmType === 'cancelReject' && activeDetail && (
      <RejectCancellationModal
        isOpen={true}
        onClose={() => setConfirmType('none')}
        requestId={activeDetail.id}
        onSuccess={() => {
          onUpdate();
          onClose();
        }}
      />
    )}
    {activeDetail && (
      <ManualAssignModal
        isOpen={showManualAssign}
        onClose={() => setShowManualAssign(false)}
        detail={{
          ...activeDetail,
          description: ''
        }}
        departments={departments}
        onSave={handleManualSave}
        saving={saving}
      />
    )}

    <ChatHistoryModal
      isOpen={isChatHistoryOpen}
      onClose={() => setIsChatHistoryOpen(false)}
      roomNumber={String(activeDetail.roomNo)}
    />
  </>
);
}
