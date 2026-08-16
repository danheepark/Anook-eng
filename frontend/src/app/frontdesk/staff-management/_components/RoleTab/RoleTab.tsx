import React, { useState, useEffect } from 'react';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/Table/Table';
import Button from '@/components/ui/Button/Button';
import SmartSearchBar from '@/components/ui/SmartSearchBar/SmartSearchBar';
import { useTranslation } from '@/app/useTranslation';
import { useRoleManagement, Role } from './useRoleManagement';
import { useDepartmentManagement } from '../Department/useDepartmentManagement';
import RoleFormModal from '../RoleFormModal/RoleFormModal';
import { ConfirmModal } from '@/components/ui/Modal';
import { useUiStore } from '@/stores/useUiStore';
import EditIcon from '@/components/icons/EditIcon';
import DeleteIcon from '@/components/icons/DeleteIcon';

import HeaderSearchSlot from '@/components/layout/HeaderSearchSlot';

export default function RoleTab() {
  const { t } = useTranslation();
  const { roles, loading: rolesLoading, error, fetchRoles, createRole, updateRole, deleteRole } = useRoleManagement();
  const { departments, loading: deptsLoading, fetchDepartments } = useDepartmentManagement();
  const { showToast } = useUiStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | undefined>(undefined);
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  useEffect(() => {
    fetchRoles();
    fetchDepartments();
  }, [fetchRoles, fetchDepartments]);

  useEffect(() => {
    if (error) {
      showToast(error, 'error');
    }
  }, [error, showToast]);

  const filteredRoles = React.useMemo(() => {
    if (!searchTerm) return roles;
    const lower = searchTerm.toLowerCase();
    return roles.filter((role) =>
      role.name.toLowerCase().includes(lower) ||
      (departments.find(d => d.id === role.departmentId)?.name || role.departmentId).toLowerCase().includes(lower)
    );
  }, [roles, departments, searchTerm]);

  useEffect(() => {
    if (filteredRoles.length > 0 && currentMatch >= filteredRoles.length) {
      setCurrentMatch(filteredRoles.length - 1);
    }
  }, [filteredRoles, currentMatch]);

  const scrollToMatch = (index: number) => {
    const target = filteredRoles[index];
    if (target) {
      setTimeout(() => {
        const el = document.getElementById(`role-row-${target.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  };

  const handleAddClick = () => {
    setEditingRole(undefined);
    setIsFormModalOpen(true);
  };

  const handleEditClick = (role: Role) => {
    setEditingRole(role);
    setIsFormModalOpen(true);
  };

  const handleDeleteClick = (role: Role) => {
    setRoleToDelete(role);
    setIsConfirmModalOpen(true);
  };

  const handleSaveRole = async (data: { departmentId: string; name: string }) => {
    if (editingRole) {
      await updateRole(editingRole.id, data);
      showToast(t.frontdeskPage.staffManagement.roleTab.editSuccess, 'success');
    } else {
      await createRole(data);
      showToast(t.frontdeskPage.staffManagement.roleTab.saveSuccess, 'success');
    }
  };

  const handleConfirmDelete = async () => {
    if (roleToDelete) {
      try {
        await deleteRole(roleToDelete.id);
        showToast(t.frontdeskPage.staffManagement.roleTab.deleteSuccess, 'success');
      } catch (err) {
        // 에러는 useRoleManagement에서 처리됨
      }
    }
    setIsConfirmModalOpen(false);
    setRoleToDelete(null);
  };

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
          totalMatches={searchTerm ? filteredRoles.length : 0}
          onPrev={() => {
            const newIndex = Math.max(0, currentMatch - 1);
            setCurrentMatch(newIndex);
            scrollToMatch(newIndex);
          }}
          onNext={() => {
            const newIndex = Math.min(filteredRoles.length - 1, currentMatch + 1);
            setCurrentMatch(newIndex);
            scrollToMatch(newIndex);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (filteredRoles.length > 0) {
                const newIndex = (currentMatch + 1) % filteredRoles.length;
                setCurrentMatch(newIndex);
                scrollToMatch(newIndex);
              }
            }
          }}
        />
      </HeaderSearchSlot>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Button variant="primary" onClick={handleAddClick}>
          {t.frontdeskPage.staffManagement.roleTab.addRole}
        </Button>
      </div>

      {rolesLoading && roles.length === 0 ? (
        <div style={{ padding: 'var(--space-24)', textAlign: 'center', color: 'var(--color-gray-500)' }}>
          {t.frontdeskPage.staffManagement.common.loading}
        </div>
      ) : (
        <Table columns="1fr 1fr 100px">
          <TableHeader>
            <TableCell>{t.frontdeskPage.staffManagement.roleTab.dept}</TableCell>
            <TableCell>{t.frontdeskPage.staffManagement.roleTab.roleName}</TableCell>
            <TableCell></TableCell>
          </TableHeader>
          {filteredRoles.length > 0 ? (
            filteredRoles.map((role, idx) => {
              const deptName = departments.find(d => d.id === role.departmentId)?.name || role.departmentId;
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
              <TableRow key={role.id} id={`role-row-${role.id}`} style={isActiveMatch ? { border: '2px solid var(--color-brand-500)', boxShadow: '0 0 0 4px var(--color-brand-100)' } : {}}>
                <TableCell label={t.frontdeskPage.staffManagement.roleTab.dept}>
                  {searchTerm ? <span dangerouslySetInnerHTML={getHighlighted(deptName)} /> : deptName}
                </TableCell>
                <TableCell label={t.frontdeskPage.staffManagement.roleTab.roleName}>
                  {searchTerm ? <span dangerouslySetInnerHTML={getHighlighted(role.name)} /> : role.name}
                </TableCell>
                <TableCell>
                  <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
                    <button 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                      onClick={() => handleEditClick(role)}
                      title={t.frontdeskPage.staffManagement.roleTab.edit}
                    >
                      <EditIcon width={20} height={20} />
                    </button>
                    <button 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                      onClick={() => handleDeleteClick(role)}
                      title={t.frontdeskPage.staffManagement.roleTab.delete}
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
                  {t.frontdeskPage.staffManagement.roleTab.empty}
                </div>
              </TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
            </TableRow>
          )}
        </Table>
      )}

      <RoleFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveRole}
        initialData={editingRole}
        departments={departments}
      />

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title={t.frontdeskPage.staffManagement.roleTab.deleteTitle}
        subtitle={t.frontdeskPage.staffManagement.roleTab.deleteConfirm.replace('{{name}}', roleToDelete?.name || '')}
        confirmText={t.frontdeskPage.staffManagement.roleTab.delete}
        cancelText={t.frontdeskPage.staffManagement.common.cancel}
      />
    </div>
  );
}
