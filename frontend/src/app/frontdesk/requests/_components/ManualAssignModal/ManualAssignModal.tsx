import React, { useState, useEffect, useMemo } from 'react';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import Button from '@/components/ui/Button/Button';
import Dropdown from '@/components/ui/Dropdown/Dropdown';
import TaskTicket from '@/components/ui/TaskBoard/TaskTicket';
import InputField from '@/components/ui/Inputfield/InputField';
import { useTranslation } from '@/app/useTranslation';
import styles from './ManualAssignModal.module.css';

interface Department {
  id: string;
  name: string;
}

interface RequestDetail {
  id: number;
  priority: string;
  departmentId: string;
  departmentName: string;
  roomNo: string;
  summary: string;
  createdAt: string;
  status: string;
  assigneeName?: string;
  description?: string;
  entities?: any;
}

interface ManualAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  detail: RequestDetail;
  departments: Department[];
  onSave: (editDeptId: string, editPriority: string, editSummary?: string, editDescription?: string) => Promise<void>;
  saving: boolean;
}

const cleanTitleSummary = (text?: string) => {
  if (!text) return '';
  return text
    .replace(/\s+at\s+\d{1,2}:\d{2}(\s*(?:AM|PM|am|pm))?/gi, '')
    .replace(/\s+at\s+\d{1,2}\s*(?:AM|PM|am|pm)/gi, '')
    .trim();
};

function computeTaskTitle(
  departmentId?: string,
  summary?: string,
  entities?: any,
  language: string = 'en'
): string {
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
}

function computeTaskItemList(entities?: any): string[] {
  if (!entities) return [];
  const lines: string[] = [];

  if (Array.isArray(entities.menu_items) && entities.menu_items.length > 0) {
    entities.menu_items.forEach((it: any) => {
      const opt = it.selected_option && it.selected_option !== '없음' && it.selected_option !== 'none' ? ` (${it.selected_option})` : '';
      lines.push(`- ${it.name}${opt} ${it.quantity ? `×${it.quantity}` : ''}`.trim());
    });
  } else if (Array.isArray(entities.items) && entities.items.length > 0) {
    entities.items.forEach((it: any) => {
      const itemText = typeof it.item === 'object' && it.item !== null ? (it.item.name || it.item.id || '') : it.item;
      lines.push(`- ${itemText} ${it.count ? `×${it.count}` : ''}`.trim());
    });
  } else if (entities.item) {
    const itemText = typeof entities.item === 'object' && entities.item !== null ? (entities.item.name || entities.item.id || '') : entities.item;
    lines.push(`- ${itemText} ${entities.count ? `×${entities.count}` : ''}`.trim());
  }

  if (Array.isArray(entities.tasks)) {
    entities.tasks.forEach((tStr: string) => {
      lines.push(`- ${tStr}`);
    });
  }

  return lines;
}

