import React, { useState, useEffect, useMemo } from 'react';
import styles from './RequestStatusCard.module.css';
import StatusTimeline, { RequestStatus } from '../StatusTimeline/StatusTimeline';
import { useTranslation } from '@/app/useTranslation';
import { useUiStore } from '@/stores/useUiStore';
import { useTranslationApi } from '@/app/useTranslationApi';

export interface RequestStatusCardProps {
  requestId: number;
  summary: string;
  domainCode: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  entities?: Record<string, any>;
}

const DOMAIN_MAP: Record<string, string> = {
  'HK': '하우스키핑',
  'FB': '다이닝',
  'FACILITY': '엔지니어링',
  'ENG': '엔지니어링',
  'CONCIERGE': '컨시어지',
  'CON': '컨시어지',
  'FRONT': '프론트 데스크',
  'FD': '프론트 데스크',
  'EMERGENCY': '긴급',
};

export default function RequestStatusCard({
  requestId,
  summary,
  domainCode,
  status,
  createdAt,
  updatedAt,
  entities,
}: RequestStatusCardProps) {
  const { t } = useTranslation();
  const { language: uiLanguage, chatLanguage } = useUiStore();
  const [targetLang, setTargetLang] = useState<string>(chatLanguage);

  useEffect(() => {
    setTargetLang(chatLanguage);
  }, [chatLanguage]);

  const deptName = DOMAIN_MAP[domainCode] || domainCode;
  
  const formatTime = (isoStr: string) => {
    const date = new Date(isoStr);
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${min}`;
  };

  const isCancelled = status === 'CANCELLED';
  const isEscalatedChat = domainCode === 'FRONT' && entities?.intent === 'ESCALATION';

  const rawDynamicTitle = useMemo(() => {
    const intent = entities?.intent as string | undefined;
    if (domainCode === 'FB') {
      const menuItems = entities?.menu_items as any[] | undefined;
      if (menuItems && menuItems.length > 0) {
        const first = menuItems[0];
        const opt = first.selected_option ? `(${first.selected_option})` : '';
        const qty = first.quantity ? ` ${first.quantity}개` : '';
        const rest = menuItems.length > 1 ? ` 외 ${menuItems.length - 1}건` : '';
        return `${first.name}${opt}${qty}${rest}`;
      }
    } else if (domainCode === 'CONCIERGE') {
      if (!intent || !entities) return null;
      switch (intent) {
        case 'TAXI':
          return `택시 호출${t.cardUI?.message?.reserveSuffix || ' 예약'}`;
        case 'LUGGAGE_STORAGE': {
          const count = entities.count;
          const action = entities.action === 'store' ? '보관' : '찾기';
          return count 
            ? `짐 ${count}개 ${action}`
            : `수하물 ${action}`;
        }
        case 'RESTAURANT': 
          return `식당${t.cardUI?.message?.reserveSuffix || ' 예약'}`;
        case 'WAKE_UP_CALL': {
          const time = entities.time as string | undefined;
          return time 
            ? `${time} 모닝콜${t.cardUI?.message?.reserveSuffix || ' 예약'}` 
            : `모닝콜${t.cardUI?.message?.reserveSuffix || ' 예약'}`;
        }
        case 'POSTAL_SERVICE': {
          const item = entities.item as string | undefined;
          return item ? `${item} 발송 대행` : '우편물 발송 대행';
        }
        case 'DELIVERY': {
          const item = entities.item as string | undefined;
          return item 
            ? `${item} 배달`
            : `배달`;
        }
        case 'RESERVATION': {
          const target = entities.target as string | undefined;
          const time = entities.time as string | undefined;
          if (target && time) return `${time} ${target}${t.cardUI?.message?.reserveSuffix || ' 예약'}`;
          if (target) return `${target}${t.cardUI?.message?.reserveSuffix || ' 예약'}`;
          return `예약`;
        }
      }
    }
    return null;
  }, [domainCode, entities, t]);

  const sourceTextForTranslation = rawDynamicTitle || summary;

  const isTranslationRequired = targetLang !== 'ko' && !(targetLang === 'en' && !/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(sourceTextForTranslation || ''));

  const { translatedText: translatedSummaryRaw, isLoading: isTranslatingRaw } = useTranslationApi(
    isTranslationRequired ? sourceTextForTranslation : null,
    targetLang
  );

  const isTranslating = isTranslationRequired && isTranslatingRaw;
  const translatedSummary = isTranslationRequired ? translatedSummaryRaw : sourceTextForTranslation;

  // Format summary to hide internal notes from guest
  const baseSummary = translatedSummary || summary;
  
  let displaySummary = '';
  if (isTranslating) {
    displaySummary = t.cardUI?.message?.translating || 'Translating...';
  } else {
    displaySummary = baseSummary.includes('[직원 인수인계]') || baseSummary.includes('[프론트 연결]') || baseSummary.includes('미학습 정보') || isEscalatedChat
      ? (t.cardUI?.message?.escalationRequest || 'Front desk staff connection request')
      : baseSummary;
  }
  
  const getFixedTitle = () => {
    if (isTranslating || isEscalatedChat || baseSummary.includes('프론트 연결')) {
      return displaySummary;
    }
    
    if (rawDynamicTitle) {
      return displaySummary;
    }
    
    const intent = entities?.intent as string | undefined;
    
    // Fallback: intent 기반 번역 매핑
    if (domainCode !== 'HK' && domainCode !== 'FACILITY') {
      if (intent && (t.intents as any)?.[intent]) {
        return (t.intents as any)[intent];
      }
    }
    
    if (!domainCode) {
      return displaySummary.split('(')[0].trim();
    }
    return displaySummary;
  };

  let finalTitle = getFixedTitle();
  
  // '요청'과 '주문' 단어가 타이틀 끝에 있는 경우 제거 (예약은 유지)
  finalTitle = finalTitle
    .replace(/(?:\s*요청|\s*주문|\s*[Rr]equest|\s*[Oo]rder|\s*리퀘스트|\s*依頼|\s*注文|\s*请求|\s*订单)$/, '')
    .trim();

  if (isCancelled) {
    finalTitle += t.cardUI?.message?.cancelSuffix || ' 취소';
  }

  return (
    <div className={`${styles.card} ${isCancelled ? styles.isCancelled : ''}`}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.department}>{deptName}</span>
          <h3 className={styles.title}>
            {isTranslating ? (
              <span className={styles.translatingText}>{t.cardUI?.message?.translating || 'Translating...'}</span>
            ) : (
              finalTitle
            )}
          </h3>
        </div>
        <div className={styles.timeInfo}>
          <span style={{ font: 'var(--text-caption-regular)', color: 'var(--color-gray-400)' }}>#{requestId}</span>
          <span>접수: {formatTime(createdAt)}</span>
          {status !== 'CREATED' && status !== 'PENDING' && <span>업데이트: {formatTime(updatedAt)}</span>}
        </div>
      </div>
      
      <div className={styles.timelineWrapper}>
        <StatusTimeline status={status} />
      </div>
    </div>
  );
}
