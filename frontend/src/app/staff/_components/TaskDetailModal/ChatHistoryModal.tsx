'use client';

import React, { useState, useEffect, useRef } from 'react';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import ChatBubble from '@/app/guest/chat/_components/ChatBubble';
import FeedbackCard from '@/app/guest/chat/_components/FeedbackCard';
import { useTranslation } from '@/app/useTranslation';
import { ArrowBackIcon } from '@/components/icons';
import styles from './ChatHistoryModal.module.css';

import GuestRequestCard from '@/app/guest/chat/_components/RequestCard/RequestCard';

interface ChatHistoryMessage {
  id: number | string;
  variant?: 'sent' | 'received';
  type?: 'REQUEST_CARD' | 'MESSAGE';
  senderType: string;
  content: string;
  translatedContent?: string;
  createdAt?: string;
  meta?: any;
  _ts?: number;
}

interface ChatHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomNumber: string;
  title?: string;
}

export default function ChatHistoryModal({ isOpen, onClose, roomNumber, title }: ChatHistoryModalProps) {
  const { t } = useTranslation();

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
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !roomNumber) return;

    const fetchMessages = async () => {
      setLoading(true);
      setError(null);
      try {
        const [msgRes, reqRes] = await Promise.all([
          fetch(`/api/staff/messages/rooms/${roomNumber}`),
          fetch(`/api/staff?action=requests&view=all&departmentId=ALL`)
        ]);
        if (!msgRes.ok) throw new Error(`HTTP ${msgRes.status}`);
        
        const data = await msgRes.json();
        const reqDataAll = reqRes.ok ? await reqRes.json() : [];
        const reqData = reqDataAll.filter((r: any) => String(r.roomNumber || r.roomNo) === String(roomNumber));

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
            if (msg.content && msg.content.includes('[FORWARD_')) {
              displayContent = translateContent(msg.content);
            } else if (msg.content && msg.content.includes('[INFO_NOT_FOUND]')) {
              displayContent = translateContent(msg.content);
            } else {
              displayContent = msg.translatedContent || msg.content;
            }
          } else if (msg.senderType === 'GUEST' && msg.translatedContent) {
            displayContent = msg.translatedContent;
          }
          return {
            id: String(msg.id),
            type: 'MESSAGE',
            senderType: msg.senderType,
            content: displayContent,
            _ts: new Date(msg.createdAt).getTime(),
          };
        });

        const requestCards = reqData.flatMap((r: any) => {
          return [{
            id: `req-${r.id}-start`,
            type: 'REQUEST_CARD',
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
          }];
        });

        const merged = [...chatMessages, ...requestCards]
          .sort((a, b) => (a._ts || 0) - (b._ts || 0));

        setMessages(merged);
      } catch (err) {
        setError(t.common.error);
        console.error('[ChatHistoryModal] fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [isOpen, roomNumber]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  if (!isOpen) return null;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalCard size="md" onClose={onClose}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {title || (t.frontdeskPage?.chatHistory?.roomChatRecord?.replace('{{room}}', roomNumber) || `${roomNumber}호 대화 내역`)}
          </h2>
        </div>
        
        <div className={styles.container}>
          <div className={styles.messageList} ref={listRef}>
            {loading && (
              <div className={styles.emptyState}>{t.common.loading}</div>
            )}
            {error && (
              <div className={styles.emptyState}>{error}</div>
            )}
            {!loading && !error && messages.length === 0 && (
              <div className={styles.emptyState}>{t.frontdeskPage?.chatHistory?.emptyMessage || '대화 내역이 없습니다.'}</div>
            )}
            {!loading && !error && messages.map((msg, idx) => {
              const isGuest = msg.senderType === 'GUEST';
              const isStaff = msg.senderType === 'STAFF';
              const isSystemMsg = msg.senderType === 'SYSTEM' || msg.content.includes('[SYSTEM]');

              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const isSameSender = prevMsg && !isSystemMsg && prevMsg.senderType !== 'SYSTEM' && !prevMsg.content.includes('[SYSTEM]') && prevMsg.senderType === msg.senderType;
              const itemMarginTop = idx === 0 ? 0 : isSameSender ? 4 : 16;

              if (msg.type === 'REQUEST_CARD' && msg.meta) {
                return (
                  <div key={msg.id} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginTop: `${itemMarginTop}px` }}>
                    <div style={{ width: '448px', maxWidth: '100%' }}>
                      <GuestRequestCard {...msg.meta} isReadOnly />
                    </div>
                  </div>
                );
              }
              
              if (isSystemMsg) {
                let cleanContent = msg.content.replace(/^\[SYSTEM\]\s*/, '');
                if (cleanContent === '상담 및 처리가 모두 완료되었습니다.' || cleanContent === '이전 상담 및 처리가 모두 완료되었습니다.') {
                  cleanContent = t.frontdeskPage?.chatHistory?.systemCompleted || cleanContent;
                }
                return (
                  <div key={msg.id} style={{ width: '100%', marginTop: `${itemMarginTop}px` }}>
                    <FeedbackCard
                      isSystemMessage
                      systemContent={cleanContent}
                      systemSubtitle={t.frontdeskPage?.chatHistory?.systemMessageNote}
                    />
                  </div>
                );
              }

              const variant = isGuest ? 'received' : 'sent';
              const bubbleStyle = isGuest ? 'sent' : 'received';
              let displayContent = msg.content;

              return (
                <div key={msg.id} style={{ width: '100%', display: 'flex', flexDirection: 'column', marginTop: `${itemMarginTop}px` }}>
                  <div style={{ borderRadius: '16px' }}>
                    <ChatBubble
                      variant={variant}
                      bubbleStyle={bubbleStyle}
                      isFallback={isStaff}
                    >
                      {displayContent}
                    </ChatBubble>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
