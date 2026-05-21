'use client';

import React from 'react';
import ModalOverlay from './ModalOverlay';
import ModalCard from './ModalCard';
import { CodeIcon } from '@/components/icons';
import Tag from '@/components/ui/StatusBadge/StatusBadge';
import SummaryCard from '@/components/ui/Card/SummaryCard';
import styles from './LogDataModal.module.css';

import { AiLogDetail } from '@/app/frontdesk/ai-routing/useAiLogs';

interface LogDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  log?: AiLogDetail | null;
}

export default function LogDataModal({ isOpen, onClose, log }: LogDataModalProps) {
  if (!isOpen) return null;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalCard size="lg" onClose={onClose}>
        <div className={styles.modalContent}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.titleSection}>
              <div className={styles.iconBox}>
                <CodeIcon />
              </div>
              <div className={styles.titleGroup}>
                <div className={styles.titleRow}>
                  <h2 className={styles.title}>로그 데이터 분석</h2>
                  <Tag variant="gray">RAW DATA</Tag>
                </div>
                <p className={styles.subtitle}>
                  연결된 티켓 번호: <span className={styles.ticketId}>request_id: #{log?.id}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className={styles.statsGrid}>
            <SummaryCard title="총 토큰" value={log?.totalTokens?.toLocaleString() || "0"} size="sm" />
            <SummaryCard title="Fallback 여부" value={log?.isFallback ? "YES" : "NO"} size="sm" />
            <SummaryCard title="처리 시간" value={`${log?.latencyMs || 0}ms`} size="sm" />
            <SummaryCard title="사용 모델" value={log?.modelName || "N/A"} size="sm" />
          </div>

          {/* Prompt Section */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>입력 프롬프트 원문 (RAW PROMPT)</h3>
            <div className={styles.promptText}>
              {log?.rawPrompt || "No prompt data."}
            </div>
          </div>

          {/* Response Section */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>AI 출력 JSON 원문 (RAW RESPONSE)</h3>
            <div className={styles.jsonContainer} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {log?.rawResponse || "No response data."}
            </div>
          </div>

        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
