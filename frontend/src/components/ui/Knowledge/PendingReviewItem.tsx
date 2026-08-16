import React from 'react';
import { DeleteIcon } from '@/components/icons';
import styles from './PendingReviewItem.module.css';
import { useTranslation } from '@/app/useTranslation';

export interface PendingReviewItemProps {
  id: number;
  title: string;
  time?: string;
  updatedAt?: string;
  onClick?: () => void;
  onDelete?: () => void;
  isActiveMatch?: boolean;
  highlightQuery?: string;
}

function formatDateTime(dateVal?: string | Date, language: string = 'en') {
  if (!dateVal) return '';
  let date: Date;
  if (dateVal instanceof Date) {
    date = dateVal;
  } else {
    date = new Date(String(dateVal).replace(' ', 'T'));
  }
  if (isNaN(date.getTime())) return String(dateVal);

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (language === 'ko') {
    return `${timeStr} ${date.getMonth() + 1}월 ${date.getDate()}일`;
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const day = date.getDate();
  return `${timeStr} ${month} ${day}`;
}

const renderHighlightedText = (text: string, search: string, isActive: boolean) => {
  if (!search) return text;
  const parts = text.split(new RegExp(`(${search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === search.toLowerCase() ? (
          <span 
            key={i} 
            style={{ 
              backgroundColor: isActive ? '#ffd54f' : 'rgba(255, 230, 0, 0.3)', 
              fontWeight: isActive ? 'bold' : 'normal',
              borderRadius: '2px',
              padding: '0 2px',
              color: 'var(--color-gray-900)'
            }}
          >
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
};

export default function PendingReviewItem({
  id,
  title,
  time,
  updatedAt,
  onClick,
  onDelete,
  isActiveMatch = false,
  highlightQuery = '',
}: PendingReviewItemProps) {
  const { language } = useTranslation();
  const displayTime = time ? (time.includes('ago') || time.includes('전') ? time : formatDateTime(time, language)) : formatDateTime(updatedAt, language);

  return (
    <div 
      id={`pending-review-${id}`} 
      className={`${styles.card} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
    >
      <button
        type="button"
        className={styles.deleteButton}
        onClick={(e) => {
          e.stopPropagation();
          onDelete?.();
        }}
        title={language === 'en' ? 'Exclude' : '삭제'}
        aria-label={language === 'en' ? 'Exclude' : '삭제'}
      >
        <DeleteIcon width={18} height={18} />
      </button>
      <h4 className={styles.title} title={title}>
        {renderHighlightedText(title, highlightQuery, isActiveMatch)}
      </h4>
      {displayTime && (
        <span className={styles.time}>
          {displayTime}
        </span>
      )}
    </div>
  );
}
