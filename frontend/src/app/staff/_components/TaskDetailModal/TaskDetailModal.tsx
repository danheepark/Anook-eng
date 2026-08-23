'use client';

import React, { useState, useEffect } from 'react';
import { History, MoreVertical, Trash2 } from 'lucide-react';
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
  highlight_items: '수정된 항목',
};

const ENTITY_LABELS_EN: Record<string, string> = {
  is_contactless: 'Contactless', target_time: 'Target Time',
  equipment: 'Equipment', symptom: 'Symptom', location: 'Location',
  destination: 'Destination', passenger_count: 'Guests', restaurant_name: 'Restaurant',
  cuisine_type: 'Cuisine', category: 'Category', action: 'Action',
  item: 'Item', time: 'Time', special_requests: 'Special Requests', count: 'Quantity',
  type: 'Type', target: 'Target', special_notes: 'PMS Special Notes',
  pms_allergen_warning: '⚠️ Allergen Warning (Guest Confirmed)',
  highlight_items: 'Modified item',
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

const computeTaskTitle = (
  departmentId?: string,
  summary?: string,
  entities?: any,
  language: string = 'en'
): string => {
  const isEn = language === 'en';
  let deptKey = 'front';
  const deptUpper = departmentId ? departmentId.toUpperCase() : '';

  if (deptUpper.includes('HK') || deptUpper.includes('HOUSEKEEPING') || deptUpper.includes('하우스키핑')) {
    deptKey = 'hk';
  } else if (deptUpper.includes('FACILITY') || deptUpper.includes('시설')) {
    deptKey = 'facility';
  } else if (deptUpper.includes('FB') || deptUpper.includes('FNB') || deptUpper.includes('식음료')) {
    deptKey = 'fb';
  } else if (deptUpper.includes('CONCIERGE') || deptUpper.includes('컨시어지')) {
    deptKey = 'concierge';
  } else if (deptUpper.includes('EMERGENCY') || deptUpper.includes('긴급')) {
    deptKey = 'emergency';
  }

  const intent = entities?.intent as string | undefined;

  const toSentenceCase = (str: string) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

  if (deptKey === 'hk') {
    const items = entities?.items as any[] | undefined;
    const tasks = entities?.tasks as string[] | undefined;
    const totalCount = (items?.length || 0) + (tasks?.length || 0);
    if (totalCount > 0) {
      let firstLabel = '';
      if (items && items.length > 0) {
        const first = items[0];
        const firstItemText = typeof first.item === 'object' && first.item !== null ? (first.item.name || first.item.id || '') : first.item;
        firstLabel = `${firstItemText} x${first.count || 1}`;
      } else if (tasks && tasks.length > 0) {
        firstLabel = tasks[0];
      }
      const restCount = totalCount - 1;
      const rest = restCount > 0 ? (isEn ? ` and ${restCount} other${restCount > 1 ? 's' : ''}` : ` 외 ${restCount}건`) : '';
      return toSentenceCase(`${firstLabel}${rest}`);
    }
  } else if (deptKey === 'fb') {
    const menuItems = entities?.menu_items as any[] | undefined;
    if (menuItems && menuItems.length > 0) {
      const first = menuItems[0];
      const opt = first.selected_option && first.selected_option !== '없음' && first.selected_option !== 'none' ? ` (${first.selected_option})` : '';
      const qty = first.quantity ? ` x${first.quantity}` : '';
      const restCount = menuItems.length - 1;
      const rest = restCount > 0 ? (isEn ? ` and ${restCount} other${restCount > 1 ? 's' : ''}` : ` 외 ${restCount}건`) : '';
      return toSentenceCase(`${first.name}${opt}${qty}${rest}`);
    }
  } else if (deptKey === 'concierge' && intent && entities) {
    const reserveSuffix = isEn ? ' reservation' : ' 예약';
    switch (intent) {
      case 'TAXI':
        return toSentenceCase(isEn ? `Taxi call${reserveSuffix}` : `택시 호출${reserveSuffix}`);
      case 'LUGGAGE_STORAGE': {
        const count = entities.count;
        if (isEn) {
          const action = entities.action === 'store' ? 'storage' : 'pickup';
          return toSentenceCase(count ? `${count} luggage ${action}` : `Luggage ${action}`);
        }
        const action = entities.action === 'store' ? '보관' : '찾기';
        return toSentenceCase(count ? `짐 ${count}개 ${action}` : `수하물 ${action}`);
      }
      case 'RESTAURANT':
        return toSentenceCase(isEn ? `Restaurant${reserveSuffix}` : `식당${reserveSuffix}`);
      case 'WAKE_UP_CALL': {
        const time = entities.time as string | undefined;
        if (isEn) return toSentenceCase(time ? `${time} Wake-up call` : `Wake-up call`);
        return toSentenceCase(time ? `${time} 모닝콜${reserveSuffix}` : `모닝콜${reserveSuffix}`);
      }
      case 'POSTAL_SERVICE': {
        const item = entities.item as string | undefined;
        if (isEn) return toSentenceCase(item ? `${item} mailing` : 'Mail service');
        return toSentenceCase(item ? `${item} 발송 대행` : '우편물 발송 대행');
      }
      case 'DELIVERY': {
        const item = entities.item as string | undefined;
        if (isEn) return toSentenceCase(item ? `${item} delivery` : 'Delivery');
        return toSentenceCase(item ? `${item} 배달` : `배달`);
      }
      case 'RESERVATION': {
        const target = entities.target as string | undefined;
        if (target) return toSentenceCase(`${target}${reserveSuffix}`);
        return toSentenceCase(isEn ? 'Reservation' : '예약');
      }
    }
  }

  if (!summary) return '';
  let clean = cleanTitleSummary(summary);
  if (clean) {
    clean = toSentenceCase(clean);
    return clean.replace(/\s*x\s*(\d+)/gi, ' ×$1');
  }
  return '';
};

const computeTaskItemList = (entities?: any): string[] => {
  if (!entities) return [];
  const lines: string[] = [];

  const toSentenceCase = (str: string) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

  if (Array.isArray(entities.menu_items) && entities.menu_items.length > 0) {
    entities.menu_items.forEach((it: any) => {
      const opt = it.selected_option && it.selected_option !== '없음' && it.selected_option !== 'none' ? ` (${it.selected_option})` : '';
      const name = toSentenceCase(it.name || '');
      lines.push(`- ${name}${opt} ${it.quantity ? `×${it.quantity}` : ''}`.trim());
    });
  } else if (Array.isArray(entities.items) && entities.items.length > 0) {
    entities.items.forEach((it: any) => {
      const itemText = typeof it.item === 'object' && it.item !== null ? (it.item.name || it.item.id || '') : it.item;
      const name = toSentenceCase(itemText || '');
      lines.push(`- ${name} ${it.count ? `×${it.count}` : ''}`.trim());
    });
  } else if (entities.item) {
    const itemText = typeof entities.item === 'object' && entities.item !== null ? (entities.item.name || entities.item.id || '') : entities.item;
    const name = toSentenceCase(itemText || '');
    lines.push(`- ${name} ${entities.count ? `×${entities.count}` : ''}`.trim());
  }

  if (Array.isArray(entities.tasks)) {
    entities.tasks.forEach((tStr: string) => {
      lines.push(`- ${toSentenceCase(tStr || '')}`);
    });
  }

  return lines;
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
      break;
    }

    items.push({
      label,
      content: text,
    });
  }

  return items;
};

