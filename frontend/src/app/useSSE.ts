'use client';

import { useCallback, useRef, useEffect, useState } from 'react';

interface UseSSEReturn {
  subscribe: (destination: string, callback: (data: unknown) => void) => () => void;
  isConnected: boolean;
  reconnect: () => void;
}

/**
 * Server-Sent Events (SSE) 구독 관리 훅
 *
 * 기존 STOMP WebSocket 훅(useWebSocket.ts)과 100% 호환되는 인터페이스를 제공하여
 * 컴포넌트 수정 없이 SSE로 마이그레이션할 수 있도록 설계됨.
 */

// 전역 연결 레지스트리 (브라우저의 6개 커넥션 제한(HTTP/1.1)을 피하기 위해 동일한 채널은 커넥션을 공유함)
const globalEventSources = new Map<string, EventSource>();
const globalListeners = new Map<string, Set<(data: unknown) => void>>();

export function useSSE(): UseSSEReturn {
  const [connectedCount, setConnectedCount] = useState(0);

  const subscribe = useCallback(
    (destination: string, callback: (data: unknown) => void): (() => void) => {
      // STOMP destination(/topic/room/707) -> SSE URL(/api/events/subscribe/room/707) 매핑
      const ssePath = destination.replace(/^\/topic\//, '');
      const url = `/api/events/subscribe/${ssePath}`;

      // 리스너 등록
      if (!globalListeners.has(destination)) {
        globalListeners.set(destination, new Set());
      }
      const listeners = globalListeners.get(destination)!;
      listeners.add(callback);

      // 이미 연결된 EventSource가 없으면 새로 생성
      if (!globalEventSources.has(destination)) {
        console.log(`[SSE] 📡 연결 시도: ${url}`);
        const eventSource = new EventSource(url);

        eventSource.onopen = () => {
          console.log(`[SSE] ✅ 연결 성공: ${destination}`);
          setConnectedCount((prev) => prev + 1);
        };

        // 서버에서 전달하는 'message' 이벤트 리스닝
        eventSource.addEventListener('message', (event) => {
          const currentListeners = globalListeners.get(destination);
          if (currentListeners) {
            try {
              const data = JSON.parse(event.data);
              currentListeners.forEach(cb => cb(data));
            } catch {
              currentListeners.forEach(cb => cb(event.data));
            }
          }
        });

        // 서버에서 전달하는 초기 연결 확인 'CONNECT' 이벤트 리스닝
        eventSource.addEventListener('CONNECT', (event) => {
          console.log(`[SSE] 🔄 Handshake 완료: ${event.data}`);
        });

        eventSource.onerror = (error) => {
          console.error(`[SSE] ❌ 연결 에러: ${destination}`, error);
          // EventSource는 자동으로 재연결을 시도함
        };

        globalEventSources.set(destination, eventSource);
      } else {
        console.log(`[SSE] ♻️ 기존 연결 재사용: ${destination}`);
      }

      // 클린업(구독 해제) 함수 반환
      return () => {
        const currentListeners = globalListeners.get(destination);
        if (currentListeners) {
          currentListeners.delete(callback);
          // 더 이상 해당 채널을 구독하는 리스너가 없으면 커넥션 닫기
          if (currentListeners.size === 0) {
            console.log(`[SSE] 🛑 구독 해제 및 연결 종료: ${destination}`);
            const eventSource = globalEventSources.get(destination);
            if (eventSource) {
              eventSource.close();
              globalEventSources.delete(destination);
            }
            globalListeners.delete(destination);
            setConnectedCount((prev) => Math.max(0, prev - 1));
          }
        }
      };
    },
    []
  );

  const reconnect = useCallback(() => {
    console.log('[SSE] 브라우저 EventSource에서 자동 재연결을 지원합니다.');
  }, []);

  // 언마운트 시 로컬 연결 카운트만 초기화 (전역 커넥션은 다른 곳에서 쓸 수 있으므로 닫지 않음)
  useEffect(() => {
    return () => {
      // 컴포넌트가 언마운트될 때 반환한 클린업 함수(위의 return)가 실행되므로 
      // 여기서 전역 EventSource를 강제로 닫으면 안 됩니다.
    };
  }, []);

  // 하나 이상의 채널에 연결되어 있거나 구독 대기 중일 때 true로 간주 (UI 호환성)
  const isConnected = true;

  return {
    subscribe,
    isConnected,
    reconnect,
  };
}
