import React, { useState, useEffect } from 'react';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/Table/Table';
import Button from '@/components/ui/Button/Button';
import SmartSearchBar from '@/components/ui/SmartSearchBar/SmartSearchBar';
import { useRoleManagement, Role } from './useRoleManagement';
import { useDepartmentManagement } from '../Department/useDepartmentManagement';
import RoleFormModal from '../RoleFormModal/RoleFormModal';
import { ConfirmModal } from '@/components/ui/Modal';
import { useUiStore } from '@/stores/useUiStore';
import EditIcon from '@/components/icons/EditIcon';
import DeleteIcon from '@/components/icons/DeleteIcon';

export default function RoleTab() {
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
      showToast('역할이 수정되었습니다.', 'success');
    } else {
      await createRole(data);
      showToast('역할이 추가되었습니다.', 'success');
    }
  };

  const handleConfirmDelete = async () => {
    if (roleToDelete) {
      try {
        await deleteRole(roleToDelete.id);
        showToast('역할이 삭제되었습니다.', 'success');
      } catch (err) {
        // 에러는 useRoleManagement에서 처리됨
      }
    }
    setIsConfirmModalOpen(false);
    setRoleToDelete(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ width: '320px' }}>
          <SmartSearchBar
            inputWrapperStyle={{ flex: 1 }}
            value={searchTerm}
            onChange={(val) => {
              setSearchTerm(val);
              setCurrentMatch(0);
            }}
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
        </div>
        <Button variant="primary" onClick={handleAddClick}>
          + 역할 추가
        </Button>
      </div>

      {rolesLoading && roles.length === 0 ? (
        <div style={{ padding: 'var(--space-24)', textAlign: 'center', color: 'var(--color-gray-500)' }}>
          로딩 중...
        </div>
      ) : (
        <Table columns="1fr 1fr 100px">
          <TableHeader>
            <TableCell>부서</TableCell>
            <TableCell>역할명</TableCell>
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
                <TableCell label="부서">
                  {searchTerm ? <span dangerouslySetInnerHTML={getHighlighted(deptName)} /> : deptName}
                </TableCell>
                <TableCell label="역할명">
                  {searchTerm ? <span dangerouslySetInnerHTML={getHighlighted(role.name)} /> : role.name}
                </TableCell>
                <TableCell>
                  <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
                    <button 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                      onClick={() => handleEditClick(role)}
                      title="수정"
                    >
                      <EditIcon width={20} height={20} />
                    </button>
                    <button 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                      onClick={() => handleDeleteClick(role)}
                      title="삭제"
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
                  등록된 역할이 없습니다.
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
        title="역할 삭제"
        subtitle={`'${roleToDelete?.name}' 역할을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        cancelText="취소"
      />
    </div>
  );
}
