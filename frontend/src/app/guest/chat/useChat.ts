import { useState, useEffect, useRef } from 'react';
import { useSSE } from '@/app/useSSE';
import { ChatMessage } from './_components/ChatScreen';
import { useTranslation } from '@/app/useTranslation';
import { useUiStore } from '@/stores/useUiStore';

interface BackendMessage {
  id: number;
  senderType: 'GUEST' | 'AI' | 'STAFF';
  content: string;
  translatedContent: string | null;
  createdAt: string;
}

export interface ActiveRequest {
  requestId: number;
  domainCode: string;
  summary: string;
  status: string;
  entities?: Record<string, unknown>;
  progress: number;
}

export function useChat() {
  const { t } = useTranslation();
  const setLanguage = useUiStore((state) => state.setLanguage);
  const setChatLanguage = useUiStore((state) => state.setChatLanguage);

  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'welcome-1',
    variant: 'received',
    type: 'WELCOME',
    content: t.guestChat.welcomeMessage,
    meta: { options: (t.guestChat as any).quickReplyOptions }
  }]);
  const [isTyping, setIsTyping] = useState(false);
  const [isStaffTyping, setIsStaffTyping] = useState(false);
  const [roomNo, setRoomNo] = useState<string | null>(null);
  const [activeRequests, setActiveRequests] = useState<ActiveRequest[]>([]);
  const { subscribe } = useSSE();
  const abortControllerRef = useRef<AbortController | null>(null);

  // 연속된 시스템 메시지 방지 및 통합용 Ref
  const cancelEventsBatch = useRef<Set<'SUCCESS' | 'PENDING' | 'STAFF_SUCCESS' | 'GUEST_CANCEL_APPROVED'>>(new Set());
  const cancelBatchTimer = useRef<NodeJS.Timeout | null>(null);

  // 현재 투숙객 세션의 requestId 목록을 관리 (이전 투숙객의 잔여 이벤트 무시용)
  const knownRequestIds = useRef<Set<number>>(new Set());

  // [AN-358] FRONT 상담 완료 배치 처리 (프론트 연결 요청 N건 → 상담 완료 카드 1개)
  const frontCompletedBatch = useRef<{ requestId: number; summary: string; domainCode: string } | null>(null);
  const frontCompletedTimer = useRef<NodeJS.Timeout | null>(null);

  // Update welcome message if language changes and it is the only message
  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === 'welcome-1') {
        return [{
          id: 'welcome-1',
          variant: 'received',
          type: 'WELCOME',
          content: t.guestChat.welcomeMessage,
          meta: { options: (t.guestChat as any).quickReplyOptions }
        }];
      }
      return prev;
    });
  }, [t.guestChat.welcomeMessage, (t.guestChat as any).quickReplyOptions]);

  // 0. 세션 정보 가져오기
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          const data = await response.json();
          if (data.roomNo) {
            setRoomNo(data.roomNo);
          }
        }
      } catch (error) {
        console.error('Failed to fetch session:', error);
      }
    };
    fetchSession();
  }, []);

  // 최신 번역 객체를 Ref에 저장하여 WebSocket 콜백(stale closure)에서도 최신 언어를 참조할 수 있도록 함
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // AI 특수 코드 매핑 함수 (다국어 언어팩 연동, 환각 방어)
  const translateContent = (content: string) => {
    if (!content) return content;
    const currentT = tRef.current;
    let newContent = content;
    if (newContent.includes('[FORWARD_FB]')) newContent = newContent.replace('[FORWARD_FB]', currentT.aiReplies?.forwardFb || '');
    if (newContent.includes('[FORWARD_HK]')) newContent = newContent.replace('[FORWARD_HK]', currentT.aiReplies?.forwardHk || '');
    if (newContent.includes('[FORWARD_FACILITY]')) newContent = newContent.replace('[FORWARD_FACILITY]', currentT.aiReplies?.forwardFacility || '');
    if (newContent.includes('[FORWARD_CONCIERGE]')) newContent = newContent.replace('[FORWARD_CONCIERGE]', (currentT.aiReplies as any)?.forwardConcierge || '');
    if (newContent.includes('[FORWARD_FRONT]')) newContent = newContent.replace('[FORWARD_FRONT]', currentT.aiReplies?.forwardFront || '');
    if (newContent.includes('[INFO_NOT_FOUND]')) newContent = newContent.replace('[INFO_NOT_FOUND]', currentT.aiReplies?.infoNotFound || '');
    if (newContent.includes('[PII_GUARD]')) newContent = newContent.replace('[PII_GUARD]', currentT.aiReplies?.piiGuard || '');
    return newContent;
  };

  // 1. 대화 내역 + 요청 카드 복원 + 상태바 복원
  useEffect(() => {
    if (!roomNo) return;

    const loadChatAndRequests = async () => {
      try {
        const [msgResponse, reqResponse] = await Promise.all([
          fetch(`/api/chat/${roomNo}/messages`),
          fetch(`/api/chat/${roomNo}/requests`),
        ]);

        // 채팅 메시지 처리
        const msgData: BackendMessage[] = msgResponse.ok ? await msgResponse.json() : [];
        const reqData: any[] = reqResponse.ok ? await reqResponse.json() : [];

        if (msgData.length === 0 && reqData.length === 0) {
          setMessages([{
            id: 'welcome-1',
            variant: 'received',
            type: 'WELCOME',
            content: t.guestChat.welcomeMessage,
            meta: { options: (t.guestChat as any).quickReplyOptions }
          }]);
          return;
        }

        // 텍스트 메시지 변환
        const chatMessages: (ChatMessage & { _ts: number })[] = msgData.map(msg => {
          let displayContent = msg.content;
          let isMenuCard = false;
          if (msg.senderType === 'AI') {
            displayContent = translateContent(msg.content);
            if (
              displayContent.includes('[MENU_CARD]') ||
              displayContent.includes('current room service menu') ||
              displayContent.includes('룸서비스 메뉴를 안내') ||
              displayContent.includes('룸서비스 메뉴입니다') ||
              displayContent.includes('Here is our current menu') ||
              displayContent.includes('ルームサービスのメニューをご案内') ||
              displayContent.includes('为您提供客房送餐菜单')
            ) {
              isMenuCard = true;
              displayContent = displayContent.replace(/\[MENU_CARD\]/g, '').trim();
            }
          } else if (msg.senderType === 'STAFF' && msg.translatedContent) {
            // 직원 메시지: 고객 언어로 번역된 내용 표시 (새로고침 시에도 번역본 유지)
            displayContent = msg.translatedContent;
          }
          return {
            id: msg.id.toString(),
            variant: msg.senderType === 'GUEST' ? 'sent' as const : 'received' as const,
            content: displayContent,
            type: isMenuCard ? ('MENU_CARD' as const) : (msg.senderType === 'STAFF' ? 'FALLBACK' as const : 'TEXT' as const),
            _ts: new Date(msg.createdAt).getTime(),
          };
        });

        // 요청 카드 변환 (시간순 삽입을 위해 _ts 포함)
        const progressMap: Record<string, number> = {
          'CREATED': 5, 'PENDING': 10, 'ESCALATED': 10, 'ASSIGNED': 50, 'IN_PROGRESS': 50, 'COMPLETED': 100, 'CANCELLED': 0
        };

        // FRONT 도메인 상담 완료 카드는 세션당 최신 1개만 생성 (여러 건의 프론트 연결이 묶여 완료되어도 종료 카드는 1개)
        let latestFrontCompleted: any = null;

        const requestCards: (ChatMessage & { _ts: number })[] = [];

        reqData.forEach((r: any) => {
          // 1. 요청 생성 시점에 생성된 RequestCard는 불변 운영 기록으로 항상 보존
          requestCards.push({
            id: `request-${r.id}`,
            variant: 'received',
            type: 'REQUEST_CARD',
            content: '',
            meta: {
              requestId: r.id,
              domainCode: r.domainCode || 'UNKNOWN',
              summary: r.summary,
              status: r.status,
              entities: r.entities,
              progress: progressMap[r.status] || 0,
              graceRemaining: 0,
              priority: r.priority || 'NORMAL',
              createdAt: r.createdAt,
              cancelReason: r.cancelReason,
              cancelledAt: r.status === 'CANCELLED' ? (r.updatedAt || r.createdAt) : undefined,
            },
            _ts: new Date(r.createdAt).getTime(),
          });

          // 2. 만약 COMPLETED 상태라면 피드백 카드 복원
          if (r.status === 'COMPLETED') {
            if (r.domainCode === 'FRONT') {
              // FRONT 상담은 가장 최신 완료건 1개만 기록해두고 나중에 1장만 추가
              if (!latestFrontCompleted || new Date(r.updatedAt || r.createdAt).getTime() >= new Date(latestFrontCompleted.updatedAt || latestFrontCompleted.createdAt).getTime()) {
                latestFrontCompleted = r;
              }
            } else {
              // 기타 일반 서비스 요청(HK, FB 등)은 요청별 개별 완료 카드 복원
              requestCards.push({
                id: `system-feedback-${r.id}`,
                variant: 'received',
                type: 'FEEDBACK',
                content: '',
                meta: {
                  requestId: r.id,
                  summary: r.summary || '',
                  domainCode: r.domainCode || '',
                  completedAt: r.updatedAt || r.createdAt,
                },
                _ts: new Date(r.updatedAt || r.createdAt).getTime(),
              });
            }
          }
        });

        // 최신 FRONT 상담 완료 카드가 있으면 1개만 추가
        if (latestFrontCompleted) {
          requestCards.push({
            id: `system-chatend-${latestFrontCompleted.id}`,
            variant: 'received',
            type: 'CHAT_END',
            content: '',
            meta: {
              requestId: latestFrontCompleted.id,
              summary: latestFrontCompleted.summary || '',
              domainCode: 'FRONT',
              completedAt: latestFrontCompleted.updatedAt || latestFrontCompleted.createdAt,
            },
            _ts: new Date(latestFrontCompleted.updatedAt || latestFrontCompleted.createdAt).getTime(),
          });
        }

        // 시간순 정렬 후 _ts 제거
        const merged = [...chatMessages, ...requestCards]
          .sort((a, b) => a._ts - b._ts)
          .map(({ _ts, ...msg }) => msg as ChatMessage);

        setMessages(merged);

        // 상태바 복원 (진행 중인 요청만)
        const active: ActiveRequest[] = reqData
          .filter((r: any) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED')
          // [Fix] CREATED 상태이면서 고객 확인 대기 중인 주문(FB/CONCIERGE 또는 유료 결제 HK)은 상태바에 표시하지 않음
          .filter((r: any) => !(r.status === 'CREATED' && (
            ['FB', 'CONCIERGE'].includes(r.domainCode || '') || 
            (r.domainCode === 'HK' && r.entities?.requires_payment_confirmation === true)
          )))
          .map((r: any) => ({
            requestId: r.id,
            domainCode: r.domainCode || 'UNKNOWN',
            summary: r.summary,
            status: r.status,
            entities: r.entities,
            progress: progressMap[r.status] || 0,
          }));

        if (active.length > 0) {
          setActiveRequests(active);
        }

        // 현재 세션의 모든 requestId를 knownRequestIds에 등록
        reqData.forEach((r: any) => knownRequestIds.current.add(r.id));
      } catch (error) {
        console.error('Error loading chat and requests:', error);
      }
    };

    loadChatAndRequests();
  }, [roomNo]);

  // 2. WebSocket 연결
  useEffect(() => {
    if (!roomNo) return;

    const unsubscribe = subscribe(`/topic/room/${roomNo}`, (payload: any) => {
      console.log('[SSE-RECEIVE]', payload);

      // 체크아웃에 의한 세션 만료 감지 → 즉시 로그아웃
      if (payload.type === 'SESSION_EXPIRED') {
        // BFF 세션 쿠키 파기
        fetch('/api/auth/session', { method: 'DELETE' }).catch(() => { });
        window.location.href = '/login?error=CHECKED_OUT';
        return;
      }

      if (payload.type === 'AI_PROGRESS') {
        setMessages(prev => {
          const existing = prev.find(m => m.id === 'ai-progress');
          if (existing) {
            // 기존 메시지의 meta만 업데이트 (컴포넌트 재마운트 방지 → 애니메이션 끊김 방지)
            return prev.map(m => m.id === 'ai-progress'
              ? { ...m, meta: { domains: payload.domains } }
              : m
            );
          }
          return [...prev, {
            id: 'ai-progress',
            variant: 'received',
            type: 'AI_PROGRESS',
            content: '',
            meta: { domains: payload.domains }
          }];
        });
        return;
      }

      if (payload.type === 'AI_RESPONSE' || payload.type === 'AI_ERROR' || payload.type === 'AI_SKIPPED') {
        setIsTyping(false);

        if (payload.type === 'AI_SKIPPED') {
          // AI_PROGRESS 메시지 제거
          setMessages(prev => prev.filter(m => m.type !== 'AI_PROGRESS'));
          return; // 직원이 채팅 중인 상태이므로 AI 응답 카드를 그리지 않음 (직원이 메시지를 보냄)
        }

        // 진행 상태 메시지 제거
        setMessages(prev => {
          const filtered = prev.filter(m => m.type !== 'AI_PROGRESS');

          // 취소 관련 AI 응답은 backend (analyze.py)에서 전송한 content를 그대로 사용합니다.
          let content = payload.content;

          // AI 특수 코드 매핑 (다국어 언어팩 연동, AI 할루시네이션 대비 includes 사용)
          content = translateContent(content);

          const isMenuInquiry =
            payload.uiType === 'MENU_CARD' ||
            payload.meta?.ui_type === 'MENU_CARD' ||
            payload.meta?.intent === 'MENU_INQUIRY' ||
            payload.meta?.entities?.intent === 'MENU_INQUIRY' ||
            (content && content.includes('[MENU_CARD]')) ||
            (content && (
              content.includes('current room service menu') ||
              content.includes('룸서비스 메뉴를 안내') ||
              content.includes('룸서비스 메뉴입니다') ||
              content.includes('Here is our current menu') ||
              content.includes('ルームサービスのメニューをご案内') ||
              content.includes('为您提供客房送餐菜单')
            ));

          if (isMenuInquiry && content) {
            content = content.replace(/\[MENU_CARD\]/g, '').trim();
          }

          const msgType = isMenuInquiry
            ? 'MENU_CARD'
            : (payload.uiType ? payload.uiType : (payload.options && payload.options.length > 0 ? 'QUICK_REPLY' : 'TEXT'));
          const msgsToAppend: ChatMessage[] = [];

          if (msgType === 'REQUEST_CARD') {
            if (payload.meta?.requestId) {
              knownRequestIds.current.add(payload.meta.requestId);
            }
            if (content && content.trim() !== '') {
              msgsToAppend.push({
                id: payload.messageId ? `${payload.messageId}-text` : `text-${Date.now()}`,
                variant: 'received',
                content,
                type: 'TEXT',
                meta: { ...(payload.meta || {}), options: undefined },
              });
            }
            msgsToAppend.push({
              id: payload.messageId ? payload.messageId.toString() : Date.now().toString(),
              variant: 'received',
              content: '', // Extract content to TEXT message
              type: 'REQUEST_CARD',
              meta: { ...(payload.meta || {}), options: payload.options },
            });
          } else {
            if (payload.meta?.requestId) {
              knownRequestIds.current.add(payload.meta.requestId);
            }
            msgsToAppend.push({
              id: payload.messageId ? payload.messageId.toString() : Date.now().toString(),
              variant: 'received',
              content,
              type: msgType,
              meta: { ...(payload.meta || {}), options: payload.options },
            });
          }
          
          return [...filtered, ...msgsToAppend];
        });
      } else if (payload.type === 'STAFF_TYPING') {
        // 직원이 메시지 작성 중 → 타이핑 인디케이터 표시
        setIsStaffTyping(true);
      } else if (payload.type === 'STAFF_MESSAGE') {
        // 프론트데스크 직원이 보낸 메시지 → 고객 화면에 AI 채팅 버블 스타일로 실시간 표시
        setIsStaffTyping(false);

        // [AN-337] 시스템 마커 메시지 필터링 (화면에 표시하지 않음)
        const contentStr = payload.content as string;
        if (contentStr && contentStr.startsWith('[SYSTEM]')) {
          return;
        }

        const staffMsgId = payload.messageId ? payload.messageId.toString() : Date.now().toString();
        setMessages(prev => {
          // 중복 방지
          if (prev.some(m => m.id === staffMsgId)) return prev;

          // FRONT RequestCard는 유지 (삭제하지 않음)
          return [...prev, {
            id: staffMsgId,
            variant: 'received',
            content: payload.content,
            type: 'FALLBACK',
          }];
        });
      } else if (['NEW_REQUEST', 'STATUS_CHANGED', 'CANCEL_APPROVED', 'CANCEL_REJECTED', 'CANCEL_REQUEST_RECEIVED'].includes(payload.type)) {
        if (payload.requestId) {
          knownRequestIds.current.add(payload.requestId);
        }

        const progressMap: Record<string, number> = {
          'CREATED': 5, 'PENDING': 10, 'ESCALATED': 10, 'ASSIGNED': 50, 'IN_PROGRESS': 50, 'COMPLETED': 100, 'CANCELLED': 0
        };
        const isCancelled = payload.status === 'CANCELLED';
        const isCancelPending = payload.type === 'CANCEL_REQUEST_RECEIVED';

        // Set Active Requests for Status Bar
        setActiveRequests(prev => {
          const filtered = prev.filter(r => r.requestId !== payload.requestId);

          // CANCELLED → 즉시 제거
          if (payload.status === 'CANCELLED') return filtered;

          // [Fix] CREATED 상태이면서 고객 확인 대기 중인 주문(FB/CONCIERGE)은 상태바에 표시하지 않음
          if (payload.status === 'CREATED' && payload.graceRemaining === -1) {
            return filtered;
          }

          // COMPLETED → 상태바에 유지 (RequestStatusBar 내부 3초 타이머로 fade-out)
          // 이후 3.5초 뒤에 배열에서도 제거
          return [...filtered, {
            requestId: payload.requestId,
            domainCode: payload.domainCode || 'UNKNOWN',
            summary: payload.summary,
            status: isCancelPending ? 'CANCEL_PENDING' : payload.status,
            entities: payload.entities,
            progress: progressMap[payload.status] || 0
          }];
        });

        // COMPLETED 3.5초 후 activeRequests에서 완전 제거 (RequestStatusBar 3초 fade-out 보장)
        if (payload.status === 'COMPLETED') {
          setTimeout(() => {
            setActiveRequests(prev => prev.filter(r => r.requestId !== payload.requestId));
          }, 3500);
        }

        // Add/Update Request Card in Chat Stream
        const requestMsg: ChatMessage = {
          id: `request-${payload.requestId}`,
          variant: 'received',
          type: 'REQUEST_CARD',
          content: '', // No text content needed, UI is rendered via RequestCard
          meta: {
            requestId: payload.requestId,
            domainCode: payload.domainCode || 'UNKNOWN',
            summary: payload.summary,
            status: payload.status,
            entities: payload.entities,
            progress: progressMap[payload.status] || 0,
            graceRemaining: payload.graceRemaining || 0,
            priority: payload.priority || 'NORMAL',
            cancelPending: isCancelPending,
            cancelReason: payload.cancelReason,
            cancelledAt: payload.status === 'CANCELLED' ? new Date().toISOString() : undefined,
            createdAt: payload.createdAt || new Date().toISOString()
          }
        };

        // COMPLETED는 ChatEndCard(FEEDBACK)로 처리
        if (payload.status !== 'COMPLETED') {
          // FRONT/EMERGENCY 도메인 카드는 제자리에서 상태만 업데이트 (제거/재생성 방지)
          const isInPlaceDomain = payload.domainCode === 'FRONT' || payload.domainCode === 'EMERGENCY';

          setMessages(prev => {
            const existingIdx = prev.findIndex(m => m.id === `request-${payload.requestId}` || m.meta?.requestId === payload.requestId);
            const existingMeta = existingIdx >= 0 ? (prev[existingIdx].meta || {}) : {};
            const existingGrace = existingMeta.graceRemaining || 0;

            if (isInPlaceDomain && existingIdx >= 0) {
              // FRONT/EMERGENCY: 제자리에서 상태만 업데이트 (카드 위치/보더 유지)
              const updated = [...prev];
              updated[existingIdx] = {
                ...updated[existingIdx],
                meta: {
                  ...updated[existingIdx].meta,
                  status: payload.status,
                  graceRemaining: 0,
                }
              };
              return updated;
            }

            // 부서가 변경된 경우: 기존 카드는 유지하고 새 카드를 하단에 추가
            const existingDomain = existingMeta.domainCode;
            const isDeptChanged = existingIdx >= 0 && existingDomain && existingDomain !== payload.domainCode;

            if (isDeptChanged) {
              // 기존 FRONT 카드는 그대로 두고, 새 부서 카드를 하단에 추가
              return [...prev, {
                ...requestMsg,
                id: `request-${payload.requestId}-${Date.now()}`,
                meta: {
                  ...requestMsg.meta,
                  createdAt: new Date().toISOString(),
                  graceRemaining: 0
                }
              }];
            }

            // [불변 채팅 기록] 취소 대기(Cancel Pending): 원래 카드는 버튼만 숨기고, 새 카드를 하단에 추가
            if (isCancelPending && existingIdx >= 0) {
              const updated = [...prev];
              updated[existingIdx] = {
                ...updated[existingIdx],
                meta: {
                  ...updated[existingIdx].meta,
                  graceRemaining: 0
                }
              };
              return [...updated, {
                ...requestMsg,
                id: `request-${payload.requestId}-cancelpending-${Date.now()}`,
                meta: {
                  ...requestMsg.meta,
                  cancelPending: true,
                  entities: payload.entities || existingMeta.entities,
                  priority: payload.priority || existingMeta.priority,
                  cancelReason: payload.cancelReason || existingMeta.cancelReason,
                  createdAt: existingMeta.createdAt || payload.createdAt || new Date().toISOString(),
                  graceRemaining: 0
                }
              }];
            }

            // [불변 채팅 기록] 취소 완료(CANCELLED): 원래 카드 불변 유지, 새 취소 카드를 하단에 추가
            if (payload.status === 'CANCELLED' && existingIdx >= 0) {
              const updated = [...prev];
              // 원래 카드: 버튼만 숨기고 나머지 전부 그대로 유지
              updated[existingIdx] = {
                ...updated[existingIdx],
                meta: {
                  ...updated[existingIdx].meta,
                  graceRemaining: 0
                }
              };
              // 새 취소 카드: 하단에 추가
              return [...updated, {
                ...requestMsg,
                id: `request-${payload.requestId}-cancelled-${Date.now()}`,
                meta: {
                  ...requestMsg.meta,
                  status: 'CANCELLED',
                  entities: payload.entities || existingMeta.entities,
                  priority: payload.priority || existingMeta.priority,
                  cancelReason: payload.cancelReason || existingMeta.cancelReason,
                  cancelledAt: new Date().toISOString(),
                  createdAt: existingMeta.createdAt || payload.createdAt || new Date().toISOString(),
                  graceRemaining: 0
                }
              }];
            }

            // 기존 카드 중 텍스트(content)가 있는 카드의 텍스트 보존 (AI 응답 텍스트 증발 방지)
            const existingWithContent = [...prev].reverse().find(m => (m.meta?.requestId === payload.requestId || m.id === `request-${payload.requestId}`) && m.content);
            const preservedContent = existingWithContent ? existingWithContent.content : '';

            // 같은 도메인 내 상태 변경: 기존 카드 교체
            const filtered = prev.filter(m => m.meta?.requestId !== payload.requestId && m.id !== `request-${payload.requestId}`);

            return [...filtered, {
              ...requestMsg,
              content: preservedContent,
              id: `request-${payload.requestId}-${Date.now()}`,
              meta: {
                ...requestMsg.meta,
                entities: payload.entities || existingMeta.entities,
                priority: payload.priority || existingMeta.priority,
                cancelReason: payload.cancelReason || existingMeta.cancelReason,
                cancelledAt: payload.status === 'CANCELLED' ? (existingMeta.cancelledAt || new Date().toISOString()) : undefined,
                createdAt: existingMeta.createdAt || payload.createdAt || new Date().toISOString(),
                graceRemaining: payload.type === 'NEW_REQUEST' ? payload.graceRemaining : (payload.status === 'CANCELLED' ? 0 : existingGrace)
              }
            }];
          });
        } else {
          // COMPLETED: 도메인별 분기
          const isFrontConsultation = payload.domainCode === 'FRONT';

          if (isFrontConsultation) {
            // FRONT 상담 완료: 배치 debounce 처리
            // 프론트 연결 요청이 N건이어도 CHAT_END 카드는 1개만 생성
            frontCompletedBatch.current = {
              requestId: payload.requestId,
              summary: payload.summary || '',
              domainCode: payload.domainCode || '',
            };
            if (frontCompletedTimer.current) clearTimeout(frontCompletedTimer.current);
            frontCompletedTimer.current = setTimeout(() => {
              const batch = frontCompletedBatch.current;
              frontCompletedBatch.current = null;
              if (!batch) return;

              setMessages(prev => {
                const cardId = `system-chatend-${batch.requestId}`;
                if (prev.some(m => m.id === cardId)) return prev;
                return [...prev, {
                  id: cardId,
                  variant: 'received' as const,
                  type: 'CHAT_END' as any,
                  content: '',
                  meta: {
                    requestId: batch.requestId,
                    summary: batch.summary,
                    domainCode: batch.domainCode,
                    completedAt: new Date().toISOString(),
                  }
                }];
              });
            }, 300);
          } else {
            // 기타 도메인 (HK, FB 등): 요청별 개별 피드백 카드
            setMessages(prev => {
              const cardId = `system-feedback-${payload.requestId}`;
              if (prev.some(m => m.id === cardId)) return prev;

              return [...prev, {
                id: cardId,
                variant: 'received' as const,
                type: 'FEEDBACK' as any,
                content: '',
                meta: {
                  requestId: payload.requestId,
                  summary: payload.summary || '',
                  domainCode: payload.domainCode || '',
                  completedAt: new Date().toISOString(),
                }
              }];
            });
          }
        }

        // --- System messages for cancel flow ---
        let hasCancelEvent = false;
        if (payload.type === 'CANCEL_APPROVED' && payload.status === 'CANCELLED') {
          // 고객이 요청한 취소를 관리자가 승인한 경우
          cancelEventsBatch.current.add('GUEST_CANCEL_APPROVED');
          hasCancelEvent = true;
        } else if (payload.type === 'STATUS_CHANGED' && payload.status === 'CANCELLED') {
          if (payload.cancelReason === 'REPLACED') {
            // System auto-cancel due to replace, do not show system message
          } else if (payload.initiatedBy === 'STAFF') {
            // 관리자가 직접 강제 취소한 경우
            cancelEventsBatch.current.add('STAFF_SUCCESS');
            hasCancelEvent = true;
          } else {
            // 고객이 직접 취소한 경우 (PENDING 상태에서 즉시 취소)
            cancelEventsBatch.current.add('SUCCESS');
            hasCancelEvent = true;
          }
        }
        if (payload.type === 'CANCEL_REQUEST_RECEIVED') {
          cancelEventsBatch.current.add('PENDING');
          hasCancelEvent = true;
        }

        if (hasCancelEvent) {
          if (cancelBatchTimer.current) clearTimeout(cancelBatchTimer.current);

          cancelBatchTimer.current = setTimeout(() => {
            const hasSuccess = cancelEventsBatch.current.has('SUCCESS');
            const hasStaffSuccess = cancelEventsBatch.current.has('STAFF_SUCCESS');
            const hasGuestApproved = cancelEventsBatch.current.has('GUEST_CANCEL_APPROVED');
            const hasPending = cancelEventsBatch.current.has('PENDING');
            cancelEventsBatch.current.clear();

            setMessages(prev => {
              const msgId = `system-cancel-batch-${Date.now()}`;

              let content = '';
              if (hasStaffSuccess) {
                // 직원/관리자가 강제 취소한 경우 (AI_RESPONSE 없음 → 여기서 안내)
                content = '죄송합니다. 현재 해당 서비스 제공이 일시적으로 어려워 요청이 취소되었습니다. 도움이 필요하시면 프론트로 연락 부탁드립니다.';
              } else if (hasGuestApproved) {
                // 관리자가 고객 취소를 승인한 경우 (AI_RESPONSE 없음 → 여기서 안내)
                content = '요청하신 취소가 정상 처리되었습니다.';
              }
              // SUCCESS / PENDING 은 AI_RESPONSE 핸들러에서 이미 메시지를 표시하므로 생략

              if (!content) return prev;

              return [...prev, {
                id: msgId,
                variant: 'received',
                type: 'TEXT',
                content: content,
              }];
            });
          }, 600); // 모든 카드가 도착한 후 렌더링되게 보장
        }

        // CANCEL_REJECTED 처리: 제네릭 메시지 대신 관리자가 입력한 반려 사유가
        // STAFF_MESSAGE로 별도 전송되므로, 여기서는 시스템 메시지를 생략합니다.
        // (반려 사유가 없는 경우에만 기본 안내 표시)
        if (payload.type === 'CANCEL_REJECTED') {
          // 반려 사유(STAFF_MESSAGE)가 0.5초 내로 도착하지 않으면 기본 메시지 표시
          const rejectFallbackTimer = setTimeout(() => {
            setMessages(prev => {
              // 이미 STAFF_MESSAGE로 반려 사유가 도착했는지 확인
              const hasRejectReason = prev.some(m =>
                m.type === 'TEXT' && m.content?.includes('[취소 반려]')
                && prev.indexOf(m) > prev.length - 5 // 최근 5개 메시지 내
              );
              if (hasRejectReason) return prev;

              // 버그 수정: 타임스탬프를 추가하여 식별자 중복으로 인한 증발 현상 방지
              const msgId = `system-cancel-reject-${payload.requestId}-${Date.now()}`;
              if (prev.some(m => m.id === msgId)) return prev;
              return [...prev, {
                id: msgId,
                variant: 'received',
                type: 'TEXT',
                content: '안내: 요청하신 사항은 이미 진행 중이어서 취소가 어렵습니다. 추가적인 문의사항은 프론트로 연락 부탁드립니다.',
              }];
            });
          }, 800);
        }
      } else if (payload.type === 'GRACE_EXPIRED') {
        if (!knownRequestIds.current.has(payload.requestId)) return;

        // Hide the buttons on the specific card by forcing graceRemaining to 0
        setMessages(prev => {
          const existingIdx = prev.findIndex(m => m.id === `request-${payload.requestId}` || m.meta?.requestId === payload.requestId);
          if (existingIdx >= 0) {
            const updated = [...prev];
            updated[existingIdx] = {
              ...updated[existingIdx],
              meta: {
                ...updated[existingIdx].meta,
                graceRemaining: 0
              }
            };
            return updated;
          }
          return prev;
        });
      }
    });

    return () => unsubscribe();
  }, [roomNo, subscribe]);

  // 3. 메시지 전송
  const sendMessage = async (text: string, imageFile?: File) => {
    if (!roomNo) return;
    if (isTyping) return; // 이미 AI가 응답 중이면 새로운 요청 원천 차단

    // 언어 미러링: 고객 입력 언어를 감지하여 UI 테마 및 채팅 요약 타겟 언어 설정
    const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(text);
    const hasChinese = /[\u4E00-\u9FFF]/.test(text);
    const hasEnglish = /[a-zA-Z]/.test(text);

    const currentLanguage = useUiStore.getState().language;
    const currentChatLanguage = useUiStore.getState().chatLanguage;
    let detectedChatLang = currentLanguage; // Default to CURRENT language

    if (hasKorean) detectedChatLang = 'ko';
    else if (hasJapanese) detectedChatLang = 'ja';
    else if (hasChinese) detectedChatLang = 'zh';
    else if (hasEnglish) detectedChatLang = 'en';

    if (detectedChatLang !== currentLanguage) {
      setLanguage(detectedChatLang as any);
    }
    if (detectedChatLang !== currentChatLanguage) {
      setChatLanguage(detectedChatLang);
    }

    // 오프라인 상태일 경우 전송 시도 자체를 차단 (버퍼링 금지)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        variant: 'received',
        content: '현재 오프라인 상태입니다. 네트워크 연결을 확인한 후 다시 전송해 주세요.',
      };
      setMessages(prev => [...prev, errorMsg]);
      return;
    }

    let base64Image: string | undefined;
    if (imageFile) {
      base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });
    }

    const tempId = `temp-${Date.now()}`;
    const newUserMsg: ChatMessage = {
      id: tempId,
      variant: 'sent',
      content: text,
      imageUrl: base64Image
    };
    setMessages(prev => {
      const filtered = prev.filter(m => m.type !== 'WELCOME');
      return [...filtered, newUserMsg];
    });

    setIsTyping(true);

    abortControllerRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append('content', text);

      // 언어 정보 (감지된 채팅 언어) 전송
      formData.append('language', detectedChatLang);

      if (base64Image) {
        formData.append('images', base64Image);
      }

      const response = await fetch(`/api/chat/${roomNo}/messages`, {
        method: 'POST',
        // FormData를 보낼 때는 Content-Type을 수동으로 지정하지 않습니다.
        // (브라우저가 자동으로 multipart/form-data와 boundary를 설정함)
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        setIsTyping(false);
        const errorData = await response.json().catch(() => ({}));
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          variant: 'received',
          content: errorData.error || '메시지 전송에 실패했습니다. 다시 시도해 주세요.',
        };
        setMessages(prev => [...prev, errorMsg]);
        return;
      }

      const data = await response.json();
      setMessages(prev => prev.map(msg =>
        msg.id === tempId
          ? { ...msg, id: data.guestMessageId.toString(), content: data.maskedContent ?? msg.content }
          : msg
      ));

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Message generation stopped by user');
      } else {
        console.error('Error sending message:', error);
      }
      setIsTyping(false);
    }
  };

  const stopMessage = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsTyping(false);
  };

  // 4. Cancel Request Action
  const cancelRequest = async (requestId: number) => {
    if (!roomNo) return;
    try {
      const response = await fetch(`/api/chat/${roomNo}/requests/${requestId}/cancel`, {
        method: 'POST'
      });
      if (!response.ok) {
        console.error('Failed to cancel request');
      }
    } catch (error) {
      console.error('Error cancelling request:', error);
    }
  };

  // 5. Confirm Request Action
  const confirmRequest = async (requestId: number) => {
    if (!roomNo) return;
    try {
      const response = await fetch(`/api/chat/${roomNo}/requests/${requestId}/confirm`, {
        method: 'POST'
      });
      if (!response.ok) {
        console.error('Failed to confirm request');
      }
    } catch (error) {
      console.error('Error confirming request:', error);
    }
  };

  // 6. Rate Request Action (피드백 별점)
  const rateRequest = async (requestId: number, rating: number) => {
    if (!roomNo) return;
    try {
      const response = await fetch(`/api/chat/${roomNo}/requests/${requestId}/rating`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating })
      });
      if (!response.ok) {
        console.error('Failed to submit rating');
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
    }
  };

  // 7. Handle Pill Selection
  const handlePillSelect = (msgId: string, option: string) => {
    // [Contextual Pill Fix] Intercept cancellation option clicked in Pill
    const isCancelOption = /취소|cancel/i.test(option);
    if (isCancelOption && activeRequests.length > 0) {
      const parentMsg = messages.find(m => m.id === msgId);
      const parentMeta = parentMsg?.meta;

      let targetRequest: ActiveRequest | undefined;

      if (activeRequests.length === 1) {
        // Edge case: if there's only 1 active request, target it directly
        targetRequest = activeRequests[0];
      } else if (parentMeta) {
        const { domainCode, summary, targetKeyword } = parentMeta;
        
        // Try matching by targetKeyword/summary first, then by domainCode
        if (targetKeyword) {
          targetRequest = activeRequests.find(req => 
            req.summary.includes(targetKeyword) || 
            (req.entities && JSON.stringify(req.entities).includes(targetKeyword))
          );
        }
        
        if (!targetRequest && domainCode) {
          targetRequest = activeRequests.find(req => req.domainCode === domainCode);
        }
        
        if (!targetRequest && summary) {
          targetRequest = activeRequests.find(req => 
            req.summary.includes(summary) || summary.includes(req.summary)
          );
        }
      }

      if (targetRequest) {
        const tempId = `temp-${Date.now()}`;
        const newUserMsg: ChatMessage = {
          id: tempId,
          variant: 'sent',
          content: option,
        };
        setMessages(prev => {
          const filtered = prev.filter(m => m.type !== 'WELCOME');
          const updated = [...filtered, newUserMsg];
          return updated.map(m =>
            m.id === msgId
              ? { ...m, meta: { ...m.meta, selectedOption: option, pillDisabled: true } }
              : m
          );
        });

        cancelRequest(targetRequest.requestId);
        return;
      }
    }

    sendMessage(option);
    setMessages(prev => prev.map(m =>
      m.id === msgId
        ? { ...m, meta: { ...m.meta, selectedOption: option, pillDisabled: true } }
        : m
    ));
  };

  return {
    messages,
    isTyping,
    isStaffTyping,
    sendMessage,
    activeRequests,
    cancelRequest,
    confirmRequest,
    rateRequest,
    stopMessage,
    handlePillSelect
  };
}
