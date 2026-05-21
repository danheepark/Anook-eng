'use client';

import React, { useState, useEffect } from 'react';
import styles from './RequestDetailModal.module.css';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import Button from '@/components/ui/Button/Button';
import Dropdown from '@/components/ui/Dropdown/Dropdown';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import { useUiStore } from '@/stores/useUiStore';
import ConfirmModal from '@/components/ui/Modal/ConfirmModal';
import RejectEscalationModal from '../RejectEscalationModal/RejectEscalationModal';
import ApproveCancellationModal from '../ApproveCancellationModal/ApproveCancellationModal';
import RejectCancellationModal from '../RejectCancellationModal/RejectCancellationModal';
import useApproveEscalation from '../ApproveEscalationModal/useApproveEscalation';
import useRequestDetail from './useRequestDetail';
import { useTranslation } from '@/app/useTranslation';
import { useTranslationApi } from '@/app/useTranslationApi';

interface Department {
  id: string;
  name: string;
}

interface RequestDetail {
  id: number;
  status: string;
  priority: string;
  departmentId: string;
  departmentName: string;
  entities: Record<string, any> | null;
  rawText: string;
  summary: string;
  confidence: number;
  roomNo: string;
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  cancelRequested?: boolean;
  cancelRequestedAt: string | null;
  imageUrl?: string | null;
  reasoning?: string;
}

interface RequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: number;
  onUpdate: () => void;
  /** 모달을 연 페이지의 부서 ID. FRONT가 아닌 경우 부서 변경 시 이관 요청(ESCALATED)으로 처리 */
  callerDepartment?: string;
}



const STATUS_VARIANT_MAP: Record<string, 'red' | 'purple' | 'green' | 'gray'> = {
  PENDING: 'red',
  ASSIGNED: 'purple',
  IN_PROGRESS: 'green',
  COMPLETED: 'gray',
  CANCELLED: 'gray',
  ESCALATED: 'red',
};

/** 직원에게 보여줄 필요 없는 내부 키 (섹션 표시 판단 + 순회에서 모두 제외) */
const HIDDEN_ENTITY_KEYS = new Set(['intent', 'allergen_warning']);

/** 배열 타입 특수 렌더러가 필요한 키 (key-value 순회에서만 스킵, 섹션 표시 판단에서는 포함) */
const ARRAY_KEYS = new Set(['items', 'tasks', 'menu_items']);

