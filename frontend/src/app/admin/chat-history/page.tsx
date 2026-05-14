'use client';

import React, { useState } from 'react';
import InputField from '@/components/ui/Inputfield/InputField';
import FilterButton from '@/components/ui/FilterButton/FilterButton';
import ChatHistory, { ChatHistoryData } from '@/components/ui/ChatHistory/ChatHistory';
import ChatBubble from '@/app/guest/chat/_components/ChatBubble';
import { MoreVertical } from 'lucide-react';
import useChatHistory from './useChatHistory';
import styles from './page.module.css';
import { useTranslation } from '@/app/useTranslation';

import ConfirmModal from '@/components/ui/Modal/ConfirmModal';

export default function ChatHistoryPage() {
  const [searchValue, setSearchValue] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const { rooms, messages, selectedRoom, loadingRooms, loadingMessages, error, selectRoom, fetchMessages, fetchRooms, deleteRoom } = useChatHistory();
  const { t } = useTranslation();

  // API 데이터를 ChatHistory 컴포넌트 형식으로 매핑
  const chatRooms: ChatHistoryData[] = rooms.map(r => ({
    id: r.roomNo,
    roomNumber: r.roomNo,
    statusText: r.lastMessage ? t.adminPage.chatHistory.activeChat : t.adminPage.chatHistory.archived,
  }));

  const [targetDate, setTargetDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // targetDate가 변경될 때마다 방 목록 새로고침
  React.useEffect(() => {
    fetchRooms(targetDate);
  }, [targetDate, fetchRooms]);

  const handleDeleteConfirm = async () => {
    if (selectedRoom) {
      await deleteRoom(selectedRoom);
      setIsDeleteModalOpen(false);
      setIsPopoverOpen(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header Section */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{t.adminPage.chatHistory.title}</h1>
        </div>
        <div className={styles.headerActions}>
          <input 
            type="date" 
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
          <InputField
            variant="search"
            placeholder={t.adminPage.chatHistory.searchPlaceholder}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
          <FilterButton
            filterOptions={[
              { label: t.adminPage.chatHistory.filterAll, value: 'all' },
              { label: t.adminPage.chatHistory.filterLatest, value: 'latest' }
            ]}
            selectedFilter="all"
            onFilterSelect={() => { }}
          />
        </div>
      </div>

      {/* Main Content Section */}
      <div className={styles.mainContent}>
        {/* Left Sidebar: Room List */}
        <div className={styles.sidebar}>
          {loadingRooms ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-gray-400)' }}>{t.common.loading}</div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-gray-400)' }}>{t.common.error}: {error}</div>
          ) : (
            <ChatHistory
              rooms={chatRooms}
              activeRoomId={selectedRoom || undefined}
              onRoomSelect={(id) => selectRoom(String(id))}
            />
          )}
        </div>

        {/* Right Area: Chat Logs */}
        <div className={styles.chatArea}>
          {/* Chat Header */}
          <div className={styles.chatHeader}>
            <div className={styles.chatHeaderLeft}>
              <h2 className={styles.chatTitle}>{selectedRoom ? `${selectedRoom}${t.adminPage.chatHistory.roomLog}` : t.adminPage.chatHistory.selectRoom}</h2>
              <span className={styles.chatSubtitle}>{t.adminPage.chatHistory.fullLog}</span>
            </div>
            <div className={styles.chatHeaderActions} onClick={() => selectedRoom && setIsPopoverOpen(!isPopoverOpen)}>
              <MoreVertical size={24} style={{ cursor: selectedRoom ? 'pointer' : 'default', opacity: selectedRoom ? 1 : 0.5 }} />
              {isPopoverOpen && selectedRoom && (
                <div className={styles.popoverMenu}>
                  <div 
                    className={styles.popoverItem} 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDeleteModalOpen(true);
                      setIsPopoverOpen(false);
                    }}
                  >
                    {t.adminPage.chatHistory.delete}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chat Body */}
          <div className={styles.chatBody}>
            {loadingMessages ? (
              <div style={{ textAlign: 'center', color: 'var(--color-gray-400)', marginTop: '40px' }}>{t.adminPage.chatHistory.loadingMessages}</div>
            ) : messages.length > 0 ? (
              <>
                {messages.map(msg => (
                  <ChatBubble
                    key={msg.id}
                    variant={msg.senderType === 'GUEST' ? 'received' : 'sent'}
                    isFallback={msg.senderType === 'STAFF'}
                  >
                    {msg.content}
                  </ChatBubble>
                ))}
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--color-gray-400)', marginTop: '40px' }}>
                {t.adminPage.chatHistory.noHistory}
              </div>
            )}
          </div>

        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="채팅 내역 삭제"
        subtitle={`정말 ${selectedRoom}호의 채팅 내역을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        status="danger"
        confirmText="삭제"
      />
    </div>
  );
}

