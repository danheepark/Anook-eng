'use client';

import React, { useState, useEffect } from 'react';
import { History } from 'lucide-react';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import Button from '@/components/ui/Button/Button';
import styles from './TaskDetailModal.module.css';
import { StaffTask } from '../../useTasks';
import { useUiStore } from '@/stores/useUiStore';
import { useNetworkStore } from '@/stores/useNetworkStore';
import { useTranslation } from '@/app/useTranslation';
import { useTranslationApi } from '@/app/useTranslationApi';
import ChatHistoryModal from './ChatHistoryModal';
import ManualAssignModal from '@/app/frontdesk/requests/_components/ManualAssignModal/ManualAssignModal';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: StaffTask | null;
  onAccept?: (id: number, version: number) => Promise<void>;
  onComplete?: (id: number, version: number) => Promise<void>;
  onTransfer?: (id: number, version: number, toDepartmentId: string, reason: string) => Promise<void>;
  onApproveCancellation?: (id: number, version: number) => Promise<void>;
  onRejectCancellation?: (id: number, version: number) => Promise<void>;
}

const DEPARTMENTS = [
  { id: 'HK', nameEn: 'Housekeeping', nameKo: '하우스키핑', name: 'Housekeeping' },
  { id: 'FACILITY', nameEn: 'Facility', nameKo: '시설관리', name: 'Facility' },
  { id: 'FB', nameEn: 'F&B', nameKo: '식음료', name: 'F&B' },
  { id: 'FRONT', nameEn: 'Front Desk', nameKo: '프론트데스크', name: 'Front Desk' },
  { id: 'CONCIERGE', nameEn: 'Concierge', nameKo: '컨시어지', name: 'Concierge' }
];

const ENTITY_LABELS_KO: Record<string, string> = {
  is_contactless: '비대면 배달', target_time: '희망 시간',
  equipment: '대상 설비', symptom: '증상', location: '위치',
  destination: '목적지', passenger_count: '인원', restaurant_name: '식당',
  cuisine_type: '음식 종류', category: '카테고리', action: '요청 유형',
  item: '대상 물품', time: '시간', special_requests: '추가 요청', count: '수량',
  type: '유형', target: '대상', special_notes: 'PMS 특이사항 노트',
  pms_allergen_warning: '⚠️ 알레르기 안전 경고 (고객 확인 완료)',
};

const ENTITY_LABELS_EN: Record<string, string> = {
  is_contactless: 'Contactless', target_time: 'Target Time',
  equipment: 'Equipment', symptom: 'Symptom', location: 'Location',
  destination: 'Destination', passenger_count: 'Guests', restaurant_name: 'Restaurant',
  cuisine_type: 'Cuisine', category: 'Category', action: 'Action',
  item: 'Item', time: 'Time', special_requests: 'Special Requests', count: 'Quantity',
  type: 'Type', target: 'Target', special_notes: 'PMS Special Notes',
  pms_allergen_warning: '⚠️ Allergen Warning (Guest Confirmed)',
};

/** 직원에게 보여줄 필요 없는 내부 키 */
const HIDDEN_ENTITY_KEYS = new Set([
  'intent', 'allergen_warning', 'item_requests', 'service_requests',
  'reasoning', 'target_time', 'tasks', 'task'
]);

/** 배열 타입 특수 렌더러가 필요한 키 */
const ARRAY_KEYS = new Set(['items', 'menu_items']);

interface TaskReasoningItem {
  label: string;
  content: string;
}

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
    // 1) 'Why this task belongs to [department]' 등 당연한 부서 배정 설명 제외
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

