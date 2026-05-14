import React, { useState, useEffect, useRef } from 'react';
import styles from './ChatPanel.module.css';
import ChatBubble from '@/app/guest/chat/_components/ChatBubble';
import ChatInput from '@/app/guest/chat/_components/ChatInput';
import { CancelIcon } from '@/components/icons';
import { useWebSocket } from '@/app/useWebSocket';
import Button from '@/components/ui/Button/Button';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import { ChatMessage } from '@/components/ui/Modal/ChatModal';

export interface ChatPanelProps {
  roomNumber?: string;
  requestId?: number;
  status?: string;
  onStatusChange?: (id: number, newStatus: string) => Promise<void>;
  autoComplete?: boolean;
  onClose?: () => void;
  initialMessage?: string;
  summary?: string;
  showRagButton?: boolean;
  onRagRegister?: () => void;
  isEmergency?: boolean;
}

const STATUS_MAP: Record<string, { text: string; variant: 'red' | 'purple' | 'green' | 'gray' }> = {
  PENDING: { text: '대기 중', variant: 'red' },
  ASSIGNED: { text: '배정됨', variant: 'purple' },
  IN_PROGRESS: { text: '처리 중', variant: 'green' },
  COMPLETED: { text: '완료', variant: 'gray' },
  CANCELLED: { text: '취소됨', variant: 'gray' },
};

