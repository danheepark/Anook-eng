import React from 'react';
import styles from './VocFilter.module.css';

export type FilterType = 'ALL' | 'POSITIVE' | 'NEGATIVE';

interface VocFilterProps {
  currentFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export default function VocFilter({ currentFilter, onFilterChange }: VocFilterProps) {
  return (
    <div className={styles.filterContainer}>
      <button 
        className={`${styles.filterButton} ${currentFilter === 'ALL' ? styles.active : ''}`}
        onClick={() => onFilterChange('ALL')}
      >
        전체보기
      </button>
      <button 
        className={`${styles.filterButton} ${currentFilter === 'POSITIVE' ? styles.active : ''}`}
        onClick={() => onFilterChange('POSITIVE')}
      >
        👍 칭찬
      </button>
      <button 
        className={`${styles.filterButton} ${currentFilter === 'NEGATIVE' ? styles.active : ''}`}
        onClick={() => onFilterChange('NEGATIVE')}
      >
        👎 불만/의견
      </button>
    </div>
  );
}
