'use client';

import React, { useState } from 'react';
import Tabs from '@/components/ui/Tab/Tabs';
import InputField from '@/components/ui/Inputfield/InputField';
import TaskColumn from '@/components/ui/TaskBoard/TaskColumn';
import TaskTicket from '@/components/ui/TaskBoard/TaskTicket';
import RequestDetailModal from '../requests/_components/RequestDetailModal/RequestDetailModal';
import useFrontdeskRequests from '../useFrontdeskRequests';
import styles from './page.module.css';
import { useTranslation } from '@/app/useTranslation';
import { ArrowUpIcon, ArrowDownIcon } from '@/components/icons';

const mapPriority = (p: string): 'NORMAL' => 'NORMAL';

const mapStatus = (s: string): 'TODO' | 'IN_PROGRESS' | 'DONE' => {
  if (s === 'COMPLETED' || s === 'CANCELLED') return 'DONE';
  if (s === 'IN_PROGRESS') return 'IN_PROGRESS';
  return 'TODO';
};

export default function ConciergePage() {
  const [searchValue, setSearchValue] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [detailTarget, setDetailTarget] = useState<number | null>(null);
  const { t } = useTranslation();
  const { pending, inProgress, completed, loading, error, refetch } = useFrontdeskRequests('CONCIERGE', searchValue, 'all');

  // Search matching indices
  const allVisibleTickets = React.useMemo(() => {
    return [...pending, ...inProgress, ...completed];
  }, [pending, inProgress, completed]);

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
      {/* Header Section */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{t.frontdeskPage.taskBoard.titles.concierge}</h1>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchBarWrapper}>
            <div className={styles.searchInputContainer}>
              <InputField 
                variant="search" 
                placeholder={t.frontdeskPage.taskBoard.searchPlaceholder} 
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
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
            </div>
            {searchValue && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--color-gray-600)', whiteSpace: 'nowrap' }}>
                {matches.length > 0 ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <button 
                        onClick={() => {
                          const newIndex = Math.max(0, currentMatchIndex - 1);
                          setCurrentMatchIndex(newIndex);
                          scrollToMatch(newIndex);
                        }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                        aria-label="Previous match"
                      >
                        <ArrowUpIcon width={16} height={16} color="var(--color-gray-600)" />
                      </button>
                      <button 
                        onClick={() => {
                          const newIndex = Math.min(matches.length - 1, currentMatchIndex + 1);
                          setCurrentMatchIndex(newIndex);
                          scrollToMatch(newIndex);
                        }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                        aria-label="Next match"
                      >
                        <ArrowDownIcon width={16} height={16} color="var(--color-gray-600)" />
                      </button>
                    </div>
                    <span>{currentMatchIndex + 1} / {matches.length}</span>
                  </>
                ) : (
                  <span>0 / 0</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

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
                { label: t.frontdeskPage.taskBoard.columns.completed, value: 'completed', count: completed.length }
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
                    description={req.assignedStaffName || ''}
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
              <TaskColumn title={t.frontdeskPage.taskBoard.columns.completed} count={completed.length} status="DONE">
                {completed.map(req => (
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
          callerDepartment="CONCIERGE"
        />
      )}
    </div>
  );
}
