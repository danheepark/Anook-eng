import React, { useState, useEffect } from 'react';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/Table/Table';
import Button from '@/components/ui/Button/Button';
import { useTranslation } from '@/app/useTranslation';
import SmartSearchBar from '@/components/ui/SmartSearchBar/SmartSearchBar';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import { useStaffManagement, Staff } from './useStaffManagement';
import { useRoleManagement } from '../RoleTab/useRoleManagement';
import { useDepartmentManagement } from '../Department/useDepartmentManagement';
import StaffFormModal from '../StaffFormModal/StaffFormModal';
import { ConfirmModal } from '@/components/ui/Modal';
import { useUiStore } from '@/stores/useUiStore';
import EditIcon from '@/components/icons/EditIcon';
import DeleteIcon from '@/components/icons/DeleteIcon';

import HeaderSearchSlot from '@/components/layout/HeaderSearchSlot';

const deptVariantMap: Record<string, "gray" | "red" | "purple" | "green"> = {
  HK: 'green',
  FB: 'purple',
  // 그 외는 모두 기본값 (gray)
};

export default function StaffTab() {
  const { t } = useTranslation();
  const { staffList, loading: staffLoading, error: staffError, fetchStaffList, createStaff, updateStaff, deleteStaff } = useStaffManagement();
  const { roles, loading: rolesLoading, fetchRoles } = useRoleManagement();
  const { departments, loading: deptsLoading, fetchDepartments } = useDepartmentManagement();
  
  const { showToast } = useUiStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | undefined>(undefined);
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);

  useEffect(() => {
    fetchStaffList();
    fetchRoles();
    fetchDepartments();
  }, [fetchStaffList, fetchRoles, fetchDepartments]);

  useEffect(() => {
    if (staffError) showToast(staffError, 'error');
  }, [staffError, showToast]);

  const filteredStaff = React.useMemo(() => {
    if (!searchTerm) return staffList;
    const lower = searchTerm.toLowerCase();
    return staffList.filter((staff) =>
      staff.name.toLowerCase().includes(lower) ||
      (staff.pin && String(staff.pin).includes(lower)) ||
      getDeptName(staff.departmentId).toLowerCase().includes(lower) ||
      getRoleName(staff.roleId).toLowerCase().includes(lower)
    );
  }, [staffList, departments, roles, searchTerm]);

  useEffect(() => {
    if (filteredStaff.length > 0 && currentMatch >= filteredStaff.length) {
      setCurrentMatch(filteredStaff.length - 1);
    }
  }, [filteredStaff, currentMatch]);

  const scrollToMatch = (index: number) => {
    const target = filteredStaff[index];
    if (target) {
      setTimeout(() => {
        const el = document.getElementById(`staff-row-${target.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  };

  const handleAddClick = () => {
    setEditingStaff(undefined);
    setIsFormModalOpen(true);
  };

  const handleEditClick = (staff: Staff) => {
    setEditingStaff(staff);
    setIsFormModalOpen(true);
  };

  const handleDeleteClick = (staff: Staff) => {
    setStaffToDelete(staff);
    setIsConfirmModalOpen(true);
  };

  const handleSaveStaff = async (data: { name: string; roleId: number; departmentId: string }) => {
    if (editingStaff) {
      await updateStaff(editingStaff.id, data);
      showToast(t.frontdeskPage.staffManagement.staffTab.editSuccess, 'success');
    } else {
      await createStaff(data);
      showToast(t.frontdeskPage.staffManagement.staffTab.saveSuccess, 'success');
    }
  };

  const handleConfirmDelete = async () => {
    if (staffToDelete) {
      try {
        await deleteStaff(staffToDelete.id);
        showToast(t.frontdeskPage.staffManagement.staffTab.deleteSuccess, 'success');
      } catch (err) {}
    }
    setIsConfirmModalOpen(false);
    setStaffToDelete(null);
  };

  const getRoleName = (roleId: number) => {
    return roles.find(r => r.id === roleId)?.name || `알 수 없음(${roleId})`;
  };

  const getDeptName = (deptId: string) => {
    return departments.find(d => d.id === deptId)?.name || deptId;
  };

  const isLoading = staffLoading || rolesLoading || deptsLoading;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
      {/* Teleport Search Bar to Header */}
      <HeaderSearchSlot>
        <SmartSearchBar
          inputWrapperStyle={{ width: 240 }}
          value={searchTerm}
          onChange={(val) => {
            setSearchTerm(val);
            setCurrentMatch(0);
          }}
          placeholder={t.frontdeskPage.taskBoard.searchPlaceholder || '검색어 입력...'}
          currentMatch={currentMatch}
          totalMatches={searchTerm ? filteredStaff.length : 0}
          onPrev={() => {
            const newIndex = Math.max(0, currentMatch - 1);
            setCurrentMatch(newIndex);
            scrollToMatch(newIndex);
          }}
          onNext={() => {
            const newIndex = Math.min(filteredStaff.length - 1, currentMatch + 1);
            setCurrentMatch(newIndex);
            scrollToMatch(newIndex);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (filteredStaff.length > 0) {
                const newIndex = (currentMatch + 1) % filteredStaff.length;
                setCurrentMatch(newIndex);
                scrollToMatch(newIndex);
              }
            }
          }}
        />
      </HeaderSearchSlot>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Button variant="primary" onClick={handleAddClick}>
          {t.frontdeskPage.staffManagement.staffTab.addStaff}
        </Button>
      </div>

      {isLoading && staffList.length === 0 ? (
        <div style={{ padding: 'var(--space-24)', textAlign: 'center', color: 'var(--color-gray-500)' }}>
          {t.frontdeskPage.staffManagement.common.loading}
        </div>
      ) : (
        <Table columns="2fr 2fr 2fr 2fr 150px">
          <TableHeader>
            <TableCell>{t.frontdeskPage.staffManagement.staffTab.name}</TableCell>
            <TableCell>{t.frontdeskPage.staffManagement.staffTab.dept}</TableCell>
            <TableCell>{t.frontdeskPage.staffManagement.staffTab.role}</TableCell>
            <TableCell>{t.frontdeskPage.staffManagement.staffTab.pin}</TableCell>
            <TableCell></TableCell>
          </TableHeader>
          {filteredStaff.length > 0 ? (
            filteredStaff.map((staff, idx) => {
              const isActiveMatch = searchTerm && idx === currentMatch;
              const highlightStyle = 'background-color: var(--color-brand-100); color: var(--color-brand-500); padding: 0 2px; border-radius: 2px;';
              
              const getHighlighted = (text: string) => {
                if (!searchTerm) return { __html: text };
                return {
                  __html: text.replace(
                    new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                    `<mark style="${highlightStyle}">$1</mark>`
                  )
                };
              };

              return (
              <TableRow key={staff.id} id={`staff-row-${staff.id}`} style={isActiveMatch ? { border: '2px solid var(--color-brand-500)', boxShadow: '0 0 0 4px var(--color-brand-100)' } : {}}>
                <TableCell label={t.frontdeskPage.staffManagement.staffTab.name}>
                  <span style={{ font: 'var(--text-body-medium)' }}>
                    {searchTerm ? <span dangerouslySetInnerHTML={getHighlighted(staff.name)} /> : staff.name}
                  </span>
                </TableCell>
                <TableCell label={t.frontdeskPage.staffManagement.staffTab.dept}>
                  {searchTerm ? <span dangerouslySetInnerHTML={getHighlighted(getDeptName(staff.departmentId))} /> : getDeptName(staff.departmentId)}
                </TableCell>
                <TableCell label={t.frontdeskPage.staffManagement.staffTab.role}>
                  {searchTerm ? <span dangerouslySetInnerHTML={getHighlighted(getRoleName(staff.roleId))} /> : getRoleName(staff.roleId)}
                </TableCell>
                <TableCell label={t.frontdeskPage.staffManagement.staffTab.pin}>
                  <code style={{ background: 'var(--color-gray-50)', padding: 'var(--space-4) var(--space-8)', borderRadius: 'var(--radius-sm)', font: 'var(--font-mono)' }}>
                  <span dangerouslySetInnerHTML={getHighlighted(staff.pin)} />
                  </code>
                </TableCell>
                <TableCell>
                  <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
                    <button 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                      onClick={() => handleEditClick(staff)}
                      title={t.frontdeskPage.staffManagement.staffTab.edit}
                    >
                      <EditIcon width={20} height={20} />
                    </button>
                    <button 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                      onClick={() => handleDeleteClick(staff)}
                      title={t.frontdeskPage.staffManagement.staffTab.delete}
                    >
                      <DeleteIcon width={20} height={20} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell>
                <div style={{ textAlign: 'center', color: 'var(--color-gray-500)', padding: 'var(--space-24)' }}>
                  {t.frontdeskPage.staffManagement.staffTab.empty}
                </div>
              </TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
            </TableRow>
          )}
        </Table>
      )}

      <StaffFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveStaff}
        initialData={editingStaff}
        roles={roles}
        departments={departments}
      />

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title={t.frontdeskPage.staffManagement.staffTab.deleteTitle}
        subtitle={t.frontdeskPage.staffManagement.staffTab.deleteConfirm.replace('{{name}}', staffToDelete?.name || '')}
        confirmText={t.frontdeskPage.staffManagement.staffTab.delete}
        cancelText={t.frontdeskPage.staffManagement.common.cancel}
      />
    </div>
  );
}
