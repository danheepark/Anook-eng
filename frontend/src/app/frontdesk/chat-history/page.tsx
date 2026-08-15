'use client';

import React, { useState } from 'react';
import RequestCard from '@/components/ui/Card/RequestCard';
import ChatPanel from '@/app/frontdesk/requests/_components/ChatPanel/ChatPanel';
import useChatHistory from './useChatHistory';
import styles from './page.module.css';
import { useTranslation } from '@/app/useTranslation';
import ConfirmModal from '@/components/ui/Modal/ConfirmModal';
import SmartSearchBar from '@/components/ui/SmartSearchBar/SmartSearchBar';
import PopoverMenu from '@/components/ui/PopoverMenu/PopoverMenu';
import { MoreIcon } from '@/components/icons';

import DateFilterDropdown, { DateFilterType, DateRange } from '../requests/_components/DateFilterDropdown';

const getTodayYMD = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getYesterdayYMD = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function ChatHistoryPage() {
  const [roomSearchValue, setRoomSearchValue] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('today');
  const [customRange, setCustomRange] = useState<DateRange>(() => {
    const today = getTodayYMD();
    return { startDate: today, endDate: today };
  });

  const { rooms, selectedRoom, loadingRooms, error, selectRoom, fetchRooms, deleteRoom } = useChatHistory();
  const { t, language } = useTranslation();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Filter type / range 변경 시 방 목록 새로고침
  React.useEffect(() => {
    if (dateFilterType === 'today') {
      fetchRooms(getTodayYMD());
    } else if (dateFilterType === 'yesterday') {
      fetchRooms(getYesterdayYMD());
    } else if (dateFilterType === 'custom') {
      if (customRange.startDate && customRange.startDate === customRange.endDate) {
        fetchRooms(customRange.startDate);
      } else {
        fetchRooms(); // fetch all and filter client-side for range
      }
    } else {
      fetchRooms();
    }
  }, [dateFilterType, customRange, fetchRooms]);

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
          type="button"
          onClick={() => setIsPopoverOpen(!isPopoverOpen)}
          className={styles.moreBtn}
          aria-label="대화 옵션 더보기"
          title="대화 옵션 더보기"
        >
          <MoreIcon size={18} />
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

  const [roomCurrentMatch, setRoomCurrentMatch] = useState(0);

  const filteredRooms = React.useMemo(() => {
    let result = [...rooms];

    // Sort by newest/latest message time first (descending)
    result.sort((a, b) => {
      const timeA = a.lastMessageAt ? new Date(a.lastMessageAt.replace(' ', 'T')).getTime() : 0;
      const timeB = b.lastMessageAt ? new Date(b.lastMessageAt.replace(' ', 'T')).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      return String(a.roomNo).localeCompare(String(b.roomNo));
    });

    if (dateFilterType !== 'all') {
      const getLocalYMD = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr.replace(' ', 'T'));
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const todayYMD = getTodayYMD();
      const yestYMD = getYesterdayYMD();

      result = result.filter(room => {
        const roomYMD = getLocalYMD(room.lastMessageAt || '');
        if (!roomYMD) return true;

        if (dateFilterType === 'today') return roomYMD === todayYMD;
        if (dateFilterType === 'yesterday') return roomYMD === yestYMD;
        if (dateFilterType === 'custom') {
          const { startDate, endDate } = customRange;
          if (startDate && endDate) return roomYMD >= startDate && roomYMD <= endDate;
          if (startDate) return roomYMD >= startDate;
          if (endDate) return roomYMD <= endDate;
        }
        return true;
      });
    }

    if (!roomSearchValue) return result;
    const query = roomSearchValue.toLowerCase();
    return result.filter(room => 
      room.roomNo.toLowerCase().includes(query) ||
      (room.lastMessage && room.lastMessage.toLowerCase().includes(query))
    );
  }, [rooms, roomSearchValue, dateFilterType, customRange]);

  const scrollToRoomMatch = (index: number) => {
    const target = filteredRooms[index];
    if (target) {
      setTimeout(() => {
        const el = document.getElementById(`room-card-${target.roomNo}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    }
  };

  React.useEffect(() => {
    if (filteredRooms.length > 0 && roomCurrentMatch >= filteredRooms.length) {
      setRoomCurrentMatch(filteredRooms.length - 1);
    }
  }, [filteredRooms, roomCurrentMatch]);

  return (
    <div className={styles.container}>
      {/* Content Section (Split Layout) */}
      <div className={styles.splitLayout}>
        {/* Left Pane: Room List */}
        <div className={`${styles.leftPane} ${mobileView !== 'list' ? styles.mobileHidden : ''}`}>
          <div className={styles.leftPaneContent}>
            {/* Room Search Bar & Date Filter */}
            <div style={{ display: 'flex', gap: 'var(--space-8)', marginBottom: 'var(--space-16)', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SmartSearchBar
                  inputWrapperStyle={{ flex: 1 }}
                  value={roomSearchValue}
                  onChange={(val) => {
                    setRoomSearchValue(val);
                    setRoomCurrentMatch(0);
                  }}
                  currentMatch={roomCurrentMatch}
                  totalMatches={filteredRooms.length}
                  onPrev={() => {
                    const newIndex = Math.max(0, roomCurrentMatch - 1);
                    setRoomCurrentMatch(newIndex);
                    scrollToRoomMatch(newIndex);
                  }}
                  onNext={() => {
                    const newIndex = Math.min(filteredRooms.length - 1, roomCurrentMatch + 1);
                    setRoomCurrentMatch(newIndex);
                    scrollToRoomMatch(newIndex);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filteredRooms.length > 0) {
                        const nextIndex = (roomCurrentMatch + 1) % filteredRooms.length;
                        setRoomCurrentMatch(nextIndex);
                        scrollToRoomMatch(nextIndex);
                      }
                    }
                  }}
                />
              </div>
              <DateFilterDropdown
                filterType={dateFilterType}
                customRange={customRange}
                onChange={(type, range) => {
                  setDateFilterType(type);
                  if (range) setCustomRange(range);
                }}
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
                {filteredRooms.map(room => {
                  const rawMsg = room.lastMessage || '';
                  const isSys = rawMsg.startsWith('[FORWARD_') || rawMsg.startsWith('[SYSTEM') || rawMsg.startsWith('[INFO_') || rawMsg.startsWith('[PII_');
                  const cleanPreview = (!isSys && rawMsg) ? rawMsg : (t.frontdeskPage.chatHistory?.emptyMessage || (language === 'en' ? 'No messages' : '메시지 없음'));

                  return (
                    <div key={room.roomNo} id={`room-card-${room.roomNo}`}>
                      <RequestCard
                        roomNumber={room.roomNo}
                        title={cleanPreview}
                        titleWeight="regular"
                        createdAt={room.lastMessageAt || ''}
                        isSelected={selectedRoom === room.roomNo}
                        isActiveMatch={roomSearchValue ? filteredRooms[roomCurrentMatch]?.roomNo === room.roomNo : false}
                        highlightSearch={roomSearchValue}
                        onCardClick={() => {
                          selectRoom(room.roomNo);
                          setRoomSearchValue('');
                          setMobileView('chat');
                        }}
                      />
                    </div>
                  );
                })}
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
              summary=""
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
