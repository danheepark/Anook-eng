import React, { useState, useEffect, useRef } from 'react';
import styles from './ChatModal.module.css';
import ModalOverlay from './ModalOverlay';
import ModalCard from './ModalCard';
import ChatBubble from '@/app/guest/chat/_components/ChatBubble';
import ChatInput from '@/app/guest/chat/_components/ChatInput';
import { CancelIcon } from '@/components/icons';
import { useWebSocket } from '@/app/useWebSocket';
import Button from '@/components/ui/Button/Button';
import KnowledgeEditModal from '@/components/ui/Knowledge/KnowledgeEditModal';

export interface ChatMessage {
  id: string;
  variant: 'sent' | 'received'; // Staff perspective: 'sent' = staff/AI, 'received' = guest
  senderType: 'GUEST' | 'AI' | 'STAFF';
  content: string;
}

export interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomNumber?: string;
  requestId?: number;
  status?: string;
  onStatusChange?: (id: number, newStatus: string) => Promise<void>;
  autoComplete?: boolean;
}

export default function ChatModal({ isOpen, onClose, roomNumber = '1204', requestId, status, onStatusChange, autoComplete }: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);
  const { subscribe } = useWebSocket();

  // RAG 등록 플로우 상태
  const [isRagConfirmOpen, setIsRagConfirmOpen] = useState(false);
  const [isKnowledgeModalOpen, setIsKnowledgeModalOpen] = useState(false);

  // 모달 열릴 때 실제 대화 내역 로드
  useEffect(() => {
    if (!isOpen || !roomNumber) return;

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

        setMessages(mapped);

        if (autoComplete && isOpen) {
          handleCompleteConsultation();
        }
      } catch {
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [isOpen, roomNumber, autoComplete]);

  // WebSocket 구독: 고객 메시지 및 AI 응답 실시간 수신
  useEffect(() => {
    if (!isOpen || !roomNumber) return;

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
  }, [isOpen, roomNumber, subscribe]);

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
  const handleCompleteConsultation = async () => {
    if (requestId && onStatusChange && status !== 'COMPLETED') {
      await onStatusChange(requestId, 'COMPLETED');
    }
    const staffMessages = messages.filter(m => m.senderType === 'STAFF');
    if (staffMessages.length > 0) {
      setIsRagConfirmOpen(true);
    } else {
      onClose();
    }
  };

  // 그냥 닫기 (상담 완료 아님)
  const handleClose = () => {
    onClose();
  };

  // "등록하기" → KnowledgeEditModal 오픈
  const handleRagConfirm = () => {
    setIsRagConfirmOpen(false);
    setIsKnowledgeModalOpen(true);
  };

  // "나중에 하기" → PENDING 상태로 저장 후 닫기 (AI 학습 관리에 쌓임)
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
    } catch (err) {
      console.error('[ChatModal] PENDING 등록 실패:', err);
    }
    setIsRagConfirmOpen(false);
    onClose();
  };

  // "건너뛰기" → 아무것도 저장하지 않고 닫기
  const handleRagSkip = () => {
    setIsRagConfirmOpen(false);
    onClose();
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

  // KnowledgeEditModal에서 저장 → 백엔드 API 호출 (APPROVED)
  const handleKnowledgeSave = async (data: { domainCode: string; question: string; answer: string }) => {
    try {
      const res = await fetch('/api/staff/knowledge/register-from-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: data.question,
          answer: data.answer,
          domainCode: data.domainCode || 'COMMON',
          roomNo: roomNumber,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('[ChatModal] RAG 지식 등록 실패:', err);
    }
    setIsKnowledgeModalOpen(false);
    onClose();
  };

  const { question: initialQuestion, answer: initialAnswer } = extractInitialContent();

  const isReadOnly = status === 'COMPLETED' || status === 'CANCELLED';

  return (
    <>
      <ModalOverlay isOpen={isOpen} onClose={handleClose}>
        <ModalCard size="md" padding={0}>
          <div className={styles.chatModalContainer}>
            <div className={styles.header}>
              <div className={styles.headerInfo}>
                <span className={styles.roomBadge}>객실 {roomNumber}</span>
                <h3 className={styles.title}>고객 상담</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {!isReadOnly && (
                  <Button variant="primary" onClick={handleCompleteConsultation} style={{ padding: '6px 12px', fontSize: '13px' }}>
                    상담 완료
                  </Button>
                )}
                <button className={styles.closeButton} onClick={handleClose} aria-label="닫기">
                  <CancelIcon width={24} height={24} color="var(--color-gray-500)" />
                </button>
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

            {!isReadOnly && (
              <div className={styles.footer}>
                <ChatInput isStaff placeholder="고객에게 답변을 입력하세요..." onSend={handleSend} />
              </div>
            )}
          </div>
        </ModalCard>
      </ModalOverlay>

      {/* RAG 등록 확인 모달 (3버튼: 등록하기 / 나중에 하기 / 건너뛰기) */}
      <ModalOverlay isOpen={isRagConfirmOpen} onClose={handleRagSkip}>
        <ModalCard size="sm">
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>AI 지식 등록</h2>
            <p style={{ fontSize: '14px', color: 'var(--color-gray-500)', lineHeight: '1.5' }}>
              이 상담 내용을 AI 지식 데이터로 등록하시겠습니까?<br />
              등록하면 AI가 동일한 질문에 자동으로 답변할 수 있습니다.
            </p>
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

      {/* 지식 등록/편집 모달 (상담 내용 프리필) */}
      {isKnowledgeModalOpen && (
        <KnowledgeEditModal
          isOpen={isKnowledgeModalOpen}
          onClose={() => {
            setIsKnowledgeModalOpen(false);
            onClose();
          }}
          mode="register"
          initialDomainCode="COMMON"
          initialQuestion={initialQuestion}
          initialAnswer={initialAnswer}
          onSave={handleKnowledgeSave}
        />
      )}
    </>
  );
}

