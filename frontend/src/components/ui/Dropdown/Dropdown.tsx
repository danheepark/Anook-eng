'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './Dropdown.module.css';
import { ArrowDownIcon } from '@/components/icons';
import PopoverMenu from '../PopoverMenu/PopoverMenu';

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps {
  /** 라벨 텍스트 */
  label?: string;
  /** 선택 전 빈 상태일 때 보여줄 텍스트 */
  placeholder?: string;
  /** 선택지 목록 배열 */
  options: DropdownOption[];
  /** 현재 선택된 값 */
  value?: string;
  /** 값이 선택되었을 때 발생할 콜백 함수 */
  onChange?: (val: string) => void;
  className?: string;
  disabled?: boolean;
}

export default function Dropdown({
  label,
  placeholder = '옵션을 선택하세요.',
  options,
  value,
  onChange,
  className = '',
  disabled = false
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  // 현재 선택된 객체 찾기
  const selectedOption = options.find((opt) => opt.value === value);



  const handleSelect = (val: string) => {
    if (onChange) {
      onChange(val);
    }
    setIsOpen(false);
  };

  // 스크롤 및 화면 크기 조절 시 드롭다운 팝업의 절대 위치를 실시간 재계산하여 자석처럼 붙어다니게 함
  useEffect(() => {
    const updatePosition = () => {
      if (isOpen && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setCoords({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }
    };

    if (isOpen) {
      // capturing phase (true)를 사용하여 모달 내부 스크롤바 이동까지 확실하게 추적
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;

    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className={`${styles.wrapper} ${className}`.trim()} ref={wrapperRef}>
      
      {/* 1. 라벨 영역 */}
      {label && (
        <div className={styles.labelWrapper}>
          <h4 className={styles.label}>{label}</h4>
        </div>
      )}

      {/* 2. 트리거 박스 (클릭 시 열림) */}
      <div 
        ref={triggerRef}
        className={`${styles.trigger} ${disabled ? styles.triggerDisabled : ''}`} 
        onMouseDown={toggleDropdown}
        onClick={(e) => e.stopPropagation()}
        style={disabled ? { cursor: 'not-allowed', opacity: 0.6 } : undefined}
      >
        {selectedOption ? (
          <span className={styles.textSelected}>{selectedOption.label}</span>
        ) : (
          <span className={styles.textPlaceholder}>{placeholder}</span>
        )}
        
        <div className={`${styles.iconWrapper} ${isOpen ? styles.iconExpanded : ''}`}>
          <ArrowDownIcon />
        </div>
      </div>

      {/* 3. 드롭다운 팝업 리스트 — PopoverMenu 재사용 (포탈로 body에 렌더링하여 모달 밖으로 나오게 허용) */}
      {isOpen && typeof window !== 'undefined' && createPortal(
        <PopoverMenu
          items={options}
          onSelect={handleSelect}
          onClose={() => setIsOpen(false)}
          selectedValue={value}
          width={coords.width}
          style={{
            position: 'absolute',
            top: coords.top + 4,
            left: coords.left,
            zIndex: 9999,
          }}
        />,
        document.body
      )}
      
    </div>
  );
}

