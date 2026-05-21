'use client';

import React, { useState, useEffect, useRef } from 'react';
import ModalOverlay from '@/components/ui/Modal/ModalOverlay';
import ModalCard from '@/components/ui/Modal/ModalCard';
import ChatBubble from '@/app/guest/chat/_components/ChatBubble';
import styles from './ChatHistoryModal.module.css';

interface ChatHistoryMessage {
  id: number | string;
  senderType: string;
  content: string;
  createdAt?: string;
}

interface ChatHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomNumber: string;
}

export default function ChatHistoryModal({ isOpen, onClose, roomNumber }: ChatHistoryModalProps) {
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
        setError('대화 내역을 불러오지 못했습니다.');
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
      <ModalCard size="md" onClose={onClose} title={`${roomNumber}호 대화 내역`}>
        <div className={styles.container}>

          <div className={styles.messageList} ref={listRef}>
            {loading && (
              <div className={styles.emptyState}>불러오는 중...</div>
            )}
            {error && (
              <div className={styles.emptyState}>{error}</div>
            )}
            {!loading && !error && messages.length === 0 && (
              <div className={styles.emptyState}>대화 내역이 없습니다.</div>
            )}
            {!loading && !error && messages.map((msg, idx) => {
              const isGuest = msg.senderType === 'GUEST';
              const isStaff = msg.senderType === 'STAFF';
              const variant = isGuest ? 'sent' : 'received';

              return (
                <ChatBubble
                  key={msg.id}
                  variant={variant}
                  isFallback={isStaff}
                >
                  {msg.content}
                </ChatBubble>
              );
            })}
          </div>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
