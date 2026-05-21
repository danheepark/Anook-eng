import React, { useState, useEffect } from 'react';
import { ModalOverlay, ModalCard } from '@/components/ui/Modal';
import Button from '@/components/ui/Button/Button';
import InputField from '@/components/ui/Inputfield/InputField';
import Dropdown from '@/components/ui/Dropdown/Dropdown';
import { Staff } from '../StaffTab/useStaffManagement';
import { Role } from '../RoleTab/useRoleManagement';
import { Department } from '../Department/useDepartmentManagement';
import { useUiStore } from '@/stores/useUiStore';

interface StaffFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; roleId: number; departmentId: string }) => Promise<void>;
  initialData?: Staff;
  roles: Role[];
  departments: Department[];
}

export default function StaffFormModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  roles,
  departments
}: StaffFormModalProps) {
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useUiStore();

  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || '');
      setRoleId(initialData?.roleId ? String(initialData.roleId) : '');
      setDepartmentId(initialData?.departmentId || '');
    }
  }, [isOpen, initialData]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast('직원 이름을 입력해주세요.', 'error');
      return;
    }
    if (!roleId) {
      showToast('역할을 선택해주세요.', 'error');
      return;
    }
    if (!departmentId) {
      showToast('부서를 선택해주세요.', 'error');
      return;
    }

    setLoading(true);
    try {
      await onSave({
        name,
        roleId: Number(roleId),
        departmentId,
      });
      onClose();
    } catch (err: any) {
      showToast(err.message || '저장에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredRoles = departmentId
    ? roles.filter(r => r.departmentId === departmentId)
    : roles;

  const roleOptions = filteredRoles.map(r => ({ label: r.name, value: String(r.id) }));
  const deptOptions = departments.map(d => ({ label: d.name, value: d.id }));

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalCard size="md" onClose={onClose} title={initialData ? '직원 정보 수정' : '새 직원 추가'}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)', marginBottom: 'var(--space-32)' }}>
          <InputField
            label="직원 이름"
            placeholder="이름을 입력하세요"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Dropdown
            label="부서"
            options={deptOptions}
            value={departmentId}
            onChange={(val) => {
              setDepartmentId(val);
              setRoleId('');
            }}
          />

          <Dropdown
            label="역할"
            options={roleOptions}
            value={roleId}
            onChange={setRoleId}
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
