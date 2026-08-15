'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './DateFilterDropdown.module.css';
import { CalendarIcon } from '@/components/icons';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from '@/app/useTranslation';

export type DateFilterType = 'all' | 'today' | 'yesterday' | 'custom';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

interface DateFilterDropdownProps {
  filterType: DateFilterType;
  customRange: DateRange;
  onChange: (type: DateFilterType, range?: DateRange) => void;
  className?: string;
}

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

export default function DateFilterDropdown({
  filterType,
  customRange,
  onChange,
  className = '',
}: DateFilterDropdownProps) {
  const { language } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [startInput, setStartInput] = useState(customRange.startDate || '');
  const [endInput, setEndInput] = useState(customRange.endDate || '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setStartInput(customRange.startDate || '');
    setEndInput(customRange.endDate || '');
  }, [customRange]);

  const handleSelectPreset = (type: DateFilterType) => {
    if (type === 'today') {
      const today = getTodayYMD();
      onChange('today', { startDate: today, endDate: today });
    } else if (type === 'yesterday') {
      const yesterday = getYesterdayYMD();
      onChange('yesterday', { startDate: yesterday, endDate: yesterday });
    } else if (type === 'all') {
      onChange('all', { startDate: '', endDate: '' });
    }
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    if (!startInput && !endInput) {
      handleSelectPreset('today');
      return;
    }
    const finalStart = startInput || endInput;
    const finalEnd = endInput || startInput;
    onChange('custom', { startDate: finalStart, endDate: finalEnd });
    setIsOpen(false);
  };

  const handleReset = () => {
    const today = getTodayYMD();
    setStartInput(today);
    setEndInput(today);
    handleSelectPreset('today');
  };

  // Label text formatter
  const getButtonLabel = () => {
    if (filterType === 'today') return language === 'ko' ? '오늘' : 'Today';
    if (filterType === 'yesterday') return language === 'ko' ? '어제' : 'Yesterday';
    if (filterType === 'all') return language === 'ko' ? '전체' : 'All';
    if (filterType === 'custom') {
      if (customRange.startDate && customRange.endDate) {
        if (customRange.startDate === customRange.endDate) {
          const parts = customRange.startDate.split('-');
          return `${parts[1]}.${parts[2]}`;
        }
        const s = customRange.startDate.slice(5).replace('-', '.');
        const e = customRange.endDate.slice(5).replace('-', '.');
        return `${s}~${e}`;
      }
      return language === 'ko' ? '날짜 선택' : 'Custom';
    }
    return language === 'ko' ? '오늘' : 'Today';
  };

  return (
    <div className={`${styles.wrapper} ${className}`.trim()} ref={dropdownRef}>
      <button
        type="button"
        className={`${styles.triggerBtn} ${isOpen ? styles.active : ''} ${filterType !== 'today' ? styles.hasFilter : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="날짜 필터"
      >
        <CalendarIcon size={14} color="currentColor" style={{ marginRight: 2 }} />
        <span className={styles.label}>{getButtonLabel()}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div className={styles.popover}>
          {/* Quick presets */}
          <div className={styles.presetsSection}>
            <div className={styles.presetButtons}>
              <button
                type="button"
                className={`${styles.presetBtn} ${filterType === 'all' ? styles.presetBtnActive : ''}`}
                onClick={() => handleSelectPreset('all')}
              >
                {language === 'ko' ? '전체' : 'All'}
              </button>
              <button
                type="button"
                className={`${styles.presetBtn} ${filterType === 'today' ? styles.presetBtnActive : ''}`}
                onClick={() => handleSelectPreset('today')}
              >
                {language === 'ko' ? '오늘' : 'Today'}
              </button>
              <button
                type="button"
                className={`${styles.presetBtn} ${filterType === 'yesterday' ? styles.presetBtnActive : ''}`}
                onClick={() => handleSelectPreset('yesterday')}
              >
                {language === 'ko' ? '어제' : 'Yesterday'}
              </button>
            </div>
          </div>

          <div className={styles.divider} />

          {/* Custom Date Range */}
          <div className={styles.customSection}>
            <span className={styles.sectionHeader}>
              {language === 'ko' ? '직접 날짜 선택 / 기간' : 'Select Date / Range'}
            </span>
            <div className={styles.dateInputsRow}>
              <div className={styles.inputCol}>
                <label className={styles.inputLabel}>{language === 'ko' ? '시작' : 'From'}</label>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                />
              </div>
              <span className={styles.tilde}>~</span>
              <div className={styles.inputCol}>
                <label className={styles.inputLabel}>{language === 'ko' ? '종료' : 'To'}</label>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={endInput}
                  min={startInput || undefined}
                  onChange={(e) => setEndInput(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.actionsRow}>
              <button
                type="button"
                className={styles.resetBtn}
                onClick={handleReset}
                title={language === 'ko' ? '초기화' : 'Reset'}
              >
                <RotateCcw size={13} />
                <span>{language === 'ko' ? '초기화' : 'Reset'}</span>
              </button>
              <button
                type="button"
                className={styles.applyBtn}
                onClick={handleApplyCustom}
              >
                {language === 'ko' ? '적용' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
