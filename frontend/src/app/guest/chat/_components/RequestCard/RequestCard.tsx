import React, { useState, useEffect } from 'react';
import styles from './RequestCard.module.css';
import GlassButton from '@/components/ui/Button/GlassButton';
import Tag from '@/components/ui/StatusBadge/StatusBadge';
import { Monitor, Home, Utensils, Wrench, ConciergeBell, AlertTriangle, FileText } from 'lucide-react';
import { useTranslationApi } from '@/app/useTranslationApi';
import { useUiStore } from '@/stores/useUiStore';
import { useTranslation } from '@/app/useTranslation';

function TypingText({ text, speed = 12 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayed(text.substring(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <>
      {displayed.split('\n').map((line, i, arr) => (
        <React.Fragment key={i}>
          {line}
          {i < arr.length - 1 && <br />}
        </React.Fragment>
      ))}
    </>
  );
}

export interface RequestCardProps {
  requestId: number;
  domainCode: string;
  summary: string;
  entities?: Record<string, unknown>;
  status: string;
  progress: number;
  graceRemaining: number;
  priority: string;
  createdAt?: string;
  cancelledAt?: string;
  cancelPending?: boolean;
  cancelReason?: string;
  onCancel?: () => void;
  onModify?: () => void;
  onAccept?: () => void;
  isReadOnly?: boolean;
}

const DOMAIN_ICONS: Record<string, React.ElementType> = {
  HK: Home,
  FB: Utensils,
  FACILITY: Wrench,
  CONCIERGE: ConciergeBell,
  FRONT: Monitor,
  EMERGENCY: AlertTriangle,
  UNKNOWN: FileText,
};

export default function RequestCard({
  requestId,
  domainCode,
  summary,
  entities,
  status,
  progress,
  graceRemaining,
  priority,
  createdAt,
  cancelledAt,
  cancelPending,
  cancelReason,
  onCancel,
  onModify,
  onAccept,
  isReadOnly = false,
}: RequestCardProps) {
  const { chatLanguage, language } = useUiStore();
  const [targetLang, setTargetLang] = useState<string>(isReadOnly ? language : chatLanguage);

  useEffect(() => {
    setTargetLang(isReadOnly ? language : chatLanguage);
  }, [chatLanguage, language, isReadOnly]);

  const { t } = useTranslation(targetLang);

  const isUrgent = priority === 'URGENT';
  const isCancelled = status === 'CANCELLED';
  const isCancelPending = cancelPending === true;
  const isEscalatedChat = domainCode === 'FRONT' && entities?.intent === 'ESCALATION';
  const isInProgress = progress >= 50 && progress < 100 && !isCancelled;
  const isCompleted = progress >= 100 && !isCancelled;

  const rawDynamicTitle = React.useMemo(() => {
    const intent = entities?.intent as string | undefined;
    if (domainCode === 'HK') {
      const items = entities?.items as any[] | undefined;
      const tasks = entities?.tasks as string[] | undefined;
      const totalCount = (items?.length || 0) + (tasks?.length || 0);
      if (totalCount > 0) {
        let firstLabel = '';
        if (items && items.length > 0) {
          const first = items[0];
          firstLabel = `${first.item} x${first.count || 1}`;
        } else if (tasks && tasks.length > 0) {
          firstLabel = tasks[0];
        }
        const restCount = totalCount - 1;
        const rest = restCount > 0 ? ` and ${restCount} other${restCount > 1 ? 's' : ''}` : '';
        return `${firstLabel}${rest}`;
      }
    } else if (domainCode === 'FB') {
      const menuItems = entities?.menu_items as any[] | undefined;
      if (menuItems && menuItems.length > 0) {
        const first = menuItems[0];
        const opt = first.selected_option ? `(${first.selected_option})` : '';
        const qty = first.quantity ? ` x${first.quantity}` : '';
        const restCount = menuItems.length - 1;
        const rest = restCount > 0 ? ` and ${restCount} other${restCount > 1 ? 's' : ''}` : '';
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
        case 'OTHER': {
          const desc = entities.description as string | undefined;
          return desc ? `${desc}` : displaySummary;
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
  const DomainIcon = DOMAIN_ICONS[domainCode] || DOMAIN_ICONS['UNKNOWN'];
  const domainLabel = (t.guestChat?.progress?.domains as Record<string, string>)?.[domainCode] || domainCode;
  const bgClass = styles[`bg${domainCode}`] || styles.bgUNKNOWN;
  const cardBgClass = styles[`cardBg${domainCode}`] || styles.cardBgUNKNOWN;

  const DOMAIN_TIMER_COLORS: Record<string, string> = {
    HK: 'var(--color-dept-hk-text)',
    FB: 'var(--color-dept-fb-text)',
    FACILITY: 'var(--color-dept-facility-text)',
    CONCIERGE: 'var(--color-dept-concierge-text)',
    FRONT: 'var(--color-dept-front-text)',
    EMERGENCY: 'var(--color-dept-emergency-text)',
  };
  const timerColor = DOMAIN_TIMER_COLORS[domainCode] || 'var(--color-primary)';
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(graceRemaining);

  // Format summary to hide internal notes from guest
  const baseSummary = translatedSummary || summary || '';
  
  let displaySummary = '';
  // 내부 관리용 말머리([프론트 연결] 등)만 제거하고 AI가 작성한 실제 summary를 표시합니다.
  let cleaned = baseSummary.replace(/^\[(?:프론트 연결|직원 인수인계)\]\s*/, '');
  
  // 단, 요약문이 비어있거나 '미학습 정보'처럼 고객에게 노출하기 부적절한 경우에만 기본 안내 문구 사용
  if (!cleaned || cleaned.includes('미학습 정보') || cleaned.includes('답변 불가')) {
    displaySummary = targetLang === 'en' ? 'Connecting to Front Desk' : (t.cardUI?.message?.escalationRequest || '프론트 데스크 연결 중');
  } else {
    displaySummary = cleaned;
  }
  
  const getFixedTitle = () => {
    // FRONT 도메인이거나 이관(ESCALATION) 건인 경우 항상 고정 타이틀 표시
    if (domainCode === 'FRONT' || isEscalatedChat || entities?.intent === 'ESCALATION' || baseSummary.includes('프론트 연결')) {
      return targetLang === 'en' ? 'Connecting to Front Desk' : (t.cardUI?.message?.escalationRequest || '프론트 데스크 연결 중');
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

  const toSentenceCase = (text: string) => {
    if (!text) return '';
    const trimmed = text.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  };

  let finalTitle = toSentenceCase(getFixedTitle());
  
  if (isCancelled) {
    finalTitle += t.cardUI?.message?.cancelSuffix || ' 취소';
  }

  useEffect(() => {
    // graceRemaining === -1: 고객 확인 대기 모드 (FB/CONCIERGE) → 타이머 없이 버튼 정적 표시
    if (graceRemaining <= 0 || isCancelled) {
      setTimeLeft(0);
      return;
    }

    setTimeLeft(graceRemaining);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [graceRemaining, isCancelled]);

  // graceRemaining === -1: 정적 버튼 (타이머 없이 항시 표시)
  // graceRemaining > 0: 타이머 카운트다운 중 버튼 표시
  const isStaticConfirm = graceRemaining === -1 && !isUrgent && !isCancelled && !isReadOnly;
  const showButtons = !isReadOnly && (isStaticConfirm || (!isUrgent && !isCancelled && timeLeft > 0));

  // Render entities description
  const renderDetails = () => {
    if (!entities) return null;

    const l = t.ticketUI?.entityLabels || {};
    const parts: string[] = [];
    
    // HK: items + tasks
    if (domainCode === 'HK') {
      if (Array.isArray(entities.items)) {
        entities.items.forEach((it: { item: string; count?: number }) => {
          const itemName = typeof it.item === 'string' ? toSentenceCase(it.item) : it.item;
          parts.push(`- ${itemName} ${it.count ? `×${it.count}` : ''}`.trim());
        });
      }
      if (Array.isArray(entities.tasks)) {
        entities.tasks.forEach((tStr: string) => parts.push(`- ${toSentenceCase(tStr)}`));
      }
      if (entities.is_contactless) parts.push(`- ${l.contactless || '비대면'}`);
      if (entities.target_time) parts.push(`- ${l.time || '시간'}: ${entities.target_time}`);
      if (parts.length === 1 && !entities.is_contactless && !entities.target_time) return null;
      return parts.length > 0 ? parts.join('\n') : null;
    }

    // FACILITY: equipment + symptom + location
    if (domainCode === 'FACILITY') {
      if (entities.equipment) parts.push(`${l.equip || '대상'}: ${entities.equipment}`);
      if (entities.symptom) parts.push(`${l.content || '내용'}: ${entities.symptom}`);
      if (entities.location && entities.location !== '객실') parts.push(`${l.loc || '위치'}: ${entities.location}`);
      return parts.length > 0 ? parts.join('\n') : null;
    }

    // EMERGENCY / FRONT: 디테일 불필요
    if (domainCode === 'EMERGENCY' || domainCode === 'FRONT') return null;

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
        entities.tasks.forEach((t: string) => parts.push(`- ${t}`));
      }
      
      if (parts.length === 0) {
        if (entities.menu) {
          parts.push(`- ${entities.menu} ${entities.count ? `×${entities.count}` : ''}`.trim());
        }
      }

      if (entities.symptom) {
        parts.push(`${l.content || '내용'}: ${entities.symptom}`);
      }
      if (domainCode === 'FB' && parts.length === 1 && !entities.symptom) return null;
      return parts.length > 0 ? parts.join('\n') : null;
    }
  };

  const rawDetails = renderDetails();
  const isDetailsTranslationRequired = targetLang !== 'ko' && !(targetLang === 'en' && !/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(rawDetails || ''));

  const { translatedText: translatedDetailsRaw, isLoading: isTranslatingDetailsRaw } = useTranslationApi(
    isDetailsTranslationRequired ? (rawDetails || undefined) : undefined,
    targetLang
  );

  const isTranslatingDetails = isDetailsTranslationRequired && isTranslatingDetailsRaw;
  const translatedDetails = isDetailsTranslationRequired ? translatedDetailsRaw : rawDetails;

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  return (
    <div className={`glass-panel ${styles.card} ${cardBgClass} ${isCancelled ? styles.cancelledCard : ''} ${isCancelPending ? styles.cancelPendingCard : ''} ${isInProgress ? styles.inProgressCard : ''} ${isCompleted ? styles.completedCard : ''}`}>
      <div className={styles.cardLayout}>
        {/* Left Column: Icon or Timer */}
        <div className={styles.leftColumn}>
          {showButtons && !isStaticConfirm ? (
            <div className={`${styles.timerContainer} ${bgClass}`} style={{ '--timer-color': timerColor } as React.CSSProperties}>
              <svg viewBox="0 0 36 36" className={styles.circularSvg}>
                <path
                  className={styles.circleProgress}
                  strokeDasharray="100"
                  strokeDashoffset={100 - (timeLeft / Math.max(graceRemaining, 1)) * 100}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className={styles.timerText}>{timeLeft}</div>
            </div>
          ) : (
            <div className={`${styles.iconContainer} ${bgClass}`}>
              <DomainIcon size={20} />
            </div>
          )}
        </div>

        {/* Right Column: Content */}
        <div className={styles.rightColumn}>
          <div className={styles.content}>
            <div className={styles.summaryRow} style={{ position: 'relative', paddingRight: '50px' }}>
              <div className={styles.summary} style={{ display: 'flex', alignItems: 'center' }}>
                <span>{finalTitle}</span>
                {isCancelPending && (
                  <span className={styles.cancelPendingBadge}>
                    {targetLang === 'ko' ? '취소 대기중' : 'Cancel Pending'}
                  </span>
                )}
              </div>
              <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <div style={{ font: 'var(--text-caption-regular)', color: 'var(--color-gray-400)', lineHeight: '1.2' }}>#{requestId}</div>
                <div className={styles.timeLabel} style={{ color: 'var(--color-gray-400)', marginTop: 0, lineHeight: '1.2' }}>
                  {formatTime(isCancelled && cancelledAt ? cancelledAt : createdAt)}
                </div>
              </div>
            </div>
          </div>

          {rawDetails && (
            <div className={styles.detailsText}>
              {(() => {
                const finalStr = translatedDetails || rawDetails;
                const rawLines = rawDetails.split('\n');
                const highlightItems = (entities?.highlight_items as string[]) || [];
                
                return finalStr.split('\n').map((line, idx) => {
                  const rawLine = rawLines[idx] || '';
                  const isMod = highlightItems.some(hi => rawLine.includes(hi));
                  
                  return (
                    <div key={idx} className={isMod ? styles.modifiedLine : ''}>
                      {line}
                      {isMod && <span className={styles.modifiedBadge}>Modified</span>}
                    </div>
                  );
                });
              })()}
            </div>
          )}

          <div className={`${styles.completionMessage} ${isCancelled ? styles.cancelledText : ''}`}>
            {isCancelled ? (
              <>{t.cardUI?.message?.cancelledCard || '요청이 취소되었습니다'}</>
            ) : showButtons && isStaticConfirm ? (
              <>{t.cardUI?.message?.confirmGuide || '확인 후 진행 버튼을 눌러주세요.'}</>
            ) : showButtons ? (
              <>{t.cardUI?.message?.autoAcceptGuide || '요청 내용을 확인해 주세요. 잠시 후 자동 전달됩니다.'}</>
            ) : isCancelPending ? (
              <>{t.cardUI?.message?.cancelPendingShort || '취소 요청 확인 중'}</>
            ) : isEscalatedChat ? (
              <>{t.cardUI?.message?.escalated || '직원이 응대할 예정입니다'}</>
            ) : (
              <>{(t.cardUI?.message?.forwarded || '{team} 팀에 전달되었습니다').replace('{team}', domainLabel)}</>
            )}
          </div>
        </div>
      </div>

      {/* Buttons — full width below cardLayout */}
      {!isReadOnly && (
        <div className={`${styles.buttonGroup} ${!showButtons ? styles.hiddenButtons : ''}`}>
          <GlassButton variant="cancel" onClick={onCancel} fullWidth>{t.cardUI?.button?.cancel || '취소하기'}</GlassButton>
          <GlassButton variant="primary" domainCode={domainCode} onClick={onAccept} fullWidth>{t.cardUI?.button?.accept || '바로등록'}</GlassButton>
        </div>
      )}
    </div>
  );
}
