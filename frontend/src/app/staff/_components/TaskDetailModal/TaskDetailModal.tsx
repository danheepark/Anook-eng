import React, { useState, useEffect, useRef } from 'react';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import Button from '@/components/ui/Button/Button';
import { ArrowBackIcon } from '@/components/icons';
import Dropdown from '@/components/ui/Dropdown/Dropdown';
import InputField from '@/components/ui/Inputfield/InputField';
import ChatBubble from '@/app/guest/chat/_components/ChatBubble';
import styles from './TaskDetailModal.module.css';
import { StaffTask } from '../../useTasks';
import { useUiStore } from '@/stores/useUiStore';
import { useNetworkStore } from '@/stores/useNetworkStore';
import { useTranslation } from '@/app/useTranslation';
import { useTranslationApi } from '@/app/useTranslationApi';

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
const HIDDEN_ENTITY_KEYS = new Set(['intent', 'allergen_warning']);

/** 배열 타입 특수 렌더러가 필요한 키 (key-value 순회에서만 스킵, 섹션 표시 판단에서는 포함) */
const ARRAY_KEYS = new Set(['items', 'tasks', 'menu_items']);

function renderEntities(entities: Record<string, any>): React.ReactNode {
  const rendered: React.ReactNode[] = [];

  // 0) 정규화: item+count 플랫 키 → items 배열로 통일 (AI 응답 형식 불일치 보정)
  if (entities.item && entities.count && !entities.items?.length) {
    entities = { ...entities, items: [{ item: entities.item, count: entities.count }] };
    // 플랫 키는 items로 흡수되었으므로 제거 (중복 표시 방지)
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
        <strong>수행 업무:</strong>
        <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
          {entities.tasks.map((t: string, idx: number) => (
            <li key={idx}>{t}</li>
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
              {mi.name} {mi.quantity}개
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
        <div key={key} style={{ marginBottom: '8px' }}>
          <StatusBadge variant="purple">{label}</StatusBadge>
        </div>
      );
    } else {
      rendered.push(
        <div key={key} style={{ marginBottom: '8px' }}>
          <strong>{label}:</strong> {String(value)}
        </div>
      );
    }
  }

  return rendered.length > 0 ? rendered : <span>분석 데이터 없음</span>;
}

export default function TaskDetailModal({ isOpen, onClose, task, onAccept, onComplete, onTransfer, onApproveCancellation, onRejectCancellation }: TaskDetailModalProps) {
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [toDepartmentId, setToDepartmentId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [view, setView] = useState<'detail' | 'chatHistory'>('detail');
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatListRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [detailHeight, setDetailHeight] = useState<number | null>(null);
  const { showToast } = useUiStore();
  const isOnline = useNetworkStore((state) => state.isOnline);
  const { t, language } = useTranslation();
  const { translatedText: translatedSummary, isLoading: isTranslating } = useTranslationApi(task?.summary, language);

  if (!isOpen || !task) return null;

  const handleClose = () => {
    setShowTransferForm(false);
    setToDepartmentId('');
    setTransferReason('');
    setView('detail');
    onClose();
  };

  const handleTransferSubmit = async () => {
    if (!toDepartmentId || !transferReason.trim()) {
      showToast('전달할 부서와 사유를 모두 입력해주세요.', 'error');
      return;
    }
    if (onTransfer) {
      setIsSubmitting(true);
      try {
        await onTransfer(task.id, task.version, toDepartmentId, transferReason);
        showToast('부서 전달이 완료되었습니다.', 'success');
        handleClose();
      } catch (err) {
        showToast(err instanceof Error ? err.message : '부서 전달 중 오류가 발생했습니다.', 'error');
        handleClose();
      } finally {
        setIsSubmitting(false);
      }
    }
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

  let badgeVariant: 'red' | 'purple' | 'green' | 'gray' | 'black' = 'gray';
  if (task.priority === 'URGENT') {
    badgeVariant = 'red';
  }

  const d = new Date(task.createdAt);
  const formattedDate = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const rawTextParts = task.rawText ? task.rawText.split('\n|||TRANSFER_REASON|||') : [];
  const transferReasonText = rawTextParts.length > 1 ? rawTextParts.slice(1).join('\n').trim() : null;

  const openChatHistory = async () => {
    if (containerRef.current) {
      setDetailHeight(containerRef.current.offsetHeight);
    }
    setView('chatHistory');
    setChatLoading(true);
    try {
      const res = await fetch(`/api/staff/messages/rooms/${task.roomNumber}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setChatMessages(data);
      setTimeout(() => {
        chatListRef.current?.scrollTo({ top: chatListRef.current.scrollHeight });
      }, 50);
    } catch (err) {
      console.error('[TaskDetailModal] chat fetch error:', err);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleClose}>
      <ModalCard size="md" overflowVisible={true} onClose={handleClose}>

        {/* ── 대화 내역 뷰 ── */}
        {view === 'chatHistory' ? (
          <div className={styles.chatHistoryContainer} style={detailHeight ? { height: detailHeight } : undefined}>
            <div className={styles.chatHistoryHeader}>
              <button className={styles.backBtn} onClick={() => setView('detail')} aria-label="뒤로">
                <ArrowBackIcon width={18} height={18} color="currentColor" />
              </button>
              <span className={styles.chatHistoryTitle}>{task.roomNumber}호 대화 내역</span>
            </div>
            <div className={styles.chatHistoryMessages} ref={chatListRef}>
              {chatLoading && <div className={styles.chatEmptyState}>불러오는 중...</div>}
              {!chatLoading && chatMessages.length === 0 && <div className={styles.chatEmptyState}>대화 내역이 없습니다.</div>}
              {!chatLoading && chatMessages.map((msg, idx) => {
                const isGuest = msg.senderType === 'GUEST';
                const isStaff = msg.senderType === 'STAFF';
                return (
                  <ChatBubble
                    key={msg.id}
                    variant={isGuest ? 'sent' : 'received'}
                    isFallback={isStaff}
                  >
                    {msg.content}
                  </ChatBubble>
                );
              })}
            </div>
          </div>
        ) : (

        <div className={styles.container} ref={containerRef}>
          <div className={styles.header}>
            <div className={styles.headerTop}>
              <span className={styles.roomBadge}>
                {language === 'ko' ? `${task.roomNumber}호` : `NO.${task.roomNumber}`}
              </span>
              {task.priority === 'URGENT' && (
                <StatusBadge variant="red">긴급</StatusBadge>
              )}
              {task.cancelRequested && (
                <StatusBadge variant="red">취소 대기중</StatusBadge>
              )}
            </div>
            <h2 className={styles.title}>{isTranslating ? t.common.loading || 'Loading...' : (translatedSummary || task.summary)}</h2>
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
                  <Button variant="secondary" onClick={openChatHistory} style={{ fontSize: '12px', padding: '4px 12px' }}>
                    대화 내역 보기
                  </Button>
                </div>
                <div className={styles.descriptionBox}>
                  {task.summary && (
                    <div style={{ marginBottom: '12px' }}>
                      <strong>요약:</strong> {task.summary}
                    </div>
                  )}
                  {task.entities && Object.keys(task.entities).filter(k => !HIDDEN_ENTITY_KEYS.has(k)).length > 0 && renderEntities(task.entities)}
                  {task.reasoning && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                      <strong>판단 근거:</strong>
                      <p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap' }}>{task.reasoning}</p>
                    </div>
                  )}
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



            {showTransferForm && (
              <div className={styles.transferForm}>
                <h3 className={styles.descriptionTitle}>업무 전달</h3>
                <div className={styles.transferFormGroup}>
                  <Dropdown
                    label="전달 대상 부서"
                    placeholder="부서 선택"
                    options={DEPARTMENTS.filter(d => d.id !== task.departmentId).map(dept => ({
                      value: dept.id,
                      label: dept.name
                    }))}
                    value={toDepartmentId}
                    onChange={(val) => setToDepartmentId(val)}
                  />
                </div>
                <div className={styles.transferFormGroup}>
                  <InputField
                    as="textarea"
                    label="전달 사유"
                    placeholder="전달 사유를 입력해주세요 (예: 해당 건은 시설관리팀 소관입니다)"
                    value={transferReason}
                    onChange={(e: any) => setTransferReason(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className={styles.transferActions}>
                  <Button variant="outlined" onClick={() => setShowTransferForm(false)} disabled={isSubmitting}>취소</Button>
                  <Button variant="primary" onClick={handleTransferSubmit} disabled={isSubmitting || !isOnline} title={!isOnline ? "오프라인 상태에서는 사용할 수 없습니다" : undefined}>전달하기</Button>
                </div>
              </div>
            )}
          </div>

          {!showTransferForm && (
            <div className={styles.footer}>
              {task.status === 'PENDING' && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setShowTransferForm(true)}
                    className={styles.actionButton}
                    disabled={isSubmitting || !isOnline}
                    title={!isOnline ? "오프라인 상태에서는 사용할 수 없습니다" : undefined}
                  >
                    업무 전달
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
          )}
        </div>

        )}
      </ModalCard>
    </ModalOverlay>
  );
}
