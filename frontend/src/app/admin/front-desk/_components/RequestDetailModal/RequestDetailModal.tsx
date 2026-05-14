'use client';

import React, { useState, useEffect } from 'react';
import styles from './RequestDetailModal.module.css';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import Button from '@/components/ui/Button/Button';
import Dropdown from '@/components/ui/Dropdown/Dropdown';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import { CancelIcon } from '@/components/icons';
import { useUiStore } from '@/stores/useUiStore';
import ConfirmModal from '@/components/ui/Modal/ConfirmModal';
import RejectEscalationModal from '../RejectEscalationModal/RejectEscalationModal';
import ApproveCancellationModal from '../ApproveCancellationModal/ApproveCancellationModal';
import RejectCancellationModal from '../RejectCancellationModal/RejectCancellationModal';
import useApproveEscalation from '../ApproveEscalationModal/useApproveEscalation';
import useRequestDetail from './useRequestDetail';

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
  cancelRequestedAt: string | null;
  imageUrl?: string | null;
  reasoning?: string;
}

interface RequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: number;
  onUpdate: () => void;
}

const PRIORITIES = [
  { value: 'NORMAL', label: '보통' },
  { value: 'URGENT', label: '긴급' },
];

const STATUS_MAP: Record<string, { text: string; variant: 'red' | 'purple' | 'green' | 'gray' }> = {
  PENDING: { text: '대기 중', variant: 'red' },
  ASSIGNED: { text: '배정됨', variant: 'purple' },
  IN_PROGRESS: { text: '처리 중', variant: 'green' },
  COMPLETED: { text: '완료', variant: 'gray' },
  CANCELLED: { text: '취소됨', variant: 'gray' },
  ESCALATED: { text: '에스컬레이션', variant: 'red' },
};

/** 영문 키 → 한국어 라벨 매핑 (모든 부서 통합) */
const ENTITY_LABELS: Record<string, string> = {
  is_contactless: '비대면 배달', target_time: '희망 시간',
  equipment: '대상 설비', symptom: '증상', location: '위치',
  destination: '목적지', passenger_count: '인원', restaurant_name: '식당',
  cuisine_type: '음식 종류', category: '카테고리', action: '요청 유형',
  item: '대상 물품', time: '시간', special_requests: '추가 요청', count: '수량',
  type: '유형', target: '대상', issue: '문제/증상', priority: '예상 긴급도',
  topic: '주제', question: '질문', language: '언어',
};

/** 직원에게 보여줄 필요 없는 내부 키 (섹션 표시 판단 + 순회에서 모두 제외) */
const HIDDEN_ENTITY_KEYS = new Set(['intent', 'allergen_warning']);

/** 배열 타입 특수 렌더러가 필요한 키 (key-value 순회에서만 스킵, 섹션 표시 판단에서는 포함) */
const ARRAY_KEYS = new Set(['items', 'tasks', 'menu_items']);

