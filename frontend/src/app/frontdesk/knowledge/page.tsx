'use client';

import React, { useState } from 'react';
import Tabs from '@/components/ui/Tab/Tabs';
import InputField from '@/components/ui/Inputfield/InputField';
import KnowledgeLibraryTab from './_components/KnowledgeLibraryTab/KnowledgeLibraryTab';
import KnowledgeReviewTab from './_components/KnowledgeReviewTab/KnowledgeReviewTab';
import { useTranslation } from '@/app/useTranslation';
import ArrowUpIcon from '@/components/icons/ArrowUpIcon';
import ArrowDownIcon from '@/components/icons/ArrowDownIcon';
import styles from './page.module.css';

export default function KnowledgeManagementPage() {
  const { t } = useTranslation();
  
  // 대분류 탭 (AI 학습 관리 vs RAG 데이터 관리)
  const [mainTab, setMainTab] = useState<'REVIEW' | 'LIBRARY'>('REVIEW');
  
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

  const handleTabChange = (val: 'REVIEW' | 'LIBRARY') => {
    setMainTab(val);
    setSubTab('ALL'); // 대분류 변경 시 중분류 초기화
    setSearchValue(''); // 탭 변경 시 검색어 초기화
    setFilterValue('all');
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

  const MAIN_TAB_OPTIONS = [
    { value: 'REVIEW', label: t.frontdeskPage.taskBoard.titles.aiTraining },
    { value: 'LIBRARY', label: t.frontdeskPage.taskBoard.titles.rag }
  ];

  const SUB_TAB_OPTIONS = [
    { value: 'ALL', label: t.frontdeskPage.rag.tabs.ALL },
    { value: 'HK', label: t.frontdeskPage.rag.tabs.HK },
    { value: 'FB', label: t.frontdeskPage.rag.tabs.FB },
    { value: 'FACILITY', label: t.frontdeskPage.rag.tabs.FACILITY },
    { value: 'CONCIERGE', label: t.frontdeskPage.rag.tabs.CONCIERGE },
    { value: 'FRONT', label: t.frontdeskPage.rag.tabs.FRONT },
    { value: 'EMERGENCY', label: t.frontdeskPage.rag.tabs.EMERGENCY },
    { value: 'COMMON', label: t.frontdeskPage.rag.tabs.COMMON }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t.frontdeskPage.sidebar.menus.rag}</h1>
        <div className={styles.headerActions}>
          <div className={styles.searchBarWrapper}>
            <div className={styles.searchInputContainer}>
              <InputField 
                variant="search" 
                placeholder={t.frontdeskPage.rag.searchPlaceholder} 
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
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
                          setActiveMatchId(matches[newIndex]);
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
                          setActiveMatchId(matches[newIndex]);
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

      {/* 2-Depth Tabs Section */}
      <div className={styles.tabsWrapper}>
        <div className={styles.mainTabs}>
          <Tabs 
            options={MAIN_TAB_OPTIONS}
            activeValue={mainTab}
            onChange={(val) => handleTabChange(val as 'REVIEW' | 'LIBRARY')}
          />
        </div>
        {mainTab === 'LIBRARY' && (
          <div className={styles.subTabs}>
            <Tabs 
              options={SUB_TAB_OPTIONS}
              activeValue={subTab}
              onChange={handleSubTabChange}
              variant="pill"
            />
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className={styles.contentWrapper}>
        {mainTab === 'REVIEW' ? (
          <KnowledgeReviewTab 
            domainCode="ALL" 
            searchValue={searchValue} 
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
        ) : (
          <KnowledgeLibraryTab 
            domainCode={subTab} 
            searchValue={searchValue} 
            filterValue={filterValue} 
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
        )}
      </div>
    </div>
  );
}
