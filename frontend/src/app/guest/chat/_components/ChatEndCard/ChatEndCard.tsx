'use client';

import React, { useState } from 'react';
import styles from './ChatEndCard.module.css';
import { ReviewStarIcon } from '@/components/icons';
import { Check, Home, Utensils, Wrench, ConciergeBell, Monitor, AlertTriangle, FileText } from 'lucide-react';

const RATING_LABELS = ['', '별로예요', '그저 그래요', '보통이에요', '좋았어요', '최고예요!'];

const DOMAIN_MAP: Record<string, { icon: React.ElementType; label: string }> = {
  HK: { icon: Home, label: '하우스키핑' },
  FB: { icon: Utensils, label: '식음료' },
  FACILITY: { icon: Wrench, label: '시설관리' },
  CONCIERGE: { icon: ConciergeBell, label: '컨시어지' },
  FRONT: { icon: Monitor, label: '프론트' },
  EMERGENCY: { icon: AlertTriangle, label: '긴급' },
  UNKNOWN: { icon: FileText, label: '기타' },
};

export interface ChatEndCardProps {
  summary: string;
  domainCode?: string;
  completedAt: string;
  onSubmitRating?: (rating: number) => void;
}

export default function ChatEndCard({ summary, domainCode, completedAt, onSubmitRating }: ChatEndCardProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const activeRating = hoverRating || rating;
  const domainInfo = DOMAIN_MAP[domainCode || 'UNKNOWN'] || DOMAIN_MAP['UNKNOWN'];
  const DomainIcon = domainInfo.icon;

  const handleStarClick = (star: number) => {
    if (submitted) return;
    setRating(star);
    setSubmitted(true);
    onSubmitRating?.(star);
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  // 표시용 요약 — [프론트 연결] 등 내부 태그 제거
  const displaySummary = summary
    .replace(/^\[(?:프론트 연결|직원 인수인계)\]\s*/, '')
    .replace(/미학습 정보.*$/, '')
    .trim() || '요청 처리';

  return (
    <div className={`glass-panel ${styles.card}`}>
      <div className={styles.cardLayout}>
        {/* Left Column: Check Icon */}
        <div className={styles.leftColumn}>
          <div className={styles.iconContainer}>
            <Check size={20} color="var(--color-success, #10B981)" strokeWidth={3} />
          </div>
        </div>

        {/* Right Column */}
        <div className={styles.rightColumn}>
          <div className={styles.content}>
            <div className={styles.summaryRow}>
              <div className={styles.summary}>{displaySummary} 완료</div>
              <div className={styles.timeLabel}>{formatTime(completedAt)}</div>
            </div>
          </div>

          <div className={styles.subtitle}>
            {submitted
              ? `${RATING_LABELS[rating]} — 감사합니다!`
              : '서비스가 만족스러우셨나요?'}
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
