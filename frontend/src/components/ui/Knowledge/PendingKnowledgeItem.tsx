'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './PendingKnowledgeItem.module.css';
import DeleteIcon from '@/components/icons/DeleteIcon';
import { useTranslation } from '@/app/useTranslation';

export interface PendingKnowledgeItemProps {
  id: number;
  domainCode: string;
  question: string;
  answer: string;
  selected?: boolean;
  onSelect?: (checked: boolean) => void;
  domainOptions?: { value: string; label: string }[];
  onDomainChange?: (domain: string) => void;
  onQuestionChange?: (value: string) => void;
  onAnswerChange?: (value: string) => void;
  onDelete?: () => void;
  questionPlaceholder?: string;
  answerPlaceholder?: string;
}

function DomainDropdown({ 
  value, 
  options, 
  onChange 
}: { 
  value: string; 
  options: { value: string; label: string }[]; 
  onChange: (v: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentLabel = options.find(o => o.value === value)?.label || value;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={styles.domainDropdownWrapper} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={styles.domainDropdownBtn}
      >
        <span>{currentLabel}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease-in-out'
          }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div className={styles.domainDropdownMenu}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`${styles.domainDropdownItem} ${value === opt.value ? styles.domainDropdownItemActive : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PendingKnowledgeItem({
  id,
  domainCode,
  question,
  answer,
  selected = false,
  onSelect,
  domainOptions = [],
  onDomainChange,
  onQuestionChange,
  onAnswerChange,
  onDelete,
  questionPlaceholder,
  answerPlaceholder,
}: PendingKnowledgeItemProps) {
  const { language } = useTranslation();

  return (
    <div id={`pending-knowledge-${id}`} className={styles.container}>
      {/* 1. Checkbox */}
      <div className={styles.checkboxWrapper} onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect?.(e.target.checked)}
          className={styles.checkboxInput}
        />
      </div>

      {/* 2. Editable Title (Question) and Subtitle (Answer) */}
      <div className={styles.mainInfo}>
        <input
          type="text"
          value={question}
          onChange={(e) => onQuestionChange?.(e.target.value)}
          placeholder={questionPlaceholder || (language === 'en' ? 'Enter question...' : '질문을 입력하세요...')}
          className={styles.editableTitle}
          onClick={(e) => e.stopPropagation()}
        />
        <input
          type="text"
          value={answer}
          onChange={(e) => onAnswerChange?.(e.target.value)}
          placeholder={answerPlaceholder || (language === 'en' ? 'Enter answer...' : '답변을 입력하세요...')}
          className={styles.editableSubtitle}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* 3. Department Dropdown */}
      <div className={styles.badgeWrapper} onClick={(e) => e.stopPropagation()}>
        {domainOptions && onDomainChange && (
          <DomainDropdown
            value={domainCode}
            options={domainOptions}
            onChange={onDomainChange}
          />
        )}
      </div>

      {/* 4. Delete Action Button */}
      <div className={styles.actions}>
        {onDelete && (
          <button
            type="button"
            className={`${styles.actionIcon} ${styles.deleteIcon}`}
            title="Delete"
            aria-label="Delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <DeleteIcon width={18} height={18} />
          </button>
        )}
      </div>
    </div>
  );
}
