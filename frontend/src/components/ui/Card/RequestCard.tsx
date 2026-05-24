import React from 'react';
import styles from './RequestCard.module.css';
import Button from '@/components/ui/Button/Button';
import Tag from '@/components/ui/StatusBadge/StatusBadge';
import { useTranslation } from '@/app/useTranslation';
import { useTranslationApi } from '@/app/useTranslationApi';

export interface RequestCardProps {
  roomType?: string;
  roomNumber: string | number;
  statusText?: string;
  statusVariant?: 'red' | 'purple' | 'green' | 'gray';
  createdAt: string | Date;
  title: string;
  description?: string;
  primaryActionText?: string;
  secondaryActionText?: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  onCardClick?: () => void;
  variant?: 'default' | 'warning';
  requestId?: number;
  status?: string;
  onStatusChange?: (id: number, newStatus: string) => Promise<void>;
  reverseActions?: boolean;
  isSelected?: boolean;
  hasNewMessage?: boolean;
  newMessageCount?: number;
  isEmergency?: boolean;
  highlightSearch?: string;
  isActiveMatch?: boolean;
}

export default function RequestCard({
  roomType = '객실',
  roomNumber,
  statusText = '미해결',
  statusVariant = 'red',
  createdAt,
  title,
  description,
  primaryActionText,
  secondaryActionText,
  onPrimaryAction,
  onSecondaryAction,
  onCardClick,
  variant = 'default',
  requestId,
  status,
  onStatusChange,
  reverseActions,
  isSelected = false,
  hasNewMessage = false,
  newMessageCount,
  isEmergency = false,
  highlightSearch = '',
  isActiveMatch = false
}: RequestCardProps) {
  const isWarning = variant === 'warning';
  const { t, language } = useTranslation();

  const { translatedText: translatedTitle } = useTranslationApi(title, language);
  const displayTitle = translatedTitle || title;

  const { translatedText: translatedDesc } = useTranslationApi(
    language !== 'ko' && description ? description : undefined,
    language
  );
  const displayDesc = language !== 'ko' && translatedDesc ? translatedDesc : description;

  const handlePrimaryClick = () => {
    if (onPrimaryAction) {
      onPrimaryAction();
    }
  };

  return (
    <>
      <div className={`${styles.requestCard} ${isWarning ? styles.requestCardWarning : ''} ${isEmergency ? styles.requestCardEmergency : ''} ${isSelected ? styles.requestCardSelected : ''} ${isActiveMatch ? styles.requestCardActiveMatch : ''} ${onCardClick ? styles.clickable : ''}`} onClick={onCardClick}>
        <div className={styles.roomBox}>
          <span className={styles.roomNumber}>
            {highlightSearch ? (
              <span dangerouslySetInnerHTML={{
                __html: String(roomNumber).replace(
                  new RegExp(`(${highlightSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                  '<mark style="background-color: var(--color-brand-100); color: var(--color-brand-500); padding: 0 2px; border-radius: 2px;">$1</mark>'
                )
              }} />
            ) : roomNumber}
          </span>
        </div>

        <div className={styles.contentSection}>
          <div className={styles.contentHeader}>
            <h3 className={styles.title}>
              {highlightSearch ? (
                <span dangerouslySetInnerHTML={{
                  __html: displayTitle.replace(
                    new RegExp(`(${highlightSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                    '<mark style="background-color: var(--color-brand-100); color: var(--color-brand-500); padding: 0 2px; border-radius: 2px;">$1</mark>'
                  )
                }} />
              ) : displayTitle}
            </h3>
          </div>
          
          <div className={styles.contentBody}>
            {displayDesc && (
              <p className={styles.description}>
                {highlightSearch ? (
                  <span dangerouslySetInnerHTML={{
                    __html: displayDesc.replace(
                      new RegExp(`(${highlightSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                      '<mark style="background-color: var(--color-brand-100); color: var(--color-brand-500); padding: 0 2px; border-radius: 2px;">$1</mark>'
                    )
                  }} />
                ) : displayDesc}
              </p>
            )}
          </div>

          {(primaryActionText || secondaryActionText) && (
            <div
              className={styles.actionSection}
              style={reverseActions ? { flexDirection: 'row-reverse' } : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              {secondaryActionText && (
                <Button variant="secondary" className={styles.actionButton} onClick={onSecondaryAction}>
                  {secondaryActionText}
                </Button>
              )}
              {primaryActionText && (
                <Button variant="primary" className={styles.actionButton} onClick={handlePrimaryClick}>
                  {primaryActionText}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className={styles.rightSection}>
          <span className={styles.timeText}>
            {getRelativeTime(createdAt, language, t.ticketUI?.time)}
          </span>
          {isEmergency && (
            <Tag variant="red">EMERGENCY</Tag>
          )}
          {status === 'PENDING' && !isEmergency && (
            <Tag variant="red">NEW</Tag>
          )}
          {(status === 'IN_PROGRESS' || status === 'ASSIGNED') && hasNewMessage && (
            <div className={styles.messageBadge}>
              {newMessageCount && newMessageCount > 0 ? (newMessageCount > 99 ? '99+' : newMessageCount) : ''}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function getRelativeTime(dateString: string | Date, language: string = 'ko', timeTexts?: any): string {
  let parsedString = dateString;
  if (typeof dateString === 'string' && !dateString.endsWith('Z') && !dateString.includes('+')) {
    parsedString = dateString + 'Z';
  }
  const date = new Date(parsedString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const paddedHours = String(hours).padStart(2, '0');
    return `${year}.${month}.${day} ${paddedHours}:${minutes} ${ampm}`;
  } else if (diffHours > 0) {
    return timeTexts
      ? `${diffHours}${language === 'en' ? ' ' : ''}${timeTexts.hoursAgo}`
      : `${diffHours}시간 전`;
  } else if (diffMins > 0) {
    return timeTexts
      ? `${diffMins}${language === 'en' ? ' ' : ''}${timeTexts.minsAgo}`
      : `${diffMins}분 전`;
  } else {
    return timeTexts
      ? timeTexts.justNow
      : '방금 전';
  }
}
