'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Tabs from '@/components/ui/Tab/Tabs';
import RequestCard from '@/components/ui/Card/RequestCard';
import Button from '@/components/ui/Button/Button';
import useFrontdeskRequests from '../useFrontdeskRequests';

import useEscalations from './useEscalations';
import CreateRequestModal from './_components/CreateRequestModal/CreateRequestModal';
import ApproveEscalationModal from './_components/ApproveEscalationModal/ApproveEscalationModal';
import RejectEscalationModal from './_components/RejectEscalationModal/RejectEscalationModal';
import ApproveCancellationModal from './_components/ApproveCancellationModal/ApproveCancellationModal';
import RejectCancellationModal from './_components/RejectCancellationModal/RejectCancellationModal';
import ChatPanel from './_components/ChatPanel/ChatPanel';
import RequestDetailPanel from './_components/RequestDetailPanel/RequestDetailPanel';
import RegisterTrainingModal from './_components/RegisterTrainingModal/RegisterTrainingModal';
import styles from './page.module.css';
import { useTranslation } from '@/app/useTranslation';
import { useUiStore } from '@/stores/useUiStore';
import { useSSE } from '@/app/useSSE';
import InputField from '@/components/ui/Inputfield/InputField';

export default function FrontDeskPage() {
  const [activeTab, setActiveTab] = useState('active');
  const [mobileView, setMobileView] = useState<'list' | 'chat' | 'detail'>('list');
  const [roomSearchValue, setRoomSearchValue] = useState('');
  const [chatSearchValue, setChatSearchValue] = useState('');
  const { requests, loading, error, refetch } = useFrontdeskRequests('FRONT');
  // 긴급대응(EMERGENCY) 부서 요청도 프론트 데스크에서 최우선으로 표시
  const { requests: emergencyRequests, loading: emergLoading, refetch: emergRefetch } = useFrontdeskRequests('EMERGENCY');
  // 취소 승인 대기: 모든 부서의 취소 요청을 프론트에서 대신 처리하기 위해 전체 조회
  const { requests: allRequests, loading: allLoading, refetch: allRefetch } = useFrontdeskRequests(undefined, '', 'all', true);

  // FRONT + EMERGENCY 요청 병합 (중복 제거)
  const mergedRequests = [...requests, ...emergencyRequests.filter(er => !requests.some(r => r.id === er.id))];

  // 우선순위 정렬 가중치: EMERGENCY > NORMAL
  const priorityWeight = (p: string) => p === 'EMERGENCY' ? 0 : 1;

  const sortByPriority = <T extends { priority: string; createdAt: string }>(list: T[]) =>
    list.sort((a, b) => {
      const pw = priorityWeight(a.priority) - priorityWeight(b.priority);
      if (pw !== 0) return pw;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const pending = sortByPriority(mergedRequests.filter(r => r.status === 'PENDING' || r.status === 'ESCALATED'));
  const inProgress = sortByPriority(mergedRequests.filter(r => (r.status === 'ASSIGNED' || r.status === 'IN_PROGRESS') && !r.cancelRequested));
  // 모든 부서의 취소 대기 건 (프론트 데스크가 대신 처리)
  const cancelPending = allRequests.filter(r => r.cancelRequested);
  const completed = sortByPriority(mergedRequests.filter(r => r.status === 'COMPLETED' || r.status === 'CANCELLED'));

  const { escalations } = useEscalations();
  const nonEmergencyEscalations = escalations.filter(r => r.priority !== 'EMERGENCY');
  const { t } = useTranslation();

  const { activeModal, closeModal } = useUiStore();
  // Chat Modal 상태
  const [activeChatRoom, setActiveChatRoom] = useState<{ roomNumber: string, requestIds: number[], representativeId: number, status: string, summary?: string, initialMessage?: string } | null>(null);
  // RAG 등록 플로우 진행 중 플래그 (자동 카드 선택 방지)
  const [isRagFlowActive, setIsRagFlowActive] = useState(false);
  // 승인/반려 모달 상태
  const [approveTarget, setApproveTarget] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);

  // 새 메시지 알림 (레드닷) 상태
  const [newMessageRoomNos, setNewMessageRoomNos] = useState<Set<string>>(new Set());
  const { subscribe } = useSSE();
  const activeChatRoomRef = useRef(activeChatRoom);
  useEffect(() => { activeChatRoomRef.current = activeChatRoom; }, [activeChatRoom]);

  // 각 방의 마지막 고객 메시지 및 마지막 메시지 시간
  const [lastGuestMessages, setLastGuestMessages] = useState<Record<string, string>>({});
  const [lastMessageTimes, setLastMessageTimes] = useState<Record<string, number>>({});
  const fetchedRoomsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const rooms = [...new Set(mergedRequests.map(r => String(r.roomNo)))];
    const newRooms = rooms.filter(r => !fetchedRoomsRef.current.has(r));
    if (newRooms.length === 0) return;

    newRooms.forEach(async (roomNo) => {
      fetchedRoomsRef.current.add(roomNo);
      try {
        const res = await fetch(`/api/frontdesk/messages/rooms/${roomNo}/messages`);
        if (!res.ok) return;
        const msgs = await res.json();
        const lastGuest = [...msgs].reverse().find((m: any) => m.senderType === 'GUEST');
        if (lastGuest) {
          setLastGuestMessages(prev => ({ ...prev, [roomNo]: lastGuest.content }));
        }
        if (msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1];
          setLastMessageTimes(prev => ({ ...prev, [roomNo]: new Date(lastMsg.createdAt).getTime() }));
        }
      } catch { /* ignore */ }
    });
  }, [mergedRequests]);

  // activeList의 최신 상태를 유지하기 위한 ref
  const activeListRef = useRef([...pending, ...inProgress]);
  useEffect(() => {
    activeListRef.current = [...pending, ...inProgress];
  }, [pending, inProgress]);

  // 활성 방들의 고객/AI 메시지 감지 (이제 각 방별로 구독하지 않고 frontdesk 채널 1개만 구독)
  useEffect(() => {
    const unsub = subscribe('/topic/frontdesk', (data: unknown) => {
      const payload = data as Record<string, unknown>;
      const type = payload.type as string;
      const roomNo = payload.roomNo as string;
      
      if ((type === 'GUEST_MESSAGE' || type === 'AI_RESPONSE' || type === 'STAFF_MESSAGE') && roomNo) {
        setLastMessageTimes(prev => ({ ...prev, [String(roomNo)]: Date.now() }));
      }

      // 고객/AI 메시지인 경우 레드닷 + 마지막 메시지 갱신
      if ((type === 'GUEST_MESSAGE' || type === 'AI_RESPONSE') && roomNo) {
        if (type === 'GUEST_MESSAGE' && payload.content) {
          setLastGuestMessages(prev => ({ ...prev, [String(roomNo)]: String(payload.content) }));
        }
        
        // 현재 열린 채팅방이면 레드닷 표시하지 않음
        if (activeChatRoomRef.current?.roomNumber === String(roomNo)) return;
        
        const relatedRequests = activeListRef.current.filter(r => String(r.roomNo) === String(roomNo));
        const hasInProgress = relatedRequests.some(r => r.status === 'IN_PROGRESS' || r.status === 'ASSIGNED');
        
        if (hasInProgress) {
          setNewMessageRoomNos(prev => {
            const next = new Set(prev);
            next.add(String(roomNo));
            return next;
          });
        }
      }
    });

    return () => {
      unsub();
    };
  }, [subscribe]);

  // 긴급(EMERGENCY) 요청 자동 선택 로직
  const seenEmergencyRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const emergencyReqs = [...pending, ...inProgress].filter(r => r.priority === 'EMERGENCY');
    let targetReq = null;

    for (const req of emergencyReqs) {
      if (!seenEmergencyRef.current.has(req.id)) {
        if (!targetReq) {
          targetReq = req;
        }
        seenEmergencyRef.current.add(req.id);
      }
    }

    if (targetReq) {
      setActiveTab('active');
      setActiveChatRoom({
        roomNumber: targetReq.roomNo,
        requestIds: [targetReq.id],
        representativeId: targetReq.id,
        status: targetReq.status,
        summary: targetReq.summary
      });
    }
  }, [pending, inProgress]);

  const mapStatusVariant = (status: string): 'red' | 'purple' | 'green' | 'gray' => {
    if (status === 'PENDING' || status === 'ESCALATED') return 'red';
    if (status === 'IN_PROGRESS') return 'green';
    if (status === 'COMPLETED' || status === 'CANCELLED') return 'gray';
    return 'gray';
  };

  const mapStatusText = (status: string): string => {
    if (status === 'PENDING') return t.frontdeskPage.frontDesk.status.pending;
    if (status === 'IN_PROGRESS') return t.frontdeskPage.frontDesk.status.inProgress;
    if (status === 'COMPLETED' || status === 'CANCELLED') return t.frontdeskPage.frontDesk.status.completed;
    if (status === 'ESCALATED') return t.frontdeskPage.frontDesk.status.escalated;
    return status;
  };


  const handleStatusChange = async (ids: number[], newStatus: string) => {
    try {
      // 서버 과부하 및 DB Lock 방지를 위해 묶음(배치) 순차 처리
      for (const id of ids) {
        await fetch(`/api/frontdesk/requests/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
      }
      if (refetch) refetch();
      if (emergRefetch) emergRefetch();
      if (allRefetch) allRefetch();
      if (activeChatRoom && ids.includes(activeChatRoom.representativeId)) {
        // COMPLETED일 때도 ChatPanel을 유지 (RAG 등록 모달 플로우를 위해)
        // ChatPanel의 onClose 콜백에서 setActiveChatRoom(null)이 호출됨
        setActiveChatRoom(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getGroupedRooms = () => {
    const activeList = [...pending, ...inProgress];
    const completedList = completed;
    const targetList = activeTab === 'active' ? activeList : completedList;

    const roomMap = new Map<string, typeof targetList>();
    for (const req of targetList) {
      const roomStr = String(req.roomNo);
      if (!roomMap.has(roomStr)) roomMap.set(roomStr, []);
      roomMap.get(roomStr)!.push(req);
    }

    const groupedRooms = Array.from(roomMap.entries()).map(([roomNo, reqs]) => {
      let highestPriority = 'NORMAL';
      if (reqs.some(r => r.priority === 'EMERGENCY')) highestPriority = 'EMERGENCY';
      else if (reqs.some(r => r.priority === 'URGENT')) highestPriority = 'URGENT';

      let repStatus = reqs[0].status;
      const hasPending = reqs.some(r => r.status === 'PENDING' || r.status === 'ESCALATED');
      const hasInProgress = reqs.some(r => r.status === 'IN_PROGRESS' || r.status === 'ASSIGNED');
      if (activeTab === 'active') {
        if (hasPending) repStatus = 'PENDING';
        else if (hasInProgress) repStatus = 'IN_PROGRESS';
      }

      const sortedReqs = [...reqs].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const latestSummary = sortedReqs[0].summary.replace(/^\[(?:프론트 연결|직원 인수인계)\]\s*/, '');
      const summaryText = reqs.length > 1 ? `${latestSummary} 외 ${reqs.length - 1}건` : latestSummary;

      return {
        roomNo,
        highestPriority,
        repStatus,
        summaryText,
        representativeId: sortedReqs[0].id,
        allIds: reqs.map(r => r.id),
        reqs: sortedReqs,
        createdAt: sortedReqs[0].createdAt,
        rawText: sortedReqs[0].rawText
      };
    });

    groupedRooms.sort((a, b) => {
      const pwA = priorityWeight(a.highestPriority);
      const pwB = priorityWeight(b.highestPriority);
      if (pwA !== pwB) return pwA - pwB; // 0 for EMERGENCY, 1 for URGENT, 2 for NORMAL

      const timeA = lastMessageTimes[a.roomNo] || new Date(a.createdAt).getTime();
      const timeB = lastMessageTimes[b.roomNo] || new Date(b.createdAt).getTime();
      return timeB - timeA;
    });

    if (roomSearchValue) {
      const query = roomSearchValue.toLowerCase();
      return groupedRooms.filter(room => 
        String(room.roomNo).toLowerCase().includes(query) || 
        room.summaryText.toLowerCase().includes(query) || 
        (room.rawText && room.rawText.toLowerCase().includes(query))
      );
    }

    return groupedRooms;
  };
  const groupedRooms = getGroupedRooms();

  useEffect(() => {
    // RAG 등록 플로우 진행 중에는 자동 카드 선택을 건너뜀 (모달이 닫힌 후 onClose에서 처리)
    if (isRagFlowActive) return;
    if (groupedRooms.length > 0) {
      const exists = activeChatRoom && groupedRooms.some(room => room.roomNo === activeChatRoom.roomNumber);
      if (!exists) {
        const room = groupedRooms[0];
        setActiveChatRoom({
          roomNumber: room.roomNo,
          requestIds: room.allIds,
          representativeId: room.representativeId,
          status: room.repStatus,
          summary: room.summaryText,
          initialMessage: room.rawText || room.summaryText
        });
        setDetailTarget(null);
      }
    } else if (activeChatRoom) {
      setActiveChatRoom(null);
    }
  }, [activeTab, pending, inProgress, completed, activeChatRoom, isRagFlowActive]);


  const handleCardClick = (requestId: number) => {
    setDetailTarget(requestId);
  };


  const [detailTarget, setDetailTarget] = useState<number | null>(null);
  const [cancelApproveTarget, setCancelApproveTarget] = useState<number | null>(null);
  const [cancelRejectTarget, setCancelRejectTarget] = useState<number | null>(null);
  const [trainingTarget, setTrainingTarget] = useState<any | null>(null);

  // Local state to track requests that have already been added to RAG (since there is no backend flag yet)
  const [registeredRagIds, setRegisteredRagIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem('registeredRagIds');
    if (saved) {
      setRegisteredRagIds(new Set(JSON.parse(saved)));
    }

    const handleRagRegistered = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      setRegisteredRagIds(prev => {
        const newSet = new Set(prev);
        newSet.add(customEvent.detail);
        return newSet;
      });
    };

    window.addEventListener('ragRegistered', handleRagRegistered);
    return () => {
      window.removeEventListener('ragRegistered', handleRagRegistered);
    };
  }, []);

  const getPrimaryActionText = (req: any) => {
    return undefined;
  };

  const getSecondaryActionText = (req: any) => {
    return undefined;
  };

  return (
    <div className={styles.container}>
      {/* Content Section (Split Layout) */}
      <div className={styles.splitLayout}>
        {/* Left Pane: Request List */}
        <div className={`${styles.leftPane} ${mobileView !== 'list' ? styles.mobileHidden : ''}`}>
          <div className={styles.leftPaneHeader}>
            <div className={styles.leftPaneHeaderLeft}>
              <h1 className={styles.leftPaneTitle}>{t.frontdeskPage.sidebar.menus.frontDesk}</h1>
            </div>
          </div>
          <div className={styles.leftPaneContent}>
            {/* Room Search Bar */}
          <div style={{ marginBottom: 'var(--space-16)' }}>
            <InputField
              variant="search"
              placeholder="객실 번호 또는 요청 내용 검색..."
              value={roomSearchValue}
              onChange={(e) => setRoomSearchValue(e.target.value)}
            />
          </div>
          {/* Tabs inside left pane */}
          <div style={{ marginBottom: 'var(--space-16)' }}>
            <Tabs
              options={[
                { label: '진행 중', value: 'active', count: new Set([...pending, ...inProgress].map(r => String(r.roomNo))).size },
                { label: '상담 완료', value: 'completed', count: new Set(completed.map(r => String(r.roomNo))).size }
              ]}
              activeValue={activeTab}
              onChange={(val) => setActiveTab(val || 'active')}
            />
          </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-gray-400)' }}>{t.common.loading}</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-gray-400)' }}>{t.common.error}: {error}</div>
        ) : groupedRooms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-gray-400)' }}>{t.frontdeskPage.frontDesk.empty}</div>
        ) : (
          <div className={styles.cardGrid}>
            {groupedRooms.map(room => (
              <RequestCard
                key={room.roomNo}
                roomNumber={room.roomNo}
                title={room.summaryText}
                description={lastGuestMessages[String(room.roomNo)] || room.rawText || '요청 내용이 없습니다.'}
                statusText={mapStatusText(room.repStatus)}
                statusVariant={mapStatusVariant(room.repStatus)}
                createdAt={room.createdAt}
                isSelected={activeChatRoom?.roomNumber === room.roomNo}
                primaryActionText={getPrimaryActionText(room)}
                secondaryActionText={getSecondaryActionText(room)}
                onPrimaryAction={() => {
                  if (activeTab === 'active') {
                    if (room.repStatus === 'PENDING' || room.repStatus === 'ESCALATED') {
                      handleStatusChange(room.allIds, 'IN_PROGRESS');
                      setActiveChatRoom({ roomNumber: room.roomNo, requestIds: room.allIds, representativeId: room.representativeId, status: 'IN_PROGRESS', summary: room.summaryText, initialMessage: room.rawText || room.summaryText });
                    } else if (room.repStatus === 'IN_PROGRESS' || room.repStatus === 'ASSIGNED') {
                      handleStatusChange(room.allIds, 'COMPLETED');
                      setActiveChatRoom(null);
                    }
                  } else if (activeTab === 'completed') {
                    setTrainingTarget(room.reqs[0]);
                  }
                }}
                onSecondaryAction={
                  activeTab === 'completed' ? () => setActiveChatRoom({ roomNumber: room.roomNo, requestIds: room.allIds, representativeId: room.representativeId, status: room.repStatus, summary: room.summaryText, initialMessage: room.rawText || room.summaryText }) :
                  undefined
                }
                reverseActions={true}
                onCardClick={() => {
                  setActiveChatRoom({ roomNumber: room.roomNo, requestIds: room.allIds, representativeId: room.representativeId, status: room.repStatus, summary: room.summaryText, initialMessage: room.rawText || room.summaryText });
                  setDetailTarget(null);
                  setMobileView('chat');
                  // 레드닷 해제
                  setNewMessageRoomNos(prev => {
                    const next = new Set(prev);
                    next.delete(room.roomNo);
                    return next;
                  });
                }}
                // custom props to pass to ChatModal through RequestCard
                requestId={room.representativeId}
                status={room.repStatus}
                onStatusChange={handleStatusChange as any}
                hasNewMessage={newMessageRoomNos.has(room.roomNo)}
                isEmergency={room.highestPriority === 'EMERGENCY'}
              />
            ))}
          </div>
        )}
          </div>
        </div>

        {/* Right Pane: Chat Window */}
        <div className={`${styles.rightPane} ${mobileView !== 'chat' ? styles.mobileHidden : ''}`}>
          {activeChatRoom ? (() => {
            const activeReq = [...pending, ...inProgress, ...completed].find(r => r.id === activeChatRoom.representativeId);
            return (
              <ChatPanel
                roomNumber={activeChatRoom.roomNumber}
                requestIds={activeChatRoom.requestIds}
                representativeId={activeChatRoom.representativeId}
                status={activeChatRoom.status}
                summary={activeChatRoom.summary}
                initialMessage={activeChatRoom.initialMessage}
                onStatusChange={handleStatusChange}
                autoComplete={false}
                onClose={() => { setIsRagFlowActive(false); setActiveChatRoom(null); }}
                showRagButton={activeTab === 'completed' && !registeredRagIds.has(activeChatRoom.representativeId)}
                onRagRegister={() => {
                  const req = [...pending, ...inProgress, ...completed].find((r: any) => r.id === activeChatRoom.representativeId);
                  if (req) setTrainingTarget(req);
                }}
                isEmergency={activeReq?.priority === 'EMERGENCY'}
                onRagFlowChange={setIsRagFlowActive}
                showSearch={true}
                onMobileBack={() => setMobileView('list')}
                onMobileMore={() => setMobileView('detail')}
              />
            );
          })() : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-gray-400)' }}>
              대화할 요청을 선택해주세요
            </div>
          )}
        </div>

        {/* Third Pane: Request Detail (요청 상세) */}
        {(activeChatRoom || detailTarget !== null) && (
          <div className={`${styles.detailPane} ${mobileView !== 'detail' ? styles.mobileHidden : ''}`}>
            <RequestDetailPanel
              requestId={(activeChatRoom ? activeChatRoom.representativeId : detailTarget)!}
              onUpdate={() => refetch && refetch()}
              onClose={() => {
                setActiveChatRoom(null);
                setDetailTarget(null);
              }}
              onMobileBack={() => setMobileView('chat')}
            />
          </div>
        )}
      </div>

      {/* 요청 생성 모달 */}
      <CreateRequestModal
        isOpen={activeModal === 'createRequest'}
        onClose={closeModal}
        onSuccess={() => refetch && refetch()}
      />

      {approveTarget !== null && (
        <ApproveEscalationModal
          isOpen={true}
          onClose={() => setApproveTarget(null)}
          requestId={approveTarget}
          onSuccess={() => refetch && refetch()}
        />
      )}

      {/* 에스컬레이션 반려 모달 */}
      {rejectTarget !== null && (
        <RejectEscalationModal
          isOpen={true}
          onClose={() => setRejectTarget(null)}
          requestId={rejectTarget}
          onSuccess={() => refetch && refetch()}
        />
      )}

      {/* 취소 승인 모달 */}
      {cancelApproveTarget !== null && (
        <ApproveCancellationModal
          isOpen={true}
          onClose={() => setCancelApproveTarget(null)}
          requestId={cancelApproveTarget}
          onSuccess={() => { refetch && refetch(); allRefetch && allRefetch(); }}
        />
      )}

      {/* 취소 반려 모달 */}
      {cancelRejectTarget !== null && (
        <RejectCancellationModal
          isOpen={true}
          onClose={() => setCancelRejectTarget(null)}
          requestId={cancelRejectTarget}
          onSuccess={() => { refetch && refetch(); allRefetch && allRefetch(); }}
        />
      )}

      <RegisterTrainingModal
        isOpen={trainingTarget !== null}
        onClose={() => setTrainingTarget(null)}
        departmentId={trainingTarget?.departmentId}
        summary={trainingTarget?.summary}
        roomNo={trainingTarget?.roomNo?.toString()}
        requestId={trainingTarget?.id}
      />
    </div>
  );
}
