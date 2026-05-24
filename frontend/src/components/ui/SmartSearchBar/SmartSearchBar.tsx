'use client';

import React from 'react';
import { ArrowUpIcon, ArrowDownIcon, SearchIcon, CancelIcon } from '@/components/icons';
import styles from './SmartSearchBar.module.css';

export interface SmartSearchBarProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  currentMatch?: number;
  totalMatches?: number;
  onPrev?: () => void;
  onNext?: () => void;
  inputWrapperStyle?: React.CSSProperties;
  onClear?: () => void;
}

export default function SmartSearchBar({
  value,
  onChange,
  currentMatch,
  totalMatches,
  onPrev,
  onNext,
  className = '',
  style,
  inputWrapperStyle,
  onClear,
  disabled,
  ...props
}: SmartSearchBarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onChange('');
    if (onClear) {
      onClear();
    }
  };

  const showMatches = totalMatches !== undefined && currentMatch !== undefined && onPrev && onNext;

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: '8px', ...style }}>
      <div style={inputWrapperStyle}>
        <div className={styles.searchContainer}>
          <div className={styles.searchIconWrapper}>
            <SearchIcon width={18} height={18} />
          </div>
          <input 
            ref={inputRef}
            className={styles.inputElement} 
            disabled={disabled}
            placeholder={props.placeholder || '검색어를 입력하세요...'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            {...props}
          />
          {!!value && !disabled && (
            <button 
              type="button" 
              className={styles.clearButton} 
              onClick={handleClear}
              aria-label="Clear search"
            >
              <CancelIcon width={16} height={16} color="currentColor" />
            </button>
          )}
        </div>
      </div>
      {value && showMatches && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--color-gray-600)', whiteSpace: 'nowrap' }}>
          {totalMatches > 0 ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <button 
                  onClick={onPrev}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                  aria-label="Previous match"
                >
                  <ArrowUpIcon width={16} height={16} color="var(--color-gray-600)" />
                </button>
                <button 
                  onClick={onNext}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                  aria-label="Next match"
                >
                  <ArrowDownIcon width={16} height={16} color="var(--color-gray-600)" />
                </button>
              </div>
              <span>{currentMatch + 1} / {totalMatches}</span>
            </>
          ) : (
            <span>0 / 0</span>
          )}
        </div>
      )}
    </div>
  );
}