function renderEntities(entities: Record<string, any>, language: string, skipItemList: boolean = false): React.ReactNode {
  const rendered: React.ReactNode[] = [];

  // 0) 정규화: item 키 단독 혹은 item+count 플랫 키 → items 배열로 통일
  if (entities.item && !entities.items?.length) {
    entities = { ...entities, items: [{ item: entities.item, count: entities.count || 1 }] };
    delete entities.item;
    delete entities.count;
  }

  // 1) 배열 타입 특수 렌더링 (skipItemList가 true면 상단 타이틀 아래 이미 표기되었으므로 본문 렌더링 생략)
  if (!skipItemList && entities.items?.length > 0) {
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

  if (!skipItemList && entities.menu_items?.length > 0) {
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
      let displayValue: string;
      if (Array.isArray(value)) {
        displayValue = value.map(v => typeof v === 'object' && v !== null ? (v.name || v.id || JSON.stringify(v)) : String(v)).join(', ');
      } else if (typeof value === 'object' && value !== null) {
        displayValue = value.name || value.id || JSON.stringify(value);
      } else {
        displayValue = String(value);
      }

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
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const { showToast } = useUiStore();
  const isOnline = useNetworkStore((state) => state.isOnline);
  const { t, language } = useTranslation();
  const { translatedText: translatedSummary } = useTranslationApi(task?.summary, language);

  if (!isOpen || !task) return null;

  const handleClose = () => {
    setIsManualAssignOpen(false);
    setIsMoreMenuOpen(false);
    setIsCancelConfirmOpen(false);
    onClose();
  };

  const handleDirectCancel = async () => {
    if (onApproveCancellation) {
      setIsSubmitting(true);
      try {
        await onApproveCancellation(task.id, task.version);
        showToast(language === 'en' ? 'Task cancelled successfully.' : '태스크가 취소 처리되었습니다.', 'success');
        setIsCancelConfirmOpen(false);
        setIsMoreMenuOpen(false);
        handleClose();
      } catch (err) {
        showToast(err instanceof Error ? err.message : (language === 'en' ? 'Failed to cancel task.' : '태스크 취소 중 오류가 발생했습니다.'), 'error');
      } finally {
        setIsSubmitting(false);
      }
    }
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

  const getDeptClass = (deptId?: string) => {
    if (!deptId) return '';
    const upper = deptId.toUpperCase();
    if (upper.includes('HK') || upper.includes('HOUSEKEEPING') || upper.includes('하우스키핑')) return styles.deptHk;
    if (upper.includes('FB') || upper.includes('FNB') || upper.includes('식음료')) return styles.deptFb;
    if (upper.includes('FACILITY') || upper.includes('MAINTENANCE') || upper.includes('시설')) return styles.deptFacility;
    if (upper.includes('CONCIERGE') || upper.includes('컨시어지')) return styles.deptConcierge;
    if (upper.includes('EMERGENCY') || upper.includes('긴급')) return styles.deptEmergency;
    if (upper.includes('FRONT') || upper.includes('프론트')) return styles.deptFront;
    return '';
  };

  const statusInfo = getStatusInfo(task.status, task.priority);
  const roomDisplay = language === 'en' ? `ROOM ${task.roomNumber}` : `${task.roomNumber}호`;
  const rawSummary = translatedSummary || task.summary;
  const toSentenceCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  const cleanSummary = toSentenceCase(cleanTitleSummary(rawSummary)).replace(/\s*x\s*(\d+)/gi, ' ×$1');

  const computedTitle = computeTaskTitle(task.departmentId, task.summary, task.entities, language);
  let modalTitle = computedTitle || cleanSummary || roomDisplay;
  const rawItemList = computeTaskItemList(task.entities);

  // 단일 항목 등 제목과 본문 내용이 완전히 동일/중복인 경우 중복 라인 제거 (TaskTicket과 동일한 로직)
  const itemList = (() => {
    if (!rawItemList || rawItemList.length === 0) return [];
    const normTitle = String(modalTitle || '')
      .replace(/^[-•*]\s*/gm, '')
      .replace(/[×xX]/g, 'x')
      .replace(/\s+/g, '')
      .toLowerCase()
      .trim();

    if (rawItemList.length === 1) {
      const normLine = rawItemList[0]
        .replace(/^[-•*]\s*/gm, '')
        .replace(/[×xX]/g, 'x')
        .replace(/\s+/g, '')
        .toLowerCase()
        .trim();
      if (normLine === normTitle) return [];
      return rawItemList;
    }

    return rawItemList.filter(line => {
      const normLine = line
        .replace(/^[-•*]\s*/gm, '')
        .replace(/[×xX]/g, 'x')
        .replace(/\s+/g, '')
        .toLowerCase()
        .trim();
      return normLine !== normTitle;
    });
  })();

  const rawTextParts = task.rawText ? task.rawText.split('\n|||TRANSFER_REASON|||') : [];
  const transferReasonText = rawTextParts.length > 1 ? rawTextParts.slice(1).join('\n').trim() : null;

  return (
    <>
      <ModalOverlay isOpen={isOpen && !isManualAssignOpen && !isChatHistoryOpen && !isCancelConfirmOpen} onClose={handleClose}>
        <ModalCard size="md" overflowVisible={false} onClose={handleClose}>
          {/* 1. 헤더 */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <span className={`${styles.roomNo} ${getDeptClass(task.departmentId)}`}>
                {roomDisplay}
              </span>
            </div>
            <div className={styles.titleRow}>
              <h2 className={styles.title}>
                {task.cancelRequested ? (language === 'en' ? 'Cancel Request' : '취소 요청') : modalTitle}
              </h2>
              <StatusBadge variant={statusInfo.variant}>{statusInfo.text}</StatusBadge>

              {/* 우측 더보기 (⋮) 메뉴 - title과 나란히, X 아이콘 아래에 위치 */}
              {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
                <div className={styles.moreMenuWrapper}>
                  <button
                    type="button"
                    className={styles.moreButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMoreMenuOpen(!isMoreMenuOpen);
                    }}
                    aria-label={language === 'en' ? 'More options' : '더보기'}
                  >
                    <MoreVertical size={18} />
                  </button>
                  {isMoreMenuOpen && (
                    <div className={styles.menuPopover} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={styles.menuItemDelete}
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          setIsCancelConfirmOpen(true);
                        }}
                      >
                        <Trash2 size={15} />
                        <span>{language === 'en' ? 'Cancel Task' : '태스크 취소'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 카드와 100% 동일하게 타이틀 바로 아래에 item list 렌더링 (회색 텍스트) */}
            {itemList.length > 0 && (
              <div className={styles.itemListSubtitle}>
                {itemList.map((line, idx) => (
                  <p key={idx} className={styles.itemListLine}>{line}</p>
                ))}
              </div>
            )}

            {task.cancelRequested && cleanSummary && (
              <div className={styles.cancelSubTitle}>
                {cleanSummary}
              </div>
            )}
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

            {/* Request created at 일시 (예: 01:50 Aug 17 2026) */}
            {task.createdAt && (
              <div className={styles.reasoningItem}>
                <span className={styles.secondaryLabel}>
                  {language === 'ko' ? '요청 일시' : 'Request created at'}
                </span>
                <p className={styles.reasoningText}>
                  {formatCreatedAt(task.createdAt)}
                </p>
              </div>
            )}

            {/* AI 분석 엔티티 (Item Requests, Order Menu 등) */}
            {task.entities && renderEntities(task.entities, language, itemList.length > 0)}

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

            {/* Accepted by 수락 담당자 */}
            {task.assignedStaffName && (
              <div className={styles.reasoningItem}>
                <span className={styles.secondaryLabel}>
                  {language === 'ko' ? '수락 담당자' : 'Accepted by'}
                </span>
                <p className={styles.reasoningText}>
                  {task.assignedStaffName}
                </p>
              </div>
            )}

            {/* Accepted at 수락 일시 */}
            {task.assignedStaffName && task.updatedAt && (
              <div className={styles.reasoningItem}>
                <span className={styles.secondaryLabel}>
                  {language === 'ko' ? '수락 일시' : 'Accepted at'}
                </span>
                <p className={styles.reasoningText}>
                  {formatCreatedAt(task.updatedAt)}
                </p>
              </div>
            )}

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
                    {(() => {
                      const isReassign = task.departmentId && task.departmentId !== 'FRONT';
                      return isReassign
                        ? (language === 'en' ? 'Reassign Task' : '업무 재배정')
                        : (language === 'en' ? 'Assign Task' : '업무 배정');
                    })()}
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

              {task.status === 'IN_PROGRESS' && !task.cancelRequested && (
                <>
                  <Button
                    variant="secondary"
                    size="medium"
                    onClick={() => setIsManualAssignOpen(true)}
                    className={styles.actionButton}
                    disabled={isSubmitting || !isOnline}
                    title={!isOnline ? (language === 'en' ? 'Unavailable offline' : '오프라인 상태에서는 사용할 수 없습니다') : undefined}
                  >
                    {language === 'en' ? 'Reassign Task' : '업무 재배정'}
                  </Button>
                  {onComplete && (
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
                </>
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
          assigneeName: task.assignedStaffName || (task as any).assigneeName || (task as any).staffName,
          description: task.rawText || '',
          entities: task.entities
        }}
        departments={DEPARTMENTS}
        onSave={async (editDeptId, editPriority, editSummary, editDescription) => {
          if (onTransfer) {
            setIsSubmitting(true);
            try {
              await onTransfer(task.id, task.version, editDeptId, editDescription || editSummary || '');
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

      <ModalOverlay isOpen={isCancelConfirmOpen} onClose={() => setIsCancelConfirmOpen(false)}>
        <ModalCard size="sm" onClose={() => setIsCancelConfirmOpen(false)}>
          <div className={styles.confirmBox}>
            <h3 className={styles.confirmTitle}>{language === 'en' ? 'Cancel Task' : '태스크 취소'}</h3>
            <p className={styles.confirmDesc}>
              {language === 'en'
                ? `Are you sure you want to cancel the task for Room ${task.roomNumber}? This action will mark the ticket as Cancelled.`
                : `정말 ${task.roomNumber}호의 태스크를 취소하시겠습니까? 이 작업은 취소(CANCELLED) 처리됩니다.`}
            </p>
            <div className={styles.confirmActions}>
              <Button variant="outlined" size="medium" onClick={() => setIsCancelConfirmOpen(false)} disabled={isSubmitting}>
                {language === 'en' ? 'Keep Task' : '돌아가기'}
              </Button>
              <Button
                variant="primary"
                size="medium"
                style={{ backgroundColor: '#DC2626', borderColor: '#DC2626', color: '#FFFFFF' }}
                onClick={handleDirectCancel}
                disabled={isSubmitting}
              >
                {language === 'en' ? 'Confirm Cancel' : '취소 확정'}
              </Button>
            </div>
          </div>
        </ModalCard>
      </ModalOverlay>
    </>
  );
}
