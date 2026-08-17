import React from 'react';
import styles from './TaskTicket.module.css';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import Button from '@/components/ui/Button/Button';
import { useNetworkStore } from '@/stores/useNetworkStore';
import { useTranslation } from '@/app/useTranslation';
import { useTranslationApi } from '@/app/useTranslationApi';

export interface TaskTicketProps {
  ticketId?: string | number;
  version?: number;
  draggable?: boolean;
  roomNo?: string | number;
  priority?: 'NORMAL' | 'URGENT';
  department?: string;
  showDeptBar?: boolean;
  title: string;
  description: string;
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE';
  createdAt: string | Date;
  updatedAt?: string | Date;
  cancelRequested?: boolean;
  onAccept?: (e: React.MouseEvent) => void;
  onComplete?: (e: React.MouseEvent) => void;
  onApproveCancel?: (e: React.MouseEvent) => void;
  onRejectCancel?: (e: React.MouseEvent) => void;
  isCancelled?: boolean;
  isEscalated?: boolean;
  assigneeName?: string | null;
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
  version,
  draggable = false,
  roomNo,
  priority = 'NORMAL',
  department,
  showDeptBar = false,
  title,
  description,
  status = 'TODO',
  createdAt,
  updatedAt,
  cancelRequested = false,
  onAccept,
  onComplete,
  onApproveCancel,
  onRejectCancel,
  isCancelled = false,
  isEscalated = false,
  assigneeName,
  entities,
  highlightSearch = '',
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
    const isEn = language === 'en';
    if (deptKey === 'hk') {
      const items = entities?.items as any[] | undefined;
      const tasks = entities?.tasks as string[] | undefined;
      const totalCount = (items?.length || 0) + (tasks?.length || 0);
      if (totalCount > 0) {
        let firstLabel = '';
        if (items && items.length > 0) {
          const first = items[0];
          const firstItemText = typeof first.item === 'object' && first.item !== null ? (first.item.name || first.item.id || '') : first.item;
          firstLabel = `${firstItemText} x${first.count || 1}`;
        } else if (tasks && tasks.length > 0) {
          firstLabel = tasks[0];
        }
        const restCount = totalCount - 1;
        const rest = restCount > 0 ? ` and ${restCount} other${restCount > 1 ? 's' : ''}` : '';
        return `${firstLabel}${rest}`;
      }
    } else if (deptKey === 'fb') {
      const menuItems = entities?.menu_items as any[] | undefined;
      if (menuItems && menuItems.length > 0) {
        const first = menuItems[0];
        const opt = first.selected_option ? `(${first.selected_option})` : '';
        const qty = first.quantity ? ` x${first.quantity}` : '';
        const restCount = menuItems.length - 1;
        const rest = restCount > 0 ? ` and ${restCount} other${restCount > 1 ? 's' : ''}` : '';
        return `${first.name}${opt}${qty}${rest}`;
      }
    } else if (deptKey === 'concierge') {
      if (!intent || !entities) return null;
      const reserveSuffix = t.cardUI?.message?.reserveSuffix || (isEn ? ' reservation' : ' 예약');
      switch (intent) {
        case 'TAXI':
          return isEn ? `Taxi call${reserveSuffix}` : `택시 호출${reserveSuffix}`;
        case 'LUGGAGE_STORAGE': {
          const count = entities.count;
          if (isEn) {
            const action = entities.action === 'store' ? 'storage' : 'pickup';
            return count ? `${count} luggage ${action}` : `Luggage ${action}`;
          }
          const action = entities.action === 'store' ? '보관' : '찾기';
          return count ? `짐 ${count}개 ${action}` : `수하물 ${action}`;
        }
        case 'RESTAURANT':
          return isEn ? `Restaurant${reserveSuffix}` : `식당${reserveSuffix}`;
        case 'WAKE_UP_CALL': {
          const time = entities.time as string | undefined;
          if (isEn) return time ? `${time} Wake-up call` : `Wake-up call`;
          return time
            ? `${time} 모닝콜${reserveSuffix}`
            : `모닝콜${reserveSuffix}`;
        }
        case 'POSTAL_SERVICE': {
          const item = entities.item as string | undefined;
          if (isEn) return item ? `${item} mailing` : 'Mail service';
          return item ? `${item} 발송 대행` : '우편물 발송 대행';
        }
        case 'DELIVERY': {
          const item = entities.item as string | undefined;
          if (isEn) return item ? `${item} delivery` : 'Delivery';
          return item ? `${item} 배달` : `배달`;
        }
        case 'RESERVATION': {
          const target = entities.target as string | undefined;
          if (target) return `${target}${reserveSuffix}`;
          return isEn ? 'Reservation' : '예약';
        }
      }
    }
    return null;
  }, [deptKey, entities, t, language]);

  const rawEntityDetails = React.useMemo(() => {
    if (!entities) return null;

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
          const itemText = typeof it.item === 'object' && it.item !== null ? (it.item.name || it.item.id || '') : it.item;
          parts.push(`- ${itemText} ${it.count ? `×${it.count}` : ''}`.trim());
        });
      } else if (entities.item) {
        const itemText = typeof entities.item === 'object' && entities.item !== null ? (entities.item.name || entities.item.id || '') : entities.item;
        parts.push(`- ${itemText} ${entities.count ? `×${entities.count}` : ''}`.trim());
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
    if (entities.target_time) {
      const timeLabel = t.ticketUI?.badge?.targetTime || (language === 'en' ? 'Target Time' : '희망 시간');
      parts.push(`${timeLabel}: ${entities.target_time}`);
    }
    return parts.length > 0 ? parts.join('\n') : null;
  }, [department, entities, t.ticketUI?.entityLabels, t.ticketUI?.badge?.targetTime, language]);

  const sourceTitle = rawDynamicTitle || title;
  const { translatedText: translatedSummary, isLoading: isTranslating } = useTranslationApi(sourceTitle, language);
  const displaySummary = (translatedSummary || sourceTitle).replace(/^(?:\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}|\d{2}-\d{2}\s\d{2}:\d{2})\s*/, '');

  const { translatedText: translatedDetails } = useTranslationApi(
    language !== 'ko' && rawEntityDetails ? rawEntityDetails : undefined,
    language
  );
  const entityDetails = language !== 'ko' && translatedDetails ? translatedDetails : rawEntityDetails;

  const isManuallyReassigned = (entities?.intent === 'ESCALATION' || (description && description.includes('|||TRANSFER_REASON|||'))) && deptKey !== 'front' && deptKey !== 'emergency';

  const fallbackDescriptionRaw = React.useMemo(() => {
    let desc = description;
    if (isManuallyReassigned && desc) {
      const lines = desc.split('\n').filter(l => l.trim());
      desc = lines[lines.length - 1] || '';
    } else if (desc && /\[(?:주문 상세|Order Details)\]/i.test(desc)) {
      desc = desc.split(/\[(?:주문 상세|Order Details)\]/i)[0].trim();
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

  const toSentenceCase = (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  let displayTitle = toSentenceCase(getFixedTitle().trim());

  const formatDoneDateTime = (dateVal: string | Date | undefined, lang: string = 'en') => {
    if (!dateVal) return '';
    let date: Date;
    if (dateVal instanceof Date) {
      date = dateVal;
    } else {
      date = new Date(String(dateVal).replace(' ', 'T'));
    }
    if (isNaN(date.getTime())) return '';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    if (lang === 'ko') {
      return `${timeStr} ${date.getMonth() + 1}월 ${date.getDate()}일`;
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    return `${timeStr} ${month} ${day}`;
  };

  let timeDisplay = '';
  if (status === 'DONE') {
    const doneTime = updatedAt || createdAt;
    timeDisplay = doneTime ? formatDoneDateTime(doneTime, language) : '';
  } else if (status === 'IN_PROGRESS' && updatedAt) {
    timeDisplay = getRelativeTime(updatedAt, language, t.ticketUI.time);
  } else {
    const activeTime = createdAt || updatedAt;
    timeDisplay = activeTime ? getRelativeTime(activeTime, language, t.ticketUI.time) : '';
  }



  const manualDesc = React.useMemo(() => {
    if (!description) return '';
    if (description.includes('|||TRANSFER_REASON|||')) {
      const parts = description.split('|||TRANSFER_REASON|||');
      const transferPart = parts[parts.length - 1].trim();
      const cleanPart = transferPart.replace(/^\[[A-Z0-9_]+\]\s*[^\n]*/i, '').trim();
      return cleanPart;
    }
    let desc = description;
    if (desc.includes('[주문 상세]')) {
      desc = desc.split('[주문 상세]')[0].trim();
    }
    const lines = desc.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      return lines[lines.length - 1];
    }
    return '';
  }, [description]);

  let displayDescription = fallbackDescription;
  if (entityDetails) {
    if (manualDesc && manualDesc !== entityDetails) {
      const cleanManualDesc = manualDesc
        .split('\n')
        .filter(line => !line.trim().startsWith('•') && !line.trim().startsWith('-'))
        .join('\n')
        .trim();
      if (cleanManualDesc) {
        displayDescription = `${entityDetails}\n${cleanManualDesc}`;
      } else {
        displayDescription = entityDetails;
      }
    } else {
      displayDescription = entityDetails;
    }
  } else if (manualDesc) {
    displayDescription = manualDesc;
  }

  
  if (language === 'en') {
    if (displayDescription === '프론트 데스크') displayDescription = 'Frontdesk';
    else if (displayDescription === '직원') displayDescription = 'Staff';
  }

  // 단일 항목 등 제목과 본문 내용이 완전히 동일/중복인 경우 중복 라인 제거
  const cleanedDescription = React.useMemo(() => {
    if (!displayDescription) return '';
    const normTitle = String(displayTitle || '')
      .replace(/^[-•*]\s*/gm, '')
      .replace(/[×xX]/g, 'x')
      .replace(/\s+/g, '')
      .toLowerCase()
      .trim();

    const lines = displayDescription.split('\n').map(l => l.trim()).filter(Boolean);
    
    // 단일 라인이고 타이틀과 동일하면 숨김
    if (lines.length === 1) {
      const normLine = lines[0]
        .replace(/^[-•*]\s*/gm, '')
        .replace(/[×xX]/g, 'x')
        .replace(/\s+/g, '')
        .toLowerCase()
        .trim();
      if (normLine === normTitle) return '';
      return lines[0];
    }

    // 복수 라인일 때 단순히 타이틀만 반복하는 라인 필터링 (예: '- cleaning'과 'Target Time: 14:00' 중 '- cleaning' 제거)
    const filteredLines = lines.filter(line => {
      const normLine = line
        .replace(/^[-•*]\s*/gm, '')
        .replace(/[×xX]/g, 'x')
        .replace(/\s+/g, '')
        .toLowerCase()
        .trim();
      return normLine !== normTitle;
    });

    return filteredLines.length > 0 ? filteredLines.join('\n') : '';
  }, [displayTitle, displayDescription]);

  return (
    <div 
      id={ticketId ? `ticket-${ticketId}` : undefined}
      draggable={draggable && !isCancelled}
      onDragStart={(e) => {
        if (!draggable || isCancelled) return;
        const dragData = {
          id: ticketId,
          version,
          fromStatus: status,
          cancelRequested
        };
        e.dataTransfer.setData('application/json', JSON.stringify(dragData));
        e.dataTransfer.setData('text/plain', String(ticketId));
        e.dataTransfer.effectAllowed = 'move';
        (e.currentTarget as HTMLElement).style.opacity = '0.4';
      }}
      onDragEnd={(e) => {
        (e.currentTarget as HTMLElement).style.opacity = '1';
      }}
      className={`${styles.taskTicket} ${styles[deptKey] || ''} ${(isCancelled || isEscalated) ? styles.isCancelled : ''} ${cancelRequested ? styles.cancelPendingCard : ''}`}
      style={{
        boxShadow: isActiveMatch ? '0 0 0 2px var(--color-primary-400), 0 4px 16px rgba(0, 0, 0, 0.12)' : undefined,
        transition: 'all 0.2s ease-in-out',
        cursor: draggable && !isCancelled ? 'grab' : undefined
      }}
    >
      {showDeptBar && <div className={styles.topColorBar} />}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {cancelRequested ? (
            <span className={styles.cancelPendingPill}>
              {roomNo ? (language === 'ko' ? `${roomNo}호 취소 요청` : `RM ${roomNo} Cancel Request`) : (t.ticketUI.badge.cancelPending || (language === 'en' ? 'Cancel Request' : '취소 요청'))}
            </span>
          ) : (
            roomNo && (
              <span className={styles.roomNo}>
                {language === 'ko' ? `${roomNo}호` : `RM ${roomNo}`}
              </span>
            )
          )}
        </div>
        <div className={styles.headerRight}>
          {(isCancelled || isEscalated || priority === 'URGENT') && (
            <div className={styles.statusRow}>
              {isCancelled && (
                <span className={`${styles.textStatus} ${styles.textStatusCancelled}`}>
                  {t.ticketUI.badge.cancelled}
                </span>
              )}
              {isEscalated && (
                <span className={`${styles.textStatus} ${styles.textStatusCancelled}`}>
                  {language === 'ko' ? '이관 대기중' : 'Transfer Pending'}
                </span>
              )}
              {priority === 'URGENT' && (
                <div className={`${styles.textStatus} ${styles.textStatusUrgent}`}>
                  {t.ticketUI.badge.urgent}
                  <span className={styles.redDot} />
                </div>
              )}
            </div>
          )}

          <div className={styles.ticketMeta}>
            {ticketId && <span className={styles.ticketId}>#{ticketId}</span>}
          </div>
        </div>
      </div>

      <div className={styles.headerDivider} />

      <div className={styles.content}>
        {entities?.is_contactless && (
          <div className={styles.badgeRow}>
            <StatusBadge variant="purple">{t.ticketUI.badge.contactless}</StatusBadge>
          </div>
        )}
        <h3 className={styles.title}>
          {isTranslating ? t.common.loading || 'Loading...' : (
            highlightSearch ? renderHighlightedText(displayTitle as string, highlightSearch, isActiveMatch) : displayTitle
          )}
        </h3>
        {cleanedDescription && (
          <p className={styles.description}>
            {highlightSearch ? renderHighlightedText(cleanedDescription, highlightSearch, isActiveMatch) : cleanedDescription}
          </p>
        )}
      </div>

      {(assigneeName || timeDisplay || Boolean((status === 'TODO' && onAccept) || (status === 'IN_PROGRESS' && !cancelRequested && onComplete) || (status === 'IN_PROGRESS' && cancelRequested && (onRejectCancel || onApproveCancel)))) && (
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {assigneeName && (
              <span className={styles.assigneeText}>
                {language === 'en' ? `Accepted by ${assigneeName}` : `${assigneeName} 담당`}
              </span>
            )}
            {timeDisplay && (
              <span className={styles.timeText}>{timeDisplay}</span>
            )}
          </div>
          <div className={styles.footerActions}>
            {status === 'TODO' && onAccept && (
              <Button
                variant="secondary"
                size="medium"
                onClick={onAccept}
                disabled={!isOnline}
                title={!isOnline ? "오프라인 상태에서는 변경할 수 없습니다" : undefined}
              >
                {t.ticketUI.button.accept}
              </Button>
            )}
            {status === 'IN_PROGRESS' && !cancelRequested && onComplete && (
              <Button
                variant="secondary"
                size="medium"
                onClick={onComplete}
                disabled={!isOnline}
                title={!isOnline ? "오프라인 상태에서는 변경할 수 없습니다" : undefined}
              >
                {t.ticketUI.button.complete}
              </Button>
            )}
            {status === 'IN_PROGRESS' && cancelRequested && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {onRejectCancel && (
                  <Button
                    variant="secondary"
                    size="medium"
                    className={styles.rejectBtn}
                    onClick={onRejectCancel}
                    disabled={!isOnline}
                    title={!isOnline ? "오프라인 상태에서는 변경할 수 없습니다" : undefined}
                  >
                    {language === 'en' ? 'Reject' : '취소 반려'}
                  </Button>
                )}
                {onApproveCancel && (
                  <Button
                    variant="primary"
                    size="medium"
                    onClick={onApproveCancel}
                    disabled={!isOnline}
                    title={!isOnline ? "오프라인 상태에서는 변경할 수 없습니다" : undefined}
                  >
                    {language === 'en' ? 'Approve' : '취소 승인'}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
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
    return `${diffDays}${language === 'en' ? ' ' : ''}${timeTexts?.daysAgo || (language === 'ko' ? '일 전' : 'days ago')}`;
  } else if (diffHours > 0) {
    return `${diffHours}${language === 'en' ? ' ' : ''}${timeTexts.hoursAgo}`;
  } else if (diffMins > 0) {
    return `${diffMins}${language === 'en' ? ' ' : ''}${timeTexts.minsAgo}`;
  } else {
    return timeTexts.justNow;
  }
}
