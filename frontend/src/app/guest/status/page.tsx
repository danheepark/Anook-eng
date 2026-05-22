'use client';

import React from 'react';
import styles from './page.module.css';
import { useRequestStatus } from './useRequestStatus';
import RequestStatusCard from './_components/RequestStatusCard/RequestStatusCard';

export default function GuestStatusPage() {
  // 테스트용으로 707호 하드코딩 (실제로는 로그인 세션이나 파라미터에서 가져옴)
  const roomNo = '707';
  const { requests, isLoading, error } = useRequestStatus(roomNo);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1 className={styles.title}>내 서비스 요청</h1>
          <p className={styles.subtitle}>
            {roomNo}호 고객님, 요청하신 서비스의 진행 상황을 실시간으로 확인하세요.
          </p>
        </header>

        {isLoading ? (
          <div className={styles.loading}>불러오는 중...</div>
        ) : error ? (
          <div className={styles.emptyState}>
            에러가 발생했습니다: {error}
          </div>
        ) : requests.length === 0 ? (
          <div className={styles.emptyState}>
            아직 요청하신 서비스가 없습니다.
          </div>
        ) : (
          <div className={styles.cardList}>
            {requests.map(req => (
              <RequestStatusCard
                key={req.id}
                requestId={req.id}
                summary={req.summary}
                domainCode={req.domainCode}
                status={req.status}
                createdAt={req.createdAt}
                updatedAt={req.updatedAt}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
