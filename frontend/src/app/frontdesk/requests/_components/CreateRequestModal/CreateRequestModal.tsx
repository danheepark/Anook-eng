'use client';

import React, { useState, useEffect } from 'react';
import styles from './CreateRequestModal.module.css';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import Button from '@/components/ui/Button/Button';
import Dropdown from '@/components/ui/Dropdown/Dropdown';
import InputField from '@/components/ui/Inputfield/InputField';
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


  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    // 부서 목록 조회
    fetch('/api/frontdesk/departments')
      .then(res => res.json())
      .then((data: Department[]) => setDepartments(data.filter(d => d.id !== 'EMERGENCY')))
      .catch(() => {});
  }, [isOpen]);

  const resetForm = () => {
    setDepartmentId('');
    setRoomNo('');
    setSummary('');
    setRawText('');

  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!departmentId || !roomNo || !summary) return;
    const payload: any = { departmentId, roomNo, summary, priority: 'NORMAL' };
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
      <ModalCard size="md" overflowVisible={true} onClose={handleClose} title="요청 생성">

        <div className={styles.form}>
          {/* 객실 번호 */}
          <div className={styles.field}>
            <InputField
              id="cr-room"
              label="객실 번호 *"
              placeholder="예: 707"
              value={roomNo}
              onChange={(e) => setRoomNo(e.target.value)}
            />
          </div>

          {/* 요약 */}
          <div className={styles.field}>
            <InputField
              id="cr-summary"
              label="요청 내용 *"
              placeholder="예: 수건 2장 추가 요청"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          {/* 상세 내용 (선택) */}
          <div className={styles.field}>
            <InputField
              as="textarea"
              id="cr-raw"
              label="상세 내용"
              placeholder="고객 원문 또는 상세 메모 (선택)"
              value={rawText}
              onChange={(e: any) => setRawText(e.target.value)}
              rows={3}
            />
          </div>

          {/* 배정 부서 */}
          <div className={styles.row}>
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
