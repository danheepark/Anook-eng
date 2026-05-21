'use client';

import React, { useState } from 'react';
import RequestCard from '@/components/ui/Card/RequestCard';
import ChatPanel from '@/app/frontdesk/requests/_components/ChatPanel/ChatPanel';
import useChatHistory from './useChatHistory';
import styles from './page.module.css';
import { useTranslation } from '@/app/useTranslation';
import ConfirmModal from '@/components/ui/Modal/ConfirmModal';
import InputField from '@/components/ui/Inputfield/InputField';
import PopoverMenu from '@/components/ui/PopoverMenu/PopoverMenu';
import { MoreIcon } from '@/components/icons';

export default function ChatHistoryPage() {
  const [roomSearchValue, setRoomSearchValue] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const { rooms, selectedRoom, loadingRooms, error, selectRoom, fetchRooms, deleteRoom } = useChatHistory();
  const { t } = useTranslation();

  const [targetDate, setTargetDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // targetDate가 변경될 때마다 방 목록 새로고침
  React.useEffect(() => {
    fetchRooms(targetDate);
  }, [targetDate, fetchRooms]);

  const handleDeleteConfirm = async () => {
    if (selectedRoom) {
      await deleteRoom(selectedRoom);
      setIsDeleteModalOpen(false);
      setMobileView('list');
    }
  };

  // Search bar and More Menu component to inject into ChatPanel header
  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setIsPopoverOpen(!isPopoverOpen)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-gray-600)'
          }}
        >
          <MoreIcon />
        </button>
        {isPopoverOpen && (
          <PopoverMenu
            items={[{ value: 'delete', label: '대화 내역 삭제' }]}
            onSelect={(value) => {
              if (value === 'delete') {
                setIsDeleteModalOpen(true);
              }
              setIsPopoverOpen(false);
            }}
            onClose={() => setIsPopoverOpen(false)}
            width={160}
            style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', zIndex: 100 }}
          />
        )}
      </div>
    </div>
  );

  const filteredRooms = roomSearchValue
    ? rooms.filter(room => room.roomNo.toLowerCase().includes(roomSearchValue.toLowerCase()))
    : rooms;

  return (
    <div className={styles.container}>
      {/* Content Section (Split Layout) */}
      <div className={styles.splitLayout}>
        {/* Left Pane: Room List */}
        <div className={`${styles.leftPane} ${mobileView !== 'list' ? styles.mobileHidden : ''}`}>
          <div className={styles.leftPaneHeader}>
            <div className={styles.leftPaneHeaderLeft}>
              <h1 className={styles.leftPaneTitle}>{t.frontdeskPage.sidebar.menus.chatHistory}</h1>
            </div>
          </div>
          <div className={styles.leftPaneContent}>
            {/* Room Search Bar */}
            <div style={{ marginBottom: 'var(--space-16)' }}>
              <InputField
                variant="search"
                placeholder="객실 번호 검색..."
                value={roomSearchValue}
                onChange={(e) => setRoomSearchValue(e.target.value)}
              />
            </div>
            {/* Date picker */}
            <div style={{ marginBottom: 'var(--space-16)' }}>
              <input
                type="date"
                style={{
                  padding: 'var(--space-8) var(--space-12)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-gray-200)',
                  font: 'var(--text-body-regular)',
                  color: 'var(--color-gray-700)',
                  width: '100%',
                }}
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>

            {loadingRooms ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-gray-400)' }}>{t.common.loading}</div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-gray-400)' }}>{t.common.error}: {error}</div>
            ) : filteredRooms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-gray-400)' }}>채팅 내역이 없습니다</div>
            ) : (
              <div className={styles.cardGrid}>
                {filteredRooms.map(room => (
                  <RequestCard
                    key={room.roomNo}
                    roomNumber={room.roomNo}
                    title={t.frontdeskPage.chatHistory?.roomConversation?.replace('{{room}}', room.roomNo) || `${room.roomNo}호 대화`}
                    description={room.lastMessage || t.frontdeskPage.chatHistory?.emptyMessage || '메시지 없음'}
                    createdAt={room.lastMessageAt || ''}
                    isSelected={selectedRoom === room.roomNo}
                    onCardClick={() => {
                      selectRoom(room.roomNo);
                      setRoomSearchValue('');
                      setMobileView('chat');
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Chat Panel */}
        <div className={`${styles.rightPane} ${mobileView !== 'chat' ? styles.mobileHidden : ''}`}>
          {selectedRoom ? (
            <ChatPanel
              roomNumber={selectedRoom}
              status="COMPLETED"
              summary={t.frontdeskPage.chatHistory?.fullLog || '전체 대화 로그'}
              onClose={() => {}}
              headerRightContent={headerRight}
              showSearch={true}
              onMobileBack={() => setMobileView('list')}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-gray-400)' }}>
              {t.frontdeskPage.chatHistory?.selectRoomPrompt || '대화를 확인할 객실을 선택해주세요'}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title={t.frontdeskPage.chatHistory?.deleteTitle || '채팅 내역 삭제'}
        subtitle={t.frontdeskPage.chatHistory?.deleteSubtitle?.replace('{{room}}', selectedRoom || '') || `정말 ${selectedRoom}호의 채팅 내역을 삭제하시겠습니까?`}
        status="danger"
        confirmText={t.frontdeskPage.chatHistory?.deleteButton || '삭제'}
      />
    </div>
  );
}
