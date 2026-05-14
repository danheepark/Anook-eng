'use client';

import React, { useState, useMemo } from 'react';
import styles from './page.module.css';
import { useVocList } from './useVocList';
import VocFilter, { FilterType } from './_components/VocFilter/VocFilter';
import VocTable from './_components/VocTable/VocTable';

export default function VocPage() {
  const { vocList, loading, error, refetch } = useVocList();
  const [filter, setFilter] = useState<FilterType>('ALL');

  const filteredVocs = useMemo(() => {
    if (filter === 'ALL') return vocList;
    return vocList.filter(voc => voc.sentiment === filter);
  }, [vocList, filter]);

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>고객 피드백 (VOC)</h1>
        <p className={styles.subtitle}>
          고객의 칭찬과 불만 등 서비스 피드백을 수집하고 관리하는 페이지입니다.
        </p>
      </div>

      {error && (
        <div className={styles.errorBox}>
          {error}
          <button 
            onClick={refetch} 
            style={{ marginLeft: '10px', textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            다시 시도
          </button>
        </div>
      )}

      <VocFilter currentFilter={filter} onFilterChange={setFilter} />
      
      <VocTable vocs={filteredVocs} loading={loading} />
    </div>
  );
}
