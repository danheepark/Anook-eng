import React, { useState, useEffect } from 'react';
import styles from './RequestStatusBar.module.css';

export interface RequestStatusBarProps {
  requestId: number;
  domainCode: string;
  summary: string;
  status: string;
  entities?: Record<string, unknown>;
  createdAt?: string;
  progress: number;
}

const DOMAIN_MAP: Record<string, { icon: string; label: string }> = {
  HK: { icon: '🏨', label: '하우스키핑' },
  FB: { icon: '🍽️', label: '식음료' },
  FACILITY: { icon: '🔧', label: '시설관리' },
  CONCIERGE: { icon: '🛎️', label: '컨시어지' },
  FRONT: { icon: '🏢', label: '프론트' },
  EMERGENCY: { icon: '🚨', label: '긴급' },
  UNKNOWN: { icon: '📋', label: '기타 요청' },
};

const STATUS_TEXT: Record<string, string> = {
  PENDING: '대기 중',
  IN_PROGRESS: '처리 중',
  COMPLETED: '처리 완료',
  CANCELLED: '취소됨',
  CANCEL_PENDING: '취소 대기 중',
  ESCALATED: '긴급 대기 중',
};

export default function RequestStatusBar({
  requestId,
  domainCode,
  summary,
  status,
  entities,
  createdAt,
  progress,
}: RequestStatusBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(true);

  const domainInfo = DOMAIN_MAP[domainCode] || DOMAIN_MAP['UNKNOWN'];
  const statusLabel = STATUS_TEXT[status] || '알 수 없음';
  
  // Render entities description
  const renderDetails = () => {
    if (!entities) return null;
    
    // Old format fallback
    if (entities.item) {
      return `${entities.item} ${entities.count ? `×${entities.count}` : ''}`;
    }
    
    // New Multi-intent format
    const parts: string[] = [];
    if (Array.isArray(entities.items)) {
      entities.items.forEach((it: any) => {
        parts.push(`${it.item} ${it.count ? `×${it.count}` : ''}`);
      });
    }
    if (Array.isArray(entities.tasks)) {
      entities.tasks.forEach((t: string) => parts.push(t));
    }
    
    if (parts.length === 0) {
      if (entities.menu) parts.push(`${entities.menu}`);
      if (entities.symptom) parts.push(`${entities.symptom}`);
    }
    
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const detailsText = renderDetails();
  
  // Handle auto-hide on completion or cancellation
  useEffect(() => {
    if (status === 'CANCELLED') {
      setVisible(false);
    } else if (status === 'COMPLETED') {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setVisible(true); // reset visibility if status goes back to pending/assigned
    }
  }, [status]);

  if (!visible) {
    return <div className={styles.statusBarContainer + ' ' + styles.hidden} />;
  }

  return (
    <div className={styles.statusBarContainer}>
      {/* Compact Progress View */}
      <div className={styles.compactView} onClick={() => setExpanded(!expanded)}>
        <div className={styles.progressSection}>
          <div className={styles.inlineProgressBarContainer}>
            <div className={styles.inlineProgressBarBg}>
              <div 
                className={styles.inlineProgressBarFill} 
                style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} 
              />
            </div>
            <div className={styles.progressDotsOverlay}>
              <div className={`${styles.progressDot} ${progress > 0 ? styles.dotActive : ''}`} />
              <div className={`${styles.progressDot} ${progress >= 50 ? styles.dotActive : ''}`} />
              <div className={`${styles.progressDot} ${progress >= 100 ? styles.dotActive : ''}`} />
            </div>
          </div>
        </div>

        <div className={styles.statusSection}>
          <span className={styles.summary}>{statusLabel}</span>
          <span className={`${styles.arrow} ${expanded ? styles.open : ''}`}>▾</span>
        </div>
      </div>

      {/* Expandable Details View */}
      {expanded && (
        <div className={styles.expandedView}>
          <div className={styles.detailsContainer}>
            <div className={styles.detailsTitle}>📋 {summary}</div>
            
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>담당 부서</span>
              <span className={styles.detailValue}>{domainInfo.label}</span>
            </div>
            
            {detailsText && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>상세 내용</span>
                <span className={styles.detailValue}>{detailsText}</span>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
