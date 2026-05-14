'use client';

import React from 'react';
import ChatScreen from './_components/ChatScreen';
import { useChat } from './useChat';

export default function GuestChatPage() {
  const { messages, isTyping, sendMessage, activeRequests, cancelRequest, confirmRequest, stopMessage, handlePillSelect } = useChat();

  return (
    <main style={{ 
      height: '100dvh', 
      display: 'flex', 
      justifyContent: 'center', /* Centers horizontally when flex-direction is row */
      alignItems: 'center', /* Centers vertically */
      backgroundColor: 'var(--color-gray-100)' 
    }}>
      <ChatScreen
        messages={messages}
        isTyping={isTyping}
        activeRequests={activeRequests}
        onSendMessage={sendMessage}
        onCancelRequest={cancelRequest}
        onConfirmRequest={confirmRequest}
        onStopMessage={stopMessage}
        onPillSelect={handlePillSelect}
      />
    </main>
  );
}
