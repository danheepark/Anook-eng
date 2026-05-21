import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, MoreVertical } from 'lucide-react';
import styles from './ChatPanel.module.css';
import ChatBubble from '@/app/guest/chat/_components/ChatBubble';
import ChatInput from '@/app/guest/chat/_components/ChatInput';
import { CancelIcon, ArrowUpIcon, ArrowDownIcon } from '@/components/icons';
import InputField from '@/components/ui/Inputfield/InputField';
import { useSSE } from '@/app/useSSE';
import { useTranslation } from '@/app/useTranslation';
import Button from '@/components/ui/Button/Button';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import FeedbackCard from '@/app/guest/chat/_components/FeedbackCard';
export interface ChatMessage {
  id: number | string;
  variant: 'sent' | 'received';
  senderType?: string;
  content: string;
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
  const { t } = useTranslation();

  // RAG 등록 플로우 상태
  const [isRagConfirmOpen, setIsRagConfirmOpen] = useState(false);

  // 내부 검색 상태
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
    if (content.includes('[FORWARD_FB]')) return t.aiReplies?.forwardFb || content;
    if (content.includes('[FORWARD_HK]')) return t.aiReplies?.forwardHk || content;
    if (content.includes('[FORWARD_FACILITY]')) return t.aiReplies?.forwardFacility || content;
    if (content.includes('[FORWARD_FRONT]')) return t.aiReplies?.forwardFront || content;
    if (content.includes('[INFO_NOT_FOUND]')) return t.aiReplies?.infoNotFound || content;
    return content;
  };

  // 모달 열릴 때 실제 대화 내역 로드
  useEffect(() => {
    if (!roomNumber) return;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/frontdesk/messages/rooms/${roomNumber}/messages`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const mapped: ChatMessage[] = data.map((msg: any) => {
          let displayContent = msg.content;
          if (msg.senderType === 'AI') {
            displayContent = translateContent(msg.content);
          } else if (msg.senderType === 'GUEST' && msg.translatedContent) {
            // 고객 메시지가 외국어인 경우, 직원 언어로 번역된 내용 표시
            displayContent = msg.translatedContent;
          }
          return {
            id: String(msg.id),
            variant: msg.senderType === 'GUEST' ? 'received' as const : 'sent' as const,
            senderType: msg.senderType,
            content: displayContent,
          };
        });

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
      } else if (type === 'GUEST_MESSAGE_TRANSLATED') {
        // 고객 메시지 번역 완료 → 기존 메시지의 content를 번역본으로 교체
        const translatedContent = payload.translatedContent as string;
        const targetMsgId = payload.messageId as number;
        if (translatedContent && targetMsgId) {
          setMessages(prev => prev.map(m =>
            m.id === String(targetMsgId) && m.senderType === 'GUEST'
              ? { ...m, content: translatedContent }
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
    if (status === 'PENDING' && requestIds && requestIds.length > 0 && onStatusChange) {
      await onStatusChange(requestIds, 'IN_PROGRESS');
    }
  };

  // 상담 완료 버튼 클릭 시: 즉시 COMPLETED 처리 후 RAG 모달은 별도로 열기
  const handleCompleteConsultation = () => {
    // 1. 즉시 COMPLETED 상태로 변경 (고객에게 바로 상담 종료 카드 전송)
    if (requestIds && requestIds.length > 0 && onStatusChange && status !== 'COMPLETED') {
      onStatusChange(requestIds, 'COMPLETED');
    }

    // 2. 직원이 답변한 내용이 있으면 RAG 등록 모달 열기
    const staffMessages = messages.filter(m => m.senderType === 'STAFF');
    if (staffMessages.length > 0) {
      setIsRagConfirmOpen(true);
      onRagFlowChange?.(true);
    } else {
      if(onClose) onClose();
    }
  };

  // 그냥 닫기 (상담 완료 아님)
  const handleClose = () => {
    if(onClose) onClose();
  };

  const handleRagConfirm = () => {
    setIsRagConfirmOpen(false);
    onRagFlowChange?.(false);
    if (onRagRegister) onRagRegister();
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
    if (onClose) onClose();
  };

  const handleRagSkip = () => {
    setIsRagConfirmOpen(false);
    onRagFlowChange?.(false);
    if (onClose) onClose();
  };

  const handleRagCancel = () => {
    setIsRagConfirmOpen(false);
    onRagFlowChange?.(false);
    if (onClose) onClose();
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
            {onMobileBack && (
              <button className={styles.mobileBackBtn} onClick={onMobileBack} aria-label="목록으로 가기">
                <ChevronLeft size={22} />
              </button>
            )}
            <span className={styles.roomBadge}>{roomNumber}호</span>
            <h3 className={styles.title}>{(summary || '상담').replace(/^\[(?:프론트 연결|직원 인수인계)\]\s*/, '')}</h3>
          </div>
          <div className={styles.headerRight} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {showSearch && (
              <div className={styles.chatSearchContainer} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '240px' }}>
                  <InputField
                    variant="search"
                    placeholder="대화 내용 검색..."
                    value={internalSearch}
                    onChange={(e) => setInternalSearch(e.target.value)}
                  />
                </div>
                {internalSearch && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--color-gray-600)', whiteSpace: 'nowrap' }}>
                    {matchIndices.length > 0 ? (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <button 
                            onClick={() => setCurrentMatch(p => Math.max(0, p - 1))}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                          >
                            <ArrowUpIcon width={16} height={16} color="var(--color-gray-600)" />
                          </button>
                          <button 
                            onClick={() => setCurrentMatch(p => Math.min(matchIndices.length - 1, p + 1))}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                          >
                            <ArrowDownIcon width={16} height={16} color="var(--color-gray-600)" />
                          </button>
                        </div>
                        <span>{currentMatch + 1} / {matchIndices.length}</span>
                      </>
                    ) : (
                      <span>0 / 0</span>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {headerRightContent ? headerRightContent : (
              (status === 'IN_PROGRESS' || status === 'ASSIGNED') && (
                <Button size="medium" variant="primary" onClick={handleCompleteConsultation}>
                  상담 완료
                </Button>
              )
            )}

            {onMobileMore && (
              <button className={styles.mobileMoreBtn} onClick={onMobileMore} aria-label="요청 상세 보기">
                <MoreVertical size={22} />
              </button>
            )}
          </div>
        </div>

        <div className={styles.messageList} ref={messageListRef}>
          {loading ? (
            <div className={styles.emptyState}>대화 내역을 불러오는 중...</div>
          ) : messages.length === 0 ? (
            <div className={styles.emptyState}>이 객실의 대화 내역이 없습니다.</div>
          ) : (
            messages.map((msg, idx) => {
              const isSystemMsg = msg.senderType === 'SYSTEM' || msg.content.includes('[SYSTEM]');
              
              if (isSystemMsg) {
                let cleanContent = msg.content.replace(/^\[SYSTEM\]\s*/, '');
                if (cleanContent === '이전 상담 및 처리가 모두 완료되었습니다.') {
                  cleanContent = t.frontdeskPage?.chatHistory?.systemCompleted || cleanContent;
                }
                return (
                  <div key={msg.id} id={`chat-msg-${msg.id}`} style={{ width: '100%' }}>
                    <FeedbackCard 
                      isSystemMessage
                      systemContent={cleanContent}
                      systemSubtitle={t.frontdeskPage?.chatHistory?.systemMessageNote}
                    />
                  </div>
                );
              }

              const isAutoMsg = msg.content.includes('프론트 데스크 직원이 메시지를 확인했습니다') || 
                                msg.content.includes('긴급 대응팀이 배정되었습니다');
              
              // 관리자 패널 기준:
              // - GUEST → 왼쪽(received) + surface color 스타일(sent)
              // - AI → 오른쪽(sent) + AI 텍스트 스타일(received)
              // - STAFF → 오른쪽(sent) + fallback 스타일
              const isManualStaffMsg = msg.senderType === 'STAFF' && !isAutoMsg;

              // 위치(variant)와 버블 스타일(bubbleStyle)을 독립적으로 지정
              const bubbleStyle = msg.senderType === 'GUEST' ? 'sent' as const : 'received' as const;
              
              const isTargetMatch = !!(internalSearch && matchIndices.length > 0 && matchIndices[currentMatch] === idx);

              return (
                <div key={msg.id} id={`chat-msg-${msg.id}`} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ 
                    transition: 'all 0.3s', 
                    padding: '4px', 
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
                    await handleSend('긴급 대응팀이 배정되었습니다. 신속히 조치하겠습니다. 안전한 곳에서 대기해 주시기 바랍니다.');
                  } else {
                    await handleSend('프론트 데스크 직원이 메시지를 확인했습니다. 곧 안내 드리겠습니다.');
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
              등록하지 않기
            </button>
          </div>
        </ModalCard>
      </ModalOverlay>
    </>
  );
}
