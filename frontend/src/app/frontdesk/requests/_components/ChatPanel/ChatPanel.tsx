import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, MoreVertical, Search } from 'lucide-react';
import styles from './ChatPanel.module.css';
import ChatBubble from '@/app/guest/chat/_components/ChatBubble';
import ChatInput from '@/app/guest/chat/_components/ChatInput';
import { CancelIcon } from '@/components/icons';
import SmartSearchBar from '@/components/ui/SmartSearchBar/SmartSearchBar';
import { useSSE } from '@/app/useSSE';
import { useTranslation } from '@/app/useTranslation';
import Button from '@/components/ui/Button/Button';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import { RagConfirmModal } from '@/components/ui/Modal';
import FeedbackCard from '@/app/guest/chat/_components/FeedbackCard';
import GuestRequestCard from '@/app/guest/chat/_components/RequestCard/RequestCard';

export interface ChatMessage {
  id: number | string;
  variant: 'sent' | 'received';
  senderType?: string;
  content: string;
  type?: 'REQUEST_CARD';
  meta?: any;
}

export interface ChatPanelProps {
  roomNumber?: string;
  requestIds?: number[];
  representativeId?: number;
  status?: string;
  onStatusChange?: (ids: number[], newStatus: string) => Promise<void>;
  autoComplete?: boolean;
  onClose?: () => void;
  initialMessage?: string;
  summary?: string;
  showRagButton?: boolean;
  onRagRegister?: () => void;
  isEmergency?: boolean;
  headerRightContent?: React.ReactNode;
  showSearch?: boolean;
  onRagFlowChange?: (active: boolean) => void;
  onMobileBack?: () => void;
  onMobileMore?: () => void;
}

const STATUS_MAP: Record<string, { text: string; variant: 'red' | 'purple' | 'green' | 'gray' }> = {
  PENDING: { text: '대기 중', variant: 'red' },
  ASSIGNED: { text: '배정됨', variant: 'purple' },
  IN_PROGRESS: { text: '처리 중', variant: 'green' },
  COMPLETED: { text: '완료', variant: 'gray' },
  CANCELLED: { text: '취소됨', variant: 'gray' },
};

