import React from 'react';
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
  secondaryLabel?: string;
  /** Primary 버튼 클릭 핸들러 */
  onPrimaryClick: () => void;
  /** Secondary 버튼 클릭 핸들러 */
  onSecondaryClick?: () => void;
  /** 카드 자체 클릭 핸들러 (상세 모달 등) */
  onClick?: () => void;
}

function getRelativeTime(dateString?: string | Date, language: string = 'en', timeTexts?: any): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return `${diffDays}${language === 'en' ? ' ' : ''}${timeTexts?.daysAgo || (language === 'ko' ? '일 전' : 'days ago')}`;
  } else if (diffHours > 0) {
    return `${diffHours}${language === 'en' ? ' ' : ''}${timeTexts?.hoursAgo || (language === 'ko' ? '시간 전' : 'hrs ago')}`;
  } else if (diffMins > 0) {
    return `${diffMins}${language === 'en' ? ' ' : ''}${timeTexts?.minsAgo || (language === 'ko' ? '분 전' : 'mins ago')}`;
  } else {
    return timeTexts?.justNow || (language === 'ko' ? '방금 전' : 'Just now');
  }
}

function getDeptClass(deptName?: string): string {
  if (!deptName) return '';
  const upper = deptName.toUpperCase();
  if (upper.includes('HK') || upper.includes('HOUSEKEEPING') || upper.includes('하우스키핑')) return styles.deptHk;
  if (upper.includes('FB') || upper.includes('FNB') || upper.includes('식음료')) return styles.deptFb;
  if (upper.includes('FACILITY') || upper.includes('MAINTENANCE') || upper.includes('시설')) return styles.deptFacility;
  if (upper.includes('CONCIERGE') || upper.includes('컨시어지')) return styles.deptConcierge;
  if (upper.includes('EMERGENCY') || upper.includes('긴급')) return styles.deptEmergency;
  if (upper.includes('FRONT') || upper.includes('프론트')) return styles.deptFront;
  return '';
}

export default function NotificationCard({
  variant,
  title,
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
  const { t, language } = useTranslation();
  const isUrgent = priority === 'URGENT';
  const timeText = createdAt ? getRelativeTime(createdAt, language, t.ticketUI?.time) : '';

  // 1. 첫 줄: Front Desk가 해야 할 판단
  const decisionText = variant === 'cancel'
    ? (language === 'en' ? 'Cancel request' : '취소 승인 요청')
    : (language === 'en' ? 'Transfer request' : '이관 승인 요청');

  // 2. 둘째 줄: 그 판단의 대상 (객실 · 요청 항목)
  const roomDisplay = language === 'en' ? `Room ${roomNumber}` : `${roomNumber}호`;
  const toSentenceCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  const cleanTitle = toSentenceCase(title);
  const targetDisplay = cleanTitle ? `${roomDisplay} · ${cleanTitle}` : roomDisplay;

  return (
    <div
      className={`${styles.card} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
    >
      {/* 1. 첫 줄: Front Desk가 해야 할 판단 + 긴급 배지 + 우측 부서명 */}
      <div className={styles.headerRow}>
        <div className={styles.titleAndBadges}>
          <h4 className={styles.decisionTitle}>{decisionText}</h4>

          <div className={styles.badgesWrapper}>
            {isUrgent && (
              <StatusBadge variant="red">
                {language === 'en' ? 'Urgent' : '긴급'}
              </StatusBadge>
            )}
          </div>
        </div>

        {departmentName && (
          <span className={`${styles.deptName} ${getDeptClass(departmentName)}`}>
            {departmentName}
          </span>
        )}
      </div>

      {/* 2. 둘째 줄: 그 판단의 대상 (Room 402 · Shampoo x1) */}
      <div className={styles.targetRow}>
        <span className={styles.targetText}>{targetDisplay}</span>
      </div>

      {/* 3. 셋째 줄: 좌측 시간 텍스트 & 우측 승인 버튼 */}
      <div className={styles.footerRow}>
        <span className={styles.timeText}>{timeText}</span>

        <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
          <Button
            variant="primary"
            size="medium"
            onClick={onPrimaryClick}
          >
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
