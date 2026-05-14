import React, { useState, useEffect } from 'react';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import { CancelIcon } from '@/components/icons';
import Button from '@/components/ui/Button/Button';
import Dropdown from '@/components/ui/Dropdown/Dropdown';
import TaskTicket from '@/components/ui/TaskBoard/TaskTicket';
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
}

interface ManualAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  detail: RequestDetail;
  departments: Department[];
  onSave: (editDeptId: string, editPriority: string) => Promise<void>;
  saving: boolean;
}

export default function ManualAssignModal({ isOpen, onClose, detail, departments, onSave, saving }: ManualAssignModalProps) {
  const [editPriority, setEditPriority] = useState<string>('NORMAL');
  const [editDeptId, setEditDeptId] = useState(detail.departmentId);

  useEffect(() => {
    if (isOpen) {
      setEditPriority('NORMAL'); // 항상 기본값은 'NORMAL' (체크 해제 상태)
      setEditDeptId(detail.departmentId);
    }
  }, [isOpen, detail]);

  if (!isOpen) return null;

  const hasChanges = editPriority !== detail.priority || editDeptId !== detail.departmentId;

  // Create a mock request object for the preview card
  const deptName = departments.find(d => d.id === editDeptId)?.name || detail.departmentName;
  const isUrgent = editPriority === 'URGENT';

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalCard size="md" overflowVisible={true}>
        <div className={styles.header}>
          <h2 className={styles.title}>수동 배정</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="닫기">
            <CancelIcon width={20} height={20} color="var(--color-gray-500)" />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.previewSection}>
            <div className={styles.previewCardWrapper}>
              <TaskTicket 
                ticketId={detail.id}
                roomNo={detail.roomNo}
                department={editDeptId}
                priority={editPriority as 'NORMAL' | 'URGENT'}
                title={detail.summary}
                description=""
                status="TODO"
                createdAt={detail.createdAt}
              />
            </div>
          </div>

          <div className={styles.formSection}>
            <div className={styles.editFieldHorizontal}>
              <label className={styles.label}>우선순위</label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={editPriority === 'URGENT'}
                  onChange={(e) => setEditPriority(e.target.checked ? 'URGENT' : 'NORMAL')}
                  className={styles.checkbox}
                />
                <span className={editPriority === 'URGENT' ? styles.urgentText : styles.normalText}>
                  긴급 작업으로 설정
                </span>
              </label>
            </div>
            
            <div className={styles.editField}>
              <Dropdown
                label="배정 부서"
                placeholder="부서를 선택하세요"
                options={departments.filter(d => d.id !== 'FRONT').map(d => ({ value: d.id, label: d.name }))}
                value={editDeptId}
                onChange={(val) => setEditDeptId(val)}
              />
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button variant="primary" disabled={!hasChanges || saving} onClick={() => onSave(editDeptId, editPriority)}>
            {saving ? '저장 중...' : '배정하기'}
          </Button>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
