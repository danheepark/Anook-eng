'use client';

import React, { useState } from 'react';
import styles from './ChatEndCard.module.css';
import { ReviewStarIcon } from '@/components/icons';
import { Check, Home, Utensils, Wrench, ConciergeBell, Monitor, AlertTriangle, FileText } from 'lucide-react';
import { useTranslation } from '@/app/useTranslation';
import { useUiStore } from '@/stores/useUiStore';

const DOMAIN_MAP: Record<string, { icon: React.ElementType }> = {
  HK: { icon: Home },
  FB: { icon: Utensils },
  FACILITY: { icon: Wrench },
  CONCIERGE: { icon: ConciergeBell },
  FRONT: { icon: Monitor },
  EMERGENCY: { icon: AlertTriangle },
  UNKNOWN: { icon: FileText },
};

export interface ChatEndCardProps {
  summary: string;
  domainCode?: string;
  completedAt: string;
  onSubmitRating?: (rating: number) => void;
}

export default function ChatEndCard({ summary, domainCode, completedAt, onSubmitRating }: ChatEndCardProps) {
  const { chatLanguage, language: uiLanguage } = useUiStore();
  const targetLang = chatLanguage || uiLanguage || 'en';
  const { t } = useTranslation(targetLang);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const ratingLabels = ['', t.feedbackCard?.ratings['1'] || 'Terrible', t.feedbackCard?.ratings['2'] || 'Poor', t.feedbackCard?.ratings['3'] || 'Average', t.feedbackCard?.ratings['4'] || 'Good', t.feedbackCard?.ratings['5'] || 'Excellent!'];

  const activeRating = hoverRating || rating;
  const domainInfo = DOMAIN_MAP[domainCode || 'UNKNOWN'] || DOMAIN_MAP['UNKNOWN'];

  const handleStarClick = (star: number) => {
    if (submitted) return;
    setRating(star);
    setSubmitted(true);
    onSubmitRating?.(star);
  };

  const formatTime = (dateStr?: string) => {
    const d = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(d.getTime())) return '';
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  // 표시용 요약 — [프론트 연결] 등 내부 태그 제거
  const displaySummary = summary
    .replace(/^\[(?:프론트 연결|직원 인수인계)\]\s*/, '')
    .replace(/미학습 정보.*$/, '')
    .trim() || (targetLang === 'ko' ? '요청 처리' : 'Request Processed');

  const completedLabel = targetLang === 'ko' ? '완료' : 'Completed';
  const satisfactionLabel = t.feedbackCard?.satisfactionQuestion || (targetLang === 'ko' ? '서비스가 만족스러우셨나요?' : 'How was our service?');
  const thankYouLabel = t.feedbackCard?.thankYou || (targetLang === 'ko' ? '감사합니다!' : 'Thank you!');

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
              <div className={styles.summary}>{displaySummary} {completedLabel}</div>
              <div className={styles.timeLabel}>{formatTime(completedAt)}</div>
            </div>
          </div>

          <div className={styles.subtitle}>
            {submitted
              ? `${ratingLabels[rating]} · ${thankYouLabel}`
              : satisfactionLabel}
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
