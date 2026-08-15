import { useState, useEffect, useCallback } from 'react';

interface ChatRoom {
  roomNo: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
}

interface ChatMessage {
  id: number;
  roomNo: string;
  senderType: string;
  content: string;
  createdAt: string;
}

export default function useChatHistory() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 객실 목록 가져오기
  const fetchRooms = useCallback(async (date?: string) => {
    try {
      setLoadingRooms(true);
      const url = date ? `/api/frontdesk/messages/rooms?date=${date}` : '/api/frontdesk/messages/rooms';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ChatRoom[] = await res.json();
      
      // 최신 대화 순으로 정렬
      const sorted = [...data].sort((a, b) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt.replace(' ', 'T')).getTime() : 0;
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt.replace(' ', 'T')).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return String(a.roomNo).localeCompare(String(b.roomNo));
      });
      
      setRooms(sorted);
      
      // 가장 최근 대화가 있는 객실 자동 선택
      setSelectedRoom(prev => {
        if (sorted.length > 0 && !prev) {
          return sorted[0].roomNo;
        } else if (sorted.length === 0) {
          return null;
        }
        return prev;
      });
    } catch (err: any) {
      setError(err.message || '객실 목록 로딩 실패');
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  }, []); // 의존성 배열 비우기 (무한 렌더링 방지)

  // 선택된 객실의 메시지 가져오기
  const fetchMessages = useCallback(async (roomNo: string) => {
    try {
      setLoadingMessages(true);
      const res = await fetch(`/api/frontdesk/messages/rooms/${roomNo}/messages`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ChatMessage[] = await res.json();
      setMessages(data);
    } catch (err: any) {
      setError(err.message || '메시지 로딩 실패');
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom);
    }
  }, [selectedRoom, fetchMessages]);

  const selectRoom = (roomNo: string) => {
    setSelectedRoom(roomNo);
  };

  const deleteRoom = async (roomNo: string) => {
    try {
      const res = await fetch(`/api/frontdesk/messages/rooms/${roomNo}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      // 삭제 후 방 목록 새로고침
      await fetchRooms();
      
      // 만약 삭제한 방이 현재 선택된 방이라면 선택 해제
      if (selectedRoom === roomNo) {
        setSelectedRoom(null);
        setMessages([]);
      }
    } catch (err: any) {
      setError(err.message || '채팅 내역 삭제 실패');
    }
  };

  return {
    rooms, messages, selectedRoom,
    loadingRooms, loadingMessages, error,
    selectRoom, fetchMessages, fetchRooms, deleteRoom
  };
}
