'use client';

import React from 'react';
import { ArrowUpIcon, ArrowDownIcon, SearchIcon, CancelIcon } from '@/components/icons';
import { useTranslation } from '@/app/useTranslation';
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
  const { t } = useTranslation();

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
    <div className={`${styles.root} ${className}`.trim()} style={{ width: '100%', ...style }}>
      <div style={{ width: '100%', ...inputWrapperStyle }}>
        <div className={styles.searchContainer}>
          <div className={styles.searchIconWrapper}>
            <SearchIcon width={18} height={18} />
          </div>
          <input 
            ref={inputRef}
            className={styles.inputElement} 
            disabled={disabled}
            placeholder={props.placeholder || t.common?.searchPlaceholder || '검색어를 입력하세요...'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            {...props}
          />
          {value && showMatches && (
            <div className={styles.inlineMatchControls}>
              <span className={styles.matchCount}>
                {totalMatches > 0 ? `${currentMatch + 1} / ${totalMatches}` : '0 / 0'}
              </span>
              {totalMatches > 0 && (
                <div className={styles.arrowButtons}>
                  <button 
                    type="button"
                    onClick={onPrev}
                    className={styles.arrowBtn}
                    aria-label="Previous match"
                    title="Previous match"
                  >
                    <ArrowUpIcon width={12} height={12} color="currentColor" />
                  </button>
                  <button 
                    type="button"
                    onClick={onNext}
                    className={styles.arrowBtn}
                    aria-label="Next match"
                    title="Next match"
                  >
                    <ArrowDownIcon width={12} height={12} color="currentColor" />
                  </button>
                </div>
              )}
            </div>
          )}
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
    </div>
  );
}
