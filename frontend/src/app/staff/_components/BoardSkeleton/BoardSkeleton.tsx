import React from 'react';
import styles from './BoardSkeleton.module.css';

const COLUMNS = ['대기 중', '진행 중', '완료됨'];
const TICKET_COUNTS = [3, 2, 1]; // 각 컬럼별 스켈레톤 티켓 수

function SkeletonTicket({ hasButton = false }: { hasButton?: boolean }) {
  return (
    <div className={styles.ticket}>
      <div className={styles.ticketHeader}>
        <div className={styles.ticketBadge} />
        <div className={styles.ticketRoom} />
      </div>
      <div className={styles.ticketTitle} />
      <div className={styles.ticketDesc} />
      <div className={styles.ticketFooter}>
        <div className={styles.ticketTime} />
        {hasButton && <div className={styles.ticketButton} />}
      </div>
    </div>
  );
}

export default function BoardSkeleton() {
  return (
    <section className={styles.board}>
      {COLUMNS.map((title, colIdx) => (
        <div key={title} className={styles.column}>
          <div className={styles.columnHeader}>
            <div className={styles.columnTitle} />
            <div className={styles.columnCount} />
          </div>
          {Array.from({ length: TICKET_COUNTS[colIdx] }).map((_, i) => (
            <SkeletonTicket key={i} hasButton={colIdx < 2} />
          ))}
        </div>
      ))}
    </section>
  );
}
