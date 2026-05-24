import React, { useState, useEffect } from 'react';
import { ModalOverlay, ModalCard } from '@/components/ui/Modal';
import Button from '@/components/ui/Button/Button';
import InputField from '@/components/ui/Inputfield/InputField';
import Dropdown from '@/components/ui/Dropdown/Dropdown';
import { useTranslation } from '@/app/useTranslation';
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
  const { t } = useTranslation();
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
      showToast(t.frontdeskPage.staffManagement.roleTab.deptRequired, 'error');
      return;
    }
    if (!name.trim()) {
      showToast(t.frontdeskPage.staffManagement.roleTab.roleRequired, 'error');
      return;
    }

    setLoading(true);
    try {
      await onSave({ departmentId, name });
      onClose();
    } catch (err: any) {
      // 에러 처리는 useRoleManagement에서 하거나 여기서 직접 showToast
      showToast(err.message || t.frontdeskPage.staffManagement.common.saveFailed, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalCard size="sm" onClose={onClose} title={initialData ? t.frontdeskPage.staffManagement.roleTab.editRole : t.frontdeskPage.staffManagement.roleTab.newRole}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)', marginBottom: 'var(--space-32)' }}>
          <Dropdown
            label={t.frontdeskPage.staffManagement.roleTab.dept}
            options={departments.map(d => ({ label: d.name, value: d.id }))}
            value={departmentId}
            onChange={setDepartmentId}
          />
          <InputField
            label={t.frontdeskPage.staffManagement.roleTab.roleName}
            placeholder={t.frontdeskPage.staffManagement.roleTab.rolePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-12)' }}>
          <Button variant="secondary" onClick={onClose} fullWidth>
            {t.frontdeskPage.staffManagement.common.cancel}
          </Button>
          <Button variant="primary" onClick={handleSubmit} fullWidth disabled={loading}>
            {loading ? t.frontdeskPage.staffManagement.common.saving : t.frontdeskPage.staffManagement.common.save}
          </Button>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