function renderEntities(entities: Record<string, any>, language: string): React.ReactNode {
  const rendered: React.ReactNode[] = [];

  // 0) 정규화: item 키 단독 혹은 item+count 플랫 키 → items 배열로 통일
  if (entities.item && !entities.items?.length) {
    entities = { ...entities, items: [{ item: entities.item, count: entities.count || 1 }] };
    delete entities.item;
    delete entities.count;
  }

  // 1) 배열 타입 특수 렌더링
  if (entities.items?.length > 0) {
    rendered.push(
      <div key="items" className={styles.reasoningItem}>
        <span className={styles.secondaryLabel}>{language === 'en' ? 'Item Request' : '물품 요청'}</span>
        <p className={styles.reasoningText}>
          {entities.items.map((it: any) => {
            const itemText = typeof it.item === 'object' && it.item !== null ? (it.item.name || it.item.id || '') : it.item;
            return `${itemText} x${it.count}`;
          }).join(', ')}
        </p>
      </div>
    );
  }

  if (entities.menu_items?.length > 0) {
    rendered.push(
      <div key="menu_items" className={styles.reasoningItem}>
        <span className={styles.secondaryLabel}>{language === 'en' ? 'Order Menu' : '주문 메뉴'}</span>
        <p className={styles.reasoningText}>
          {entities.menu_items.map((mi: any) => {
            const opt = mi.selected_option && mi.selected_option !== '없음' && mi.selected_option !== 'none' ? ` (${mi.selected_option})` : '';
            return `${mi.name}${opt} x${mi.quantity}`;
          }).join(', ')}
        </p>
      </div>
    );
  }

  // 2) 단순 key-value
  for (const [key, value] of Object.entries(entities)) {
    if (HIDDEN_ENTITY_KEYS.has(key) || ARRAY_KEYS.has(key)) continue;
    if (value === null || value === undefined || value === '' || value === false || value === '없음' || value === 'none') continue;

    const label = language === 'en' ? (ENTITY_LABELS_EN[key] || key) : (ENTITY_LABELS_KO[key] || key);

    if (value === true) {
      rendered.push(
        <div key={key} className={styles.reasoningItem}>
          <span className={styles.secondaryLabel}>{label}</span>
          <p className={styles.reasoningText}>✓</p>
        </div>
      );
    } else {
      const displayValue = typeof value === 'object' && value !== null
        ? (value.name || value.id || JSON.stringify(value))
        : String(value);

      rendered.push(
        <div key={key} className={styles.reasoningItem}>
          <span className={styles.secondaryLabel}>{label}</span>
          <p className={styles.reasoningText}>{displayValue}</p>
        </div>
      );
    }
  }

  return rendered;
}

