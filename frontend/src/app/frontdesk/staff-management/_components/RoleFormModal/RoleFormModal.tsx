import React, { useState, useEffect } from 'react';
import { ModalOverlay, ModalCard } from '@/components/ui/Modal';
import Button from '@/components/ui/Button/Button';
import InputField from '@/components/ui/Inputfield/InputField';
import Dropdown from '@/components/ui/Dropdown/Dropdown';
import { Role } from '../RoleTab/useRoleManagement';
import { Department } from '../Department/useDepartmentManagement';
import { useUiStore } from '@/stores/useUiStore';

interface RoleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { departmentId: string; name: string }) => Promise<void>;
  initialData?: Role;
  departments: Department[];
}

export default function RoleFormModal({ isOpen, onClose, onSave, initialData, departments }: RoleFormModalProps) {
  const [departmentId, setDepartmentId] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useUiStore();

  useEffect(() => {
    if (isOpen) {
      setDepartmentId(initialData?.departmentId || '');
      setName(initialData?.name || '');
    }
  }, [isOpen, initialData]);

  const handleSubmit = async () => {
    if (!departmentId) {
      showToast('부서를 선택해주세요.', 'error');
      return;
    }
    if (!name.trim()) {
      showToast('역할명을 입력해주세요.', 'error');
      return;
    }

    setLoading(true);
    try {
      await onSave({ departmentId, name });
      onClose();
    } catch (err: any) {
      // 에러 처리는 useRoleManagement에서 하거나 여기서 직접 showToast
      showToast(err.message || '저장에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalCard size="sm" onClose={onClose} title={initialData ? '역할 수정' : '새 역할 추가'}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)', marginBottom: 'var(--space-32)' }}>
          <Dropdown
            label="부서"
            options={departments.map(d => ({ label: d.name, value: d.id }))}
            value={departmentId}
            onChange={setDepartmentId}
          />
          <InputField
            label="역할명"
            placeholder="역할명을 입력하세요"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-12)' }}>
          <Button variant="secondary" onClick={onClose} fullWidth>
            취소
          </Button>
          <Button variant="primary" onClick={handleSubmit} fullWidth disabled={loading}>
            {loading ? '저장 중...' : '저장'}
          </Button>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
