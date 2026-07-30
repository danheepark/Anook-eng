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
}

const translateContent = (content: string) => {
  if (!content) return content;
  if (content.includes('[FORWARD_FB]')) return '네, 식음료 팀으로 주문 내용을 바로 전달해 드릴게요!';
  if (content.includes('[FORWARD_HK]')) return '네, 알겠습니다! 하우스키핑 팀으로 요청 내용을 신속하게 전달해 드릴게요.';
  if (content.includes('[FORWARD_FACILITY]')) return '불편을 드려 죄송합니다. 🥲 시설 관리 팀으로 내용을 전달하여 최대한 빠르게 조치해 드릴게요! 🛠️';
  if (content.includes('[FORWARD_FRONT]')) return '지금 바로 프론트 데스크 직원에게 연결하여 도움을 드리겠습니다.';
  if (content.includes('[INFO_NOT_FOUND]')) return '그 부분은 제가 바로 답변드리기 어려워 프론트 데스크로 즉시 전달해 두었습니다! 🥲 직원이 확인 후 바로 채팅으로 안내해 드릴 예정이니 잠시만 기다려 주세요. 🙏';
  return content;
};

export default function ChatHistoryModal({ isOpen, onClose, roomNumber }: ChatHistoryModalProps) {
  const { t } = useTranslation();
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
          <h2 className={styles.title}>{t.frontdeskPage?.chatHistory?.roomChatRecord?.replace('{{room}}', roomNumber) || `${roomNumber}호 대화 내역`}</h2>
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
              if (msg.type === 'REQUEST_CARD' && msg.meta) {
                return (
                  <div key={msg.id} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', margin: '4px 0' }}>
                    <div style={{ maxWidth: '85%' }}>
                      <GuestRequestCard {...msg.meta} isReadOnly />
                    </div>
                  </div>
                );
              }

              const isGuest = msg.senderType === 'GUEST';
              const isStaff = msg.senderType === 'STAFF';
              const isSystemMsg = msg.senderType === 'SYSTEM' || msg.content.includes('[SYSTEM]');
              
              if (isSystemMsg) {
                let cleanContent = msg.content.replace(/^\[SYSTEM\]\s*/, '');
                if (cleanContent === '상담 및 처리가 모두 완료되었습니다.' || cleanContent === '이전 상담 및 처리가 모두 완료되었습니다.') {
                  cleanContent = t.frontdeskPage?.chatHistory?.systemCompleted || cleanContent;
                }
                return (
                  <div key={msg.id} style={{ width: '100%', marginBottom: 'var(--space-8)' }}>
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
                <div key={msg.id} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '4px', borderRadius: '16px' }}>
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
