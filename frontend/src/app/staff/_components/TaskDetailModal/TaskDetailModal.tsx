import React, { useState, useEffect, useRef } from 'react';
import { History } from 'lucide-react';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import Button from '@/components/ui/Button/Button';
import Dropdown from '@/components/ui/Dropdown/Dropdown';
import InputField from '@/components/ui/Inputfield/InputField';
import styles from './TaskDetailModal.module.css';
import { StaffTask } from '../../useTasks';
import { useUiStore } from '@/stores/useUiStore';
import { useNetworkStore } from '@/stores/useNetworkStore';
import { useTranslation } from '@/app/useTranslation';
import { useTranslationApi } from '@/app/useTranslationApi';
import ChatHistoryModal from './ChatHistoryModal';
import ManualAssignModal from '@/app/frontdesk/requests/_components/ManualAssignModal/ManualAssignModal';

interface ChatMsg {
  id: number | string;
  senderType: string;
  content: string;
}

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: StaffTask | null;
  onAccept?: (id: number, version: number) => Promise<void>;
  onComplete?: (id: number, version: number) => Promise<void>;
  onTransfer?: (id: number, version: number, toDepartmentId: string, reason: string) => Promise<void>;
  onApproveCancellation?: (id: number, version: number) => Promise<void>;
  onRejectCancellation?: (id: number, version: number) => Promise<void>;
}

const DEPARTMENTS = [
  { id: 'HK', name: '하우스키핑' },
  { id: 'FACILITY', name: '시설관리' },
  { id: 'FB', name: '식음료' },
  { id: 'FRONT', name: '프론트데스크' },
  { id: 'CONCIERGE', name: '컨시어지' }
];

/** 영문 키 → 한국어 라벨 매핑 (여기에 한 줄 추가하면 자동으로 예쁘게 표시됨) */
const ENTITY_LABELS: Record<string, string> = {
  // HK
  is_contactless: '비대면 배달', target_time: '희망 시간',
  // FACILITY
  equipment: '대상 설비', symptom: '증상', location: '위치',
  // CONCIERGE
  destination: '목적지', passenger_count: '인원', restaurant_name: '식당',
  cuisine_type: '음식 종류', category: '카테고리', action: '요청 유형',
  // 공통
  item: '대상 물품', time: '시간', special_requests: '추가 요청', count: '수량',
  type: '유형', target: '대상',
};

/** 직원에게 보여줄 필요 없는 내부 키 (섹션 표시 판단 + 순회에서 모두 제외) */
const HIDDEN_ENTITY_KEYS = new Set(['intent', 'allergen_warning', 'item_requests', 'service_requests']);

/** 배열 타입 특수 렌더러가 필요한 키 (key-value 순회에서만 스킵, 섹션 표시 판단에서는 포함) */
const ARRAY_KEYS = new Set(['items', 'tasks', 'menu_items']);

