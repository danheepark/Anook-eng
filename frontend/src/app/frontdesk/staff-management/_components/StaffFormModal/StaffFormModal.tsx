import React, { useState, useEffect } from 'react';
import { ModalOverlay, ModalCard } from '@/components/ui/Modal';
import Button from '@/components/ui/Button/Button';
import InputField from '@/components/ui/Inputfield/InputField';
import Dropdown from '@/components/ui/Dropdown/Dropdown';
import { useTranslation } from '@/app/useTranslation';
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
  const { t } = useTranslation();
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
      showToast(t.frontdeskPage.staffManagement.staffTab.nameRequired, 'error');
      return;
    }
    if (!roleId) {
      showToast(t.frontdeskPage.staffManagement.staffTab.roleRequired, 'error');
      return;
    }
    if (!departmentId) {
      showToast(t.frontdeskPage.staffManagement.staffTab.deptRequired, 'error');
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
      showToast(err.message || t.frontdeskPage.staffManagement.common.saveFailed, 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedDept = departments.find(d => d.id === departmentId);
  const isFrontDesk = selectedDept?.id === 'FRONT' || selectedDept?.name === '프론트데스크';
  const frontAdminRole = roles.find(r => r.name === '관리자' && r.departmentId === departmentId);

  useEffect(() => {
    if (isFrontDesk && frontAdminRole) {
      setRoleId(String(frontAdminRole.id));
    }
  }, [isFrontDesk, frontAdminRole]);

  const filteredRoles = isFrontDesk && frontAdminRole
    ? [frontAdminRole]
    : departmentId
    ? roles.filter(r => r.departmentId === departmentId)
    : roles;

  const roleOptions = filteredRoles.map(r => ({ label: r.name, value: String(r.id) }));
  const deptOptions = departments
    .filter(d => d.id !== 'EMERGENCY' && d.name !== '긴급대응')
    .map(d => ({ label: d.name, value: d.id }));

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalCard size="md" onClose={onClose} title={initialData ? t.frontdeskPage.staffManagement.staffTab.editStaff : t.frontdeskPage.staffManagement.staffTab.newStaff} overflowVisible={true}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)', marginBottom: 'var(--space-32)' }}>
          <InputField
            label={t.frontdeskPage.staffManagement.staffTab.nameInputLabel}
            placeholder={t.frontdeskPage.staffManagement.staffTab.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Dropdown
            label={t.frontdeskPage.staffManagement.staffTab.dept}
            options={deptOptions}
            value={departmentId}
            onChange={(val) => {
              setDepartmentId(val);
              setRoleId('');
            }}
          />

          <Dropdown
            label={t.frontdeskPage.staffManagement.staffTab.role}
            options={roleOptions}
            value={roleId}
            onChange={setRoleId}
            disabled={isFrontDesk}
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
