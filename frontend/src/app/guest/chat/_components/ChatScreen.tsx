import React, { useRef, useEffect, useState } from 'react';
import styles from './ChatScreen.module.css';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';

import Pill from '@/components/ui/Pill/Pill';
import ChatBackground from './ChatBackground';
import ChatEndCard from './ChatEndCard/ChatEndCard';
import FeedbackCard from './FeedbackCard';
import RequestCard from './RequestCard/RequestCard';
import RequestStatusBar from './RequestStatusBar/RequestStatusBar';
import ProgressIndicator from './ProgressIndicator/ProgressIndicator';
import { ActiveRequest } from '../useChat';
import { ArrowDownIcon } from '@/components/icons';
import { useTranslation } from '@/app/useTranslation';

export interface ChatMessage {
  id: string;
  variant: 'sent' | 'received';
  type?: 'TEXT' | 'REQUEST_CARD' | 'AI_PROGRESS' | 'QUICK_REPLY' | 'FEEDBACK' | 'CHAT_END' | 'WELCOME' | 'FALLBACK' | 'STATUS_CARD';
  content: string;
  imageUrl?: string;
  meta?: Record<string, any>;
}

export interface ChatScreenProps {
  messages: ChatMessage[];
  isTyping: boolean;
  isStaffTyping?: boolean;
  activeRequests?: ActiveRequest[];
  onSendMessage: (text: string) => void;
  onCancelRequest?: (requestId: number) => void;
  onConfirmRequest?: (requestId: number) => void;
  onRateRequest?: (requestId: number, rating: number) => void;
  onStopMessage?: () => void;
  onPillSelect?: (msgId: string, option: string) => void;
}

