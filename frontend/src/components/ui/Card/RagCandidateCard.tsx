import React from 'react';
import styles from './RagCandidateCard.module.css';
import Button from '@/components/ui/Button/Button';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';

export type RagReason = 'RAG_MISSING' | 'INTENT_UNCLEAR';

export interface RagCandidateCardProps {
  department: string;
  aiReason?: RagReason;
  roomNumber?: string;
  consultationContent?: string;
  question?: string;
  answer?: string;
  timestamp: string;
  onAddRag: (extractedContent: string) => void;
  onReject: () => void;
}

export default function RagCandidateCard({
  department,
  aiReason,
  roomNumber,
  consultationContent,
  question,
  answer,
  timestamp,
  onAddRag,
  onReject
}: RagCandidateCardProps) {

  // 대화 내용 중 '직원:'으로 시작하는 가장 긴 답장 추출
  const getLongestStaffReply = (text: string) => {
    const lines = text.split('\n');
    let longestReply = text;
    let maxLength = 0;
    
    const staffLines = lines.filter(line => line.includes('직원:'));
    if (staffLines.length > 0) {
      staffLines.forEach(line => {
        const reply = line.split('직원:')[1].trim();
        if (reply.length > maxLength) {
          maxLength = reply.length;
          longestReply = reply;
        }
      });
      return `"${longestReply}"`;
    }
    
    return `"${text.trim()}"`;
  };

  const displayContent = consultationContent ? getLongestStaffReply(consultationContent) : '';
  const reasonText = aiReason === 'RAG_MISSING' ? '지식 없음' : aiReason === 'INTENT_UNCLEAR' ? '의도 불명' : '검토 대기';
  const displayCategory = aiReason ? `${reasonText} (${department})` : `검토 대기 (${department})`;
  const badgeVariant = aiReason === 'INTENT_UNCLEAR' ? 'red' : 'purple';

  return (
    <div className={styles.card}>
      {roomNumber && (
        <div className={styles.roomBox}>
          <span className={styles.roomType}>객실</span>
          <span className={styles.roomNumber}>{roomNumber}</span>
        </div>
      )}

      <div className={styles.contentSection}>
        <div className={styles.contentHeader}>
          <StatusBadge variant={badgeVariant}>{displayCategory}</StatusBadge>
          <span className={styles.timeText}>
            {timestamp}
          </span>
        </div>
        
        {consultationContent ? (
          <h3 className={styles.title}>
            {displayContent}
          </h3>
        ) : (
          <>
            <div className={styles.questionText}>
              <strong>Q:</strong> {question || '(질문 없음)'}
            </div>
            <div className={styles.answerText}>
              <strong>A:</strong> {answer || '(답변 없음)'}
            </div>
          </>
        )}
      </div>

      <div className={styles.actionSection}>
        <Button 
          variant="primary" 
          onClick={() => onAddRag(consultationContent ? displayContent.replace(/(^"|"$)/g, '') : answer || '')} 
          style={{ width: '100%', padding: 'var(--space-8)' }}
        >
          RAG 추가
        </Button>
        <Button variant="secondary" onClick={onReject} style={{ width: '100%', padding: 'var(--space-8)' }}>제외</Button>
      </div>
    </div>
  );
}
