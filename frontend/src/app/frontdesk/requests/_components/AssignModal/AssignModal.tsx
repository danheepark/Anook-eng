'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './AssignModal.module.css';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import Button from '@/components/ui/Button/Button';
import InputField from '@/components/ui/Inputfield/InputField';

import useAssignRequest from './useAssignRequest';

interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: number;
  requestSummary: string;
  roomNo: string;
  onSuccess?: () => void;
}

export default function AssignModal({
  isOpen,
  onClose,
  requestId,
  requestSummary,
  roomNo,
  onSuccess,
}: AssignModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const { staffList, assignRequest, loading } = useAssignRequest();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAssign = async () => {
    if (selectedStaffId === null) return;
    const success = await assignRequest(requestId, selectedStaffId);
    if (success) {
      setSelectedStaffId(null);
      setSearchQuery('');
      onClose();
      if (onSuccess) onSuccess();
    }
  };

  const handleClose = () => {
    setSelectedStaffId(null);
    setSearchQuery('');
    onClose();
  };

  const filteredStaff = staffList.filter(staff =>
    staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    staff.departmentId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleClose}>
      <ModalCard size="sm" overflowVisible={true} onClose={handleClose} title="수동 배정">

        <div className={styles.info}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>객실</span>
            <span className={styles.infoValue}>{roomNo}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>요청</span>
            <span className={styles.infoValue}>{requestSummary}</span>
          </div>
        </div>

        <div className={styles.selectWrapper} ref={containerRef}>
          <div className={styles.comboboxContainer}>
            <InputField
              label="담당 직원 검색"
              placeholder="직원 이름 또는 부서를 입력하세요..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedStaffId(null);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
            />
            {isDropdownOpen && (
              <div className={styles.popoverMenu}>
                {filteredStaff.length > 0 ? (
                  filteredStaff.map((staff) => (
                    <button
                      key={staff.id}
                      type="button"
                      className={`${styles.popoverItem} ${selectedStaffId === staff.id ? styles.selectedItem : ''}`}
                      onClick={() => {
                        setSelectedStaffId(staff.id);
                        setSearchQuery(`${staff.name} (${staff.departmentId})`);
                        setIsDropdownOpen(false);
                      }}
                    >
                      <span className={styles.staffName}>{staff.name}</span>
                      <span className={styles.staffDept}>{staff.departmentId}</span>
                    </button>
                  ))
                ) : (
                  <div className={styles.noResults}>검색 결과가 없습니다</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={styles.buttonGroup}>
          <Button variant="secondary" style={{ flex: 1 }} onClick={handleClose}>
            취소
          </Button>
          <Button
            variant="primary"
            style={{ flex: 1 }}
            onClick={handleAssign}
            disabled={selectedStaffId === null || loading}
          >
            {loading ? '배정 중...' : '배정하기'}
          </Button>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