export default function ManualAssignModal({ isOpen, onClose, detail, departments, onSave, saving }: ManualAssignModalProps) {
  const { language } = useTranslation();
  const [editDeptId, setEditDeptId] = useState(detail.departmentId);
  const [editSummary, setEditSummary] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [reassignReason, setReassignReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEditDeptId(detail.departmentId);
      
      // Title 기본값 설정: computeTaskTitle로 추출된 카드의 고유 Title을 기본값으로 할당
      let initialTitle = computeTaskTitle(detail.departmentId, detail.summary, detail.entities, language);
      if (!initialTitle) {
        initialTitle = detail.summary || '';
      }
      setEditSummary(initialTitle);
      setReassignReason('');

      // 상세 설명 기본값 설정: entities에서 item list를 최우선으로 추출하여 세팅
      let initialDesc = '';
      if (detail.entities) {
        const itemLines = computeTaskItemList(detail.entities);
        if (itemLines.length > 0) {
          initialDesc = itemLines.join('\n');
        }
      }
      if (!initialDesc) {
        initialDesc = detail.description || '';
      }
      setEditDescription(initialDesc);
    }
  }, [isOpen, detail, language]);

  // 미리보기 카드용 통합 설명 (아이템 리스트 + 재배정 사유)
  const previewDescription = useMemo(() => {
    const parts = [];
    if (editDescription.trim()) parts.push(editDescription.trim());
    if (reassignReason.trim()) {
      const reasonLabel = language === 'ko' ? '재배정 사유' : 'Reassignment reason';
      parts.push(`[${reasonLabel}] ${reassignReason.trim()}`);
    }
    return parts.join('\n\n');
  }, [editDescription, reassignReason, language]);

  if (!isOpen) return null;

  const canSubmit = editDeptId && editDeptId !== 'FRONT' && editSummary.trim().length > 0;

  const handleAssignSubmit = () => {
    const finalParts = [];
    if (editDescription.trim()) {
      finalParts.push(editDescription.trim());
    }
    if (reassignReason.trim()) {
      finalParts.push(`|||TRANSFER_REASON|||\n${reassignReason.trim()}`);
    }
    const finalDescription = finalParts.join('\n');
    onSave(editDeptId, 'NORMAL', editSummary, finalDescription);
  };

  const isReassign = detail.departmentId && detail.departmentId !== 'FRONT';
  const modalTitleText = isReassign
    ? (language === 'ko' ? '업무 재배정' : 'Reassign Task')
    : (language === 'ko' ? '수동 배정' : 'Assign Task');

  const buttonText = saving
    ? (language === 'ko' ? '저장 중...' : 'Saving...')
    : isReassign
      ? (language === 'ko' ? '재배정하기' : 'Reassign')
      : (language === 'ko' ? '배정하기' : 'Assign');

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalCard size="md" overflowVisible={true} onClose={onClose} title={modalTitleText}>

        <div className={styles.content}>
          {/* 미리보기 카드 — 입력필드와 1:1 실시간 동기화 */}
          <div className={styles.previewSection}>
            <div className={styles.previewCardWrapper}>
              <TaskTicket
                ticketId={detail.id}
                roomNo={detail.roomNo}
                department={editDeptId}
                priority={'NORMAL'}
                title={editSummary || (language === 'ko' ? '배정할 업무 내용을 입력하세요' : 'Enter task summary')}
                description={previewDescription}
                status={detail.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'TODO'}
                assigneeName={detail.assigneeName}
                createdAt={detail.createdAt}
              />
            </div>
          </div>

          {/* 편집 폼 */}
          <div className={styles.formSection}>
            <div className={styles.editField}>
              <Dropdown
                label={language === 'ko' ? '배정 부서' : 'Department'}
                placeholder={language === 'ko' ? '부서를 선택하세요' : 'Select department'}
                options={departments.filter(d => d.id !== 'FRONT').map(d => ({ value: d.id, label: d.name }))}
                value={editDeptId}
                onChange={(val) => setEditDeptId(val)}
              />
            </div>

            <div className={styles.editField}>
              <InputField
                label={language === 'ko' ? '제목' : 'Title'}
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                placeholder={language === 'ko' ? '배정할 업무 내용을 입력하세요' : 'Enter task summary'}
              />
            </div>

            <div className={styles.editField}>
              <InputField
                as="textarea"
                label={language === 'ko' ? '상세 설명' : 'Description'}
                value={editDescription}
                onChange={(e: any) => setEditDescription(e.target.value)}
                placeholder={language === 'ko' ? '상세한 업무 내용을 입력하세요 (선택)' : 'Enter task description (optional)'}
                rows={3}
              />
            </div>

            <div className={styles.editField}>
              <InputField
                label={language === 'ko' ? '재배정 사유' : 'Reassignment Reason'}
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                placeholder={language === 'ko' ? '재배정 또는 이관 사유를 입력하세요 (선택)' : 'Enter reason for reassignment (optional)'}
              />
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <Button variant="secondary" onClick={onClose}>
            {language === 'ko' ? '취소' : 'Cancel'}
          </Button>
          <Button variant="primary" disabled={!canSubmit || saving} onClick={handleAssignSubmit}>
            {buttonText}
          </Button>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
