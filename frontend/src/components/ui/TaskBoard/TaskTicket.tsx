import React from 'react';
import styles from './TaskTicket.module.css';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import Button from '@/components/ui/Button/Button';
import { useNetworkStore } from '@/stores/useNetworkStore';
import { useTranslation } from '@/app/useTranslation';
import { useTranslationApi } from '@/app/useTranslationApi';

export interface TaskTicketProps {
  ticketId?: string | number;
  roomNo?: string | number;
  priority?: 'NORMAL' | 'URGENT';
  department?: string;
  title: string;
  description: string;
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE';
  createdAt: string | Date;
  updatedAt?: string | Date;
  cancelRequested?: boolean;
  onAccept?: (e: React.MouseEvent) => void;
  onComplete?: (e: React.MouseEvent) => void;
  isCancelled?: boolean;
  entities?: {
    is_contactless?: boolean;
    target_time?: string;
    items?: Array<{ item: string; count: number }>;
    tasks?: string[];
    [key: string]: any;
  };
  highlightSearch?: string;
  isActiveMatch?: boolean;
}

const renderHighlightedText = (text: string, search: string, isActiveMatch: boolean) => {
  if (!search) return text;
  const parts = text.split(new RegExp(`(${search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === search.toLowerCase() ? (
          <span 
            key={i} 
            style={{ 
              backgroundColor: isActiveMatch ? '#ffd54f' : 'rgba(255, 230, 0, 0.3)', 
              fontWeight: isActiveMatch ? 'bold' : 'normal',
              borderRadius: '2px',
              padding: '0 2px',
              color: 'var(--color-gray-900)'
            }}
          >
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
};

export default function TaskTicket({
  ticketId,
  roomNo,
  priority = 'NORMAL',
  department,
  title,
  description,
  status = 'TODO',
  createdAt,
  updatedAt,
  cancelRequested = false,
  onAccept,
  onComplete,
  isCancelled = false,
  entities,
  highlightSearch,
  isActiveMatch = false
}: TaskTicketProps) {
  const isOnline = useNetworkStore((state) => state.isOnline);
  const { t, language } = useTranslation();

  let displayDept = department;
  let deptKey = 'front';
  let deptUpper = department ? department.toUpperCase() : '';

  if (department) {
    if (deptUpper.includes('HK') || deptUpper.includes('하우스키핑')) {
      deptKey = 'hk';
    } else if (deptUpper.includes('FACILITY') || deptUpper.includes('시설')) {
      deptKey = 'facility';
    } else if (deptUpper.includes('FB') || deptUpper.includes('식음료')) {
      deptKey = 'fb';
    } else if (deptUpper.includes('CONCIERGE') || deptUpper.includes('컨시어지')) {
      deptKey = 'concierge';
    }
  }

  if (deptUpper && (deptUpper.includes('EMERGENCY') || deptUpper.includes('긴급대응팀'))) {
    deptKey = 'emergency';
  }

  const rawDynamicTitle = React.useMemo(() => {
    const intent = entities?.intent as string | undefined;
    if (deptKey === 'fb') {
      const menuItems = entities?.menu_items as any[] | undefined;
      if (menuItems && menuItems.length > 0) {
        const first = menuItems[0];
        const opt = first.selected_option ? `(${first.selected_option})` : '';
        const qty = first.quantity ? ` ${first.quantity}개` : '';
        const rest = menuItems.length > 1 ? ` 외 ${menuItems.length - 1}건` : '';
        return `${first.name}${opt}${qty}${rest}`; // Removed " 주문"
      }
    } else if (deptKey === 'concierge') {
      if (!intent || !entities) return null;
      switch (intent) {
        case 'TAXI':
          return `택시 호출${t.cardUI?.message?.reserveSuffix || ' 예약'}`;
        case 'LUGGAGE_STORAGE': {
          const count = entities.count;
          const action = entities.action === 'store' ? '보관' : '찾기';
          return count 
            ? `짐 ${count}개 ${action}` // Removed " 요청"
            : `수하물 ${action}`; // Removed " 요청"
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
            ? `${item} 배달` // Removed " 요청"
            : `배달`; // Removed " 요청"
        }
        case 'RESERVATION': {
          const target = entities.target as string | undefined;
          const time = entities.time as string | undefined;
          if (target && time) return `${time} ${target}${t.cardUI?.message?.reserveSuffix || ' 예약'}`;
          if (target) return `${target}${t.cardUI?.message?.reserveSuffix || ' 예약'}`;
          return `예약`; // Changed from '예약 요청'
        }
      }
    }
    return null;
  }, [deptKey, entities, t]);

  const rawEntityDetails = React.useMemo(() => {
    if (!entities) return null;
    const lowerDept = department?.toLowerCase();
    if (lowerDept === 'hk' || lowerDept === 'facility' || lowerDept === 'emergency' || lowerDept === 'front') return null;

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
          const opt = it.selected_option ? `(${it.selected_option})` : '';
          parts.push(`- ${it.name}${opt} ${it.quantity ? `×${it.quantity}` : ''}`.trim());
        });
      } else if (Array.isArray(entities.items)) {
        entities.items.forEach((it: any) => {
          parts.push(`- ${it.item} ${it.count ? `×${it.count}` : ''}`.trim());
        });
      } else if (entities.item) {
        parts.push(`- ${entities.item} ${entities.count ? `×${entities.count}` : ''}`.trim());
      }
      if (Array.isArray(entities.tasks)) {
        entities.tasks.forEach((tStr: string) => parts.push(`- ${tStr}`));
      }
      if (parts.length === 0) {
        if (entities.menu) {
          parts.push(`- ${entities.menu} ${entities.count ? `×${entities.count}` : ''}`.trim());
        }
      }
      if (entities.symptom) {
        parts.push(`${l.content || '내용'}: ${entities.symptom}`);
      }
    }
    return parts.length > 0 ? parts.join('\n') : null;
  }, [department, entities, t.ticketUI?.entityLabels]);

  const sourceTitle = rawDynamicTitle || title;
  const { translatedText: translatedSummary, isLoading: isTranslating } = useTranslationApi(sourceTitle, language);
  const displaySummary = translatedSummary || sourceTitle;

  const { translatedText: translatedDetails } = useTranslationApi(
    language !== 'ko' && rawEntityDetails ? rawEntityDetails : undefined,
    language
  );
  const entityDetails = language !== 'ko' && translatedDetails ? translatedDetails : rawEntityDetails;

  const isManuallyReassigned = entities?.intent === 'ESCALATION' && deptKey !== 'front' && deptKey !== 'emergency';

  const fallbackDescriptionRaw = React.useMemo(() => {
    let desc = description;
    if (isManuallyReassigned && desc) {
      const lines = desc.split('\n').filter(l => l.trim());
      desc = lines[lines.length - 1] || '';
    } else if (desc && desc.includes('[주문 상세]')) {
      desc = desc.split('[주문 상세]')[0].trim();
    }
    return desc;
  }, [description, isManuallyReassigned]);

  const { translatedText: translatedFallbackDesc } = useTranslationApi(
    language !== 'ko' && fallbackDescriptionRaw ? fallbackDescriptionRaw : undefined,
    language
  );
  
  const fallbackDescription = language !== 'ko' && translatedFallbackDesc ? translatedFallbackDesc : fallbackDescriptionRaw;

  if (department) {
    if (deptKey === 'hk') displayDept = t.ticketUI.department.HK;
    else if (deptKey === 'facility') displayDept = t.ticketUI.department.FACILITY;
    else if (deptKey === 'fb') displayDept = t.ticketUI.department.FB;
    else if (deptKey === 'concierge') displayDept = t.ticketUI.department.CONCIERGE;
    else if (deptKey === 'emergency') displayDept = t.ticketUI.department.EMERGENCY;
    else displayDept = t.ticketUI.department.FRONT;
  }

  const getFixedTitle = () => {
    if (isTranslating || isManuallyReassigned || displaySummary.includes('프론트 연결')) {
      return displaySummary;
    }
    
    if (rawDynamicTitle) {
      return displaySummary;
    }
    
    const intent = entities?.intent as string | undefined;
    
    // Fallback: intent 기반 번역 매핑
    if (deptKey !== 'hk' && deptKey !== 'facility') {
      if (intent && (t.intents as any)?.[intent]) {
        return (t.intents as any)[intent];
      }
    }
    
    if (!department) {
      return displaySummary.split('(')[0].trim();
    }
    return displaySummary;
  };

  let displayTitle = getFixedTitle();
  
  // '요청'과 '주문' 단어가 타이틀 끝에 있는 경우 제거 (예약은 유지)
  displayTitle = displayTitle
    .replace(/(?:\s*요청|\s*주문|\s*[Rr]equest|\s*[Oo]rder|\s*リクエスト|\s*依頼|\s*注文|\s*请求|\s*订单)$/, '')
    .trim();

  let timeDisplay = '';
  if (status === 'DONE') {
    let parsedString = createdAt;
    const date = new Date(parsedString);
    const hours = date.getHours();
    const mins = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hr = hours % 12 || 12;
    timeDisplay = `${String(hr).padStart(2, '0')}:${mins} ${ampm}`;
  } else if (status === 'IN_PROGRESS' && updatedAt) {
    const relTime = getRelativeTime(updatedAt, language, t.ticketUI.time);
    if (relTime === t.ticketUI.time.justNow) {
      timeDisplay = t.ticketUI.time.justStarted;
    } else {
      timeDisplay = relTime.replace(language === 'ko' ? ' 전' : ' ago', t.ticketUI.time.elapsed);
    }
  } else {
    timeDisplay = getRelativeTime(updatedAt || createdAt, language, t.ticketUI.time);
  }



  let displayDescription = fallbackDescription;
  if (status !== 'IN_PROGRESS' && entityDetails) {
    // Override rawText with entity details for TODO/DONE
    displayDescription = entityDetails;
  }
  
  if (language === 'en') {
    if (displayDescription === '프론트 데스크') displayDescription = 'Frontdesk';
    else if (displayDescription === '직원') displayDescription = 'Staff';
  }

  return (
    <div 
      id={ticketId ? `ticket-${ticketId}` : undefined}
      className={`${styles.taskTicket} ${styles[deptKey]} ${isCancelled ? styles.isCancelled : ''}`}
      style={{
        boxShadow: isActiveMatch ? '0 0 0 2px var(--color-primary-400), 0 4px 16px rgba(0, 0, 0, 0.12)' : undefined,
        transition: 'all 0.2s ease-in-out'
      }}
    >
      <div className={styles.topColorBar} />
      <div className={styles.header}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {roomNo && (
            <>
              <span className={styles.roomNo}>
                {language === 'ko' ? `${roomNo}호` : `NO.${roomNo}`}
              </span>
              <div className={styles.headerDivider} />
            </>
          )}
          {department && (
            <div className={styles.deptBadge}>
              {displayDept}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isCancelled && (
            <span className={`${styles.textStatus} ${styles.textStatusCancelled}`}>
              {t.ticketUI.badge.cancelled}
            </span>
          )}
          {cancelRequested && (
            <span className={`${styles.textStatus} ${styles.textStatusCancelPending}`}>
              {t.ticketUI.badge.cancelPending}
            </span>
          )}
          {priority === 'URGENT' && (
            <div className={`${styles.textStatus} ${styles.textStatusUrgent}`}>
              {t.ticketUI.badge.urgent}
              <span className={styles.redDot} />
            </div>
          )}
        </div>
      </div>

      {(entities?.is_contactless || entities?.target_time) && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', marginTop: '-4px' }}>
          {entities.is_contactless && (
            <StatusBadge variant="purple">{t.ticketUI.badge.contactless}</StatusBadge>
          )}
          {entities.target_time && (
            <StatusBadge variant="gray">{t.ticketUI.badge.targetTime}: {entities.target_time}</StatusBadge>
          )}
        </div>
      )}

      <div className={styles.content}>
        <h3 className={styles.title}>
          {isTranslating ? t.common.loading || 'Loading...' : (
            highlightSearch ? renderHighlightedText(displayTitle as string, highlightSearch, isActiveMatch) : displayTitle
          )}
        </h3>
        <p className={styles.description}>
          {highlightSearch ? renderHighlightedText(displayDescription || '', highlightSearch, isActiveMatch) : displayDescription}
        </p>
      </div>

      <div className={styles.divider} />

      <div className={styles.footer}>
        <span className={styles.timeText}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          {timeDisplay}
        </span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {ticketId && <span className={styles.ticketId}>#{ticketId}</span>}
          {status === 'TODO' && onAccept && (
            <Button
              variant="primary"
              onClick={onAccept}
              style={{ padding: '4px 12px', minHeight: 'auto', fontSize: '12px' }}
              disabled={!isOnline}
              title={!isOnline ? "오프라인 상태에서는 변경할 수 없습니다" : undefined}
            >
              {t.ticketUI.button.accept}
            </Button>
          )}
          {status === 'IN_PROGRESS' && onComplete && (
            <Button
              variant="primary"
              onClick={onComplete}
              style={{ padding: '4px 12px', minHeight: 'auto', fontSize: '12px' }}
              disabled={!isOnline}
              title={!isOnline ? "오프라인 상태에서는 변경할 수 없습니다" : undefined}
            >
              {t.ticketUI.button.complete}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function getRelativeTime(dateString: string | Date, language: string, timeTexts: any): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const paddedHours = String(hours).padStart(2, '0');
    return `${year}.${month}.${day} ${paddedHours}:${minutes} ${ampm}`;
  } else if (diffHours > 0) {
    return `${diffHours}${language === 'en' ? ' ' : ''}${timeTexts.hoursAgo}`;
  } else if (diffMins > 0) {
    return `${diffMins}${language === 'en' ? ' ' : ''}${timeTexts.minsAgo}`;
  } else {
    return timeTexts.justNow;
  }
}
