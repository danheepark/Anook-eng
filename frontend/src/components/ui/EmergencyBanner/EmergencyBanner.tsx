'use client';

import React, { useEffect, useRef } from 'react';
import styles from './EmergencyBanner.module.css';

interface EmergencyAlert {
  requestId: number;
  roomNo: string;
  summary: string;
  category: string;
}

interface EmergencyBannerProps {
  alert: EmergencyAlert;
  onDismiss: () => void;
  onClick?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  FIRE: '🔥 화재',
  MEDICAL: '🏥 의료',
  THREAT: '🚨 위협',
};

/**
 * 긴급 상황 알림 배너 (EM-217)
 *
 * WebSocket으로 URGENT + emergency_category 이벤트 수신 시 표시.
 * 빨간색 깜빡이는 배너 + 알림음으로 즉각 주의를 환기.
 */
export default function EmergencyBanner({ alert, onDismiss, onClick }: EmergencyBannerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 배너 표시 시 알림음 재생
  useEffect(() => {
    try {
      // Web Audio API로 경고음 생성 (외부 파일 불필요)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      
      // 브라우저 정책(Autoplay 방지)으로 인해 suspended 상태일 수 있음. 
      // 사용자가 페이지 어딘가를 한 번이라도 클릭했다면 resume()을 통해 깨울 수 있습니다.
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.type = 'sawtooth'; // 날카롭고 긴급한 느낌의 톱니파
      
      let time = ctx.currentTime;
      oscillator.start(time);
      
      // 고음과 저음이 빠르게 교차하는 '삐-뽀-삐-뽀' 화재 경보기 패턴 (총 6주기, 1.8초)
      for (let i = 0; i < 6; i++) {
        // 강하고 높은 음 (1200Hz)
        oscillator.frequency.setValueAtTime(1200, time);
        gain.gain.setValueAtTime(0.2, time);
        
        // 날카로운 낮은 음 (800Hz)
        oscillator.frequency.setValueAtTime(800, time + 0.15);
        gain.gain.setValueAtTime(0.2, time + 0.15);
        
        time += 0.3;
      }
      
      gain.gain.setValueAtTime(0, time);
      oscillator.stop(time);
    } catch {
      // AudioContext 미지원 환경 무시
    }
  }, [alert.requestId]);

  const categoryLabel = CATEGORY_LABELS[alert.category] || '🚨 긴급';

  return (
    <div className={styles.banner} onClick={onClick} role="alert">
      <div className={styles.iconPulse}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>

      <div className={styles.textArea}>
        <p className={styles.title}>
          {categoryLabel} — {alert.roomNo}호
        </p>
        <p className={styles.detail}>{alert.summary}</p>
      </div>

      <button
        className={styles.closeBtn}
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        aria-label="긴급 알림 닫기"
      >
        ✕
      </button>
    </div>
  );
}
