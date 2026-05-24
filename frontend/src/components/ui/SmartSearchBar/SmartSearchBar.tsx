'use client';

import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '@/components/icons';
import InputField, { InputFieldProps } from '@/components/ui/Inputfield/InputField';

export interface SmartSearchBarProps extends Omit<InputFieldProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  currentMatch: number;
  totalMatches: number;
  onPrev: () => void;
  onNext: () => void;
  inputWrapperStyle?: React.CSSProperties;
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
  ...props
}: SmartSearchBarProps) {
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: '8px', ...style }}>
      <div style={inputWrapperStyle}>
        <InputField
          variant="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...props}
        />
      </div>
      {value && (
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