const renderHighlightedText = (text: string, search: string, isActiveMatch: boolean) => {
  if (!search) return text;
  const parts = text.split(new RegExp(`(${search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === search.toLowerCase() ? (
          <span
            key={i}
            style={{
              backgroundColor: isActiveMatch ? '#ffd54f' : 'rgba(255, 230, 0, 0.3)',
              fontWeight: isActiveMatch ? 'bold' : 'normal',
              borderRadius: '2px',
              padding: '0 2px',
              color: 'var(--color-gray-900)'
            }}
          >
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
};

export default function ChatPanel({ roomNumber = '1204', requestIds, representativeId, status, onStatusChange, autoComplete, onClose, initialMessage, summary, showRagButton, onRagRegister, isEmergency = false, headerRightContent, showSearch, onRagFlowChange, onMobileBack, onMobileMore }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);
  const { subscribe } = useSSE();
  const { t, language } = useTranslation();

  // RAG 등록 플로우 상태
  const [isRagConfirmOpen, setIsRagConfirmOpen] = useState(false);

  // 내부 검색 상태
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [internalSearch, setInternalSearch] = useState('');
  const [matchIndices, setMatchIndices] = useState<number[]>([]);
  const [currentMatch, setCurrentMatch] = useState(0);

  useEffect(() => {
    if (!internalSearch) {
      setMatchIndices([]);
      setCurrentMatch(0);
      return;
    }
    const indices: number[] = [];
    messages.forEach((m, i) => {
      if (m.content.toLowerCase().includes(internalSearch.toLowerCase())) {
        indices.push(i);
      }
    });
    setMatchIndices(indices);
    if (currentMatch >= indices.length) {
      setCurrentMatch(Math.max(0, indices.length - 1));
    }
  }, [internalSearch, messages]);

  useEffect(() => {
    if (internalSearch && matchIndices.length > 0) {
      const targetMsg = messages[matchIndices[currentMatch]];
      if (targetMsg) {
        const el = document.getElementById(`chat-msg-${targetMsg.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [currentMatch, matchIndices, internalSearch, messages]);

  // AI 특수 코드 매핑 함수 (다국어 언어팩 연동)
  const translateContent = (content: string) => {
    if (!content) return content;
    let newContent = content;
    if (newContent.includes('[FORWARD_FB]') || newContent.includes('식음료 팀으로 주문 내용을 바로 전달')) {
      return t.aiReplies?.forwardFb || "Sure! I'll send your order over to the F&B team right away!";
    }
    if (newContent.includes('[FORWARD_HK]') || newContent.includes('하우스키핑 팀으로 요청 내용을 신속하게 전달')) {
      return t.aiReplies?.forwardHk || "Got it! Sending your request to the Housekeeping team now.";
    }
    if (newContent.includes('[FORWARD_FACILITY]') || newContent.includes('시설 관리 팀으로 내용을 전달')) {
      return t.aiReplies?.forwardFacility || "So sorry about the inconvenience! I'm forwarding this to the Facility team to get it sorted as quickly as possible.";
    }
    if (newContent.includes('[FORWARD_CONCIERGE]')) {
      return (t.aiReplies as any)?.forwardConcierge || "Got it! I'll pass this along to the Concierge team right away.";
    }
    if (newContent.includes('[FORWARD_FRONT]') || newContent.includes('프론트 데스크 직원에게 연결하여 도움을 드리겠습니다') || newContent.includes('프론트데스크 직원이 곧 확인 후 안내')) {
      return t.aiReplies?.forwardFront || "Let me connect you to the front desk right now.";
    }
    if (newContent.includes('[INFO_NOT_FOUND]') || newContent.includes('프론트 데스크로 즉시 전달해 두었습니다') || newContent.includes('제가 바로 답변드리기 어려워')) {
      return t.aiReplies?.infoNotFound || "I'm not quite sure about that one. I've passed your question along to the front desk, and they'll get back to you here shortly.";
    }
    if (newContent.includes('[PII_GUARD]')) {
      return t.aiReplies?.piiGuard || "To keep your personal info safe, we can't accept sensitive details through chat.";
    }
    return newContent;
  };

  // 모달 열릴 때 실제 대화 내역 로드
  useEffect(() => {
    if (!roomNumber) return;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const [msgRes, reqRes] = await Promise.all([
          fetch(`/api/frontdesk/messages/rooms/${roomNumber}/messages`),
          fetch(`/api/frontdesk/requests?roomNo=${roomNumber}`)
        ]);
        if (!msgRes.ok) throw new Error(`HTTP ${msgRes.status}`);

        const data = await msgRes.json();
        const reqData = reqRes.ok ? await reqRes.json() : [];

        const progressMap: Record<string, number> = {
          PENDING: 10,
          ASSIGNED: 30,
          IN_PROGRESS: 50,
          COMPLETED: 100,
          CANCELLED: 100,
        };

        const chatMessages = data.map((msg: any) => {
          let displayContent = msg.content;
          if (msg.senderType === 'AI') {
            displayContent = msg.translatedContent ? translateContent(msg.translatedContent) : translateContent(msg.content);
          } else if (msg.senderType === 'GUEST' && msg.translatedContent) {
            displayContent = msg.translatedContent;
          }
          return {
            id: String(msg.id),
            variant: msg.senderType === 'GUEST' ? 'received' as const : 'sent' as const,
            senderType: msg.senderType,
            content: displayContent,
            _ts: new Date(msg.createdAt).getTime(),
          };
        });

        const requestCards = reqData.flatMap((r: any) => {
          const cards: any[] = [];
          cards.push({
            id: `req-${r.id}-start`,
            type: 'REQUEST_CARD',
            variant: 'received',
            senderType: 'SYSTEM',
            content: '',
            meta: {
              requestId: r.id,
              domainCode: r.departmentId || 'UNKNOWN',
              summary: r.summary,
              status: r.status,
              entities: r.entities,
              progress: progressMap[r.status] || 0,
              graceRemaining: 0,
              priority: r.priority || 'NORMAL',
              createdAt: r.createdAt,
              cancelReason: r.cancelReason,
              cancelledAt: r.status === 'CANCELLED' ? (r.updatedAt || r.createdAt) : undefined,
            },
            _ts: new Date(r.createdAt).getTime(),
          });
          return cards;
        });

        const merged = [...chatMessages, ...requestCards]
          .sort((a, b) => a._ts - b._ts)
          .map(({ _ts, ...msg }) => msg as ChatMessage);

        // 데이터가 없으면 데모용 더미 데이터 삽입
        if (merged.length === 0 && initialMessage) {
          setMessages([
            { id: 'dummy-1', variant: 'received', senderType: 'GUEST', content: initialMessage },
            { id: 'dummy-2', variant: 'sent', senderType: 'AI', content: '요청이 접수되었습니다. 프론트데스크 직원이 곧 확인 후 안내해 드리겠습니다.' },
          ]);
        } else {
          setMessages(merged);
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
        const rawContent = payload.originalContent ? (payload.originalContent as string) : content;
        const displayContent = type === 'AI_RESPONSE' ? translateContent(rawContent) : rawContent;
        setMessages(prev => {
          if (messageId && prev.some(m => m.id === String(messageId))) return prev;
          // 낙관적 업데이트로 인한 중복 방지 (내용으로 비교)
          if (type === 'STAFF_MESSAGE' && prev.some(m => m.variant === 'sent' && m.content === displayContent && String(m.id).startsWith('temp'))) {
            // tempId를 실제 messageId로 교체
            return prev.map(m => (m.variant === 'sent' && m.content === displayContent && String(m.id).startsWith('temp')) ? { ...m, id: String(messageId), content: displayContent, senderType: 'STAFF' } : m);
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
      } else if (type === 'GUEST_MESSAGE_TRANSLATED' || type === 'MESSAGE_TRANSLATED') {
        // 고객 또는 AI 메시지 번역 완료 → 기존 메시지의 content를 번역본으로 교체
        const translatedContent = payload.translatedContent as string;
        const targetMsgId = payload.messageId as number;
        if (translatedContent && targetMsgId) {
          setMessages(prev => prev.map(m =>
            m.id === String(targetMsgId) && (m.senderType === 'GUEST' || m.senderType === 'AI')
              ? { ...m, content: m.senderType === 'AI' ? translateContent(translatedContent) : translatedContent }
              : m
          ));
        }
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
      const res = await fetch(`/api/frontdesk/messages/rooms/${roomNumber}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      // 전송 실패 시에도 화면에는 유지
    }

    // 3. PENDING 상태면 IN_PROGRESS로 변경
    if (status === 'PENDING' && requestIds && requestIds.length > 0 && onStatusChange) {
      await onStatusChange(requestIds, 'IN_PROGRESS');
    }
  };

  // 상담 완료 버튼 클릭 시: RAG 모달을 먼저 열고, 선택 후 완료 처리
  const handleCompleteConsultation = () => {
    const staffMessages = messages.filter(m => m.senderType === 'STAFF');
    if (staffMessages.length > 0) {
      // 1. 직원이 답변한 내용이 있으면 RAG 등록 모달 열기 (아직 완료 처리 안 함)
      setIsRagConfirmOpen(true);
      onRagFlowChange?.(true);
    } else {
      // 2. 직원이 답변한 내용이 없으면 즉시 COMPLETED 처리
      if (requestIds && requestIds.length > 0 && onStatusChange && status !== 'COMPLETED') {
        onStatusChange(requestIds, 'COMPLETED');
      }
    }
  };

  // 그냥 닫기 (상담 완료 아님)
  const handleClose = () => {
    if (onClose) onClose();
  };

  const completeRequest = () => {
    if (requestIds && requestIds.length > 0 && onStatusChange && status !== 'COMPLETED') {
      onStatusChange(requestIds, 'COMPLETED');
    }
  };

  const handleRagConfirm = () => {
    setIsRagConfirmOpen(false);
    onRagFlowChange?.(false);
    if (onRagRegister) onRagRegister();
    completeRequest();
  };

  // "나중에 하기" → PENDING 상태로 저장 후 완료 처리
  const handleRagLater = async () => {
    const { answer } = extractInitialContent();
    const cleanSummary = summary ? summary.replace(/^\[(?:프론트 연결|직원 인수인계)\]\s*/, '') : '미분류 상담';
    try {
      const res = await fetch('/api/staff/knowledge/register-from-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: cleanSummary,
          answer,
          domainCode: 'COMMON',
          roomNo: roomNumber,
          status: 'PENDING',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // 로컬 스토리지에 등록 상태 저장
      if (representativeId) {
        const saved = localStorage.getItem('registeredRagIds');
        const set = saved ? new Set(JSON.parse(saved)) : new Set();
        set.add(representativeId);
        localStorage.setItem('registeredRagIds', JSON.stringify(Array.from(set)));
        window.dispatchEvent(new CustomEvent('ragRegistered', { detail: representativeId }));
      }
    } catch (err) {
      console.error('[ChatPanel] PENDING 등록 실패:', err);
    }
    setIsRagConfirmOpen(false);
    onRagFlowChange?.(false);
    completeRequest();
  };

  const handleRagSkip = () => {
    setIsRagConfirmOpen(false);
    onRagFlowChange?.(false);
    completeRequest();
  };

  const handleRagCancel = () => {
    setIsRagConfirmOpen(false);
    onRagFlowChange?.(false);
  };

  // 상담 내용에서 초기 질문/답변 추출
  const extractInitialContent = () => {
    const chunks: ChatMessage[][] = [];
    let currentChunk: ChatMessage[] = [];

    for (const msg of messages) {
      const content = msg.content || '';
      if (content.includes(t.frontdeskPage?.chatHistory?.systemCompleted || '이전 상담 및 처리가 모두 완료되었습니다') || content.includes('상담 및 처리가 모두 완료되었습니다') || content.includes('[SYSTEM]')) {
        if (currentChunk.length > 0) {
          chunks.push([...currentChunk]);
          currentChunk = [];
        }
      } else {
        currentChunk.push(msg);
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    const latestChunk = chunks.length > 0 ? chunks[chunks.length - 1] : [];

    const guestMessages = latestChunk
      .filter(m => m.senderType === 'GUEST')
      .map(m => m.content);

    const staffMessages = latestChunk
      .filter(m => m.senderType === 'STAFF')
      .map(m => m.content);

    return {
      question: guestMessages.length > 0 ? guestMessages.join('\n') : '대화 기록 기반 요약',
      answer: staffMessages.join('\n'),
    };
  };

  // 첫 번째 읽지 않은 메시지(Unread) 구분선 위치 계산
  const firstUnreadIndex = React.useMemo(() => {
    if (messages.length === 0) return -1;
    if (status === 'COMPLETED' || status === 'CANCELLED') return -1;

    // 1. 마지막 [SYSTEM] 상담 완료 메시지 이후의 첫 번째 메시지 찾기
    let lastSystemIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (
        msg.senderType === 'SYSTEM' ||
        msg.content?.includes('[SYSTEM]') ||
        msg.content?.includes('상담 및 처리가 모두 완료되었습니다') ||
        msg.content?.includes('이전 상담 및 처리가 모두 완료되었습니다')
      ) {
        lastSystemIdx = i;
        break;
      }
    }

    const startIndex = lastSystemIdx !== -1 ? lastSystemIdx + 1 : 0;
    if (startIndex >= messages.length) return -1;

    // 2. 직원이 마지막으로 전송한 메시지 위치 찾기
    let lastStaffIdx = -1;
    for (let i = messages.length - 1; i >= startIndex; i--) {
      if (messages[i].senderType === 'STAFF') {
        lastStaffIdx = i;
        break;
      }
    }

    const unreadStart = lastStaffIdx !== -1 ? lastStaffIdx + 1 : startIndex;
    if (unreadStart < messages.length && (unreadStart > 0 || lastSystemIdx !== -1)) {
      return unreadStart;
    }
    return -1;
  }, [messages, status]);

  const isReadOnly = status === 'COMPLETED' || status === 'CANCELLED';

  return (
    <>
      <div className={styles.chatPanelContainer}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            {onMobileBack && (
              <button className={styles.mobileBackBtn} onClick={onMobileBack} aria-label={t.chatPanel?.backToList || "목록으로 가기"}>
                <ChevronLeft size={22} />
              </button>
            )}
            <span className={styles.roomBadge}>{language === 'en' ? `Room ${roomNumber}` : `${roomNumber}호`}</span>
            {summary ? (
              <h3 className={styles.title}>{summary.replace(/^\[(?:프론트 연결|직원 인수인계)\]\s*/, '')}</h3>
            ) : null}
          </div>
          <div className={styles.headerRight}>
            {showSearch && (
              <div className={styles.searchWrapper}>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${isSearchOpen ? styles.iconBtnActive : ''}`}
                  onClick={() => {
                    setIsSearchOpen(prev => !prev);
                    if (isSearchOpen) {
                      setInternalSearch('');
                    }
                  }}
                  aria-label="Search messages"
                >
                  <Search size={18} />
                </button>

                {isSearchOpen && (
                  <div className={styles.floatingSearchContainer}>
                    <SmartSearchBar
                      autoFocus
                      inputWrapperStyle={{ width: '320px' }}
                      placeholder={t.frontdeskPage?.chatHistory?.searchPlaceholder || '대화 내용 검색...'}
                      value={internalSearch}
                      onChange={(val) => setInternalSearch(val)}
                      currentMatch={currentMatch}
                      totalMatches={matchIndices.length}
                      onPrev={() => setCurrentMatch(p => Math.max(0, p - 1))}
                      onNext={() => setCurrentMatch(p => Math.min(matchIndices.length - 1, p + 1))}
                    />
                  </div>
                )}
              </div>
            )}

            {headerRightContent ? headerRightContent : (
              (status === 'IN_PROGRESS' || status === 'ASSIGNED') && (
                <Button size="medium" variant="primary" onClick={handleCompleteConsultation}>
                  {t.chatPanel?.consultationComplete || '상담 완료'}
                </Button>
              )
            )}

            {onMobileMore && (
              <button className={styles.mobileMoreBtn} onClick={onMobileMore} aria-label={t.chatPanel?.viewRequestDetail || "요청 상세 보기"}>
                <MoreVertical size={22} />
              </button>
            )}
          </div>
        </div>

        <div className={styles.messageList} ref={messageListRef}>
          {loading ? (
            <div className={styles.emptyState}>{t.chatPanel?.loadingMessages || '대화 내역을 불러오는 중...'}</div>
          ) : messages.length === 0 ? (
            <div className={styles.emptyState}>{t.chatPanel?.noMessages || '이 객실의 대화 내역이 없습니다.'}</div>
          ) : (
            messages.map((msg, idx) => {
              const isSystemMsg = msg.senderType === 'SYSTEM' || msg.content.includes('[SYSTEM]');

              // 연속된 동일 [SYSTEM] 메시지는 첫 번째만 렌더링 (N건 동시 완료 → 카드 1개)
              // 대화 사이에 끼인 [SYSTEM]은 이전 메시지가 시스템이 아니므로 정상 표시
              if (isSystemMsg && idx > 0) {
                const prevMsg = messages[idx - 1];
                const isPrevSystem = prevMsg.senderType === 'SYSTEM' || prevMsg.content.includes('[SYSTEM]');
                if (isPrevSystem && prevMsg.content === msg.content) {
                  return null; // 연속 중복 → 건너뜀
                }
              }

              const isUnreadStart = idx === firstUnreadIndex;
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const isSameSender = prevMsg && !isSystemMsg && prevMsg.senderType !== 'SYSTEM' && prevMsg.variant === msg.variant;
              const itemMarginTop = idx === 0 ? 0 : isSameSender ? 4 : 16;

              let renderedItem = null;

              if (msg.type === 'REQUEST_CARD' && msg.meta) {
                renderedItem = (
                  <div key={msg.id} id={`chat-msg-${msg.id}`} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginTop: `${itemMarginTop}px` }}>
                    <div className={styles.requestCardWrapper}>
                      <GuestRequestCard {...msg.meta} isReadOnly />
                    </div>
                  </div>
                );
              } else if (isSystemMsg) {
                let cleanContent = msg.content.replace(/^\[SYSTEM\]\s*/, '');
                if (cleanContent === '상담 및 처리가 모두 완료되었습니다.' || cleanContent === '이전 상담 및 처리가 모두 완료되었습니다.') {
                  cleanContent = t.frontdeskPage?.chatHistory?.systemCompleted || cleanContent;
                }
                renderedItem = (
                  <div key={msg.id} id={`chat-msg-${msg.id}`} style={{ width: '100%', marginTop: `${itemMarginTop}px` }}>
                    <FeedbackCard
                      isSystemMessage
                      systemContent={cleanContent}
                      systemSubtitle={t.frontdeskPage?.chatHistory?.systemMessageNote}
                    />
                  </div>
                );
              } else {
                const isAutoMsg = 
                  msg.content.includes('직원이 메시지를 확인했습니다') ||
                  (msg.content.includes('프론트') && msg.content.includes('확인했습니다')) ||
                  (msg.content.toLowerCase().includes('front desk') && (
                    msg.content.toLowerCase().includes('reviewed') ||
                    msg.content.toLowerCase().includes('received') ||
                    msg.content.toLowerCase().includes('checked') ||
                    msg.content.toLowerCase().includes('assist you')
                  )) ||
                  msg.content.includes('フロントデスク') ||
                  msg.content.includes('前台工作人员') ||
                  msg.content.includes('긴급 대응팀') ||
                  msg.content.toLowerCase().includes('emergency response team');

                const isTargetMatch = !!(internalSearch && matchIndices.length > 0 && matchIndices[currentMatch] === idx);

                const formatNoticeContent = (content: string) => {
                  if (!content) return '';
                  let formatted = content
                    .replace(/has received your message/gi, 'has reviewed your message')
                    .replace(/\s*and will assist you shortly\.?/gi, '.')
                    .replace(/\s*and will assist you\.?/gi, '.')
                    .replace(/\s*곧 안내\s*드리겠습니다\.?/g, '')
                    .replace(/\s*곧 안내해\s*드리겠습니다\.?/g, '')
                    .replace(/\s*すぐにご案内いたします。?/g, '')
                    .replace(/\s*我们将很快为您提供帮助。?/g, '')
                    .replace(/\n\s*/g, ' ')
                    .trim();
                  if (/^[A-Za-z]/.test(formatted) && !/[.!?]$/.test(formatted)) {
                    formatted += '.';
                  }
                  return formatted;
                };

                if (isAutoMsg) {
                  renderedItem = (
                    <div key={msg.id} id={`chat-msg-${msg.id}`} className={styles.systemDivider}>
                      <span className={styles.systemDividerText}>
                        {renderHighlightedText(formatNoticeContent(msg.content), internalSearch, isTargetMatch)}
                      </span>
                    </div>
                  );
                } else {
                  const isManualStaffMsg = msg.senderType === 'STAFF';
                  const bubbleStyle = msg.senderType === 'GUEST' ? 'sent' as const : 'received' as const;

                  renderedItem = (
                    <div key={msg.id} id={`chat-msg-${msg.id}`} style={{ width: '100%', display: 'flex', flexDirection: 'column', marginTop: `${itemMarginTop}px` }}>
                      <div style={{
                        transition: 'all 0.3s',
                        borderRadius: '16px',
                      }}>
                        <ChatBubble
                          variant={msg.variant}
                          bubbleStyle={bubbleStyle}
                          isFallback={isManualStaffMsg}
                        >
                          {renderHighlightedText(msg.content, internalSearch, isTargetMatch)}
                        </ChatBubble>
                      </div>
                    </div>
                  );
                }
              }

              if (isUnreadStart) {
                return (
                  <React.Fragment key={`unread-container-${msg.id}`}>
                    <div className={styles.unreadDivider}>
                      <span className={styles.unreadText}>
                        {(t.chatPanel as any)?.unread || (language === 'en' ? 'Unread' : '읽지 않은 메시지')}
                      </span>
                    </div>
                    {renderedItem}
                  </React.Fragment>
                );
              }

              return renderedItem;
            })
          )}
        </div>

        {!isReadOnly && status === 'PENDING' && (
          <div className={styles.footer} style={{ justifyContent: 'center' }}>
            <Button
              variant={isEmergency ? 'danger' : 'primary'}
              size="large"
              fullWidth
              onClick={async () => {
                if (onStatusChange && requestIds && requestIds.length > 0) {
                  await onStatusChange(requestIds, 'IN_PROGRESS');
                  if (isEmergency) {
                    await handleSend(t.chatPanel?.autoReplyEmergency || 'An emergency response team has been assigned. We will take prompt action. Please wait in a safe place.');
                  } else {
                    await handleSend(t.chatPanel?.autoReplyStaffChecked || 'A front desk team member has reviewed your message and will assist you shortly.');
                  }
                }
              }}
            >
              {isEmergency ? t.chatPanel?.startEmergency || '긴급 대응 시작' : t.chatPanel?.startConsultation || '상담 시작하기'}
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
              {t.chatPanel?.registerAiKnowledge || 'AI 지식 등록'}
            </Button>
          </div>
        )}

        {!isReadOnly && status !== 'PENDING' && (
          <div className={styles.footer} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <ChatInput isStaff placeholder={t.chatPanel?.replyPlaceholder || '고객에게 답변을 입력하세요...'} onSend={handleSend} />
            </div>
          </div>
        )}
      </div>

      {/* RAG 등록 확인 모달 (3버튼: 등록하기 / 나중에 하기 / 건너뛰기) */}
      <RagConfirmModal
        isOpen={isRagConfirmOpen}
        onConfirm={handleRagConfirm}
        onLater={handleRagLater}
        onSkip={handleRagSkip}
        onCancel={handleRagCancel}
      />
    </>
  );
}
