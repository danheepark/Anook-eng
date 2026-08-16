import React from 'react';
import { ChevronRight } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import Button from '@/components/ui/Button/Button';
import { useTranslation } from '@/app/useTranslation';
import styles from './NotificationCard.module.css';

export type NotificationVariant = 'cancel' | 'escalation';

interface NotificationCardProps {
  /** 카드 유형: 'cancel' = 취소 요청, 'escalation' = 이관 요청 */
  variant: NotificationVariant;
  /** AI가 생성한 요약 제목 */
  title: string;
  /** 원문 또는 상세 설명 (rawText 등) */
  description?: string;
  /** 객실 번호 */
  roomNumber: string;
  /** 소속 부서명 */
  departmentName?: string;
  /** 생성 시각 (ISO string) */
  createdAt?: string;
  /** 우선순위 */
  priority?: string;
  /** 좌측(Primary) 버튼 텍스트 */
  primaryLabel: string;
  /** 우측(Secondary) 버튼 텍스트 */
  secondaryLabel: string;
  /** Primary 버튼 클릭 핸들러 */
  onPrimaryClick: () => void;
  /** Secondary 버튼 클릭 핸들러 */
  onSecondaryClick: () => void;
  /** 카드 자체 클릭 핸들러 (상세 모달 등) */
  onClick?: () => void;
}

function formatRelativeTime(isoStr?: string, language?: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const diffInMs = Math.max(0, now.getTime() - d.getTime());
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  
  if (language === 'ko') {
    if (diffInMins < 1) return '방금 전';
    if (diffInMins < 60) return `${diffInMins}분 전`;
    const diffInHours = Math.floor(diffInMins / 60);
    if (diffInHours < 24) return `${diffInHours}시간 전`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}일 전`;
  }

  if (diffInMins < 1) return 'Just now';
  if (diffInMins === 1) return '1m ago';
  if (diffInMins < 60) return `${diffInMins}m ago`;
  const diffInHours = Math.floor(diffInMins / 60);
  if (diffInHours === 1) return '1h ago';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

export default function NotificationCard({
  variant,
  title,
  description,
  roomNumber,
  departmentName,
  createdAt,
  priority,
  primaryLabel,
  secondaryLabel,
  onPrimaryClick,
  onSecondaryClick,
  onClick,
}: NotificationCardProps) {
  const { language } = useTranslation();
  const isUrgent = priority === 'URGENT';
  const timeText = createdAt ? formatRelativeTime(createdAt, language) : '';

  const badgeText = variant === 'cancel'
    ? (language === 'en' ? 'Cancel' : '취소 요청')
    : (language === 'en' ? 'Transfer' : '이관 요청');

  const badgeVariant = variant === 'cancel' ? 'red' : 'purple';
  const roomDisplay = language === 'en' ? `Room ${roomNumber}` : `${roomNumber}호`;
  const toSentenceCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  const cleanTitle = toSentenceCase(title);

  return (
    <div
      className={`${styles.card} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
    >
      {/* 1. Header Row: Title + Inline Badges (Time, Type, Urgent) + Right Chevron */}
      <div className={styles.headerRow}>
        <div className={styles.titleAndBadges}>
          <div className={styles.titleWrapper}>
            <span className={styles.roomPrefix}>{roomDisplay}</span>
            <span className={styles.titleDivider}>•</span>
            <h4 className={styles.title}>{cleanTitle}</h4>
          </div>

          <div className={styles.badgesWrapper}>
            {timeText && (
              <StatusBadge variant="gray">{timeText}</StatusBadge>
            )}
            <StatusBadge variant={badgeVariant}>{badgeText}</StatusBadge>
            {isUrgent && (
              <StatusBadge variant="red">
                {language === 'en' ? 'Urgent' : '긴급'}
              </StatusBadge>
            )}
          </div>
        </div>

        <div className={styles.chevronWrapper}>
          <ChevronRight size={16} className={styles.chevronIcon} />
        </div>
      </div>

      {/* 2. Middle Row: Description Preview */}
      {description && (
        <p className={styles.description}>{description}</p>
      )}

      {/* 3. Footer Row: Department Info & Action Buttons */}
      <div className={styles.footerRow}>
        <div className={styles.metaInfo}>
          {departmentName && (
            <div className={styles.deptInfo}>
              <span className={styles.deptDot} />
              <span className={styles.deptLabel}>{departmentName}</span>
            </div>
          )}
        </div>

        <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
          <Button
            variant="secondary"
            className={styles.actionBtn}
            onClick={onSecondaryClick}
          >
            {secondaryLabel}
          </Button>
          <Button
            variant="primary"
            className={styles.actionBtn}
            onClick={onPrimaryClick}
          >
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
