'use client';

import React, { useState } from 'react';
import Tabs from '@/components/ui/Tab/Tabs';
import InputField from '@/components/ui/Inputfield/InputField';
import TaskColumn from '@/components/ui/TaskBoard/TaskColumn';
import TaskTicket from '@/components/ui/TaskBoard/TaskTicket';
import RequestDetailModal from '../requests/_components/RequestDetailModal/RequestDetailModal';
import useFrontdeskRequests from '../useFrontdeskRequests';
import HeaderSearchSlot from '@/components/layout/HeaderSearchSlot';
import DateFilterDropdown, { DateFilterType, DateRange } from '../requests/_components/DateFilterDropdown';
import styles from './page.module.css';
import { useTranslation } from '@/app/useTranslation';
import SmartSearchBar from '@/components/ui/SmartSearchBar/SmartSearchBar';

const mapPriority = (p: string): 'NORMAL' => 'NORMAL';

const mapStatus = (s: string): 'TODO' | 'IN_PROGRESS' | 'DONE' => {
  if (s === 'COMPLETED' || s === 'CANCELLED') return 'DONE';
  if (s === 'IN_PROGRESS') return 'IN_PROGRESS';
  return 'TODO';
};

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

export default function HousekeepingPage() {
  const [searchValue, setSearchValue] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [detailTarget, setDetailTarget] = useState<number | null>(null);
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('today');
  const [customRange, setCustomRange] = useState<DateRange>(() => {
    const today = getTodayYMD();
    return { startDate: today, endDate: today };
  });

  const { t } = useTranslation();
  const { pending, inProgress, completed, loading, error, refetch } = useFrontdeskRequests('HK', searchValue, 'all');

  const filteredCompleted = React.useMemo(() => {
    if (dateFilterType === 'all') return completed;

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

    return completed.filter(req => {
      const reqYMD = getLocalYMD(req.updatedAt || req.createdAt);
      if (!reqYMD) return true;

      if (dateFilterType === 'today') return reqYMD === todayYMD;
      if (dateFilterType === 'yesterday') return reqYMD === yestYMD;
      if (dateFilterType === 'custom') {
        const { startDate, endDate } = customRange;
        if (startDate && endDate) return reqYMD >= startDate && reqYMD <= endDate;
        if (startDate) return reqYMD >= startDate;
        if (endDate) return reqYMD <= endDate;
      }
      return true;
    });
  }, [completed, dateFilterType, customRange]);

  // Search matching indices
  const allVisibleTickets = React.useMemo(() => {
    return [...pending, ...inProgress, ...filteredCompleted];
  }, [pending, inProgress, filteredCompleted]);

  const matches = React.useMemo(() => {
    if (!searchValue) return [];
    return allVisibleTickets.filter(req => 
      req.roomNo?.toString().includes(searchValue) ||
      req.summary?.toLowerCase().includes(searchValue.toLowerCase()) ||
      (req.rawText || '').toLowerCase().includes(searchValue.toLowerCase()) ||
      (req.assignedStaffName || '').toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [allVisibleTickets, searchValue]);

  // Reset index when search term changes
  React.useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchValue]);

  React.useEffect(() => {
    if (matches.length > 0 && currentMatchIndex >= matches.length) {
      setCurrentMatchIndex(matches.length - 1);
    }
  }, [matches, currentMatchIndex]);

  const scrollToMatch = (index: number) => {
    const target = matches[index];
    if (target) {
      const statusStr = target.status;
      if (statusStr === 'COMPLETED' || statusStr === 'CANCELLED') {
        setActiveTab('completed');
      } else if (statusStr === 'IN_PROGRESS') {
        setActiveTab('inProgress');
      } else {
        setActiveTab('pending');
      }

      setTimeout(() => {
        const el = document.getElementById(`ticket-${target.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    }
  };

  if (error) return <div className={styles.container}><p>오류: {error}</p></div>;

  return (
    <div className={styles.container}>
      <HeaderSearchSlot>
        <SmartSearchBar
          inputWrapperStyle={{ width: 260 }}
          value={searchValue}
          onChange={(val) => setSearchValue(val)}
          placeholder={t.frontdeskPage.taskBoard.searchPlaceholder}
          currentMatch={currentMatchIndex}
          totalMatches={matches.length}
          onPrev={() => {
            const newIndex = Math.max(0, currentMatchIndex - 1);
            setCurrentMatchIndex(newIndex);
            scrollToMatch(newIndex);
          }}
          onNext={() => {
            const newIndex = Math.min(matches.length - 1, currentMatchIndex + 1);
            setCurrentMatchIndex(newIndex);
            scrollToMatch(newIndex);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (matches.length > 0) {
                const nextIndex = (currentMatchIndex + 1) % matches.length;
                setCurrentMatchIndex(nextIndex);
                scrollToMatch(nextIndex);
              }
            }
          }}
        />
      </HeaderSearchSlot>

      {/* Task Board Section */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-gray-400)' }}>{t.common.loading}</div>
      ) : (
        <>
          <div className={styles.mobileTabs}>
            <Tabs
              options={[
                { label: t.frontdeskPage.taskBoard.columns.pending, value: 'pending', count: pending.length },
                { label: t.frontdeskPage.taskBoard.columns.inProgress, value: 'inProgress', count: inProgress.length },
                { label: t.frontdeskPage.taskBoard.columns.completed, value: 'completed', count: filteredCompleted.length }
              ]}
              activeValue={activeTab}
              onChange={(val) => val && setActiveTab(val)}
            />
          </div>

          <div className={styles.board}>
            {/* Column 1: 대기 중 */}
            <div className={`${styles.columnWrapper} ${activeTab !== 'pending' ? styles.mobileHidden : ''}`}>
              <TaskColumn title={t.frontdeskPage.taskBoard.columns.pending} count={pending.length} status="TODO">
                {pending.map(req => (
                  <div key={req.id} onClick={() => setDetailTarget(req.id)} style={{ cursor: 'pointer' }}>
                  <TaskTicket 
                    ticketId={req.id}
                    roomNo={req.roomNo}
                    department={req.departmentName}
                    priority={mapPriority(req.priority)}
                    title={req.summary}
                    description={req.rawText || ''}
                    status={mapStatus(req.status)}
                    isCancelled={req.status === 'CANCELLED'}
                    cancelRequested={req.cancelRequested}
                    createdAt={req.createdAt}
                    entities={req.entities}
                    highlightSearch={searchValue}
                    isActiveMatch={matches[currentMatchIndex]?.id === req.id}
                  />
                  </div>
                ))}
              </TaskColumn>
            </div>

            {/* Column 2: 진행 중 */}
            <div className={`${styles.columnWrapper} ${activeTab !== 'inProgress' ? styles.mobileHidden : ''}`}>
              <TaskColumn title={t.frontdeskPage.taskBoard.columns.inProgress} count={inProgress.length} status="IN_PROGRESS">
                {inProgress.map(req => (
                  <div key={req.id} onClick={() => setDetailTarget(req.id)} style={{ cursor: 'pointer' }}>
                  <TaskTicket 
                    ticketId={req.id}
                    roomNo={req.roomNo}
                    department={req.departmentName}
                    priority={mapPriority(req.priority)}
                    title={req.summary}
                    description={req.rawText || ''}
                    status={mapStatus(req.status)}
                    isCancelled={req.status === 'CANCELLED'}
                    cancelRequested={req.cancelRequested}
                    createdAt={req.createdAt}
                    updatedAt={req.updatedAt}
                    entities={req.entities}
                    highlightSearch={searchValue}
                    isActiveMatch={matches[currentMatchIndex]?.id === req.id}
                  />
                  </div>
                ))}
              </TaskColumn>
            </div>

            {/* Column 3: 완료 */}
            <div className={`${styles.columnWrapper} ${activeTab !== 'completed' ? styles.mobileHidden : ''}`}>
              <TaskColumn 
                title={t.frontdeskPage.taskBoard.columns.completed} 
                count={filteredCompleted.length} 
                status="DONE"
                headerRight={
                  <DateFilterDropdown
                    filterType={dateFilterType}
                    customRange={customRange}
                    onChange={(type, range) => {
                      setDateFilterType(type);
                      if (range) setCustomRange(range);
                    }}
                  />
                }
              >
                {filteredCompleted.map(req => (
                  <div key={req.id} onClick={() => setDetailTarget(req.id)} style={{ cursor: 'pointer' }}>
                  <TaskTicket 
                    ticketId={req.id}
                    roomNo={req.roomNo}
                    department={req.departmentName}
                    priority={mapPriority(req.priority)}
                    title={req.summary}
                    description={req.rawText || ''}
                    status={mapStatus(req.status)}
                    isCancelled={req.status === 'CANCELLED'}
                    cancelRequested={req.cancelRequested}
                    createdAt={req.createdAt}
                    entities={req.entities}
                    highlightSearch={searchValue}
                    isActiveMatch={matches[currentMatchIndex]?.id === req.id}
                  />
                  </div>
                ))}
              </TaskColumn>
            </div>
          </div>
        </>
      )}

      {/* 상세 모달 */}
      {detailTarget !== null && (
        <RequestDetailModal
          isOpen={true}
          onClose={() => setDetailTarget(null)}
          requestId={detailTarget}
          onUpdate={() => refetch && refetch()}
          callerDepartment="HK"
        />
      )}
    </div>
  );
}
