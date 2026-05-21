import React, { useState, useEffect } from 'react';
import styles from './RequestStatusBar.module.css';
import { useTranslation } from '@/app/useTranslation';
import { useTranslationApi } from '@/app/useTranslationApi';
import { useUiStore } from '@/stores/useUiStore';

export interface RequestStatusBarProps {
  requestId: number;
  domainCode: string;
  summary: string;
  status: string;
  entities?: Record<string, unknown>;
  createdAt?: string;
  progress: number;
  isMini?: boolean;
}

const DOMAIN_MAP: Record<string, { icon: string, key: string }> = {
  HK: { icon: '🏨', key: 'HK' },
  FB: { icon: '🍽️', key: 'FB' },
  FACILITY: { icon: '🔧', key: 'FACILITY' },
  CONCIERGE: { icon: '🛎️', key: 'CONCIERGE' },
  FRONT: { icon: '🏢', key: 'FRONT' },
  EMERGENCY: { icon: '🚨', key: 'EMERGENCY' },
  UNKNOWN: { icon: '📋', key: 'UNKNOWN' },
};

export default function RequestStatusBar({
  domainCode,
  summary,
  status,
  entities,
  progress,
  isMini = false
}: RequestStatusBarProps) {
  const [visible, setVisible] = useState(true);
  const { t } = useTranslation();
  
  const isCancelled = status === 'CANCELLED';
  const isEscalatedChat = domainCode === 'FRONT' && entities?.intent === 'ESCALATION';

  const { chatLanguage } = useUiStore();
  const [targetLang, setTargetLang] = useState<string>(chatLanguage);

  useEffect(() => {
    setTargetLang(chatLanguage);
  }, [chatLanguage]);

  // Translation for summary
  const rawDynamicTitle = React.useMemo(() => {
    const intent = entities?.intent as string | undefined;
    if (domainCode === 'FB') {
      const menuItems = entities?.menu_items as any[] | undefined;
      if (menuItems && menuItems.length > 0) {
        const first = menuItems[0];
        const opt = first.selected_option ? `(${first.selected_option})` : '';
        const qty = first.quantity ? ` ${first.quantity}개` : '';
        const rest = menuItems.length > 1 ? ` 외 ${menuItems.length - 1}건` : '';
        return `${first.name}${opt}${qty}${rest} 주문`;
      }
    } else if (domainCode === 'CONCIERGE') {
      if (!intent || !entities) return null;
      switch (intent) {
        case 'TAXI':
          return '택시 호출 예약';
        case 'LUGGAGE_STORAGE': {
          const count = entities.count;
          const action = entities.action === 'store' ? '보관' : '찾기';
          return count ? `짐 ${count}개 ${action} 요청` : `수하물 ${action} 요청`;
        }
        case 'RESTAURANT': return '식당 예약';
        case 'WAKE_UP_CALL': {
          const time = entities.time as string | undefined;
          return time ? `${time} 모닝콜 예약` : '모닝콜 예약';
        }
        case 'POSTAL_SERVICE': {
          const item = entities.item as string | undefined;
          return item ? `${item} 발송 대행` : '우편물 발송 대행';
        }
        case 'DELIVERY': {
          const item = entities.item as string | undefined;
          return item ? `${item} 배달 요청` : '배달 요청';
        }
        case 'RESERVATION': {
          const target = entities.target as string | undefined;
          const time = entities.time as string | undefined;
          if (target && time) return `${time} ${target} 예약`;
          if (target) return `${target} 예약`;
          return '예약 요청';
        }
      }
    }
    return null;
  }, [domainCode, entities]);

  const sourceTextForTranslation = rawDynamicTitle || summary;

  const isTranslationRequired = targetLang !== 'ko' && !(targetLang === 'en' && !/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(sourceTextForTranslation || ''));

  const { translatedText: translatedSummaryRaw, isLoading: isTranslatingRaw } = useTranslationApi(
    isTranslationRequired ? sourceTextForTranslation : null,
    targetLang
  );

  const isTranslating = isTranslationRequired && isTranslatingRaw;
  const translatedSummary = isTranslationRequired ? translatedSummaryRaw : sourceTextForTranslation;
  
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
    if (intent && (t.intents as any)?.[intent]) {
      return (t.intents as any)[intent];
    }
    
    if (!domainCode) {
      return displaySummary.split('(')[0].trim();
    }
    return displaySummary;
  };

  let finalTitle = getFixedTitle();
  if (isCancelled) {
    finalTitle += ` ${t.cardUI?.message?.cancelledCard || '취소됨'}`;
  }

  const domainLabel = (t.guestChat?.progress?.domains as Record<string, string>)?.[domainCode] || domainCode;
  
  // Render entities description
  const renderDetails = () => {
    if (!entities) return null;
    
    // 심플한 요청(HK, FACILITY, EMERGENCY, FRONT)은 메인 타이틀(summary)만 보여주고 디테일은 생략
    if (domainCode === 'HK' || domainCode === 'FACILITY' || domainCode === 'EMERGENCY' || domainCode === 'FRONT') return null;

    const l = t.ticketUI?.entityLabels || {};
    const parts: string[] = [];
    
    if (entities.intent === 'TAXI') {
      if (entities.time) parts.push(`${l.time || '시간'}: ${entities.time}`);
      if (entities.destination) parts.push(`${l.dest || '목적지'}: ${entities.destination}`);
      if (entities.passenger_count) parts.push(`${l.pax || '인원'}: ${entities.passenger_count}${l.paxUnit || ''}`);
    } else if (entities.intent === 'RESTAURANT' || entities.intent === 'RESERVATION') {
      if (entities.restaurant_name) parts.push(`${l.rest || '식당'}: ${entities.restaurant_name}`);
      if (entities.target) parts.push(`${l.target || '대상'}: ${entities.target}`);
      if (entities.time) parts.push(`${l.time || '시간'}: ${entities.time}`);
      if (entities.party_size) parts.push(`${l.pax || '인원'}: ${entities.party_size}${l.paxUnit || ''}`);
    } else if (entities.intent === 'LUGGAGE_STORAGE') {
      if (entities.action) parts.push(`${l.req || '요청'}: ${entities.action === 'store' ? (l.store || '보관') : (l.pickup || '찾기')}`);
      if (entities.count) parts.push(`${l.count || '수량'}: ${entities.count}${l.countUnit || ''}`);
    } else if (entities.intent === 'DELIVERY' || entities.intent === 'POSTAL_SERVICE') {
      if (entities.item) parts.push(`${l.item || '물품'}: ${entities.item}`);
      if (entities.store_name) parts.push(`${l.vendor || '업체'}: ${entities.store_name}`);
      if (entities.time) parts.push(`${l.time || '시간'}: ${entities.time}`);
      if (entities.destination) parts.push(`${l.dest || '도착지'}: ${entities.destination}`);
    } else if (entities.intent === 'WAKE_UP_CALL') {
      if (entities.time) parts.push(`${l.time || '시간'}: ${entities.time}`);
    } else if (entities.intent === 'MEDICAL_INFO') {
      if (entities.type) parts.push(`${l.type || '분류'}: ${entities.type}`);
      if (entities.symptom) parts.push(`${l.symptom || '증상'}: ${entities.symptom}`);
    } else if (entities.intent === 'TOUR_INFO') {
      if (entities.category) parts.push(`${l.type || '분류'}: ${entities.category}`);
      if (entities.area) parts.push(`${l.area || '지역'}: ${entities.area}`);
    } else {
      if (Array.isArray(entities.menu_items)) {
        entities.menu_items.forEach((it: any) => {
          parts.push(`${it.name} ${it.quantity ? `×${it.quantity}` : ''}`.trim());
        });
      } else if (Array.isArray(entities.items)) {
        entities.items.forEach((it: any) => {
          parts.push(`${it.item} ${it.count ? `×${it.count}` : ''}`.trim());
        });
      } else if (entities.item) {
        parts.push(`${entities.item} ${entities.count ? `×${entities.count}` : ''}`.trim());
      }
  
      if (Array.isArray(entities.tasks)) {
        entities.tasks.forEach((t: string) => parts.push(t));
      }
      
      if (parts.length === 0) {
        if (entities.menu) {
          parts.push(`${entities.menu} ${entities.count ? `×${entities.count}` : ''}`.trim());
        }
      }
 
      if (entities.symptom) {
        parts.push(`${l.content || '내용'}: ${entities.symptom}`);
      }
    }
    
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const rawDetails = renderDetails();
  const isDetailsTranslationRequired = targetLang !== 'ko' && !(targetLang === 'en' && !/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(rawDetails || ''));

  const { translatedText: translatedDetailsRaw } = useTranslationApi(
    isDetailsTranslationRequired ? (rawDetails || undefined) : undefined,
    targetLang
  );

  const translatedDetails = isDetailsTranslationRequired ? translatedDetailsRaw : rawDetails;

  const detailsText = translatedDetails || rawDetails;
  
  let computedProgress = 0;
  if (status === 'PENDING' || status === 'CANCEL_PENDING' || status === 'ESCALATED') {
    computedProgress = 0;
  } else if (status === 'IN_PROGRESS') {
    computedProgress = 50;
  } else if (status === 'COMPLETED') {
    computedProgress = 100;
  }

  useEffect(() => {
    if (status === 'CANCELLED') {
      setVisible(false);
    } else if (status === 'COMPLETED') {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setVisible(true);
    }
  }, [status]);

  if (!visible) return null;

  const detailItems = detailsText ? detailsText.split(', ') : [];

  return (
    <div 
      className={styles.statusBarContainer}
      style={isMini ? { padding: 'var(--space-12) var(--space-24)', gap: 0 } : {}}
    >
      {!isMini && (
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={`${styles.title} ${isTranslating ? styles.translatingText : ''}`}>{finalTitle}</div>
            
            {/* Subtitle: strictly menu/items list line-by-line */}
            {detailItems.length > 0 && (
              <div className={styles.menuList}>
                {detailItems.map((item, idx) => (
                  <div key={idx} className={styles.menuItem}>
                    <span className={styles.bullet}>{"- "}</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Order Status Message below */}
            <div className={styles.statusMessage}>
              {domainCode === 'EMERGENCY' ? (
                <>
                  {(status === 'PENDING' || status === 'CANCEL_PENDING') && (t.cardUI.statusBar?.emergencyPending || '프론트 데스크에서 긴급 요청건을 확인하고 있습니다.')}
                  {status === 'IN_PROGRESS' && (t.cardUI.statusBar?.emergencyInProgress || '프론트 데스크에서 긴급 요청건을 처리 중입니다.')}
                  {status === 'COMPLETED' && (t.cardUI.statusBar?.emergencyCompleted || '긴급 요청건이 처리 완료되었습니다.')}
                </>
              ) : (
                <>
                  {(status === 'PENDING' || status === 'CANCEL_PENDING') && t.cardUI.statusBar?.templateNoDetailsPending?.replace('{team}', domainLabel)}
                  {status === 'IN_PROGRESS' && t.cardUI.statusBar?.templateNoDetailsInProgress?.replace('{team}', domainLabel)}
                  {status === 'COMPLETED' && t.cardUI.statusBar?.templateNoDetailsCompleted?.replace('{team}', domainLabel)}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className={styles.stepperContainer}>
        {/* Background lines */}
        <div className={styles.stepperTrack}>
          <div 
            className={styles.stepperFill} 
            style={{ width: `${computedProgress}%` }} 
          />
        </div>

        {/* Nodes */}
        <div className={styles.stepperNodes}>
          {/* Step 1: 확인 중 (0%) */}
          <div className={styles.stepWrapper}>
            <div className={`${styles.node} ${computedProgress > 0 ? styles.nodeCompleted : computedProgress === 0 ? styles.nodeActive : styles.nodeInactive}`}>
              {computedProgress > 0 ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : computedProgress === 0 ? <div className={styles.innerDot} /> : null}
            </div>
            <div className={`${styles.stepLabel} ${computedProgress >= 0 ? styles.labelActive : ''}`}>{t.cardUI.statusBar?.checking || '확인 중'}</div>
          </div>

          {/* Step 2: 처리 중 (50%) */}
          <div className={styles.stepWrapper}>
            <div className={`${styles.node} ${computedProgress > 50 ? styles.nodeCompleted : computedProgress === 50 ? styles.nodeActive : styles.nodeInactive}`}>
              {computedProgress > 50 ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : computedProgress === 50 ? <div className={styles.innerDot} /> : null}
            </div>
            <div className={`${styles.stepLabel} ${computedProgress >= 50 ? styles.labelActive : ''}`}>{t.cardUI.statusBar?.processing || '처리 중'}</div>
          </div>

          {/* Step 3: 처리 완료 (100%) */}
          <div className={styles.stepWrapper}>
            <div className={`${styles.node} ${computedProgress >= 100 ? styles.nodeCompleted : styles.nodeInactive}`}>
              {computedProgress >= 100 ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : null}
            </div>
            <div className={`${styles.stepLabel} ${computedProgress >= 100 ? styles.labelActive : ''}`}>{t.cardUI.statusBar?.completed || '처리 완료'}</div>
          </div>
        </div>
      </div>

    </div>
  );
}
