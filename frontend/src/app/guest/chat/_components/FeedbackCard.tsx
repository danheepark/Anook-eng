'use client';

import React, { useState } from 'react';
import styles from './FeedbackCard.module.css';
import { ReviewStarIcon } from '@/components/icons';
import { Check, Home, Utensils, Wrench, ConciergeBell, Monitor, AlertTriangle, FileText } from 'lucide-react';
import { useTranslation } from '@/app/useTranslation';

const DOMAIN_MAP: Record<string, { icon: React.ElementType; label: string }> = {
  HK: { icon: Home, label: '하우스키핑' },
  FB: { icon: Utensils, label: '식음료' },
  FACILITY: { icon: Wrench, label: '시설관리' },
  CONCIERGE: { icon: ConciergeBell, label: '컨시어지' },
  FRONT: { icon: Monitor, label: '프론트' },
  EMERGENCY: { icon: AlertTriangle, label: '긴급' },
  UNKNOWN: { icon: FileText, label: '기타' },
};

export interface FeedbackCardProps {
  /** 요청 요약 (AI 요청 완료 시 전달) */
  summary?: string;
  /** 부서 코드 (아이콘/라벨 결정) */
  domainCode?: string;
  /** 완료 시간 */
  completedAt?: string;
  /** 별점 제출 핸들러 */
  onSubmit?: (rating: number) => void;
  /** 시스템 메시지 모드 여부 */
  isSystemMessage?: boolean;
  /** 시스템 메시지 내용 */
  systemContent?: string;
  /** 시스템 메시지 부제목/가이드 */
  systemSubtitle?: string;
}

export default function FeedbackCard({ 
  summary, 
  domainCode, 
  completedAt, 
  onSubmit,
  isSystemMessage = false,
  systemContent,
  systemSubtitle
}: FeedbackCardProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  
  const ratingLabels = ['', t.feedbackCard?.ratings['1'] || '별로예요', t.feedbackCard?.ratings['2'] || '그저 그래요', t.feedbackCard?.ratings['3'] || '보통이에요', t.feedbackCard?.ratings['4'] || '좋았어요', t.feedbackCard?.ratings['5'] || '최고예요!'];

  const activeRating = hoverRating || rating;
  const domainInfo = DOMAIN_MAP[domainCode || 'UNKNOWN'] || DOMAIN_MAP['UNKNOWN'];

  // 요청 정보가 있으면 요청 완료 카드, 없으면 상담 완료 카드
  const hasRequestInfo = !!summary;

  const handleStarClick = (star: number) => {
    if (submitted) return;
    setRating(star);
    setSubmitted(true);
    if (onSubmit) onSubmit(star);
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  if (isSystemMessage) {
    return (
      <div 
        className={`glass-panel ${styles.card}`} 
        style={{ 
          margin: 'var(--space-8) 0', 
          width: '100%', 
          border: '1px solid var(--color-success, #10B981)',
          background: 'linear-gradient(to right, color-mix(in srgb, var(--color-success, #10B981) 8%, rgba(255, 255, 255, 0)) 0%, rgba(255, 255, 255, 0) 70%), rgba(255, 255, 255, 0.6)'
        }}
      >
        <div className={styles.cardLayout}>
          {/* Left Column: Icon */}
          <div className={styles.leftColumn}>
            <div className={styles.iconContainer} style={{ backgroundColor: 'color-mix(in srgb, var(--color-success, #10B981) 15%, #fff)' }}>
              <Check size={20} color="var(--color-success, #10B981)" strokeWidth={3} />
            </div>
          </div>

          {/* Right Column */}
          <div className={styles.rightColumn}>
            <div className={styles.content}>
              <div className={styles.summaryRow}>
                <div className={styles.title}>
                  {systemContent || t.feedbackCard?.systemCompletedTitle || '이전 상담 및 처리가 모두 완료되었습니다.'}
                </div>
              </div>
            </div>

            <div className={styles.subtitle}>
              {systemSubtitle || t.feedbackCard?.systemCompletedSubtitle || '(※ 고객에게 노출되지 않는 프론트 운영용 메시지입니다)'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 게스트용 제목: 도메인 라벨 + "요청 완료"
  const displayTitle = hasRequestInfo
    ? `${domainInfo.label} ${t.feedbackCard?.requestCompleted || '요청 완료'}`
    : (t.feedbackCard?.consultationCompleted || '상담이 완료되었습니다');

  return (
    <div className={`glass-panel ${styles.card}`}>
      <div className={styles.cardLayout}>
        {/* Left Column: Icon */}
        <div className={styles.leftColumn}>
          <div className={styles.iconContainer}>
            <Check size={20} color="var(--color-success, #10B981)" strokeWidth={3} />
          </div>
        </div>

        {/* Right Column */}
        <div className={styles.rightColumn}>
          <div className={styles.content}>
            <div className={styles.summaryRow}>
              <div className={styles.title}>{displayTitle}</div>
              {completedAt && <div className={styles.timeLabel}>{formatTime(completedAt)}</div>}
            </div>
          </div>

          <div className={styles.subtitle}>
            {submitted
              ? `${ratingLabels[rating]} — ${t.feedbackCard?.thankYou || '감사합니다!'}`
              : (t.feedbackCard?.satisfactionQuestion || '서비스가 만족스러우셨나요?')}
          </div>

          {/* Inline Star Rating */}
          <div className={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={styles.starButton}
                onClick={() => handleStarClick(star)}
                onMouseEnter={() => !submitted && setHoverRating(star)}
                onMouseLeave={() => !submitted && setHoverRating(0)}
                aria-label={`${star}점`}
                disabled={submitted}
              >
                <ReviewStarIcon
                  className={`${styles.starIcon} ${star <= activeRating ? styles.starFilled : styles.starEmpty}`}
                  fill={star <= activeRating ? 'currentColor' : 'none'}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
