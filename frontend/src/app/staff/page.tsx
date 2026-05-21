'use client';

import React, { useMemo, useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Tabs from '@/components/ui/Tab/Tabs';
import TaskColumn from '@/components/ui/TaskBoard/TaskColumn';
import TaskTicket from '@/components/ui/TaskBoard/TaskTicket';
import InputField from '@/components/ui/Inputfield/InputField';
import TaskDetailModal from './_components/TaskDetailModal/TaskDetailModal';
import { useTasks, StaffTask } from './useTasks';
import BoardSkeleton from './_components/BoardSkeleton/BoardSkeleton';
import styles from './page.module.css';

const COLUMN_CONFIG = [
  { id: 'PENDING', title: '대기 중', status: 'TODO' },
  { id: 'IN_PROGRESS', title: '진행 중', status: 'IN_PROGRESS' },
  { id: 'COMPLETED', title: '완료됨', status: 'DONE' },
];

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
  const searchParams = useSearchParams();
  const view = searchParams.get('view');
  const { tasks, loading, error, acceptTask, completeTask, transferTask, approveCancellation, rejectCancellation } = useTasks(view === 'my' ? 'my' : 'dept');

  // 필터 및 모달 상태 관리
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [selectedTask, setSelectedTask] = useState<StaffTask | null>(null);
  const [activeTab, setActiveTab] = useState<'TODO' | 'IN_PROGRESS' | 'DONE'>('TODO');

  const [departmentName, setDepartmentName] = useState('부서');
  const [departmentRole, setDepartmentRole] = useState<any>('housekeeping');

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.departmentId) {
          // Sidebar Role 매핑
          const roleMap: Record<string, string> = {
            'HK': 'housekeeping',
            'FACILITY': 'facility',
            'FB': 'fb',
            'CONCIERGE': 'concierge'
          };
          setDepartmentRole(roleMap[data.departmentId] || 'housekeeping');

          // 화면 타이틀 이름 매핑 (요청하신 정확한 명칭으로 고정)
          const nameMap: Record<string, string> = {
            'HK': '하우스키핑',
            'FACILITY': 'Facility',
            'FB': 'FB',
            'CONCIERGE': '컨시어지'
          };
          setDepartmentName(nameMap[data.departmentId] || data.department || '부서');
        } else if (data.department) {
          setDepartmentName(data.department);
        }
      })
      .catch(console.error);
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (priorityFilter !== 'ALL' && task.priority !== priorityFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return task.roomNumber.toString().includes(query) ||
          task.summary.toLowerCase().includes(query);
      }
      return true;
    });
  }, [tasks, searchQuery, priorityFilter]);

  const boardData = useMemo(() => {
    const sortByCancelRequested = (taskList: typeof filteredTasks) => {
      return [...taskList].sort((a, b) => {
        if (a.cancelRequested && !b.cancelRequested) return -1;
        if (!a.cancelRequested && b.cancelRequested) return 1;
        return 0;
      });
    };

    return {
      TODO: sortByCancelRequested(filteredTasks.filter(t => t.status === 'PENDING' || t.status === 'ESCALATED')),
      IN_PROGRESS: sortByCancelRequested(filteredTasks.filter(t => t.status === 'IN_PROGRESS')),
      DONE: filteredTasks.filter(t => t.status === 'COMPLETED' || t.status === 'CANCELLED'),
    };
  }, [filteredTasks]);

  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <header className={styles.header}>
          <h1 className={styles.title}>{departmentName} 관리</h1>
          <p className={styles.subtitle}>{departmentName} 전용 채널</p>
        </header>

        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <InputField
              variant="search"
              placeholder="객실번호 또는 내용 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <BoardSkeleton />
      ) : error ? (
        <div className={styles.error}>데이터를 불러오는 데 실패했습니다. ({error})</div>
      ) : (
        <>
          <div className={styles.mobileTabs}>
            <Tabs
              options={[
                { label: '대기 중', value: 'TODO', count: boardData.TODO.length },
                { label: '진행 중', value: 'IN_PROGRESS', count: boardData.IN_PROGRESS.length },
                { label: '완료됨', value: 'DONE', count: boardData.DONE.length }
              ]}
              activeValue={activeTab}
              onChange={(val) => val && setActiveTab(val as 'TODO' | 'IN_PROGRESS' | 'DONE')}
            />
          </div>

          <section className={styles.board}>
            {COLUMN_CONFIG.map(col => {
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
                            description=""
                            status={col.status as 'TODO' | 'IN_PROGRESS' | 'DONE'}
                            createdAt={task.createdAt}
                            cancelRequested={task.cancelRequested}
                            isCancelled={task.status === 'CANCELLED'}
                            onAccept={col.status === 'TODO' ? (e) => {
                              e.stopPropagation();
                              acceptTask(task.id, task.version);
                            } : undefined}
                            onComplete={col.status === 'IN_PROGRESS' && !task.cancelRequested ? (e) => {
                              e.stopPropagation();
                              completeTask(task.id, task.version);
                            } : undefined}
                            entities={task.entities}
                          />
                        </div>
                      ))}
                      {columnTasks.length === 0 && (
                        <div className={styles.empty}>해당하는 작업이 없습니다.</div>
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