export default function TaskDetailModal({ isOpen, onClose, task, onAccept, onComplete, onTransfer, onApproveCancellation, onRejectCancellation }: TaskDetailModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false);
  const [isManualAssignOpen, setIsManualAssignOpen] = useState(false);
  const { showToast } = useUiStore();
  const isOnline = useNetworkStore((state) => state.isOnline);
  const { t, language } = useTranslation();
  const { translatedText: translatedSummary } = useTranslationApi(task?.summary, language);

  if (!isOpen || !task) return null;

  const handleClose = () => {
    setIsManualAssignOpen(false);
    onClose();
  };

  const handleAccept = async () => {
    if (onAccept) {
      setIsSubmitting(true);
      try {
        await onAccept(task.id, task.version);
        handleClose();
      } catch (err) {
        showToast(err instanceof Error ? err.message : (language === 'en' ? 'An error occurred while accepting task.' : '요청 수락 중 오류가 발생했습니다.'), 'error');
        handleClose();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleComplete = async () => {
    if (onComplete) {
      setIsSubmitting(true);
      try {
        await onComplete(task.id, task.version);
        showToast(language === 'en' ? 'Task completed successfully.' : '요청이 완료 처리되었습니다.', 'success');
        handleClose();
      } catch (err) {
        showToast(err instanceof Error ? err.message : (language === 'en' ? 'An error occurred while completing the task.' : '요청 완료 중 오류가 발생했습니다.'), 'error');
        handleClose();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleApproveCancellation = async () => {
    if (onApproveCancellation) {
      setIsSubmitting(true);
      try {
        await onApproveCancellation(task.id, task.version);
        showToast(language === 'en' ? 'Cancellation approved.' : '취소가 승인되었습니다.', 'success');
        handleClose();
      } catch (err) {
        showToast(err instanceof Error ? err.message : (language === 'en' ? 'An error occurred while approving cancellation.' : '취소 승인 중 오류가 발생했습니다.'), 'error');
        handleClose();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleRejectCancellation = async () => {
    if (onRejectCancellation) {
      setIsSubmitting(true);
      try {
        await onRejectCancellation(task.id, task.version);
        showToast(language === 'en' ? 'Cancellation rejected.' : '취소가 반려되었습니다.', 'success');
        handleClose();
      } catch (err) {
        showToast(err instanceof Error ? err.message : (language === 'en' ? 'An error occurred while rejecting cancellation.' : '취소 반려 중 오류가 발생했습니다.'), 'error');
        handleClose();
      } finally {
        setIsSubmitting(false);
      }
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

  const STATUS_VARIANT_MAP: Record<string, 'red' | 'purple' | 'green' | 'gray'> = {
    PENDING: 'red',
    ASSIGNED: 'purple',
    IN_PROGRESS: 'green',
    COMPLETED: 'gray',
    CANCELLED: 'gray',
    ESCALATED: 'red',
  };

  // 상태 뱃지 매핑
  const getStatusInfo = (status: string, priority: string) => {
    if (priority === 'URGENT') return { variant: 'red' as const, text: language === 'en' ? 'URGENT' : '긴급' };
    const variant = STATUS_VARIANT_MAP[status] || 'gray';
    switch (status) {
      case 'PENDING':
        return { variant, text: language === 'en' ? 'Pending' : '대기중' };
      case 'ASSIGNED':
        return { variant, text: language === 'en' ? 'Assigned' : '배정됨' };
      case 'IN_PROGRESS':
        return { variant, text: language === 'en' ? 'In Progress' : '진행중' };
      case 'COMPLETED':
        return { variant, text: language === 'en' ? 'Completed' : '완료' };
      case 'CANCELLED':
        return { variant, text: language === 'en' ? 'Cancelled' : '취소' };
      case 'ESCALATED':
        return { variant, text: language === 'en' ? 'Escalated' : '에스컬레이션' };
      default:
        return { variant, text: status };
    }
  };

  const statusInfo = getStatusInfo(task.status, task.priority);
  const roomPrefix = language === 'ko' ? `${task.roomNumber}호` : `NO.${task.roomNumber}`;
  const rawSummary = translatedSummary || task.summary;
  const cleanSummary = cleanTitleSummary(rawSummary);
  const modalTitle = cleanSummary ? `${roomPrefix} ${cleanSummary}` : roomPrefix;

  const rawTextParts = task.rawText ? task.rawText.split('\n|||TRANSFER_REASON|||') : [];
  const transferReasonText = rawTextParts.length > 1 ? rawTextParts.slice(1).join('\n').trim() : null;

  return (
    <>
      <ModalOverlay isOpen={isOpen && !isManualAssignOpen && !isChatHistoryOpen} onClose={handleClose}>
        <ModalCard size="md" overflowVisible={false} onClose={handleClose}>
          <div className={styles.container}>
            {/* 1. 헤더 */}
            <div className={styles.header}>
              <div className={styles.headerTop}>
                {task.cancelRequested ? (
                  <StatusBadge variant="red">
                    {language === 'en' ? 'Cancel request' : '취소 요청'}
                  </StatusBadge>
                ) : (
                  <StatusBadge variant={statusInfo.variant}>{statusInfo.text}</StatusBadge>
                )}
              </div>
              <h2 className={styles.title}>{modalTitle}</h2>
            </div>

            {/* 2. 본문 */}
            <div className={styles.modalBody}>
              {/* 취소 요청 일시 (Cancel request일 때 최상단 표시) */}
              {task.cancelRequested && (task.cancelRequestedAt || task.updatedAt) && (
                <div className={styles.reasoningItem}>
                  <span className={styles.secondaryLabel}>
                    {language === 'ko' ? '취소 요청 일시' : 'Cancellation requested at'}
                  </span>
                  <p className={styles.reasoningText}>
                    {formatCreatedAt(task.cancelRequestedAt || task.updatedAt)}
                  </p>
                </div>
              )}

              {/* Created at 일시 (예: 01:50 Aug 17 2026) */}
              {task.createdAt && (
                <div className={styles.reasoningItem}>
                  <span className={styles.secondaryLabel}>
                    {language === 'ko' ? '요청 일시' : 'Created at'}
                  </span>
                  <p className={styles.reasoningText}>
                    {formatCreatedAt(task.createdAt)}
                  </p>
                </div>
              )}

              {/* Accepted by 수락 담당자 및 시간 (예: Sarah Williams at 00:21) */}
              {task.assignedStaffName && (
                <div className={styles.reasoningItem}>
                  <span className={styles.secondaryLabel}>
                    {language === 'ko' ? '수락 담당자' : 'Accepted by'}
                  </span>
                  <p className={styles.reasoningText}>
                    {task.updatedAt
                      ? `${task.assignedStaffName} at ${formatAcceptedAt(task.updatedAt, task.createdAt)}`
                      : task.assignedStaffName}
                  </p>
                </div>
              )}

              {/* AI 분석 엔티티 (Item Requests, Order Menu 등) */}
              {task.entities && renderEntities(task.entities, language)}

              {/* Reasoning (Task Ticket 전용 구조화 렌더링) */}
              {(() => {
                const hasItemEntities = !!(
                  task.entities?.items?.length ||
                  task.entities?.menu_items?.length ||
                  task.entities?.item
                );
                const items = extractTaskReasoningItems(
                  task.reasoning,
                  task.entities?.reasoning,
                  task.departmentId,
                  undefined,
                  language,
                  task.entities?.target_time,
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

              {/* 첨부 사진 */}
              {task.imageUrl && (
                <div className={styles.photoSection}>
                  <h3 className={styles.photoTitle}>{language === 'en' ? 'Attached Photo' : '첨부 사진'}</h3>
                  <div className={styles.photoBox}>
                    <img src={task.imageUrl} alt={language === 'en' ? 'Attached Photo' : '첨부 사진'} className={styles.photoImg} />
                  </div>
                </div>
              )}

              {/* 업무 전달 사유 */}
              {transferReasonText && (
                <div className={styles.reasoningItem}>
                  <span className={styles.secondaryLabel}>{language === 'en' ? 'Transfer Reason' : '업무 전달 사유'}</span>
                  <div className={styles.transferReasonBox}>
                    {transferReasonText}
                  </div>
                </div>
              )}
            </div>

            {/* 3. 푸터 버튼 */}
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
                {task.status === 'PENDING' && (
                  <>
                    <Button
                      variant="secondary"
                      size="medium"
                      onClick={() => setIsManualAssignOpen(true)}
                      className={styles.actionButton}
                      disabled={isSubmitting || !isOnline}
                      title={!isOnline ? (language === 'en' ? 'Unavailable offline' : '오프라인 상태에서는 사용할 수 없습니다') : undefined}
                    >
                      {language === 'en' ? 'Assign Task' : '업무 배정'}
                    </Button>
                    <Button
                      variant="primary"
                      size="medium"
                      onClick={handleAccept}
                      className={styles.actionButton}
                      disabled={isSubmitting || !isOnline}
                      title={!isOnline ? (language === 'en' ? 'Unavailable offline' : '오프라인 상태에서는 사용할 수 없습니다') : undefined}
                    >
                      {language === 'en' ? 'Accept Task' : '업무 수락'}
                    </Button>
                  </>
                )}

                {task.status === 'IN_PROGRESS' && !task.cancelRequested && onComplete && (
                  <Button
                    variant="primary"
                    size="medium"
                    onClick={handleComplete}
                    className={styles.actionButton}
                    disabled={isSubmitting || !isOnline}
                    title={!isOnline ? (language === 'en' ? 'Unavailable offline' : '오프라인 상태에서는 사용할 수 없습니다') : undefined}
                  >
                    {language === 'en' ? 'Complete Task' : '업무 완료'}
                  </Button>
                )}

                {task.status === 'IN_PROGRESS' && task.cancelRequested && (
                  <>
                    <Button
                      variant="secondary"
                      size="medium"
                      onClick={handleRejectCancellation}
                      className={styles.actionButton}
                      disabled={isSubmitting || !isOnline}
                      title={!isOnline ? (language === 'en' ? 'Unavailable offline' : '오프라인 상태에서는 사용할 수 없습니다') : undefined}
                    >
                      {language === 'en' ? 'Reject' : '취소 반려'}
                    </Button>
                    <Button
                      variant="primary"
                      size="medium"
                      onClick={handleApproveCancellation}
                      className={styles.actionButton}
                      disabled={isSubmitting || !isOnline}
                      title={!isOnline ? (language === 'en' ? 'Unavailable offline' : '오프라인 상태에서는 사용할 수 없습니다') : undefined}
                    >
                      {language === 'en' ? 'Approve' : '취소 승인'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </ModalCard>
      </ModalOverlay>

      <ChatHistoryModal
        isOpen={isChatHistoryOpen}
        onClose={() => setIsChatHistoryOpen(false)}
        roomNumber={String(task.roomNumber)}
      />

      <ManualAssignModal
        isOpen={isManualAssignOpen}
        onClose={() => setIsManualAssignOpen(false)}
        detail={{
          id: task.id,
          priority: task.priority,
          departmentId: task.departmentId,
          departmentName: (() => {
            const d = DEPARTMENTS.find(dept => dept.id === task.departmentId);
            if (!d) return task.departmentId;
            return language === 'en' ? d.nameEn : d.nameKo;
          })(),
          roomNo: String(task.roomNumber),
          summary: task.summary,
          createdAt: task.createdAt,
          status: task.status,
          description: ''
        }}
        departments={DEPARTMENTS}
        onSave={async (editDeptId, editPriority, editSummary, editDescription) => {
          if (onTransfer) {
            setIsSubmitting(true);
            try {
              const reason = `${editSummary || ''}${editDescription ? '\n' + editDescription : ''}`;
              await onTransfer(task.id, task.version, editDeptId, reason);
              showToast(language === 'en' ? 'Task reassigned successfully.' : '업무 배정이 완료되었습니다.', 'success');
              setIsManualAssignOpen(false);
              onClose();
            } catch (err) {
              showToast(err instanceof Error ? err.message : (language === 'en' ? 'An error occurred while reassigning task.' : '업무 배정 중 오류가 발생했습니다.'), 'error');
            } finally {
              setIsSubmitting(false);
            }
          }
        }}
        saving={isSubmitting}
      />
    </>
  );
}
