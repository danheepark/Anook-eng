'use client';

import React from 'react';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/Table/Table';
import styles from './RatingTable.module.css';

interface RatingItem {
  requestId: number;
  roomNo: string;
  summary: string;
  rating: number;
  staffName: string;
  createdAt: string;
  updatedAt: string;
}

interface RatingTableProps {
  ratings: RatingItem[];
  loading: boolean;
  averageRating: number;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className={styles.stars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= rating ? styles.starFilled : styles.starEmpty}>
          ★
        </span>
      ))}
    </span>
  );
}

function formatDate(dateString: string) {
  const d = new Date(dateString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function RatingTable({ ratings, loading, averageRating }: RatingTableProps) {
  if (loading) {
    return <div className={styles.emptyState}>로딩 중...</div>;
  }

  return (
    <div>
      {/* 평균 별점 요약 카드 */}
      <div className={styles.summaryCard}>
        <div className={styles.summaryLabel}>평균 상담 만족도</div>
        <div className={styles.summaryScore}>
          <StarDisplay rating={Math.round(averageRating)} />
          <span className={styles.scoreText}>{averageRating.toFixed(1)}</span>
          <span className={styles.scoreCount}>({ratings.length}건)</span>
        </div>
      </div>

      {/* 별점 테이블 */}
      <Table columns="100px 1fr 120px 120px 140px">
        <TableHeader>
          <TableCell>객실</TableCell>
          <TableCell>상담 내용</TableCell>
          <TableCell>상담 직원</TableCell>
          <TableCell>별점</TableCell>
          <TableCell>상담 일시</TableCell>
        </TableHeader>
        
        {ratings.length === 0 ? (
          <div className={styles.emptyState} style={{ gridColumn: '1 / -1' }}>
            등록된 별점 피드백이 없습니다.
          </div>
        ) : (
          ratings.map((item) => (
            <TableRow key={item.requestId}>
              <TableCell label="객실">
                <span className={styles.roomBadge}>{item.roomNo}</span>
              </TableCell>
              <TableCell label="상담 내용">
                <span className={styles.summaryText}>{item.summary || '-'}</span>
              </TableCell>
              <TableCell label="상담 직원">
                <span className={styles.staffName}>{item.staffName}</span>
              </TableCell>
              <TableCell label="별점">
                <span className={styles.ratingText}>{item.rating}/5</span>
              </TableCell>
              <TableCell label="상담 일시">
                <span className={styles.dateText}>{formatDate(item.createdAt)}</span>
              </TableCell>
            </TableRow>
          ))
        )}
      </Table>
    </div>
  );
}
