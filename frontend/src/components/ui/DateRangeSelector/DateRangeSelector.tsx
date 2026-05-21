'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './DateRangeSelector.module.css';
import { CalendarIcon, ArrowDownIcon } from '@/components/icons';
import { useTranslation } from '@/app/useTranslation';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

interface DateRangeSelectorProps {
  dateRange: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

// Utility to format date to YYYY-MM-DD
const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function DateRangeSelector({
  dateRange,
  onChange,
  className = '',
}: DateRangeSelectorProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  
  // Local state for custom inputs
  const [customStart, setCustomStart] = useState(dateRange.startDate);
  const [customEnd, setCustomEnd] = useState(dateRange.endDate);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync local inputs when external props change
  useEffect(() => {
    setCustomStart(dateRange.startDate);
    setCustomEnd(dateRange.endDate);
  }, [dateRange]);

  const handlePresetClick = (daysBack: number, presetType: 'days' | 'thisWeek' | 'thisMonth' | 'yesterday') => {
    const end = new Date();
    let start = new Date();

    if (presetType === 'yesterday') {
      end.setDate(end.getDate() - 1);
      start.setDate(start.getDate() - 1);
    } else if (presetType === 'days') {
      start.setDate(start.getDate() - daysBack);
    } else if (presetType === 'thisWeek') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
      start.setDate(diff);
    } else if (presetType === 'thisMonth') {
      start = new Date(start.getFullYear(), start.getMonth(), 1);
    }

    const newRange = {
      startDate: formatDate(start),
      endDate: formatDate(end),
    };
    
    setCustomStart(newRange.startDate);
    setCustomEnd(newRange.endDate);
    onChange(newRange);
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    if (customStart && customEnd) {
      onChange({ startDate: customStart, endDate: customEnd });
      setIsOpen(false);
    }
  };

  // Determine display text for the trigger button
  const getDisplayText = () => {
    if (dateRange.startDate === dateRange.endDate) {
      if (dateRange.startDate === formatDate(new Date())) return '오늘';
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (dateRange.startDate === formatDate(yesterday)) return '어제';
      return dateRange.startDate;
    }
    return `${dateRange.startDate} ~ ${dateRange.endDate}`;
  };

  return (
    <div className={`${styles.container} ${className}`.trim()} ref={containerRef}>
      <button 
        className={`${styles.triggerButton} ${isOpen ? styles.active : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="기간 선택"
      >
        <CalendarIcon size={18} className={styles.icon} />
        <span>{getDisplayText()}</span>
        <ArrowDownIcon width={16} height={16} className={styles.icon} />
      </button>

      {isOpen && (
        <div className={styles.popover}>
          <div>
            <p className={styles.sectionTitle}>빠른 선택 (Presets)</p>
            <div className={styles.presetGrid}>
              <button className={styles.presetButton} onClick={() => handlePresetClick(0, 'days')}>오늘</button>
              <button className={styles.presetButton} onClick={() => handlePresetClick(1, 'yesterday')}>어제</button>
              <button className={styles.presetButton} onClick={() => handlePresetClick(0, 'thisWeek')}>이번 주</button>
              <button className={styles.presetButton} onClick={() => handlePresetClick(6, 'days')}>최근 7일</button>
              <button className={styles.presetButton} onClick={() => handlePresetClick(0, 'thisMonth')}>이번 달</button>
              <button className={styles.presetButton} onClick={() => handlePresetClick(29, 'days')}>최근 30일</button>
            </div>
          </div>

          <div className={styles.customRange}>
            <p className={styles.sectionTitle}>사용자 지정 (Custom)</p>
            <div className={styles.dateInputGroup}>
              <input 
                type="date" 
                className={styles.dateInput} 
                value={customStart}
                max={customEnd || formatDate(new Date())}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <span className={styles.dateSeparator}>~</span>
              <input 
                type="date" 
                className={styles.dateInput} 
                value={customEnd}
                min={customStart}
                max={formatDate(new Date())}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
            <button className={styles.applyButton} onClick={handleApplyCustom}>
              적용하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
