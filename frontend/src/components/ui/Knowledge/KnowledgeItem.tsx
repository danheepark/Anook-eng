import React from 'react';
import styles from './KnowledgeItem.module.css';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import EditIcon from '@/components/icons/EditIcon';
import DeleteIcon from '@/components/icons/DeleteIcon';

export interface KnowledgeItemProps {
  id: number;
  domainCode: string;
  question: string;
  answer: string;
  updatedAt: string;
  onClick?: () => void;
  onEdit?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  isActiveMatch?: boolean;
  highlightQuery?: string;
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

export default function KnowledgeItem({ id, domainCode, question, answer, updatedAt, onClick, onEdit, onDelete, isActiveMatch = false, highlightQuery = '' }: KnowledgeItemProps) {
  return (
    <div id={`knowledge-${id}`} className={styles.container} onClick={onClick}>
      <div className={styles.topRow}>
        <div className={styles.badgeWrapper}>
          <StatusBadge variant="gray">{domainCode}</StatusBadge>
        </div>
        <div className={styles.topRight}>
          <span className={styles.dateText}>{updatedAt}</span>
        </div>
      </div>
      <h3 className={styles.title}>{renderHighlightedText(question, highlightQuery, isActiveMatch)}</h3>
      <p className={styles.description}>{renderHighlightedText(answer, highlightQuery, isActiveMatch)}</p>
      <div className={styles.bottomRow}>
        <div className={styles.actions}>
          <span 
            className={styles.actionIcon} 
            title="수정"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(e);
            }}
          >
            <EditIcon width={20} height={20} />
          </span>
          <span 
            className={styles.actionIcon} 
            title="삭제"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(e);
            }}
          >
            <DeleteIcon width={20} height={20} />
          </span>
        </div>
      </div>
    </div>
  );
}
