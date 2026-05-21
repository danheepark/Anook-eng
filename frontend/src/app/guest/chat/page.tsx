'use client';

import React, { useEffect, useState } from 'react';
import ChatScreen from './_components/ChatScreen';
import { useChat } from './useChat';
import { useUiStore } from '@/stores/useUiStore';

export default function GuestChatPage() {
  const { messages, isTyping, isStaffTyping, sendMessage, activeRequests, cancelRequest, confirmRequest, rateRequest, stopMessage, handlePillSelect } = useChat();
  const { language, setLanguage } = useUiStore();
  const [hasCheckedLanguage, setHasCheckedLanguage] = useState(false);

  useEffect(() => {
    if (!hasCheckedLanguage) {
      const browserLang = navigator.language.slice(0, 2);
      if (['ko', 'en', 'zh', 'ja'].includes(browserLang)) {
        if (browserLang !== language) setLanguage(browserLang as any);
      } else {
        if (language !== 'en') setLanguage('en');
      }
      setHasCheckedLanguage(true);
    }
  }, [language, setLanguage, hasCheckedLanguage]);

  return (
    <main style={{ 
      height: '100dvh', 
      display: 'flex', 
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'var(--color-gray-100)',
      overflow: 'hidden'
    }}>
      <ChatScreen
        messages={messages}
        isTyping={isTyping}
        isStaffTyping={isStaffTyping}
        activeRequests={activeRequests}
        onSendMessage={sendMessage}
        onCancelRequest={cancelRequest}
        onConfirmRequest={confirmRequest}
        onRateRequest={rateRequest}
        onStopMessage={stopMessage}
        onPillSelect={handlePillSelect}
      />
    </main>
  );
}
