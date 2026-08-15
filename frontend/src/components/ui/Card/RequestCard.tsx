import React, { useState, useEffect } from 'react';
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

  // 30초마다 상대 시간(1 min ago 등) 자동 갱신
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

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

  const needsAttention = status === 'PENDING' || !!hasNewMessage;

  return (
    <>
      <div className={`${styles.requestCard} ${isWarning ? styles.requestCardWarning : ''} ${isEmergency ? styles.requestCardEmergency : ''} ${isSelected ? styles.requestCardSelected : ''} ${isActiveMatch ? styles.requestCardActiveMatch : ''} ${status === 'CANCELLED' ? styles.isCancelled : ''} ${status === 'ESCALATED' ? styles.isEscalated : ''} ${onCardClick ? styles.clickable : ''}`} onClick={onCardClick}>
        {needsAttention && <span className={styles.unreadDot} />}
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
          <div className={styles.badgeWrapper}>
            {isEmergency && (
              <Tag variant="red">EMERGENCY</Tag>
            )}
            {status === 'PENDING' && !isEmergency && (
              <Tag variant="red">NEW</Tag>
            )}
            {status === 'CANCELLED' && (
              <Tag variant="gray">{t.status?.cancelled || '취소됨'}</Tag>
            )}
            {status === 'ESCALATED' && (
              <Tag variant="gray">
                {language === 'ko' ? '이관 대기중' : 'Transfer Pending'}
              </Tag>
            )}
            {(status === 'IN_PROGRESS' || status === 'ASSIGNED') && hasNewMessage && (
              <div className={styles.messageBadge}>
                {newMessageCount && newMessageCount > 0 ? (newMessageCount > 99 ? '99+' : newMessageCount) : ''}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function getRelativeTime(dateString: string | Date, language: string = 'ko', timeTexts?: any): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString.replace(' ', 'T')) : new Date(dateString);
  if (isNaN(date.getTime())) return '';

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
    return timeTexts?.hoursAgo
      ? `${diffHours}${language === 'en' ? ' ' : ''}${timeTexts.hoursAgo}`
      : `${diffHours}${language === 'en' ? ' hrs ago' : '시간 전'}`;
  } else if (diffMins > 0) {
    return timeTexts?.minsAgo
      ? `${diffMins}${language === 'en' ? ' ' : ''}${timeTexts.minsAgo}`
      : `${diffMins}${language === 'en' ? ' mins ago' : '분 전'}`;
  } else {
    return timeTexts?.justNow
      ? timeTexts.justNow
      : (language === 'en' ? 'Just now' : '방금 전');
  }
}