function renderEntities(entities: Record<string, any>): React.ReactNode {
  const rendered: React.ReactNode[] = [];

  // 0) 정규화: item+count 플랫 키 → items 배열로 통일 (AI 응답 형식 불일치 보정)
  if (entities.item && entities.count && !entities.items?.length) {
    entities = { ...entities, items: [{ item: entities.item, count: entities.count }] };
    delete entities.item;
    delete entities.count;
  }

  // 1) 배열 타입 특수 렌더링
  if (entities.items?.length > 0) {
    rendered.push(
      <div key="items" style={{ marginBottom: '12px' }}>
        <strong>물품 요청:</strong>
        <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
          {entities.items.map((it: any, idx: number) => (
            <li key={idx}>{it.item} - {it.count}개</li>
          ))}
        </ul>
      </div>
    );
  }
  if (entities.tasks?.length > 0) {
    rendered.push(
      <div key="tasks" style={{ marginBottom: '12px' }}>
        <strong>작업 요청:</strong>
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
        <strong>주문 메뉴:</strong>
        <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
          {entities.menu_items.map((mi: any, idx: number) => (
            <li key={idx}>
              {mi.name} - {mi.quantity}개
              {mi.selected_option && mi.selected_option !== '없음' && ` (옵션: ${mi.selected_option})`}
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
    if (value === null || value === undefined || value === '' || value === false || value === '없음') continue;

    const label = ENTITY_LABELS[key] || key; // 매핑 없으면 영어 키 그대로 표시 (폴백)

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
}: RequestDetailModalProps) {
  const { approveEscalation } = useApproveEscalation();
  const { detail, fetchDetail, changePriority, changeDepartment, cancelRequest, loading } = useRequestDetail();

  const [editPriority, setEditPriority] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmType, setConfirmType] = useState<'none' | 'cancel' | 'approve' | 'reject' | 'cancelApprove' | 'cancelReject'>('none');
  const showToast = useUiStore((s) => s.showToast);

  useEffect(() => {
    if (isOpen) {
      fetchDetail(requestId);
    }
  }, [isOpen, requestId]);

  useEffect(() => {
    if (detail) {
      setEditPriority(detail.priority);
      setEditDeptId(detail.departmentId);
    }
  }, [detail]);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/admin/departments')
      .then(res => res.json())
      .then((data: Department[]) => setDepartments(data.filter(d => d.id !== 'EMERGENCY')))
      .catch(() => {});
  }, [isOpen]);

  if (!detail) return null;

  const statusInfo = STATUS_MAP[detail.status] ?? { text: detail.status, variant: 'gray' as const };

  const hasChanges =
    editPriority !== detail.priority ||
    editDeptId !== detail.departmentId;

  const handleSave = async () => {
    setSaving(true);
    let changed = false;

    if (editPriority !== detail.priority) {
      const ok = await changePriority(detail.id, editPriority);
      if (ok) changed = true;
    }

    if (editDeptId !== detail.departmentId) {
      const ok = await changeDepartment(detail.id, editDeptId);
      if (ok) changed = true;
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
    const ok = await cancelRequest(detail.id);
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
    const ok = await approveEscalation(detail.id, editDeptId, editPriority);
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
    const d = new Date(dt);
    return d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalCard size="lg">
        {/* 헤더 */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title}>요청 상세</h2>
            <StatusBadge variant={statusInfo.variant}>{statusInfo.text}</StatusBadge>
            {detail.cancelRequested && (
              <StatusBadge variant="red">고객 취소 요청됨</StatusBadge>
            )}
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="닫기">
            <CancelIcon width={20} height={20} color="var(--color-gray-500)" />
          </button>
        </div>

        {/* 기본 정보 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>기본 정보</h3>
          <div className={styles.grid}>
            <div className={styles.gridItem}>
              <span className={styles.label}>객실</span>
              <span className={styles.value}>{detail.roomNo}</span>
            </div>

            <div className={styles.gridItem}>
              <span className={styles.label}>생성 시간</span>
              <span className={styles.value}>{formatDateTime(detail.createdAt)}</span>
            </div>
            <div className={styles.gridItem}>
              <span className={styles.label}>최종 수정</span>
              <span className={styles.value}>{formatDateTime(detail.updatedAt)}</span>
            </div>
          </div>
        </div>

        {/* 요약 + 원문 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>요청 내용</h3>
          <div className={styles.contentBlock}>
            <span className={styles.label}>요약</span>
            <p className={styles.contentText}>{detail.summary}</p>
          </div>
          {(() => {
            if (!detail.rawText) return null;
            const transferParts = detail.rawText.split('\n|||TRANSFER_REASON|||');
            const mainText = transferParts[0] || '';
            const transferReason = transferParts.length > 1 ? transferParts.slice(1).join('\n').trim() : '';

            const detailParts = mainText.split('[주문 상세]');
            const customerText = detailParts[0].trim();
            const orderDetail = detailParts.length > 1 ? detailParts.slice(1).join('').trim() : '';

            // entities가 있으면 [주문/요청 상세] 숨김 처리 (AI 결과와 중복 표시 방지)
            const hasValidEntities = detail.entities && Object.keys(detail.entities).filter(k => !HIDDEN_ENTITY_KEYS.has(k)).length > 0;

            return (
              <>
                {customerText && (
                  <div className={styles.contentBlock}>
                    <span className={styles.label}>고객 원문</span>
                    <p className={styles.rawText}>{customerText}</p>
                  </div>
                )}
                {orderDetail && !hasValidEntities && (
                  <div className={styles.contentBlock}>
                    <span className={styles.label}>주문/요청 상세</span>
                    <p className={styles.orderDetail}>{orderDetail}</p>
                  </div>
                )}
                {transferReason && (
                  <div className={styles.contentBlock}>
                    <span className={styles.label}>부서 이관 사유</span>
                    <p className={styles.transferReason}>{transferReason}</p>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* 첨부 사진 */}
        {detail.imageUrl && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>첨부 사진</h3>
            <div className={styles.contentBlock} style={{ textAlign: 'center' }}>
              <img src={detail.imageUrl} alt="첨부 사진" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', objectFit: 'contain' }} />
            </div>
          </div>
        )}

        {/* AI 분석 결과 */}
        {((detail.entities && Object.keys(detail.entities).length > 0) || detail.reasoning) && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>AI 분석 결과</h3>
            <div className={styles.aiInfo}>
              <div className={styles.confidenceBadge}>
                신뢰도: {Math.round(detail.confidence * 100)}%
              </div>
              {(() => {
                if (!detail.entities) return null;
                // 직원에게 보여줄 필요 없는 키 제외하고 렌더링할 게 있는지 확인
                const displayableKeys = Object.keys(detail.entities).filter(k => !HIDDEN_ENTITY_KEYS.has(k));
                if (displayableKeys.length === 0) return null;

                return (
                  <div className={styles.entityList}>
                    {renderEntities(detail.entities)}
                  </div>
                );
              })()}
              {detail.reasoning && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-gray-200)' }}>
                  <span className={styles.label} style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>판단 근거</span>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-gray-700)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                    {detail.reasoning}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 배정 관리 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>배정 관리</h3>
          <div className={styles.editRow}>
            <div className={styles.editField}>
              <label className={styles.label}>우선순위</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', height: '40px', paddingLeft: '4px' }}>
                <input
                  type="checkbox"
                  checked={editPriority === 'URGENT'}
                  onChange={(e) => setEditPriority(e.target.checked ? 'URGENT' : 'NORMAL')}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-error)' }}
                />
                <span style={{ fontSize: '14px', fontWeight: editPriority === 'URGENT' ? 600 : 400, color: 'var(--color-gray-700)' }}>
                  긴급 작업으로 설정
                </span>
              </label>
            </div>
            <div className={styles.editField}>
              <Dropdown
                label="배정 부서"
                placeholder="부서를 선택하세요"
                options={departments.map(d => ({ value: d.id, label: d.name }))}
                value={editDeptId}
                onChange={(val) => setEditDeptId(val)}
              />
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className={styles.footer}>
          {detail.status === 'ESCALATED' ? (
            <Button variant="secondary" onClick={() => setConfirmType('reject')} style={{ color: 'var(--color-error)' }} disabled={saving || loading}>
              에스컬레이션 반려
            </Button>
          ) : detail.cancelRequested ? (
            <>
              <Button variant="secondary" onClick={() => setConfirmType('cancelReject')} style={{ color: 'var(--color-error)' }} disabled={saving || loading}>
                취소 반려
              </Button>
              <Button variant="primary" onClick={() => setConfirmType('cancelApprove')} disabled={saving || loading}>
                취소 승인
              </Button>
            </>
          ) : detail.status !== 'COMPLETED' && detail.status !== 'CANCELLED' ? (
            <Button variant="secondary" onClick={() => setConfirmType('cancel')} style={{ color: 'var(--color-error)' }}>
              강제 요청 취소
            </Button>
          ) : <div />}

          <div className={styles.footerRight}>
            <Button variant="secondary" onClick={onClose}>닫기</Button>
            {detail.status === 'ESCALATED' ? (
              <Button variant="primary" onClick={() => setConfirmType('approve')} disabled={saving || loading}>
                에스컬레이션 승인
              </Button>
            ) : hasChanges ? (
              <Button variant="primary" onClick={handleSave} disabled={saving || loading}>
                {saving ? '저장 중...' : '변경 저장'}
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

      {confirmType === 'reject' && detail && (
        <RejectEscalationModal
          isOpen={true}
          onClose={() => setConfirmType('none')}
          requestId={detail.id}
          onSuccess={() => {
            onUpdate();
            onClose();
          }}
        />
      )}

      {confirmType === 'cancelApprove' && detail && (
        <ApproveCancellationModal
          isOpen={true}
          onClose={() => setConfirmType('none')}
          requestId={detail.id}
          onSuccess={() => {
            onUpdate();
            onClose();
          }}
        />
      )}

      {confirmType === 'cancelReject' && detail && (
        <RejectCancellationModal
          isOpen={true}
          onClose={() => setConfirmType('none')}
          requestId={detail.id}
          onSuccess={() => {
            onUpdate();
            onClose();
          }}
        />
      )}
    </ModalOverlay>
  );
}
