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
  const [editSummary, setEditSummary] = useState(detail.summary || '');
  const [editDescription, setEditDescription] = useState('');
  const [reassignReason, setReassignReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEditDeptId(detail.departmentId);
      setEditSummary(detail.summary || '');
      setReassignReason('');

      // 상세 설명 기본값 설정: 기존 description이 없으면 entities에서 item list 자동 추출
      let initialDesc = detail.description || '';
      if (!initialDesc && detail.entities) {
        const itemLines = computeTaskItemList(detail.entities);
        if (itemLines.length > 0) {
          initialDesc = itemLines.join('\n');
        }
      }
      setEditDescription(initialDesc);
    }
  }, [isOpen, detail]);

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

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalCard size="md" overflowVisible={true} onClose={onClose} title={language === 'ko' ? '수동 배정' : 'Assign Task'}>

        <div className={styles.content}>
          {/* 미리보기 카드 — 실시간 반영 */}
          <div className={styles.previewSection}>
            <div className={styles.previewCardWrapper}>
              <TaskTicket
                ticketId={detail.id}
                roomNo={detail.roomNo}
                department={editDeptId}
                priority={'NORMAL'}
                title={editSummary || (language === 'ko' ? '배정할 업무 내용을 입력하세요' : 'Enter task summary')}
                description={previewDescription}
                entities={detail.entities}
                status="TODO"
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
            {saving
              ? (language === 'ko' ? '저장 중...' : 'Saving...')
              : (language === 'ko' ? '배정하기' : 'Assign')}
          </Button>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
