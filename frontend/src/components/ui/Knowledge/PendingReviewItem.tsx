'use client';

import React from 'react';
import styles from './PendingReviewItem.module.css';
import { useTranslation } from '@/app/useTranslation';

export interface PendingReviewItemProps {
  id: number;
  title: string;
  time?: string;
  updatedAt?: string;
  onClick?: () => void;
  isActiveMatch?: boolean;
  highlightQuery?: string;
}

function formatRelativeTime(dateString?: string, language: string = 'en') {
  if (!dateString) return '';
  // If already formatted like "2 hrs ago"
  if (dateString.includes('ago') || dateString.includes('전')) return dateString;

  const now = new Date();
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return language === 'en' ? 'Just now' : '방금 전';
  }
  if (diffMins < 60) {
    return language === 'en' ? `${diffMins} min${diffMins > 1 ? 's' : ''} ago` : `${diffMins}분 전`;
  }
  if (diffHours < 24) {
    return language === 'en' ? `${diffHours} hr${diffHours > 1 ? 's' : ''} ago` : `${diffHours}시간 전`;
  }
  if (diffDays < 7) {
    return language === 'en' ? `${diffDays} day${diffDays > 1 ? 's' : ''} ago` : `${diffDays}일 전`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
  isActiveMatch = false,
  highlightQuery = '',
}: PendingReviewItemProps) {
  const { language } = useTranslation();
  const displayTime = time || formatRelativeTime(updatedAt, language);

  return (
    <div 
      id={`pending-review-${id}`} 
      className={`${styles.card} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
    >
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
