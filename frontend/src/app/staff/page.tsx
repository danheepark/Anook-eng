'use client';

import React, { useMemo, useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Tabs from '@/components/ui/Tab/Tabs';
import TaskColumn from '@/components/ui/TaskBoard/TaskColumn';
import TaskTicket from '@/components/ui/TaskBoard/TaskTicket';
import { MoreIcon } from '@/components/icons';
import SmartSearchBar from '@/components/ui/SmartSearchBar/SmartSearchBar';
import TaskDetailModal from './_components/TaskDetailModal/TaskDetailModal';
import { useTasks, StaffTask } from './useTasks';
import BoardSkeleton from './_components/BoardSkeleton/BoardSkeleton';
import HeaderSearchSlot from '@/components/layout/HeaderSearchSlot';
import { useUiStore } from '@/stores/useUiStore';
import DateFilterDropdown, { DateFilterType, DateRange } from '../frontdesk/requests/_components/DateFilterDropdown';
import styles from './page.module.css';
import { useTranslation } from '@/app/useTranslation';

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

const PRIORITY_OPTIONS = [
  { label: '전체 우선순위', value: 'ALL' },
  { label: '긴급 (URGENT)', value: 'URGENT' },
  { label: '일반 (NORMAL)', value: 'NORMAL' },
];

/** 영문 키 → 한국어 라벨 (카드 미리보기용) */
const ENTITY_LABELS: Record<string, string> = {
  is_contactless: '비대면 배달', target_time: '희망 시간',
  equipment: '대상 설비', symptom: '증상', location: '위치',
  destination: '목적지', passenger_count: '인원', restaurant_name: '식당',
  cuisine_type: '음식 종류', category: '카테고리', action: '요청 유형',
  item: '대상 물품', time: '시간', special_requests: '추가 요청', count: '수량',
  type: '유형', target: '대상',
};
const HIDDEN_KEYS = new Set(['intent', 'allergen_warning']);

/** entities → 카드 미리보기 텍스트 (1~2줄 요약) */
function formatEntitiesText(entities: Record<string, any>): string {
  const parts: string[] = [];

  // 정규화: item+count 플랫 → items 배열
  if (entities.item && entities.count && !entities.items?.length) {
    entities = { ...entities, items: [{ item: entities.item, count: entities.count }] };
  }

  // 배열 타입
  if (entities.items?.length > 0) {
    parts.push(entities.items.map((it: any) => `${it.item} ${it.count}개`).join(', '));
  }
  if (entities.tasks?.length > 0) {
    parts.push(entities.tasks.join(', '));
  }
  if (entities.menu_items?.length > 0) {
    parts.push(entities.menu_items.map((mi: any) => {
      let s = `${mi.name} ${mi.quantity}개`;
      if (mi.selected_option && mi.selected_option !== '없음') s += ` (${mi.selected_option})`;
      return s;
    }).join(', '));
  }

  // 단순 키
  for (const [key, value] of Object.entries(entities)) {
    if (HIDDEN_KEYS.has(key)) continue;
    if (['items', 'tasks', 'menu_items', 'item', 'count'].includes(key)) continue;
    if (value === null || value === undefined || value === '' || value === false || value === '없음') continue;
    if (value === true) { parts.push(ENTITY_LABELS[key] || key); continue; }
    const label = ENTITY_LABELS[key] || key;
    parts.push(`${label}: ${value}`);
  }

  return parts.join('\n');
}

/**
 * [가이드라인 준수] 스태프 대시보드 메인 페이지
 * - URL: /staff
 * - useSearchParams() 사용을 위해 Suspense 경계를 설정합니다.
 */
export default function StaffDashboardPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>화면을 준비 중입니다...</div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const view = searchParams.get('view');
  const { tasks, loading, error, acceptTask, completeTask, transferTask, approveCancellation, rejectCancellation } = useTasks(view === 'my' ? 'my' : 'dept');
  const setHeaderTitle = useUiStore((s) => s.setHeaderTitle);

  // 필터 및 모달 상태 관리
  const [searchValue, setSearchValue] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [selectedTask, setSelectedTask] = useState<StaffTask | null>(null);
  const [activeTab, setActiveTab] = useState<'TODO' | 'IN_PROGRESS' | 'DONE'>('TODO');
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('today');
  const [customRange, setCustomRange] = useState<DateRange>(() => {
    const today = getTodayYMD();
    return { startDate: today, endDate: today };
  });

  const [departmentId, setDepartmentId] = useState<string>('');
  const [departmentName, setDepartmentName] = useState('');
  const [departmentRole, setDepartmentRole] = useState<any>('housekeeping');

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.departmentId) {
          setDepartmentId(data.departmentId);
          // Sidebar Role 매핑
          const roleMap: Record<string, string> = {
            'HK': 'housekeeping',
            'FACILITY': 'facility',
            'FB': 'fb',
            'CONCIERGE': 'concierge'
          };
          setDepartmentRole(roleMap[data.departmentId] || 'housekeeping');

          // 화면 타이틀 이름 매핑
          const nameMap: Record<string, string> = {
            'HK': '하우스키핑',
            'FACILITY': '시설 관리',
            'FB': 'FB',
            'CONCIERGE': '컨시어지'
          };
          setDepartmentName(nameMap[data.departmentId] || data.department || '');
        } else if (data.department) {
          setDepartmentName(data.department);
        }
      })
      .catch(console.error);
  }, []);

  const columnConfig = useMemo(() => [
    { id: 'PENDING', title: t.frontdeskPage.taskBoard.columns.pending, status: 'TODO' },
    { id: 'IN_PROGRESS', title: t.frontdeskPage.taskBoard.columns.inProgress, status: 'IN_PROGRESS' },
    { id: 'COMPLETED', title: t.frontdeskPage.taskBoard.columns.completed, status: 'DONE' },
  ], [t]);

  const staffDashboardT = t.frontdeskPage?.staffDashboard;
  const currentDeptTitle = (departmentId && t.ticketUI.department[departmentId as keyof typeof t.ticketUI.department]) || departmentName || staffDashboardT?.defaultDept || '부서';
  const pageTitle = view === 'my'
    ? (staffDashboardT?.myTasks || '내 작업')
    : (staffDashboardT?.allTasks || '{{dept}} 전체 작업').replace('{{dept}}', currentDeptTitle);

  useEffect(() => {
    setHeaderTitle(pageTitle);
    return () => {
      setHeaderTitle(null);
    };
  }, [pageTitle, setHeaderTitle]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (priorityFilter !== 'ALL' && task.priority !== priorityFilter) return false;
      if (searchValue) {
        const query = searchValue.toLowerCase();
        return task.roomNumber.toString().includes(query) ||
          task.summary.toLowerCase().includes(query);
      }
      return true;
    });
  }, [tasks, searchValue, priorityFilter]);

  useEffect(() => {
    if (filteredTasks.length > 0 && currentMatch >= filteredTasks.length) {
      setCurrentMatch(filteredTasks.length - 1);
    }
  }, [filteredTasks, currentMatch]);

  const scrollToMatch = (index: number) => {
    const target = filteredTasks[index];
    if (target) {
      setTimeout(() => {
        const el = document.getElementById(`ticket-${target.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  };

  const boardData = useMemo(() => {
    const sortByCancelRequested = (taskList: typeof filteredTasks) => {
      return [...taskList].sort((a, b) => {
        // 1. 취소 요청(cancelRequested) 건이 무조건 최상위
        if (a.cancelRequested && !b.cancelRequested) return -1;
        if (!a.cancelRequested && b.cancelRequested) return 1;
        
        // 2. 둘 다 취소 요청이거나 둘 다 아닌 경우, 긴급(URGENT)이 다음 순위
        const aUrgent = a.priority === 'URGENT';
        const bUrgent = b.priority === 'URGENT';
        if (aUrgent && !bUrgent) return -1;
        if (!aUrgent && bUrgent) return 1;
        
        // 3. 우선순위도 같으면 최신 생성일 순 정렬
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    };

    const safeParseTime = (dateStr?: string | null) => {
      if (!dateStr) return 0;
      const normalized = String(dateStr).replace(' ', 'T');
      const time = new Date(normalized).getTime();
      return isNaN(time) ? 0 : time;
    };

    const allDoneTasks = filteredTasks.filter(t => t.status === 'COMPLETED' || t.status === 'CANCELLED');
    const todayYMD = getTodayYMD();
    const yestYMD = getYesterdayYMD();

    const filteredDoneTasks = allDoneTasks.filter(task => {
      if (dateFilterType === 'all') return true;

      const getLocalYMD = (dateStr?: string | null) => {
        if (!dateStr) return '';
        const d = new Date(dateStr.replace(' ', 'T'));
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const taskYMD = getLocalYMD(task.updatedAt || task.cancelRequestedAt || task.createdAt);
      if (!taskYMD) return true;

      if (dateFilterType === 'today') return taskYMD === todayYMD;
      if (dateFilterType === 'yesterday') return taskYMD === yestYMD;
      if (dateFilterType === 'custom') {
        const { startDate, endDate } = customRange;
        if (startDate && endDate) return taskYMD >= startDate && taskYMD <= endDate;
        if (startDate) return taskYMD >= startDate;
        if (endDate) return taskYMD <= endDate;
      }
      return true;
    });

    return {
      TODO: filteredTasks.filter(t => (t.status === 'PENDING' || t.status === 'ESCALATED') && !t.cancelRequested),
      IN_PROGRESS: sortByCancelRequested(filteredTasks.filter(t => t.status === 'IN_PROGRESS')),
      DONE: filteredDoneTasks.sort((a, b) => {
        const timeA = safeParseTime(a.updatedAt || a.cancelRequestedAt || a.createdAt);
        const timeB = safeParseTime(b.updatedAt || b.cancelRequestedAt || b.createdAt);
        if (timeA !== timeB) {
          return timeB - timeA;
        }
        return b.id - a.id;
      }),
    };
  }, [filteredTasks, dateFilterType, customRange]);

  return (
    <div className={styles.container}>
      <HeaderSearchSlot>
        <SmartSearchBar
          inputWrapperStyle={{ width: 240 }}
          value={searchValue}
          onChange={(val) => {
            setSearchValue(val);
            setCurrentMatch(0);
          }}
          placeholder={t.frontdeskPage.taskBoard.searchPlaceholder}
          currentMatch={currentMatch}
          totalMatches={searchValue ? filteredTasks.length : 0}
          onPrev={() => {
            const newIndex = Math.max(0, currentMatch - 1);
            setCurrentMatch(newIndex);
            scrollToMatch(newIndex);
          }}
          onNext={() => {
            const newIndex = Math.min(filteredTasks.length - 1, currentMatch + 1);
            setCurrentMatch(newIndex);
            scrollToMatch(newIndex);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (filteredTasks.length > 0) {
                const nextIndex = (currentMatch + 1) % filteredTasks.length;
                setCurrentMatch(nextIndex);
                scrollToMatch(nextIndex);
              }
            }
          }}
        />
      </HeaderSearchSlot>

      {loading ? (
        <BoardSkeleton />
      ) : error ? (
        <div className={styles.error}>데이터를 불러오는 데 실패했습니다. ({error})</div>
      ) : (
        <>
          <div className={styles.mobileTabs}>
            <Tabs
              options={[
                { label: t.frontdeskPage.taskBoard.columns.pending, value: 'TODO', count: boardData.TODO.length },
                { label: t.frontdeskPage.taskBoard.columns.inProgress, value: 'IN_PROGRESS', count: boardData.IN_PROGRESS.length },
                { label: t.frontdeskPage.taskBoard.columns.completed, value: 'DONE', count: boardData.DONE.length }
              ]}
              activeValue={activeTab}
              onChange={(val) => val && setActiveTab(val as 'TODO' | 'IN_PROGRESS' | 'DONE')}
            />
          </div>

          <section className={styles.board}>
            {columnConfig.map(col => {
              const columnTasks = boardData[col.status as keyof typeof boardData];
              return (
                <div
                  key={col.id}
                  className={`${styles.columnWrapper} ${activeTab !== col.status ? styles.mobileHidden : ''}`}
                >
                  <TaskColumn
                    title={col.title}
                    count={columnTasks.length}
                    status={col.status as 'TODO' | 'IN_PROGRESS' | 'DONE'}
                    headerRight={col.status === 'DONE' ? (
                      <DateFilterDropdown
                        filterType={dateFilterType}
                        customRange={customRange}
                        onChange={(type, range) => {
                          setDateFilterType(type);
                          if (range) setCustomRange(range);
                        }}
                      />
                    ) : undefined}
                  >
                    <div className={styles.columnContent}>
                      {columnTasks.map(task => (
                        <div
                          key={`${task.roomNumber}-${task.createdAt}`}
                          className={styles.ticketWrapper}
                          onClick={() => setSelectedTask(task)}
                        >
                          <TaskTicket
                            ticketId={task.id}
                            roomNo={task.roomNumber}
                            department={task.departmentId}
                            priority={mapPriority(task.priority)}
                            title={task.summary}
                            description={task.rawText || ''}
                            status={col.status as 'TODO' | 'IN_PROGRESS' | 'DONE'}
                            createdAt={task.createdAt}
                            updatedAt={task.updatedAt}
                            cancelRequested={task.cancelRequested}
                            isCancelled={task.status === 'CANCELLED'}
                            isEscalated={task.status === 'ESCALATED'}
                            onAccept={col.status === 'TODO' ? (e) => {
                              e.stopPropagation();
                              acceptTask(task.id, task.version);
                            } : undefined}
                            onComplete={col.status === 'IN_PROGRESS' && !task.cancelRequested ? (e) => {
                              e.stopPropagation();
                              completeTask(task.id, task.version);
                            } : undefined}
                            onApproveCancel={col.status === 'IN_PROGRESS' && task.cancelRequested ? (e) => {
                              e.stopPropagation();
                              approveCancellation(task.id, task.version);
                            } : undefined}
                            onRejectCancel={col.status === 'IN_PROGRESS' && task.cancelRequested ? (e) => {
                              e.stopPropagation();
                              rejectCancellation(task.id, task.version);
                            } : undefined}
                            entities={task.entities}
                            assigneeName={task.assignedStaffName}
                            highlightSearch={searchValue}
                            isActiveMatch={searchValue ? filteredTasks[currentMatch]?.id === task.id : false}
                          />
                        </div>
                      ))}
                      {columnTasks.length === 0 && (
                        <div className={styles.empty}>{staffDashboardT?.empty || '해당하는 작업이 없습니다.'}</div>
                      )}
                    </div>
                  </TaskColumn>
                </div>
              );
            })}
          </section>
        </>
      )}

      <TaskDetailModal
        isOpen={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        onAccept={acceptTask}
        onComplete={completeTask}
        onTransfer={transferTask}
        onApproveCancellation={approveCancellation}
        onRejectCancellation={rejectCancellation}
      />
    </div>
  );
}

function mapPriority(p: string): 'NORMAL' | 'URGENT' {
  if (p === 'HIGH' || p === 'URGENT') return 'URGENT';
  return 'NORMAL';
}
