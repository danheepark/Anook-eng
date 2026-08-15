import React, { useState, useEffect } from 'react';
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
}

interface ManualAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  detail: RequestDetail;
  departments: Department[];
  onSave: (editDeptId: string, editPriority: string, editSummary?: string, editDescription?: string) => Promise<void>;
  saving: boolean;
}

export default function ManualAssignModal({ isOpen, onClose, detail, departments, onSave, saving }: ManualAssignModalProps) {
  const { language } = useTranslation();
  const [editDeptId, setEditDeptId] = useState(detail.departmentId);
  const [editSummary, setEditSummary] = useState(detail.summary || '');
  const [editDescription, setEditDescription] = useState(detail.description || '');

  useEffect(() => {
    if (isOpen) {
      setEditDeptId(detail.departmentId);
      setEditSummary(detail.summary || '');
      setEditDescription(detail.description || '');
    }
  }, [isOpen, detail]);

  if (!isOpen) return null;

  const canSubmit = editDeptId && editDeptId !== 'FRONT' && editSummary.trim().length > 0;

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
                description={editDescription}
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


          </div>
        </div>

        <div className={styles.footer}>
          <Button variant="secondary" onClick={onClose}>
            {language === 'ko' ? '취소' : 'Cancel'}
          </Button>
          <Button variant="primary" disabled={!canSubmit || saving} onClick={() => onSave(editDeptId, 'NORMAL', editSummary, editDescription)}>
            {saving
              ? (language === 'ko' ? '저장 중...' : 'Saving...')
              : (language === 'ko' ? '배정하기' : 'Assign')}
          </Button>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
