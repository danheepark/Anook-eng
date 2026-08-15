'use client';

import React, { useState } from 'react';
import Tabs from '@/components/ui/Tab/Tabs';
import HeaderSearchSlot from '@/components/layout/HeaderSearchSlot';
import KnowledgeLibraryTab from './_components/KnowledgeLibraryTab/KnowledgeLibraryTab';
import KnowledgeReviewTab from './_components/KnowledgeReviewTab/KnowledgeReviewTab';
import { useTranslation } from '@/app/useTranslation';
import SmartSearchBar from '@/components/ui/SmartSearchBar/SmartSearchBar';
import { useKnowledge } from './useKnowledge';
import styles from './page.module.css';

export default function KnowledgeManagementPage() {
  const { t, language } = useTranslation();
  const { data } = useKnowledge();
  const pendingCount = data.filter(item => item.status === 'PENDING').length;
  const approvedCount = data.filter(item => item.status === 'APPROVED').length;

  // 중분류 탭 (도메인별 필터)
  const [subTab, setSubTab] = useState('ALL');

  // 검색 & 필터 상태
  const [searchValue, setSearchValue] = useState('');
  const [filterValue, setFilterValue] = useState('all');

  // 검색 내비게이션 상태
  const [matches, setMatches] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [activeMatchId, setActiveMatchId] = useState<number | null>(null);

  const handleSearchChange = (val: string) => {
    setSearchValue(val);
    setMatches([]);
    setCurrentMatchIndex(0);
    setActiveMatchId(null);
  };

  const handleSubTabChange = (val: string) => {
    setSubTab(val || 'ALL');
    setSearchValue('');
    setMatches([]);
    setCurrentMatchIndex(0);
    setActiveMatchId(null);
  };

  const approvedData = data.filter(item => item.status === 'APPROVED');
  const getDomainCount = (code: string) => {
    if (code === 'ALL') return approvedData.length;
    return approvedData.filter(item => item.domainCode?.toUpperCase() === code).length;
  };

  const SUB_TAB_OPTIONS = [
    { value: 'ALL', label: t.frontdeskPage.rag.tabs.ALL, count: getDomainCount('ALL') },
    { value: 'HK', label: t.frontdeskPage.rag.tabs.HK, count: getDomainCount('HK') },
    { value: 'FB', label: t.frontdeskPage.rag.tabs.FB, count: getDomainCount('FB') },
    { value: 'FACILITY', label: t.frontdeskPage.rag.tabs.FACILITY, count: getDomainCount('FACILITY') },
    { value: 'CONCIERGE', label: t.frontdeskPage.rag.tabs.CONCIERGE, count: getDomainCount('CONCIERGE') },
    { value: 'FRONT', label: t.frontdeskPage.rag.tabs.FRONT, count: getDomainCount('FRONT') },
    { value: 'EMERGENCY', label: t.frontdeskPage.rag.tabs.EMERGENCY, count: getDomainCount('EMERGENCY') },
    { value: 'COMMON', label: t.frontdeskPage.rag.tabs.COMMON, count: getDomainCount('COMMON') }
  ];

  // 분석 후보 상태 (Knowledge Candidates 타이틀 연동)
  const [candidateState, setCandidateState] = useState<{ isAnalyzed: boolean; count: number }>({
    isAnalyzed: false,
    count: 0
  });

  return (
    <div className={styles.container}>
      {/* Teleport Search Bar to Header */}
      <HeaderSearchSlot>
        <SmartSearchBar
          inputWrapperStyle={{ width: 200 }}
          value={searchValue}
          onChange={(val) => handleSearchChange(val)}
          placeholder={t.frontdeskPage.taskBoard.searchPlaceholder}
          currentMatch={currentMatchIndex}
          totalMatches={matches.length}
          onPrev={() => {
            const newIndex = Math.max(0, currentMatchIndex - 1);
            setCurrentMatchIndex(newIndex);
            setActiveMatchId(matches[newIndex]);
          }}
          onNext={() => {
            const newIndex = Math.min(matches.length - 1, currentMatchIndex + 1);
            setCurrentMatchIndex(newIndex);
            setActiveMatchId(matches[newIndex]);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (matches.length > 0) {
                const nextIndex = (currentMatchIndex + 1) % matches.length;
                setCurrentMatchIndex(nextIndex);
                setActiveMatchId(matches[nextIndex]);
              }
            }
          }}
        />
      </HeaderSearchSlot>

      {/* 1. Top Section: Pending Knowledge / Knowledge Candidates */}
      <section className={styles.pendingBox}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            {candidateState.isAnalyzed 
              ? (language === 'en' ? 'Knowledge Candidates' : '지식 후보')
              : (language === 'en' ? 'Pending Knowledge' : (t.frontdeskPage?.taskBoard?.titles?.aiTraining || '대기 중인 지식'))}
          </h2>
          <div id="pending-knowledge-header-actions" />
        </div>
        <div className={styles.sectionBody}>
          <KnowledgeReviewTab 
            domainCode="ALL" 
            searchValue={searchValue} 
            onCandidateStateChange={(isAnalyzed, count) => {
              setCandidateState({ isAnalyzed, count });
            }}
            onMatchesChange={(m) => {
              setMatches(m);
              if (m.length === 0) {
                setCurrentMatchIndex(0);
                setActiveMatchId(null);
              } else if (currentMatchIndex >= m.length) {
                setCurrentMatchIndex(0);
                setActiveMatchId(m[0]);
              } else if (activeMatchId === null) {
                setActiveMatchId(m[currentMatchIndex]);
              }
            }}
            activeMatchId={activeMatchId}
          />
        </div>
      </section>

      {/* 2. Bottom Section: AI Knowledge Library */}
      <section className={styles.section}>
        <div className={styles.tabRow}>
          <div className={styles.subTabs}>
            <Tabs 
              options={SUB_TAB_OPTIONS}
              activeValue={subTab}
              onChange={handleSubTabChange}
              variant="line"
            />
          </div>
          <div id="knowledge-header-actions" className={styles.tabActions} />
        </div>

        <div className={styles.sectionBody}>
          <KnowledgeLibraryTab 
            domainCode={subTab} 
            searchValue={searchValue} 
            filterValue={filterValue} 
            onMatchesChange={(m) => {
              // Matches callback
            }}
            activeMatchId={activeMatchId}
          />
        </div>
      </section>
    </div>
  );
}
