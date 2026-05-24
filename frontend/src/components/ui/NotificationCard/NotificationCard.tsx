import React from 'react';
import Button from '@/components/ui/Button/Button';
import Tag from '@/components/ui/StatusBadge/StatusBadge';
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

const VARIANT_CONFIG: Record<NotificationVariant, { label: string; badgeVariant: 'red' | 'purple' | 'green' | 'gray' }> = {
  cancel: { label: '취소 요청', badgeVariant: 'red' },
  escalation: { label: '이관 요청', badgeVariant: 'purple' },
};

function formatRelativeTime(isoStr?: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const diffInMs = now.getTime() - d.getTime();
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  
  if (diffInMins < 1) return '방금 전';
  if (diffInMins < 60) return `${diffInMins}분 전`;
  
  const diffInHours = Math.floor(diffInMins / 60);
  if (diffInHours < 24) return `${diffInHours}시간 전`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}일 전`;
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
  const config = VARIANT_CONFIG[variant];
  const isUrgent = priority === 'URGENT';

  return (
    <div
      className={`${styles.card} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
    >
      {/* 컨텐츠 섹션 (Left & Middle) */}
      <div className={styles.contentSection}>
        <div className={styles.tagsRow}>
          <Tag variant={config.badgeVariant}>{config.label}</Tag>
          {isUrgent && <Tag variant="red">긴급</Tag>}
        </div>

        <div className={styles.titleRow}>
          <span className={styles.roomNumber}>{roomNumber}호</span>
          <h3 className={styles.title}>{title}</h3>
        </div>

        {description && <p className={styles.description}>{description}</p>}

        <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
          <Button
            variant="secondary"
            className={styles.actionButton}
            onClick={onSecondaryClick}
          >
            {secondaryLabel}
          </Button>
          <Button
            variant="primary"
            className={styles.actionButton}
            onClick={onPrimaryClick}
          >
            {primaryLabel}
          </Button>
        </div>
      </div>

      {/* 오른쪽 섹션 (Right - 시간 표시) */}
      <div className={styles.rightSection}>
        <span className={styles.timeText}>
          {[departmentName, createdAt ? formatRelativeTime(createdAt) : null]
            .filter(Boolean)
            .join(' • ')}
        </span>
      </div>
    </div>
  );
}
