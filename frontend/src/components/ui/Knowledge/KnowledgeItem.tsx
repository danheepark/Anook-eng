import React from 'react';
import styles from './KnowledgeItem.module.css';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import EditIcon from '@/components/icons/EditIcon';
import DeleteIcon from '@/components/icons/DeleteIcon';
import { useTranslation } from '@/app/useTranslation';

export interface KnowledgeItemProps {
  id: number;
  domainCode: string;
  question: string;
  answer: string;
  updatedAt?: string;
  onClick?: () => void;
  onEdit?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  isActiveMatch?: boolean;
  highlightQuery?: string;
}

function formatKnowledgeDateTime(dateVal?: string | Date, language: string = 'en') {
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
  const year = date.getFullYear();
  const timeStr = `${hours}:${minutes}`;

  if (language === 'ko') {
    return `${timeStr} ${year}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const day = date.getDate();
  return `${timeStr} ${month} ${day} ${year}`;
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

export default function KnowledgeItem({ 
  id, 
  domainCode, 
  question, 
  answer, 
  updatedAt, 
  onClick, 
  onEdit, 
  onDelete, 
  isActiveMatch = false, 
  highlightQuery = '',
}: KnowledgeItemProps) {
  const { t, language } = useTranslation();

  const getDeptLabel = (code: string) => {
    switch (code?.toUpperCase()) {
      case 'HK': return t.frontdeskPage?.rag?.tabs?.HK || '하우스키핑';
      case 'FB': return t.frontdeskPage?.rag?.tabs?.FB || '식음료';
      case 'FACILITY': return t.frontdeskPage?.rag?.tabs?.FACILITY || '시설관리';
      case 'CONCIERGE': return t.frontdeskPage?.rag?.tabs?.CONCIERGE || '컨시어지';
      case 'FRONT': return t.frontdeskPage?.rag?.tabs?.FRONT || '프론트';
      case 'EMERGENCY': return t.frontdeskPage?.rag?.tabs?.EMERGENCY || '긴급';
      case 'UNKNOWN': return (language === 'en' ? 'Unknown' : '미분류');
      case 'COMMON': return t.frontdeskPage?.rag?.tabs?.COMMON || '공통';
      default: return code || (language === 'en' ? 'Unknown' : '미분류');
    }
  };

  const getDeptVariant = (code: string): 'hk' | 'fb' | 'facility' | 'concierge' | 'front' | 'emergency' | 'gray' => {
    switch (code?.toUpperCase()) {
      case 'HK': return 'hk';
      case 'FB': return 'fb';
      case 'FACILITY': return 'facility';
      case 'CONCIERGE': return 'concierge';
      case 'FRONT': return 'front';
      case 'EMERGENCY': return 'emergency';
      case 'UNKNOWN': return 'gray';
      default: return 'gray';
    }
  };

  const truncateText = (text: string, maxLength: number = 200) => {
    if (!text) return '';
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  };

  return (
    <div 
      id={`knowledge-${id}`} 
      className={styles.container} 
      onClick={onClick}
    >
      {/* 1. Title on top, Subtitle content preview below */}
      <div className={styles.mainInfo}>
        <h3 className={styles.title}>
          {renderHighlightedText(question, highlightQuery, isActiveMatch)}
        </h3>
        <p className={styles.subtitle}>
          {renderHighlightedText(truncateText(answer, 200), highlightQuery, isActiveMatch)}
        </p>
      </div>

      {/* 2. Department Badge (Direct child) */}
      <div className={styles.badgeWrapper}>
        <StatusBadge variant={getDeptVariant(domainCode)}>
          {getDeptLabel(domainCode)}
        </StatusBadge>
      </div>

      {/* 3. Date (Direct child) */}
      {updatedAt ? (
        <div className={styles.dateWrapper}>
          <span className={styles.dateText}>{formatKnowledgeDateTime(updatedAt, language)}</span>
        </div>
      ) : null}

      {/* 4. Action Icons (Direct child) */}
      <div className={styles.actions}>
        {onEdit && (
          <button 
            type="button"
            className={styles.actionIcon} 
            title={(t.common as Record<string, string>)?.edit || '수정'}
            aria-label="수정"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(e);
            }}
          >
            <EditIcon width={18} height={18} />
          </button>
        )}
        {onDelete && (
          <button 
            type="button"
            className={`${styles.actionIcon} ${styles.deleteIcon}`} 
            title={(t.common as Record<string, string>)?.delete || '삭제'}
            aria-label="삭제"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(e);
            }}
          >
            <DeleteIcon width={18} height={18} />
          </button>
        )}
      </div>
    </div>
  );
}