function renderEntities(entities: Record<string, any>): React.ReactNode {
  const rendered: React.ReactNode[] = [];

  // 0) 정규화: item 키 단독 혹은 item+count 플랫 키 → items 배열로 통일 (AI 응답 형식 불일치 보정)
  if (entities.item && !entities.items?.length) {
    entities = { ...entities, items: [{ item: entities.item, count: entities.count || 1 }] };
    // 플랫 키는 items로 흡수되었으므로 제거 (중복 표시 방지)
    delete entities.item;
    delete entities.count;
  }

  // 1) 배열 타입 특수 렌더링
  if (entities.items?.length > 0) {
    rendered.push(
      <div key="items" className={styles.contentBlock} style={{ marginBottom: '12px' }}>
        <span className={styles.label}>물품 요청</span>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {entities.items.map((it: any, idx: number) => {
            const itemText = typeof it.item === 'object' && it.item !== null ? (it.item.name || it.item.id || '') : it.item;
            return <li key={idx}>• {itemText} - {it.count}개</li>;
          })}
        </ul>
      </div>
    );
  }
  if (entities.tasks?.length > 0) {
    rendered.push(
      <div key="tasks" className={styles.contentBlock} style={{ marginBottom: '12px' }}>
        <span className={styles.label}>수행 업무</span>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {entities.tasks.map((t: string, idx: number) => (
            <li key={idx}>• {t}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (entities.menu_items?.length > 0) {
    rendered.push(
      <div key="menu_items" className={styles.contentBlock} style={{ marginBottom: '12px' }}>
        <span className={styles.label}>주문 메뉴</span>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {entities.menu_items.map((mi: any, idx: number) => (
            <li key={idx}>
              • {mi.name} {mi.quantity}개
              {mi.selected_option && mi.selected_option !== '없음' ? ` (${mi.selected_option})` : ''}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // 2) 단순 key-value: 라벨 매핑에 있으면 한국어, 없으면 영문 키 그대로 (폴백)
  for (const [key, value] of Object.entries(entities)) {
    if (HIDDEN_ENTITY_KEYS.has(key) || ARRAY_KEYS.has(key)) continue;
    if (value === null || value === undefined || value === '' || value === false || value === '없음') continue;

    const label = ENTITY_LABELS[key] || key;

    // boolean 타입 (is_contactless 등) 은 뱃지로 표시
    if (value === true) {
      rendered.push(
        <div key={key} className={styles.contentBlock} style={{ marginBottom: '8px' }}>
          <span className={styles.label}>{label}</span>
        </div>
      );
    } else {
      const displayValue = typeof value === 'object' && value !== null
        ? (value.name || value.id || JSON.stringify(value))
        : String(value);

      rendered.push(
        <div key={key} className={styles.contentBlock} style={{ marginBottom: '8px' }}>
          <span className={styles.label}>{label}</span>
          <span className={styles.value}>{displayValue}</span>
        </div>
      );
    }
  }

  return rendered.length > 0 ? rendered : <span>분석 데이터 없음</span>;
}

export default function TaskDetailModal({ isOpen, onClose, task, onAccept, onComplete, onTransfer, onApproveCancellation, onRejectCancellation }: TaskDetailModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false);
  const [isManualAssignOpen, setIsManualAssignOpen] = useState(false);
  const { showToast } = useUiStore();
  const isOnline = useNetworkStore((state) => state.isOnline);
  const { t, language } = useTranslation();
  const { translatedText: translatedSummary, isLoading: isTranslating } = useTranslationApi(task?.summary, language);

  if (!isOpen || !task) return null;

  const handleClose = () => {
    setIsManualAssignOpen(false);
    onClose();
  };

  const handleAccept = async () => {
    if (onAccept) {
      setIsSubmitting(true);
      try {
        await onAccept(task.id, task.version);
        handleClose();
      } catch (err) {
        showToast(err instanceof Error ? err.message : '요청 수락 중 오류가 발생했습니다.', 'error');
        handleClose();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleComplete = async () => {
    if (onComplete) {
      setIsSubmitting(true);
      try {
        await onComplete(task.id, task.version);
        handleClose();
      } catch (err) {
        showToast(err instanceof Error ? err.message : '요청 완료 중 오류가 발생했습니다.', 'error');
        handleClose();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleApproveCancellation = async () => {
    if (onApproveCancellation) {
      setIsSubmitting(true);
      try {
        await onApproveCancellation(task.id, task.version);
        showToast('취소가 승인되었습니다.', 'success');
        handleClose();
      } catch (err) {
        showToast(err instanceof Error ? err.message : '취소 승인 중 오류가 발생했습니다.', 'error');
        handleClose();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleRejectCancellation = async () => {
    if (onRejectCancellation) {
      setIsSubmitting(true);
      try {
        await onRejectCancellation(task.id, task.version);
        showToast('취소가 반려되었습니다.', 'success');
        handleClose();
      } catch (err) {
        showToast(err instanceof Error ? err.message : '취소 반려 중 오류가 발생했습니다.', 'error');
        handleClose();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const d = new Date(task.createdAt);
  const formattedDate = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const rawTextParts = task.rawText ? task.rawText.split('\n|||TRANSFER_REASON|||') : [];
  const transferReasonText = rawTextParts.length > 1 ? rawTextParts.slice(1).join('\n').trim() : null;

  const openChatHistory = () => {
    setIsChatHistoryOpen(true);
  };

  return (
    <>
      <ModalOverlay isOpen={isOpen && !isManualAssignOpen && !isChatHistoryOpen} onClose={handleClose}>
        <ModalCard size="md" overflowVisible={false} onClose={handleClose}>
          <div className={styles.container}>
            <div className={styles.header}>
              <div className={styles.headerTitleRow}>
                <span className={styles.roomBadge}>
                  {language === 'ko' ? `${task.roomNumber}호` : `NO.${task.roomNumber}`}
                </span>
                <h2 className={styles.title}>{isTranslating ? t.common.loading || 'Loading...' : (translatedSummary || task.summary)}</h2>
                {task.priority === 'URGENT' && (
                  <StatusBadge variant="red">긴급</StatusBadge>
                )}
                {task.cancelRequested && (
                  <StatusBadge variant="red">취소 대기중</StatusBadge>
                )}
              </div>
            </div>

            <div className={styles.content}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>요청 시간</span>
                <span className={styles.infoValue}>{formattedDate}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>상태</span>
                <span className={styles.infoValue}>
                  {task.status === 'PENDING' ? t.cardUI.status.pending :
                   task.status === 'IN_PROGRESS' ? t.cardUI.status.inProgress :
                   task.status === 'COMPLETED' ? t.cardUI.status.completedMark :
                   task.status === 'CANCELLED' ? t.cardUI.status.cancelled : task.status}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>부서</span>
                <span className={styles.infoValue}>
                  {DEPARTMENTS.find(d => d.id === task.departmentId)?.name || task.departmentId}
                </span>
              </div>

              {task.cancelRequested && (
                <div className={styles.cancelAlertBox}>
                  <strong>⚠️ 고객 취소 요청</strong>
                  <p>고객이 해당 요청에 대해 취소를 신청했습니다. 진행 상황을 확인하고 취소 승인 또는 반려를 선택해주세요.</p>
                </div>
              )}

              {/* AI 분석 상세 내역 — summary + entities + reasoning */}
              {(task.entities && Object.keys(task.entities).filter(k => !HIDDEN_ENTITY_KEYS.has(k)).length > 0) || task.reasoning ? (
                <div className={styles.descriptionSection}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.descriptionTitle}>AI 분석 상세 내역</h3>
                    <button
                      className={styles.chatHistoryIconButton}
                      onClick={openChatHistory}
                      title="대화 내역 보기"
                      aria-label="대화 내역 보기"
                    >
                      <History size={20} />
                    </button>
                  </div>
                  <div className={styles.descriptionBox}>
                    {task.entities && Object.keys(task.entities).filter(k => !HIDDEN_ENTITY_KEYS.has(k)).length > 0 && (
                      <div className={styles.entityList}>
                        {renderEntities(task.entities)}
                      </div>
                    )}
                    {task.reasoning && (() => {
                      const cleanedReasoning = task.reasoning
                        .replace(/\\n/g, '\n')
                        .replace(/([^\n])\s*•/g, '$1\n•')
                        .split('\n')
                        .map(line => line.trim())
                        .filter(line => line !== '')
                        .filter(line => !line.toLowerCase().includes('confidence:'))
                        .join('\n')
                        .trim();
                      const formattedConfidence = task.confidence !== null && task.confidence !== undefined
                        ? `${Math.round(task.confidence * 100)}%`
                        : '100%';
                      const label = language === 'en' ? 'confidence' : '신뢰도';
                      const displayReasoning = cleanedReasoning
                        ? `${cleanedReasoning}\n• ${label}: ${formattedConfidence}`
                        : `• ${label}: ${formattedConfidence}`;
                      return (
                        <div className={styles.contentBlock} style={{ marginTop: '12px' }}>
                          <span className={styles.label}>{language === 'en' ? 'Reason' : '사유'}</span>
                          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }} className={styles.value}>{displayReasoning}</p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : null}

              {task.imageUrl && (
                <div className={styles.descriptionSection}>
                  <h3 className={styles.descriptionTitle}>첨부 사진</h3>
                  <div className={styles.descriptionBox} style={{ textAlign: 'center' }}>
                    <img src={task.imageUrl} alt="첨부 사진" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', objectFit: 'contain' }} />
                  </div>
                </div>
              )}

              {transferReasonText && (
                <div className={styles.descriptionSection}>
                  <h3 className={styles.descriptionTitle}>업무 전달 사유</h3>
                  <div className={styles.transferReasonBox}>
                    {transferReasonText}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.footer}>
              {task.status === 'PENDING' && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setIsManualAssignOpen(true)}
                    className={styles.actionButton}
                    disabled={isSubmitting || !isOnline}
                    title={!isOnline ? "오프라인 상태에서는 사용할 수 없습니다" : undefined}
                  >
                    업무 배정
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleAccept}
                    className={styles.actionButton}
                    disabled={isSubmitting || !isOnline}
                    title={!isOnline ? "오프라인 상태에서는 사용할 수 없습니다" : undefined}
                  >
                    업무 수락
                  </Button>
                </>
              )}

              {task.status === 'IN_PROGRESS' && !task.cancelRequested && onComplete && (
                <Button
                  variant="primary"
                  onClick={handleComplete}
                  className={styles.actionButton}
                  disabled={isSubmitting || !isOnline}
                  title={!isOnline ? "오프라인 상태에서는 사용할 수 없습니다" : undefined}
                >
                  업무 완료
                </Button>
              )}

              {task.status === 'IN_PROGRESS' && task.cancelRequested && (
                <>
                  <Button
                    variant="outlined"
                    onClick={handleRejectCancellation}
                    className={styles.actionButton}
                    disabled={isSubmitting || !isOnline}
                    title={!isOnline ? "오프라인 상태에서는 사용할 수 없습니다" : undefined}
                  >
                    취소 반려
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleApproveCancellation}
                    className={styles.actionButton}
                    disabled={isSubmitting || !isOnline}
                    title={!isOnline ? "오프라인 상태에서는 사용할 수 없습니다" : undefined}
                  >
                    취소 승인
                  </Button>
                </>
              )}
            </div>
          </div>
        </ModalCard>
      </ModalOverlay>

      <ChatHistoryModal
        isOpen={isChatHistoryOpen}
        onClose={() => setIsChatHistoryOpen(false)}
        roomNumber={String(task.roomNumber)}
      />

      <ManualAssignModal
        isOpen={isManualAssignOpen}
        onClose={() => setIsManualAssignOpen(false)}
        detail={{
          id: task.id,
          priority: task.priority,
          departmentId: task.departmentId,
          departmentName: DEPARTMENTS.find(d => d.id === task.departmentId)?.name || task.departmentId,
          roomNo: String(task.roomNumber),
          summary: task.summary,
          createdAt: task.createdAt,
          status: task.status,
          description: ''
        }}
        departments={DEPARTMENTS}
        onSave={async (editDeptId, editPriority, editSummary, editDescription) => {
          if (onTransfer) {
            setIsSubmitting(true);
            try {
              const reason = `${editSummary || ''}${editDescription ? '\n' + editDescription : ''}`;
              await onTransfer(task.id, task.version, editDeptId, reason);
              showToast('업무 배정이 완료되었습니다.', 'success');
              setIsManualAssignOpen(false);
              onClose();
            } catch (err) {
              showToast(err instanceof Error ? err.message : '업무 배정 중 오류가 발생했습니다.', 'error');
            } finally {
              setIsSubmitting(false);
            }
          }
        }}
        saving={isSubmitting}
      />
    </>
  );
}