export default function ChatScreen({ messages, isTyping, isStaffTyping, activeRequests, onSendMessage, onCancelRequest, onConfirmRequest, onRateRequest, onStopMessage, onPillSelect }: ChatScreenProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [isRequestsExpanded, setIsRequestsExpanded] = useState(true);
  const { t } = useTranslation();
  const statusBarRef = useRef<HTMLDivElement>(null);

  // Click outside to collapse request status bar
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (
        isRequestsExpanded &&
        statusBarRef.current &&
        !statusBarRef.current.contains(event.target as Node)
      ) {
        setIsRequestsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isRequestsExpanded]);

  // AI Progress의 domains를 별도로 추출 (ProgressIndicator를 map 밖에서 독립 렌더링)
  const progressMsg = messages.find(m => m.type === 'AI_PROGRESS');
  const progressDomains = progressMsg?.meta?.domains as string[] | undefined;

  // FRONT(실시간 상담)은 요청 상태바에서 제외
  const filteredRequests = activeRequests?.filter(r => r.domainCode !== 'FRONT');

  // Auto-scroll to bottom when messages or typing state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isStaffTyping]);

  const hasInteracted = messages.some(msg => msg.variant === 'sent');
  // AI가 타이핑 중일 때는 화려한 애니메이션이 선명하게 보이도록 흰색 장막을 걷어냅니다.
  const showTypingBackground = !isTyping && (isUserTyping || hasInteracted);

  return (
    <div className={styles.chatScreen}>
      <ChatBackground isAiTyping={isTyping} isUserTyping={showTypingBackground} isInitial={!hasInteracted} />



      {/* 고정 상태 바 컨테이너 */}
      {filteredRequests && filteredRequests.length > 0 && (
        <div
          ref={statusBarRef}
          className={styles.statusBarContainer}
          onClick={() => {
            if (!isRequestsExpanded) {
              setIsRequestsExpanded(true);
            }
          }}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(10x)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.8)',
            boxShadow: '0 8px 32px rgba(31, 38, 135, 0.05)',
            transform: 'translateZ(0)',
          }}
        >
          <div className={styles.requestList}>
            {[...filteredRequests].reverse().map((req, index) => {
              const isLatest = index === 0;
              const content = (
                <RequestStatusBar
                  key={req.requestId}
                  requestId={req.requestId}
                  domainCode={req.domainCode}
                  summary={req.summary}
                  status={req.status}
                  entities={req.entities}
                  progress={req.progress}
                  isMini={isLatest ? !isRequestsExpanded : false}
                />
              );

              if (isLatest) {
                return content;
              }

              return (
                <div
                  key={req.requestId}
                  className={`${styles.expandableWrapper} ${isRequestsExpanded ? styles.expanded : ''}`}
                >
                  <div className={styles.expandableInner}>
                    {content}
                  </div>
                </div>
              );
            })}
          </div>
          <div 
            className={styles.multiRequestToggle}
            onClick={(e) => {
              e.stopPropagation();
              setIsRequestsExpanded(!isRequestsExpanded);
            }}
          >
            <span>{t.guestChat?.activeRequestsCount?.replace('{count}', String(filteredRequests.length)) || `${filteredRequests.length}개의 진행 중인 요청`}</span>
            <span className={`${styles.arrow} ${isRequestsExpanded ? styles.arrowOpen : ''}`}>
              <ArrowDownIcon width={20} height={20} strokeWidth={1} color="var(--color-gray-400)" />
            </span>
          </div>
        </div>
      )}

      <div
        className={`${styles.messageList} ${filteredRequests && filteredRequests.length > 0 ? styles.messageListWithStatusBar : ''}`}
      >
        {!(messages.length === 1 && messages[0].type === 'WELCOME') && <div className={styles.spacer} />}
        {messages.map((msg, index) => {

          if (msg.type === 'AI_PROGRESS') {
            return null; // map 밖에서 독립 렌더링
          }
          if (msg.type === 'FALLBACK') {
            return (
              <ChatBubble key={msg.id} variant="received" bubbleStyle="sent" isFallback animate={index === messages.length - 1}>
                {msg.content}
              </ChatBubble>
            );
          }
          if (msg.type === 'STATUS_CARD') {
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column' }}>
                {msg.content && <ChatBubble variant="received" animate={index === messages.length - 1}>{msg.content}</ChatBubble>}
              </div>
            );
          }
          if (msg.type === 'REQUEST_CARD') {
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column' }}>
                {msg.content && msg.content.trim() !== '' && (
                  <ChatBubble variant="received" animate={index === messages.length - 1}>
                    {msg.content}
                  </ChatBubble>
                )}
                <RequestCard
                  requestId={Number(msg.meta?.requestId)}
                  domainCode={String(msg.meta?.domainCode)}
                  summary={String(msg.meta?.summary)}
                  entities={msg.meta?.entities as Record<string, unknown>}
                  status={String(msg.meta?.status)}
                  progress={Number(msg.meta?.progress) || 0}
                  graceRemaining={Number(msg.meta?.graceRemaining) || 0}
                  priority={String(msg.meta?.priority || 'NORMAL')}
                  createdAt={msg.meta?.createdAt as string}
                  cancelledAt={msg.meta?.cancelledAt as string}
                  cancelPending={Boolean(msg.meta?.cancelPending)}
                  cancelReason={msg.meta?.cancelReason as string}
                  onCancel={() => onCancelRequest?.(Number(msg.meta?.requestId))}
                  onAccept={() => onConfirmRequest?.(Number(msg.meta?.requestId))}
                />
              </div>
            );
          }
          if (msg.type === 'QUICK_REPLY' || msg.type === 'WELCOME') {
            const isWelcome = msg.type === 'WELCOME';
            const isFirstChat = index === 0 && !isWelcome;
            let welcomeLine1 = '';
            let welcomeLine2 = '';
            if (isWelcome) {
              const lines = (msg.content || '').split('\n');
              welcomeLine1 = lines[0] || '';
              welcomeLine2 = lines.slice(1).join('\n') || '';
            }
            return (
              <div key={msg.id} style={{
                display: 'flex',
                flexDirection: 'column',
                flex: isWelcome ? 1 : undefined,
                margin: isWelcome ? '0' : (isFirstChat ? 'auto 0 0 0' : '0')
              }}>
                {isWelcome ? (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <div style={{
                      padding: '0 var(--space-8)',
                      textAlign: 'center',
                      lineHeight: '1.5',
                      transform: 'translateY(6vh)'
                    }}>
                      <div style={{ marginBottom: 'var(--space-32)', display: 'flex', justifyContent: 'center' }}>
                        <img
                          src="/icon.png"
                          alt="Anook AI"
                          style={{
                            width: '40px',
                            height: '40px',
                            objectFit: 'contain'
                          }}
                        />
                      </div>
                      <div style={{ font: 'var(--text-h2-bold)', color: 'var(--color-gray-900)', marginBottom: 'var(--space-8)' }}>
                        {welcomeLine1}
                      </div>
                      {welcomeLine2 && (
                        <div style={{ font: 'var(--text-body-medium)', color: 'var(--color-gray-500)', whiteSpace: 'pre-wrap' }}>
                          {welcomeLine2}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  msg.content ? <ChatBubble variant="received" animate={index === messages.length - 1}>{msg.content}</ChatBubble> : null
                )}
                {!msg.meta?.selectedOption && (
                  <div style={{
                    display: 'flex',
                    justifyContent: isWelcome ? 'center' : 'flex-start',
                    marginBottom: isWelcome ? '-36px' : '0',
                    paddingBottom: '0',
                    paddingLeft: '0'
                  }}>
                    <Pill
                      options={msg.meta?.options as string[]}
                      selectedOption={msg.meta?.selectedOption as string | undefined}
                      disabled={msg.meta?.pillDisabled as boolean | undefined}
                      onSelect={(option) => {
                        if (onPillSelect) {
                          onPillSelect(msg.id, option);
                        } else {
                          onSendMessage(option);
                        }
                      }}
                      align={isWelcome ? 'center' : 'flex-start'}
                    />
                  </div>
                )}
              </div>
            );
          }
          if (msg.type === 'FEEDBACK') {
            return (
              <ChatEndCard
                key={msg.id}
                summary={String(msg.meta?.summary || '')}
                domainCode={String(msg.meta?.domainCode || 'UNKNOWN')}
                completedAt={String(msg.meta?.completedAt || new Date().toISOString())}
                onSubmitRating={(rating) => {
                  const requestId = msg.meta?.requestId;
                  if (requestId && onRateRequest) {
                    onRateRequest(Number(requestId), rating);
                  }
                }}
              />
            );
          }
          if (msg.type === 'CHAT_END') {
            return (
              <FeedbackCard
                key={msg.id}
                completedAt={String(msg.meta?.completedAt || new Date().toISOString())}
                onSubmit={(rating) => {
                  const requestId = msg.meta?.requestId;
                  if (requestId && onRateRequest) {
                    onRateRequest(Number(requestId), rating);
                  }
                }}
              />
            );
          }

          return (
            <ChatBubble key={msg.id} variant={msg.variant} imageUrl={msg.imageUrl} animate={index === messages.length - 1 && msg.variant === 'received'}>
              {msg.content}
            </ChatBubble>
          );
        })}
        {progressMsg && (
          <ProgressIndicator domains={progressDomains} />
        )}
        {isStaffTyping && (
          <ChatBubble variant="received" bubbleStyle="sent" isFallback>
            <span className={styles.typingDots}><span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} /></span>
          </ChatBubble>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.footer}>
        <ChatInput
          onSend={onSendMessage}
          isTyping={isTyping}
          onStop={onStopMessage}
          onUserTyping={setIsUserTyping}
          onFocus={() => setIsRequestsExpanded(false)}
        />
      </div>
    </div>
  );
}