export default function ChatPanel({ roomNumber = '1204', requestId, status, onStatusChange, autoComplete, onClose, initialMessage, summary, showRagButton, onRagRegister, isEmergency = false }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);
  const { subscribe } = useWebSocket();

  // RAG 등록 플로우 상태
  const [isRagConfirmOpen, setIsRagConfirmOpen] = useState(false);

  // 모달 열릴 때 실제 대화 내역 로드
  useEffect(() => {
    if (!roomNumber) return;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/messages/rooms/${roomNumber}/messages`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const mapped: ChatMessage[] = data.map((msg: any) => ({
          id: String(msg.id),
          variant: msg.senderType === 'GUEST' ? 'received' as const : 'sent' as const,
          senderType: msg.senderType,
          content: msg.content,
        }));

        // 데이터가 없으면 데모용 더미 데이터 삽입
        if (mapped.length === 0 && initialMessage) {
          setMessages([
            { id: 'dummy-1', variant: 'received', senderType: 'GUEST', content: initialMessage },
            { id: 'dummy-2', variant: 'sent', senderType: 'AI', content: '요청이 접수되었습니다. 프론트데스크 직원이 곧 확인 후 안내해 드리겠습니다.' },
          ]);
        } else {
          setMessages(mapped);
        }

        if (autoComplete) {
          handleCompleteConsultation();
        }
      } catch {
        // 에러 발생 시에도 데모용 더미 데이터 삽입
        if (initialMessage) {
          setMessages([
            { id: 'dummy-1', variant: 'received', senderType: 'GUEST', content: initialMessage },
            { id: 'dummy-2', variant: 'sent', senderType: 'AI', content: '요청이 접수되었습니다. 프론트데스크 직원이 곧 확인 후 안내해 드리겠습니다.' },
          ]);
        } else {
          setMessages([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [roomNumber, autoComplete, initialMessage]);

  // WebSocket 구독: 고객 메시지 및 AI 응답 실시간 수신
  useEffect(() => {
    if (!roomNumber) return;

    const unsubscribe = subscribe(`/topic/room/${roomNumber}`, (data: unknown) => {
      const payload = data as Record<string, unknown>;
      const type = payload.type as string;
      const content = payload.content as string;
      const messageId = payload.messageId as number | undefined;

      if (type === 'AI_RESPONSE' || type === 'STAFF_MESSAGE') {
        const displayContent = payload.originalContent ? (payload.originalContent as string) : content;
        setMessages(prev => {
          if (messageId && prev.some(m => m.id === String(messageId))) return prev;
          // 낙관적 업데이트로 인한 중복 방지 (내용으로 비교)
          if (type === 'STAFF_MESSAGE' && prev.some(m => m.variant === 'sent' && m.content === displayContent && m.id.startsWith('temp'))) {
            // tempId를 실제 messageId로 교체
            return prev.map(m => (m.variant === 'sent' && m.content === displayContent && m.id.startsWith('temp')) ? { ...m, id: String(messageId), content: displayContent, senderType: 'STAFF' } : m);
          }
          return [...prev, {
            id: messageId ? String(messageId) : Date.now().toString(),
            variant: 'sent',
            senderType: type === 'STAFF_MESSAGE' ? 'STAFF' : 'AI',
            content: displayContent,
          }];
        });
      } else if (type === 'GUEST_MESSAGE') {
        setMessages(prev => {
          if (messageId && prev.some(m => m.id === String(messageId))) return prev;
          return [...prev, {
            id: messageId ? String(messageId) : Date.now().toString(),
            variant: 'received',
            senderType: 'GUEST',
            content,
          }];
        });
      }
    });

    return () => unsubscribe();
  }, [roomNumber, subscribe]);

  // 메시지 목록 스크롤 하단 유지
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text: string) => {
    // 1. 낙관적 업데이트 (즉시 화면에 표시)
    const tempId = `temp-${Date.now()}`;
    const newMsg: ChatMessage = { id: tempId, variant: 'sent', senderType: 'STAFF', content: text };
    setMessages(prev => [...prev, newMsg]);

    // 2. 백엔드로 전송
    try {
      const res = await fetch(`/api/staff/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: text,
          roomNo: roomNumber
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      // 전송 실패 시에도 화면에는 유지
    }

    // 3. PENDING 상태면 IN_PROGRESS로 변경
    if (status === 'PENDING' && requestId && onStatusChange) {
      await onStatusChange(requestId, 'IN_PROGRESS');
    }
  };

  // 상담 완료 버튼 클릭 시
  const handleCompleteConsultation = () => {
    const staffMessages = messages.filter(m => m.senderType === 'STAFF');
    if (staffMessages.length > 0) {
      setIsRagConfirmOpen(true);
    } else {
      if (requestId && onStatusChange && status !== 'COMPLETED') {
        onStatusChange(requestId, 'COMPLETED');
      } else {
        if(onClose) onClose();
      }
    }
  };

  // 그냥 닫기 (상담 완료 아님)
  const handleClose = () => {
    if(onClose) onClose();
  };

  // "등록하기" → page.tsx의 onRagRegister를 호출하여 RegisterTrainingModal 오픈
  const handleRagConfirm = () => {
    setIsRagConfirmOpen(false);
    if (onRagRegister) onRagRegister();
    if (requestId && onStatusChange && status !== 'COMPLETED') {
      onStatusChange(requestId, 'COMPLETED');
    }
  };

  // "나중에 하기" → PENDING 상태로 저장 후 완료 처리
  const handleRagLater = async () => {
    const { question, answer } = extractInitialContent();
    try {
      const res = await fetch('/api/staff/knowledge/register-from-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          answer,
          domainCode: 'COMMON',
          roomNo: roomNumber,
          status: 'PENDING',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // 로컬 스토리지에 등록 상태 저장
      if (requestId) {
        const saved = localStorage.getItem('registeredRagIds');
        const set = saved ? new Set(JSON.parse(saved)) : new Set();
        set.add(requestId);
        localStorage.setItem('registeredRagIds', JSON.stringify(Array.from(set)));
        window.dispatchEvent(new CustomEvent('ragRegistered', { detail: requestId }));
      }
    } catch (err) {
      console.error('[ChatPanel] PENDING 등록 실패:', err);
    }
    setIsRagConfirmOpen(false);
    
    if (requestId && onStatusChange && status !== 'COMPLETED') {
      onStatusChange(requestId, 'COMPLETED');
    } else if (onClose) onClose();
  };

  // "건너뛰기" → 그냥 완료 처리
  const handleRagSkip = () => {
    setIsRagConfirmOpen(false);
    if (requestId && onStatusChange && status !== 'COMPLETED') {
      onStatusChange(requestId, 'COMPLETED');
    } else if (onClose) onClose();
  };

  // 취소 (단순히 모달 닫기, 완료 처리 안 함)
  const handleRagCancel = () => {
    setIsRagConfirmOpen(false);
  };

  // 상담 내용에서 초기 질문/답변 추출
  const extractInitialContent = () => {
    const staffMessages = messages
      .filter(m => m.senderType === 'STAFF')
      .map(m => m.content);

    return {
      question: '',
      answer: staffMessages.join('\n'),
    };
  };

  const isReadOnly = status === 'COMPLETED' || status === 'CANCELLED';

  return (
    <>
      <div className={styles.chatPanelContainer}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.roomBadge}>{roomNumber}호</span>
            <h3 className={styles.title}>{summary || '상담'}</h3>
          </div>
          <div className={styles.headerRight}>
            {status && STATUS_MAP[status] && (
              <StatusBadge variant={STATUS_MAP[status].variant}>{STATUS_MAP[status].text}</StatusBadge>
            )}
          </div>
        </div>

        <div className={styles.messageList} ref={messageListRef}>
          {loading ? (
            <div className={styles.emptyState}>대화 내역을 불러오는 중...</div>
          ) : messages.length === 0 ? (
            <div className={styles.emptyState}>이 객실의 대화 내역이 없습니다.</div>
          ) : (
            messages.map((msg) => (
              <ChatBubble key={msg.id} variant={msg.variant} isFallback={msg.senderType === 'STAFF'}>
                {msg.content}
              </ChatBubble>
            ))
          )}
        </div>

        {!isReadOnly && status === 'PENDING' && (
          <div className={styles.footer} style={{ justifyContent: 'center' }}>
            <Button 
              variant={isEmergency ? 'danger' : 'primary'}
              size="large"
              fullWidth
              onClick={async () => {
                if (onStatusChange && requestId) {
                  await onStatusChange(requestId, 'IN_PROGRESS');
                  // 긴급 대응 시작 시 고객에게 자동 메시지 전송
                  if (isEmergency) {
                    await handleSend('긴급 대응팀이 배정되었습니다. 신속히 조치하겠습니다. 안전한 곳에서 대기해 주시기 바랍니다.');
                  }
                }
              }} 
            >
              {isEmergency ? '긴급 대응 시작' : '상담 시작하기'}
            </Button>
          </div>
        )}

        {status === 'COMPLETED' && showRagButton && (
          <div className={styles.footer} style={{ justifyContent: 'center' }}>
            <Button 
              variant="primary" 
              size="large"
              fullWidth
              onClick={onRagRegister} 
            >
              AI 지식 등록
            </Button>
          </div>
        )}

        {!isReadOnly && status !== 'PENDING' && (
          <div className={styles.footer} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <ChatInput isStaff placeholder="고객에게 답변을 입력하세요..." onSend={handleSend} />
            </div>
            {(status === 'IN_PROGRESS' || status === 'ASSIGNED') && (
              <Button size="large" variant="primary" onClick={handleCompleteConsultation} style={{ marginBottom: '8px' }}>
                상담 완료
              </Button>
            )}
          </div>
        )}
      </div>

      {/* RAG 등록 확인 모달 (3버튼: 등록하기 / 나중에 하기 / 건너뛰기) */}
      <ModalOverlay isOpen={isRagConfirmOpen} onClose={handleRagCancel}>
        <ModalCard size="sm">
          <div style={{ position: 'relative' }}>
            <button
              onClick={handleRagCancel}
              aria-label="닫기"
              style={{
                position: 'absolute',
                top: '-12px',
                right: '-12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CancelIcon width={20} height={20} color="var(--color-gray-400)" />
            </button>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>AI 지식 등록</h2>
              <p style={{ fontSize: '14px', color: 'var(--color-gray-500)', lineHeight: '1.5' }}>
                이 상담 내용을 AI 지식 데이터로 등록하시겠습니까?<br />
                등록하면 AI가 동일한 질문에 자동으로 답변할 수 있습니다.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            <Button variant="primary" onClick={handleRagConfirm} style={{ width: '100%' }}>
              지금 등록하기
            </Button>
            <Button variant="secondary" onClick={handleRagLater} style={{ width: '100%' }}>
              나중에 하기
            </Button>
            <button
              onClick={handleRagSkip}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-gray-400)',
                fontSize: '13px',
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              등록하지 않고 삭제
            </button>
          </div>
        </ModalCard>
      </ModalOverlay>
    </>
  );
}
