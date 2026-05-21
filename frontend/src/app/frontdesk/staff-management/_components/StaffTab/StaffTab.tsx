import React, { useState, useEffect } from 'react';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/Table/Table';
import Button from '@/components/ui/Button/Button';
import InputField from '@/components/ui/Inputfield/InputField';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import { useStaffManagement, Staff } from './useStaffManagement';
import { useRoleManagement } from '../RoleTab/useRoleManagement';
import { useDepartmentManagement } from '../Department/useDepartmentManagement';
import StaffFormModal from '../StaffFormModal/StaffFormModal';
import { ConfirmModal } from '@/components/ui/Modal';
import { useUiStore } from '@/stores/useUiStore';
import EditIcon from '@/components/icons/EditIcon';
import DeleteIcon from '@/components/icons/DeleteIcon';

const deptVariantMap: Record<string, "gray" | "red" | "purple" | "green"> = {
  HK: 'green',
  FB: 'purple',
  // 그 외는 모두 기본값 (gray)
};

export default function StaffTab() {
  const { staffList, loading: staffLoading, error: staffError, fetchStaffList, createStaff, updateStaff, deleteStaff } = useStaffManagement();
  const { roles, loading: rolesLoading, fetchRoles } = useRoleManagement();
  const { departments, loading: deptsLoading, fetchDepartments } = useDepartmentManagement();
  
  const { showToast } = useUiStore();

  const [searchTerm, setSearchTerm] = useState('');
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

  const filteredStaff = staffList.filter((staff) =>
    staff.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      showToast('직원 정보가 수정되었습니다.', 'success');
    } else {
      await createStaff(data);
      showToast('직원이 등록되었습니다.', 'success');
    }
  };

  const handleConfirmDelete = async () => {
    if (staffToDelete) {
      try {
        await deleteStaff(staffToDelete.id);
        showToast('직원이 삭제되었습니다.', 'success');
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ width: '300px' }}>
          <InputField
            variant="search"
            placeholder="직원 이름 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="primary" onClick={handleAddClick}>
          + 직원 추가
        </Button>
      </div>

      {isLoading && staffList.length === 0 ? (
        <div style={{ padding: 'var(--space-24)', textAlign: 'center', color: 'var(--color-gray-500)' }}>
          로딩 중...
        </div>
      ) : (
        <Table columns="2fr 2fr 2fr 2fr 150px">
          <TableHeader>
            <TableCell>이름</TableCell>
            <TableCell>부서</TableCell>
            <TableCell>역할</TableCell>
            <TableCell>PIN</TableCell>
            <TableCell></TableCell>
          </TableHeader>
          {filteredStaff.length > 0 ? (
            filteredStaff.map((staff) => (
              <TableRow key={staff.id}>
                <TableCell label="이름">
                  <span style={{ font: 'var(--text-body-medium)' }}>{staff.name}</span>
                </TableCell>
                <TableCell label="부서">
                  {getDeptName(staff.departmentId)}
                </TableCell>
                <TableCell label="역할">{getRoleName(staff.roleId)}</TableCell>
                <TableCell label="PIN">
                  <code style={{ background: 'var(--color-gray-50)', padding: 'var(--space-4) var(--space-8)', borderRadius: 'var(--radius-sm)', font: 'var(--font-mono)' }}>
                    {staff.pin}
                  </code>
                </TableCell>
                <TableCell>
                  <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
                    <button 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                      onClick={() => handleEditClick(staff)}
                      title="수정"
                    >
                      <EditIcon width={20} height={20} />
                    </button>
                    <button 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                      onClick={() => handleDeleteClick(staff)}
                      title="삭제"
                    >
                      <DeleteIcon width={20} height={20} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell>
                <div style={{ textAlign: 'center', color: 'var(--color-gray-500)', padding: 'var(--space-24)' }}>
                  등록된 직원이 없습니다.
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
        title="직원 삭제"
        subtitle={`'${staffToDelete?.name}' 직원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        cancelText="취소"
      />
    </div>
  );
}
