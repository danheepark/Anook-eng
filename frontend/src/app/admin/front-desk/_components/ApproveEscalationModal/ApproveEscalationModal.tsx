'use client';

import React, { useEffect, useState } from 'react';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import Button from '@/components/ui/Button/Button';
import Dropdown from '@/components/ui/Dropdown/Dropdown';
import styles from './ApproveEscalationModal.module.css';

import useApproveEscalation from './useApproveEscalation';

interface Department {
  id: string;
  name: string;
}

export interface ApproveEscalationModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: number;
  onSuccess?: () => void;
}

export default function ApproveEscalationModal({
  isOpen,
  onClose,
  requestId,
  onSuccess,
}: ApproveEscalationModalProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('NORMAL');
  const { approveEscalation, loading } = useApproveEscalation();

  useEffect(() => {
    if (isOpen) {
      fetch('/api/admin/departments')
        .then(res => res.json())
        .then((data: Department[]) => {
          const filteredDepartments = data.filter(d => d.id !== 'EMERGENCY');
          setDepartments(filteredDepartments);
          if (filteredDepartments.length > 0) setSelectedDept(filteredDepartments[0].id);
        })
        .catch(err => console.error(err));
    }
  }, [isOpen]);

  const handleApprove = async () => {
    if (!selectedDept || !selectedPriority) return;
    const success = await approveEscalation(requestId, selectedDept, selectedPriority);
    if (success) {
      onClose();
      if (onSuccess) onSuccess();
    }
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalCard size="sm" overflowVisible={true}>
        <div className={styles.textWrapper}>
          <h2 className={styles.title}>에스컬레이션 승인</h2>
          <p className={styles.subtitle}>재배정할 부서를 선택해 주세요. 승인 시 우선순위가 긴급으로 변경되며 부서로 요청이 넘어갑니다.</p>
        </div>

        <div className={styles.inputGroup}>
          <Dropdown
            label="배정 부서"
            placeholder="부서를 선택하세요"
            options={departments.map(dept => ({ value: dept.id, label: dept.name }))}
            value={selectedDept}
            onChange={(val) => setSelectedDept(val)}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>우선순위</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', height: '40px', paddingLeft: '4px' }}>
            <input
              type="checkbox"
              checked={selectedPriority === 'URGENT'}
              onChange={(e) => setSelectedPriority(e.target.checked ? 'URGENT' : 'NORMAL')}
              disabled={loading}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-error)' }}
            />
            <span style={{ fontSize: '14px', fontWeight: selectedPriority === 'URGENT' ? 600 : 400, color: 'var(--color-gray-700)' }}>
              긴급 작업으로 설정
            </span>
          </label>
        </div>

        <div className={styles.buttonGroup}>
          <Button variant="secondary" style={{ flex: 1 }} onClick={onClose} disabled={loading}>
            아니오
          </Button>
          <Button variant="primary" style={{ flex: 1 }} onClick={handleApprove} disabled={loading}>
            승인하기
          </Button>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