function renderEntities(entities: Record<string, any>, t: any, language: string): React.ReactNode {
  const rendered: React.ReactNode[] = [];

  // 0) 정규화: item+count 플랫 키 → items 배열로 통일 (AI 응답 형식 불일치 보정)
  if (entities.item && entities.count && !entities.items?.length) {
    entities = { ...entities, items: [{ item: entities.item, count: entities.count }] };
    delete entities.item;
    delete entities.count;
  }

  const labels = t.frontdeskPage.requestDetailModal.entityLabels;

  // 1) 배열 타입 특수 렌더링
  if (entities.items?.length > 0) {
    rendered.push(
      <div key="items" style={{ marginBottom: '12px' }}>
        <strong>{labels.items}:</strong>
        <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
          {entities.items.map((it: any, idx: number) => (
            <li key={idx}>{it.item} - {it.count}{labels.countSuffix}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (entities.tasks?.length > 0) {
    rendered.push(
      <div key="tasks" style={{ marginBottom: '12px' }}>
        <strong>{labels.tasks}:</strong>
        <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
          {entities.tasks.map((task: string, idx: number) => (
            <li key={idx}>{task}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (entities.menu_items?.length > 0) {
    rendered.push(
      <div key="menu_items" style={{ marginBottom: '12px' }}>
        <strong>{labels.menu_items}:</strong>
        <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
          {entities.menu_items.map((mi: any, idx: number) => (
            <li key={idx}>
              {mi.name} - {mi.quantity}{labels.countSuffix}
              {mi.selected_option && mi.selected_option !== '없음' && mi.selected_option !== 'None' && ` (${labels.option}: ${mi.selected_option})`}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // 2) 일반 Key-Value 렌더링
  for (const [key, value] of Object.entries(entities)) {
    // 숨길 키이거나 이미 처리된 배열 키면 스킵
    if (HIDDEN_ENTITY_KEYS.has(key) || ARRAY_KEYS.has(key)) continue;
    // 값이 비어있으면 스킵
    if (value === null || value === undefined || value === '' || value === false || value === '없음' || value === 'None') continue;

    const label = labels[key as keyof typeof labels] || key; // 매핑 없으면 영어 키 그대로 표시 (폴백)

    // boolean true인 경우 라벨만 표시 (예: is_contactless -> "비대면 배달")
    if (value === true) {
      rendered.push(
        <div key={key} style={{ marginBottom: '8px' }}>
          <strong>{label}</strong>
        </div>
      );
      continue;
    }

    rendered.push(
      <div key={key} style={{ marginBottom: '8px' }}>
        <strong>{label}:</strong> {value}
      </div>
    );
  }

  return rendered.length > 0 ? rendered : <pre className={styles.jsonBlock}>{JSON.stringify(entities, null, 2)}</pre>;
}

export default function RequestDetailModal({
  isOpen,
  onClose,
  requestId,
  onUpdate,
  callerDepartment = 'FRONT',
}: RequestDetailModalProps) {
  const { approveEscalation } = useApproveEscalation();
  const { detail, fetchDetail, changePriority, changeDepartment, requestEscalation, cancelRequest, loading } = useRequestDetail();

  // Fallback mock detail for /test page or API failure
  const activeDetail = detail || (isOpen && !loading ? {
    id: requestId,
    status: 'PENDING',
    priority: 'NORMAL',
    departmentId: 'HK',
    departmentName: '하우스키핑',
    entities: { items: [{ item: '수건', count: 2 }] },
    rawText: '수건 2장 더 가져다주세요. 욕실용 수건으로 부탁합니다.',
    summary: '수건 2장 추가 요청',
    confidence: 0.98,
    roomNo: '707',
    assignedStaffId: null,
    assignedStaffName: null,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cancelRequested: false,
    cancelRequestedAt: null,
  } : null);

  const [editPriority, setEditPriority] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmType, setConfirmType] = useState<'none' | 'cancel' | 'approve' | 'reject' | 'cancelApprove' | 'cancelReject'>('none');
  const showToast = useUiStore((s) => s.showToast);

  const { t, language } = useTranslation();
  const { translatedText: translatedSummary, isLoading: isTranslating } = useTranslationApi(activeDetail?.summary, language);

  useEffect(() => {
    if (isOpen) {
      fetchDetail(requestId);
    }
  }, [isOpen, requestId]);

  useEffect(() => {
    if (activeDetail) {
      setEditPriority(activeDetail.priority);
      setEditDeptId(activeDetail.departmentId);
    }
  }, [activeDetail]);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/frontdesk/departments')
      .then(res => res.json())
      .then((data: Department[]) => setDepartments(data.filter(d => d.id !== 'EMERGENCY')))
      .catch(() => {});
  }, [isOpen]);

  if (!activeDetail) return null;

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING': return t.cardUI.status.pending;
      case 'ASSIGNED': return t.status.assigned || 'Assigned';
      case 'IN_PROGRESS': return t.cardUI.status.inProgress;
      case 'COMPLETED': return t.cardUI.status.completedMark;
      case 'CANCELLED': return t.cardUI.status.cancelled;
      case 'ESCALATED': return t.cardUI.status.escalated;
      default: return status;
    }
  };

  const statusInfo = {
    text: getStatusText(activeDetail.status),
    variant: STATUS_VARIANT_MAP[activeDetail.status] ?? 'gray',
  };

  const hasChanges =
    editPriority !== activeDetail.priority ||
    editDeptId !== activeDetail.departmentId;

  const handleSave = async () => {
    setSaving(true);
    let changed = false;

    if (editPriority !== activeDetail.priority) {
      const ok = await changePriority(activeDetail.id, editPriority);
      if (ok) changed = true;
    }

    if (editDeptId !== activeDetail.departmentId) {
      // 프론트데스크(관리자)는 즉시 부서 배정, 타부서(직원)는 이관 요청(승인 대기)
      const deptChangeOk = callerDepartment === 'FRONT'
        ? await changeDepartment(activeDetail.id, editDeptId)
        : await requestEscalation(activeDetail.id, editDeptId);
      if (deptChangeOk) changed = true;
    }

    setSaving(false);
    if (changed) {
      onUpdate();
      onClose();
    }
  };

  const handleCancel = async () => {
    setConfirmType('none');
    setSaving(true);
    const ok = await cancelRequest(activeDetail.id);
    setSaving(false);
    if (ok) {
      showToast('요청이 취소되었습니다.', 'success');
      onUpdate();
      onClose();
    } else {
      showToast('요청 취소에 실패했습니다.', 'error');
    }
  };

  const handleApproveEscalation = async () => {
    setConfirmType('none');

    setSaving(true);
    // 상세 모달 내에서 직접 승인할 때는 현재 모달에 세팅된 editDeptId와 editPriority 값을 전달합니다.
    const ok = await approveEscalation(activeDetail.id, editDeptId, editPriority);
    setSaving(false);
    if (ok) {
      showToast('에스컬레이션이 승인되어 재배정 대기 상태가 되었습니다.', 'success');
      onUpdate();
      onClose();
    } else {
      showToast('승인 처리에 실패했습니다.', 'error');
    }
  };




  const formatDateTime = (dt: string) => {
    if (!dt) return '';
    const d = new Date(dt);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalCard size="lg" onClose={onClose}>
        {/* 헤더 */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title}>{t.frontdeskPage.requestDetailModal.title}</h2>
            <StatusBadge variant={statusInfo.variant}>{statusInfo.text}</StatusBadge>
            {activeDetail.cancelRequested && (
              <StatusBadge variant="red">{t.frontdeskPage.requestDetailModal.status.cancelRequested}</StatusBadge>
            )}
          </div>
        </div>

        {/* 기본 정보 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t.frontdeskPage.requestDetailModal.basicInfo}</h3>
          <div className={styles.grid}>
            <div className={styles.gridItem}>
              <span className={styles.label}>{t.frontdeskPage.requestDetailModal.roomNo}</span>
              <span className={styles.value}>
                {language === 'ko' ? `${activeDetail.roomNo}호` : `NO.${activeDetail.roomNo}`}
              </span>
            </div>

            <div className={styles.gridItem}>
              <span className={styles.label}>{t.frontdeskPage.requestDetailModal.createdAt}</span>
              <span className={styles.value}>{formatDateTime(activeDetail.createdAt)}</span>
            </div>
            <div className={styles.gridItem}>
              <span className={styles.label}>{t.frontdeskPage.requestDetailModal.updatedAt}</span>
              <span className={styles.value}>{formatDateTime(activeDetail.updatedAt)}</span>
            </div>
          </div>
        </div>

        {/* 요약 + 원문 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t.frontdeskPage.requestDetailModal.requestContent}</h3>
          <div className={styles.contentBlock}>
            <span className={styles.label}>{t.frontdeskPage.requestDetailModal.summary}</span>
            <p className={styles.contentText}>
              {isTranslating ? t.common.loading : translatedSummary || activeDetail.summary}
            </p>
          </div>
          {(() => {
            if (!activeDetail.rawText) return null;
            const transferParts = activeDetail.rawText.split('\n|||TRANSFER_REASON|||');
            const mainText = transferParts[0] || '';
            const transferReason = transferParts.length > 1 ? transferParts.slice(1).join('\n').trim() : '';

            const detailParts = mainText.split('[주문 상세]');
            const customerText = detailParts[0].trim();
            const orderDetail = detailParts.length > 1 ? detailParts.slice(1).join('').trim() : '';

            // entities가 있으면 [주문/요청 상세] 숨김 처리 (AI 결과와 중복 표시 방지)
            const hasValidEntities = activeDetail.entities && Object.keys(activeDetail.entities).filter(k => !HIDDEN_ENTITY_KEYS.has(k)).length > 0;

            return (
              <>
                {customerText && (
                  <div className={styles.contentBlock}>
                    <span className={styles.label}>{t.frontdeskPage.requestDetailModal.originalText}</span>
                    <p className={styles.rawText}>{customerText}</p>
                  </div>
                )}
                {orderDetail && !hasValidEntities && (
                  <div className={styles.contentBlock}>
                    <span className={styles.label}>{t.frontdeskPage.requestDetailModal.orderDetail}</span>
                    <p className={styles.orderDetail}>{orderDetail}</p>
                  </div>
                )}
                {transferReason && (
                  <div className={styles.contentBlock}>
                    <span className={styles.label}>{t.frontdeskPage.requestDetailModal.transferReason}</span>
                    <p className={styles.transferReason}>{transferReason}</p>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* 첨부 사진 */}
        {activeDetail.imageUrl && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t.frontdeskPage.requestDetailModal.photo}</h3>
            <div className={styles.contentBlock} style={{ textAlign: 'center' }}>
              <img src={activeDetail.imageUrl} alt={t.frontdeskPage.requestDetailModal.photo} style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', objectFit: 'contain' }} />
            </div>
          </div>
        )}

        {/* AI 분석 결과 */}
        {((activeDetail.entities && Object.keys(activeDetail.entities).length > 0) || activeDetail.reasoning) && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t.frontdeskPage.requestDetailModal.aiAnalysis}</h3>
            <div className={styles.aiInfo}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <span className={styles.label}>{t.frontdeskPage.requestDetailModal.confidence}</span>
                <span className={styles.value}>{Math.round(activeDetail.confidence * 100)}%</span>
              </div>
              {(() => {
                if (!activeDetail.entities) return null;
                // 직원에게 보여줄 필요 없는 키 제외하고 렌더링할 게 있는지 확인
                const displayableKeys = Object.keys(activeDetail.entities).filter(k => !HIDDEN_ENTITY_KEYS.has(k));
                if (displayableKeys.length === 0) return null;

                return (
                  <div className={styles.entityList}>
                    {renderEntities(activeDetail.entities, t, language)}
                  </div>
                );
              })()}
              {activeDetail.reasoning && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-gray-200)' }}>
                  <span className={styles.label} style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>{t.frontdeskPage.requestDetailModal.reasoning}</span>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-gray-700)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                    {activeDetail.reasoning}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 배정 관리 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t.frontdeskPage.requestDetailModal.assignment}</h3>
          <div className={styles.editRow}>
            <div className={styles.editField}>
              <Dropdown
                label={t.frontdeskPage.requestDetailModal.assignDept}
                placeholder={t.frontdeskPage.requestDetailModal.selectDept || "부서를 선택하세요"}
                options={departments.map(d => ({ 
                  value: d.id, 
                  label: t.ticketUI.department[d.id as keyof typeof t.ticketUI.department] || d.name 
                }))}
                value={editDeptId}
                onChange={(val) => setEditDeptId(val)}
              />
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className={styles.footer}>
          {activeDetail.status === 'ESCALATED' ? (
            <Button variant="secondary" onClick={() => setConfirmType('reject')} style={{ color: 'var(--color-error)' }} disabled={saving || loading}>
              {t.frontdeskPage.requestDetailModal.buttons.rejectEscalation}
            </Button>
          ) : activeDetail.cancelRequested ? (
            <>
              <Button variant="secondary" onClick={() => setConfirmType('cancelReject')} style={{ color: 'var(--color-error)' }} disabled={saving || loading}>
                {t.frontdeskPage.requestDetailModal.buttons.rejectCancel}
              </Button>
              <Button variant="primary" onClick={() => setConfirmType('cancelApprove')} disabled={saving || loading}>
                {t.frontdeskPage.requestDetailModal.buttons.approveCancel}
              </Button>
            </>
          ) : activeDetail.status !== 'COMPLETED' && activeDetail.status !== 'CANCELLED' ? (
            <Button variant="secondary" onClick={() => setConfirmType('cancel')} style={{ color: 'var(--color-error)' }}>
              {t.frontdeskPage.requestDetailModal.buttons.forceCancel}
            </Button>
          ) : <div />}

          <div className={styles.footerRight}>
            <Button variant="secondary" onClick={onClose}>{t.frontdeskPage.requestDetailModal.buttons.close}</Button>
            {activeDetail.status === 'ESCALATED' ? (
              <Button variant="primary" onClick={() => setConfirmType('approve')} disabled={saving || loading}>
                {t.frontdeskPage.requestDetailModal.buttons.approveEscalation}
              </Button>
            ) : hasChanges ? (
              <Button variant="primary" onClick={handleSave} disabled={saving || loading}>
                {saving ? t.frontdeskPage.requestDetailModal.buttons.saving : t.frontdeskPage.requestDetailModal.buttons.save}
              </Button>
            ) : null}
          </div>
        </div>
      </ModalCard>

      <ConfirmModal
        isOpen={confirmType === 'cancel'}
        onClose={() => setConfirmType('none')}
        onConfirm={handleCancel}
        title="요청 취소"
        subtitle="정말 요청을 취소하시겠습니까?"
        status="danger"
        cancelText="아니오"
        confirmText="예, 취소합니다"
      />

      <ConfirmModal
        isOpen={confirmType === 'approve'}
        onClose={() => setConfirmType('none')}
        onConfirm={handleApproveEscalation}
        title="에스컬레이션 승인"
        subtitle={`선택한 부서(${departments.find(d => d.id === editDeptId)?.name || '...'})로 재배정하며 승인합니다.`}
        cancelText="아니오"
        confirmText="승인하기"
      />

      {confirmType === 'reject' && activeDetail && (
        <RejectEscalationModal
          isOpen={true}
          onClose={() => setConfirmType('none')}
          requestId={activeDetail.id}
          onSuccess={() => {
            onUpdate();
            onClose();
          }}
        />
      )}

      {confirmType === 'cancelApprove' && activeDetail && (
        <ApproveCancellationModal
          isOpen={true}
          onClose={() => setConfirmType('none')}
          requestId={activeDetail.id}
          onSuccess={() => {
            onUpdate();
            onClose();
          }}
        />
      )}

      {confirmType === 'cancelReject' && activeDetail && (
        <RejectCancellationModal
          isOpen={true}
          onClose={() => setConfirmType('none')}
          requestId={activeDetail.id}
          onSuccess={() => {
            onUpdate();
            onClose();
          }}
        />
      )}
    </ModalOverlay>
  );
}
