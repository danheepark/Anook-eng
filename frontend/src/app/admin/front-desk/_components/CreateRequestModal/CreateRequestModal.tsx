'use client';

import React, { useState, useEffect } from 'react';
import styles from './CreateRequestModal.module.css';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import Button from '@/components/ui/Button/Button';
import Dropdown from '@/components/ui/Dropdown/Dropdown';
import { CancelIcon } from '@/components/icons';
import useCreateRequest from './useCreateRequest';

interface Department {
  id: string;
  name: string;
}

interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}



export default function CreateRequestModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateRequestModalProps) {
  const { createRequest, loading } = useCreateRequest();
  const [departmentId, setDepartmentId] = useState('');
  const [roomNo, setRoomNo] = useState('');
  const [summary, setSummary] = useState('');
  const [rawText, setRawText] = useState('');
  const [priority, setPriority] = useState('NORMAL');

  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    // 부서 목록 조회
    fetch('/api/admin/departments')
      .then(res => res.json())
      .then((data: Department[]) => setDepartments(data.filter(d => d.id !== 'EMERGENCY')))
      .catch(() => {});
  }, [isOpen]);

  const resetForm = () => {
    setDepartmentId('');
    setRoomNo('');
    setSummary('');
    setRawText('');
    setPriority('NORMAL');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!departmentId || !roomNo || !summary) return;
    const payload: any = { departmentId, roomNo, summary, priority };
    if (rawText) payload.rawText = rawText;
    
    const success = await createRequest(payload);
    if (success) {
      resetForm();
      onClose();
      if (onSuccess) onSuccess();
    }
  };

  const isValid = departmentId && roomNo && summary;

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleClose}>
      <ModalCard size="md" overflowVisible={true}>
        <div className={styles.header}>
          <h2 className={styles.title}>요청 생성</h2>
          <button className={styles.closeButton} onClick={handleClose} aria-label="닫기">
            <CancelIcon width={20} height={20} color="var(--color-gray-500)" />
          </button>
        </div>

        <div className={styles.form}>
          {/* 객실 번호 */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cr-room">객실 번호 <span className={styles.required}>*</span></label>
            <input
              id="cr-room"
              className={styles.input}
              type="text"
              placeholder="예: 707"
              value={roomNo}
              onChange={(e) => setRoomNo(e.target.value)}
            />
          </div>

          {/* 요약 */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cr-summary">요청 내용 <span className={styles.required}>*</span></label>
            <input
              id="cr-summary"
              className={styles.input}
              type="text"
              placeholder="예: 수건 2장 추가 요청"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          {/* 상세 내용 (선택) */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cr-raw">상세 내용</label>
            <textarea
              id="cr-raw"
              className={styles.textarea}
              placeholder="고객 원문 또는 상세 메모 (선택)"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={3}
            />
          </div>

          {/* 하단 2열: 우선순위 + 배정 부서 */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>우선순위</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', height: '40px', paddingLeft: '4px' }}>
                <input
                  type="checkbox"
                  checked={priority === 'URGENT'}
                  onChange={(e) => setPriority(e.target.checked ? 'URGENT' : 'NORMAL')}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-error)' }}
                />
                <span style={{ fontSize: '14px', fontWeight: priority === 'URGENT' ? 600 : 400, color: 'var(--color-gray-700)' }}>
                  긴급 작업으로 설정
                </span>
              </label>
            </div>
            <div className={styles.field}>
              <Dropdown
                label="배정 부서 *"
                placeholder="부서를 선택하세요"
                options={departments.map(d => ({ value: d.id, label: d.name }))}
                value={departmentId}
                onChange={(val) => setDepartmentId(val)}
              />
            </div>
          </div>
        </div>

        <div className={styles.buttonGroup}>
          <Button variant="secondary" style={{ flex: 1 }} onClick={handleClose}>
            취소
          </Button>
          <Button
            variant="primary"
            style={{ flex: 1 }}
            onClick={handleSubmit}
            disabled={!isValid || loading}
          >
            {loading ? '생성 중...' : '요청 생성'}
          </Button>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
