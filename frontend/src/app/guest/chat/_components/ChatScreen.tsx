import React, { useRef, useEffect, useState } from 'react';
import styles from './ChatScreen.module.css';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';

import Pill from '@/components/ui/Pill/Pill';
import ChatBackground from './ChatBackground';
import StatusCard from './StatusCard';
import FeedbackCard from './FeedbackCard';
import RequestCard from './RequestCard/RequestCard';
import RequestStatusBar from './RequestStatusBar/RequestStatusBar';
import ProgressIndicator from './ProgressIndicator/ProgressIndicator';
import { ActiveRequest } from '../useChat';

export interface ChatMessage {
  id: string;
  variant: 'sent' | 'received';
  type?: 'TEXT' | 'REQUEST_CARD' | 'AI_PROGRESS' | 'QUICK_REPLY' | 'FEEDBACK' | 'WELCOME' | 'FALLBACK' | 'STATUS_CARD';
  content: string;
  imageUrl?: string;
  meta?: Record<string, any>;
}

export interface ChatScreenProps {
  messages: ChatMessage[];
  isTyping: boolean;
  activeRequests?: ActiveRequest[];
  onSendMessage: (text: string) => void;
  onCancelRequest?: (requestId: number) => void;
  onConfirmRequest?: (requestId: number) => void;
  onStopMessage?: () => void;
  onPillSelect?: (msgId: string, option: string) => void;
}

export default function ChatScreen({ messages, isTyping, activeRequests, onSendMessage, onCancelRequest, onConfirmRequest, onStopMessage, onPillSelect }: ChatScreenProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isUserTyping, setIsUserTyping] = useState(false);

  // Auto-scroll to bottom when messages or typing state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const hasInteracted = messages.some(msg => msg.variant === 'sent');
  const showTypingBackground = isUserTyping || hasInteracted;

  return (
    <div className={styles.chatScreen}>
      <ChatBackground isAiTyping={isTyping} isUserTyping={showTypingBackground} />


      
      {/* 고정 상태 바 컨테이너 */}
      {activeRequests && activeRequests.length > 0 && (
        <div style={{ 
          position: 'absolute', 
          top: 'var(--space-12)', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          width: 'calc(100% - var(--space-32))', 
          maxWidth: '448px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px', 
          zIndex: 10 
        }}>
          {activeRequests.map(req => (
            <RequestStatusBar
              key={req.requestId}
              requestId={req.requestId}
              domainCode={req.domainCode}
              summary={req.summary}
              status={req.status}
              entities={req.entities}
              progress={req.progress}
            />
          ))}
        </div>
      )}

      <div 
        className={styles.messageList}
        style={{ paddingTop: activeRequests && activeRequests.length > 0 ? '100px' : undefined }}
      >
        {!(messages.length === 1 && messages[0].type === 'WELCOME') && <div style={{ flex: 1 }} />}
        {messages.map((msg, index) => {
          const isLatest = index === messages.length - 1;

          if (msg.type === 'AI_PROGRESS') {
            return (
              <ProgressIndicator
                key={msg.id}
                domains={msg.meta?.domains as string[]}
              />
            );
          }
          if (msg.type === 'FALLBACK') {
            return (
              <ChatBubble key={msg.id} variant="received" isFallback isLatest={isLatest}>
                {msg.content}
              </ChatBubble>
            );
          }
          if (msg.type === 'STATUS_CARD') {
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column' }}>
                {msg.content && <ChatBubble variant="received" isLatest={isLatest}>{msg.content}</ChatBubble>}
                <StatusCard 
                  progress={Number(msg.meta?.progress) || 0} 
                  steps={msg.meta?.steps as string[]} 
                  cancelled={Boolean(msg.meta?.cancelled) || false}
                />
              </div>
            );
          }
          if (msg.type === 'REQUEST_CARD') {
            return (
              <RequestCard 
                key={msg.id}
                requestId={Number(msg.meta?.requestId)}
                domainCode={String(msg.meta?.domainCode)}
                summary={String(msg.meta?.summary)}
                entities={msg.meta?.entities as Record<string, unknown>}
                status={String(msg.meta?.status)}
                progress={Number(msg.meta?.progress) || 0}
                graceRemaining={Number(msg.meta?.graceRemaining) || 0}
                priority={String(msg.meta?.priority || 'NORMAL')}
                cancelPending={Boolean(msg.meta?.cancelPending)}
                onCancel={() => onCancelRequest?.(Number(msg.meta?.requestId))}
                onAccept={() => onConfirmRequest?.(Number(msg.meta?.requestId))}
              />
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
                margin: isWelcome ? 'auto 0' : (isFirstChat ? 'auto 0 0 0' : '0')
              }}>
                {isWelcome ? (
                  <div style={{ 
                    marginBottom: 'var(--space-24)', 
                    padding: '0 var(--space-8)',
                    textAlign: 'center',
                    lineHeight: '1.5'
                  }}>
                    <div style={{ font: 'var(--text-h1-bold)', color: 'var(--color-gray-900)', marginBottom: 'var(--space-8)' }}>
                      {welcomeLine1}
                    </div>
                    {welcomeLine2 && (
                      <div style={{ font: 'var(--text-body-medium)', color: 'var(--color-gray-500)', whiteSpace: 'pre-wrap' }}>
                        {welcomeLine2}
                      </div>
                    )}
                  </div>
                ) : (
                  msg.content ? <ChatBubble variant="received" isLatest={isLatest}>{msg.content}</ChatBubble> : null
                )}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: isWelcome ? 'center' : 'flex-start',
                  marginBottom: isWelcome ? '-16px' : '0',
                  paddingLeft: isWelcome ? '0' : '48px'
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
              </div>
            );
          }
          if (msg.type === 'FEEDBACK') {
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column' }}>
                {msg.content && <ChatBubble variant="received" isLatest={isLatest}>{msg.content}</ChatBubble>}
                <FeedbackCard onSubmit={(rating) => console.log('Feedback:', rating)} />
              </div>
            );
          }
          
          return (
            <ChatBubble key={msg.id} variant={msg.variant} isLatest={isLatest} imageUrl={msg.imageUrl}>
              {msg.content}
            </ChatBubble>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      
      <div className={styles.footer}>
        <ChatInput onSend={onSendMessage} isTyping={isTyping} onStop={onStopMessage} onUserTyping={setIsUserTyping} />
      </div>
    </div>
  );
}
