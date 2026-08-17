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
  targetTime?: string,
  hasItemEntities?: boolean
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
    // 2) 'No existing housekeeping orders are currently active...', 'no additional context' 등 무의미한/부정형 filler 문장 제외
    if (
      lower.includes('does not require additional') ||
      lower.includes('no additional operational context') ||
      lower.includes('no additional context') ||
      lower.includes('standard operational procedure') ||
      lower.includes('no special requirements') ||
      lower.includes('no special operational') ||
      lower.includes('no existing') ||
      lower.includes('currently active') ||
      lower.includes('no active orders') ||
      lower.includes('no active requests') ||
      lower.includes('no prior orders') ||
      lower.includes('no previous orders') ||
      lower.includes('no other active') ||
      lower.includes('no pending orders') ||
      lower.includes('not currently active') ||
      lower.includes('진행 중인') ||
      lower.includes('이전 요청 없음') ||
      lower.includes('이전 주문 없음') ||
      lower.includes('특이사항 없음') ||
      lower.includes('해당 없음') ||
      lower === 'none' ||
      lower === 'none.' ||
      lower === '없음'
    ) {
      return false;
    }
    return true;
  });

  if (cleanedLines.length === 0) return [];

  const items: TaskReasoningItem[] = [];

  // If item/menu entities already exist, skip redundant 1st line if it just repeats requested items
  let startIndex = 0;
  if (hasItemEntities && cleanedLines.length > 0) {
    const firstLineLower = cleanedLines[0].toLowerCase();
    if (
      firstLineLower.startsWith('the guest requested') ||
      firstLineLower.startsWith('guest requested') ||
      firstLineLower.startsWith('one bottle of') ||
      firstLineLower.startsWith('requested')
    ) {
      startIndex = 1;
    }
  }

  for (let i = startIndex; i < cleanedLines.length; i++) {
    let text = cleanedLines[i];
    if (text.toLowerCase().startsWith('the guest requested')) {
      text = text.replace(/^the guest requested (a |an |to |for )?/i, '').trim();
      if (text.endsWith('.')) text = text.slice(0, -1).trim();
      if (targetTime && text.toLowerCase().includes('at a specific time')) {
        text = text.replace(/at a specific time/i, `at ${targetTime}`);
      }
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }

    let label = lang === 'ko' ? '특이사항' : 'Operational context';
    if (i === 0) {
      label = lang === 'ko' ? '고객 요청' : 'Guest request';
    } else if (i > 1) {
      label = lang === 'ko' ? `추가 정보 ${i}` : `Additional info ${i}`;
    }

    items.push({
      label,
      content: text,
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

  // 1. Created at 일시 포맷 (예: 01:50 Aug 17 2026)
  const formatCreatedAt = (dateString: string | Date | undefined): string => {
    if (!dateString) return '';
    const d = new Date(typeof dateString === 'string' ? dateString.replace(' ', 'T') : dateString);
    if (isNaN(d.getTime())) return '';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const year = d.getFullYear();
    const day = d.getDate();

    if (language === 'ko') {
      return `${hours}:${minutes} ${year}년 ${d.getMonth() + 1}월 ${day}일`;
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[d.getMonth()];
    return `${hours}:${minutes} ${month} ${day} ${year}`;
  };

  // 2. Accepted by 시간 포맷: 같은 날짜면 시간만 (예: 00:21), 다른 날짜면 시간+날짜 (예: 00:21 Jul 31)
  const formatAcceptedAt = (
    acceptedDateStr: string | Date | undefined,
    createdDateStr: string | Date | undefined
  ): string => {
    if (!acceptedDateStr) return '';
    const dAccepted = new Date(typeof acceptedDateStr === 'string' ? acceptedDateStr.replace(' ', 'T') : acceptedDateStr);
    if (isNaN(dAccepted.getTime())) return '';

    const hours = String(dAccepted.getHours()).padStart(2, '0');
    const minutes = String(dAccepted.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    let isSameDay = false;
    if (createdDateStr) {
      const dCreated = new Date(typeof createdDateStr === 'string' ? createdDateStr.replace(' ', 'T') : createdDateStr);
      if (!isNaN(dCreated.getTime())) {
        isSameDay = (
          dAccepted.getFullYear() === dCreated.getFullYear() &&
          dAccepted.getMonth() === dCreated.getMonth() &&
          dAccepted.getDate() === dCreated.getDate()
        );
      }
    }

    if (isSameDay) {
      return timeStr;
    }

    const day = dAccepted.getDate();
    if (language === 'ko') {
      return `${timeStr} ${dAccepted.getMonth() + 1}월 ${day}일`;
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[dAccepted.getMonth()];
    return `${timeStr} ${month} ${day}`;
  };

  const getDeptClass = (deptIdOrName?: string) => {
    if (!deptIdOrName) return '';
    const upper = deptIdOrName.toUpperCase();
    if (upper.includes('HK') || upper.includes('HOUSEKEEPING') || upper.includes('하우스키핑')) return styles.deptHk;
    if (upper.includes('FB') || upper.includes('FNB') || upper.includes('식음료')) return styles.deptFb;
    if (upper.includes('FACILITY') || upper.includes('MAINTENANCE') || upper.includes('시설')) return styles.deptFacility;
    if (upper.includes('CONCIERGE') || upper.includes('컨시어지')) return styles.deptConcierge;
    if (upper.includes('EMERGENCY') || upper.includes('긴급')) return styles.deptEmergency;
    if (upper.includes('FRONT') || upper.includes('프론트')) return styles.deptFront;
    return '';
  };

  const getDeptName = (deptId?: string, fallbackName?: string) => {
    if (deptId === 'HK') return language === 'ko' ? '하우스키핑' : 'Housekeeping';
    if (deptId === 'FB') return language === 'ko' ? '식음료' : 'F&B';
    if (deptId === 'FACILITY') return language === 'ko' ? '시설관리' : 'Facility';
    if (deptId === 'CONCIERGE') return language === 'ko' ? '컨시어지' : 'Concierge';
    if (deptId === 'FRONT') return language === 'ko' ? '프론트데스크' : 'Front Desk';
    const d = departments.find(dep => dep.id === deptId);
    if (d) return d.name;
    if (fallbackName) return fallbackName;
    return deptId || '';
  };

  const deptDisplayName = getDeptName(activeDetail.departmentId, activeDetail.departmentName);
  const roomDisplay = language === 'en' ? `Room ${activeDetail.roomNo}` : `${activeDetail.roomNo}호`;
  const toSentenceCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  const cleanSummary = toSentenceCase(cleanTitleSummary(translatedSummary || activeDetail.summary));

  let modalTitle = cleanSummary;
  let modalSubtitle = roomDisplay;

  if (activeDetail.cancelRequested) {
    modalTitle = language === 'en' ? 'Cancel request' : '취소 요청';
    modalSubtitle = cleanSummary ? `${roomDisplay}, ${cleanSummary}` : roomDisplay;
  } else if (activeDetail.status === 'ESCALATED') {
    modalTitle = language === 'en' ? 'Transfer request' : '이관 요청';
    modalSubtitle = cleanSummary ? `${roomDisplay}, ${cleanSummary}` : roomDisplay;
  } else {
    modalTitle = cleanSummary || roomDisplay;
    modalSubtitle = cleanSummary ? roomDisplay : '';
  }

  return (
    <>
      <ModalOverlay isOpen={isOpen && !showManualAssign && !isChatHistoryOpen} onClose={onClose}>
        <ModalCard size="md" overflowVisible={false} onClose={onClose}>
        {/* 헤더 */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            {deptDisplayName && (
              <span className={`${styles.deptName} ${getDeptClass(activeDetail.departmentId || activeDetail.departmentName)}`}>
                {deptDisplayName}
              </span>
            )}
            <span>{modalTitle}</span>
          </h2>
          {modalSubtitle && (
            <p className={styles.subtitle}>{modalSubtitle}</p>
          )}
        </div>

        <div className={styles.modalBody}>
          {/* 취소 요청 일시 (Cancel request일 때 최상단 표시) */}
          {activeDetail.cancelRequested && (activeDetail.cancelRequestedAt || activeDetail.updatedAt) && (
            <div className={styles.reasoningItem}>
              <span className={styles.secondaryLabel}>
                {language === 'ko' ? '취소 요청 일시' : 'Cancellation requested at'}
              </span>
              <p className={styles.reasoningText}>
                {formatCreatedAt(activeDetail.cancelRequestedAt || activeDetail.updatedAt)}
              </p>
            </div>
          )}

          {/* 1. Created at 일시 (예: 01:50 Aug 17 2026) */}
          {activeDetail.createdAt && (
            <div className={styles.reasoningItem}>
              <span className={styles.secondaryLabel}>
                {language === 'ko' ? '요청 일시' : 'Created at'}
              </span>
              <p className={styles.reasoningText}>
                {formatCreatedAt(activeDetail.createdAt)}
              </p>
            </div>
          )}

          {/* Accepted by 수락 담당자 및 시간 (예: Sarah Williams at 00:21) */}
          {activeDetail.assignedStaffName && (
            <div className={styles.reasoningItem}>
              <span className={styles.secondaryLabel}>
                {language === 'ko' ? '수락 담당자' : 'Accepted by'}
              </span>
              <p className={styles.reasoningText}>
                {activeDetail.updatedAt
                  ? `${activeDetail.assignedStaffName} at ${formatAcceptedAt(activeDetail.updatedAt, activeDetail.createdAt)}`
                  : activeDetail.assignedStaffName}
              </p>
            </div>
          )}

          {/* 2. AI 분석 엔티티 (Task Requests, Target Time, Items 등) */}
          {activeDetail.entities && renderEntities(activeDetail.entities, t, language)}

          {/* 3. Reasoning (Task Ticket 전용 구조화 렌더링) */}
          {(() => {
            const hasItemEntities = !!(
              activeDetail.entities?.items?.length ||
              activeDetail.entities?.menu_items?.length ||
              activeDetail.entities?.item
            );
            const items = extractTaskReasoningItems(
              activeDetail.reasoning,
              activeDetail.entities?.reasoning,
              activeDetail.departmentId,
              activeDetail.departmentName,
              language,
              activeDetail.entities?.target_time,
              hasItemEntities
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
          <Button
            variant="outlined"
            size="medium"
            onClick={() => setIsChatHistoryOpen(true)}
            className={styles.chatHistoryBtn}
          >
            <History size={16} />
            <span>{language === 'en' ? 'Chat History' : '대화 내역'}</span>
          </Button>

          <div className={styles.footerRight}>
            {activeDetail.status === 'ESCALATED' && (
              <>
                <Button className={styles.footerButton} variant="secondary" size="medium" onClick={() => setConfirmType('reject')} style={{ color: 'var(--color-error)' }} disabled={saving || loading}>
                  {t.frontdeskPage.requestDetailModal.buttons.rejectEscalation}
                </Button>
                <Button className={styles.footerButton} variant="primary" size="medium" onClick={() => setConfirmType('approve')} disabled={saving || loading}>
                  {t.frontdeskPage.requestDetailModal.buttons.approveEscalation}
                </Button>
              </>
            )}

            {activeDetail.cancelRequested && (
              <>
                <Button className={styles.footerButton} variant="secondary" size="medium" onClick={() => setConfirmType('cancelReject')} style={{ color: 'var(--color-error)' }} disabled={saving || loading}>
                  {t.frontdeskPage.requestDetailModal.buttons.rejectCancel}
                </Button>
                <Button className={styles.footerButton} variant="primary" size="medium" onClick={() => setConfirmType('cancelApprove')} disabled={saving || loading}>
                  {t.frontdeskPage.requestDetailModal.buttons.approveCancel}
                </Button>
              </>
            )}

            {!activeDetail.cancelRequested && activeDetail.status !== 'ESCALATED' && activeDetail.status !== 'COMPLETED' && activeDetail.status !== 'CANCELLED' && (
              <>
                <Button className={styles.footerButton} variant="secondary" size="medium" onClick={() => setConfirmType('cancel')} style={{ color: 'var(--color-error)' }}>
                  {t.frontdeskPage.requestDetailModal.buttons.forceCancel}
                </Button>
                <Button className={styles.footerButton} variant="primary" size="medium" onClick={() => setShowManualAssign(true)}>
                  {language === 'en' ? 'Assign Task' : '업무 배정'}
                </Button>
                {hasChanges && (
                  <Button className={styles.footerButton} variant="primary" size="medium" onClick={handleSave} disabled={saving || loading}>
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
