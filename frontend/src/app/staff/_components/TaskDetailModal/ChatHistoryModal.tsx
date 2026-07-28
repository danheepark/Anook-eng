'use client';

import React, { useState, useEffect, useRef } from 'react';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import ChatBubble from '@/app/guest/chat/_components/ChatBubble';
import FeedbackCard from '@/app/guest/chat/_components/FeedbackCard';
import { useTranslation } from '@/app/useTranslation';
import { ArrowBackIcon } from '@/components/icons';
import styles from './ChatHistoryModal.module.css';

interface ChatHistoryMessage {
  id: number | string;
  senderType: string;
  content: string;
  translatedContent?: string;
  createdAt?: string;
}

interface ChatHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomNumber: string;
  hideBackButton?: boolean;
}

export default function ChatHistoryModal({ isOpen, onClose, roomNumber, hideBackButton }: ChatHistoryModalProps) {
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
        const res = await fetch(`/api/staff/messages/rooms/${roomNumber}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setMessages(data);
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
          {!hideBackButton && (
            <button className={styles.backBtn} onClick={onClose} aria-label="뒤로">
              <ArrowBackIcon width={18} height={18} color="currentColor" />
            </button>
          )}
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
              if (msg.translatedContent && (msg.senderType === 'GUEST' || msg.senderType === 'AI')) {
                displayContent = msg.translatedContent;
              }

              return (
                <ChatBubble
                  key={msg.id}
                  variant={variant}
                  bubbleStyle={bubbleStyle}
                  isFallback={isStaff}
                >
                  {displayContent}
                </ChatBubble>
              );
            })}
          </div>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
