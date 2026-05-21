'use client';

import React, { useState } from 'react';
import InputField from '@/components/ui/Inputfield/InputField';
import SummaryCard from '@/components/ui/Card/SummaryCard';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/Table/Table';
import Button from '@/components/ui/Button/Button';
import LogDataModal from '@/components/ui/Modal/LogDataModal';
import ArrowUpIcon from '@/components/icons/ArrowUpIcon';
import ArrowDownIcon from '@/components/icons/ArrowDownIcon';
import styles from './page.module.css';
import { useTranslation } from '@/app/useTranslation';
import useAiLogs, { AiLogDetail } from './useAiLogs';

export default function AiRoutingPage() {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState('');
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AiLogDetail | null>(null);
  const [isRatingExpanded, setIsRatingExpanded] = useState(false);

  // 검색 내비게이션 상태
  const [matches, setMatches] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [activeMatchId, setActiveMatchId] = useState<number | null>(null);
  
  const { summary, logs, ratingsData, loading, error } = useAiLogs();

  // 검색 변경 핸들러
  const handleSearchChange = (val: string) => {
    setSearchValue(val);
    const search = val.toLowerCase();
    if (!search) {
      setMatches([]);
      setCurrentMatchIndex(0);
      setActiveMatchId(null);
      return;
    }

    const matchedLogIds = logs
      .filter(log => {
        const date = formatDate(log.createdAt).toLowerCase();
        const summaryText = extractSummaryFromResponse(log.rawResponse).toLowerCase();
        const tokens = log.totalTokens.toString();
        const latency = log.latencyMs.toString();
        return date.includes(search) || summaryText.includes(search) || tokens.includes(search) || latency.includes(search);
      })
      .map(log => log.id);

    setMatches(matchedLogIds);
    if (matchedLogIds.length === 0) {
      setCurrentMatchIndex(0);
      setActiveMatchId(null);
    } else {
      setCurrentMatchIndex(0);
      setActiveMatchId(matchedLogIds[0]);
    }
  };

  // logs 목록이 비동기로 로드되었을 때 기존 검색어 기반으로 재매칭
  React.useEffect(() => {
    if (searchValue) {
      handleSearchChange(searchValue);
    }
  }, [logs]);

  // activeMatchId 변경 시 해당 로그 로우로 스크롤
  React.useEffect(() => {
    if (activeMatchId) {
      const el = document.getElementById(`log-${activeMatchId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeMatchId]);

  // 텍스트 하이라이트 헬퍼 함수
  const renderHighlightedText = (text: string, search: string, isActive: boolean) => {
    if (!search) return text;
    const parts = text.split(new RegExp(`(${search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === search.toLowerCase() ? (
            <span 
              key={i} 
              style={{ 
                backgroundColor: isActive ? '#ffd54f' : 'rgba(255, 230, 0, 0.3)', 
                fontWeight: isActive ? 'bold' : 'normal',
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

  const filteredLogs = logs.filter(log => {
    const search = searchValue.toLowerCase();
    if (!search) return true;
    const date = formatDate(log.createdAt).toLowerCase();
    const summaryText = extractSummaryFromResponse(log.rawResponse).toLowerCase();
    const tokens = log.totalTokens.toString();
    const latency = log.latencyMs.toString();
    return date.includes(search) || summaryText.includes(search) || tokens.includes(search) || latency.includes(search);
  });

  const handleOpenModal = (log: AiLogDetail) => {
    setSelectedLog(log);
    setIsLogModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedLog(null);
    setIsLogModalOpen(false);
  };

  const extractSummaryFromResponse = (rawResponse: string) => {
    if (!rawResponse) return '요청 내용 없음';
    try {
      const data = JSON.parse(rawResponse);
      if (Array.isArray(data) && data.length > 0) {
        return data[0].summary || '요청 내용 없음';
      } else if (data && typeof data === 'object') {
        return data.summary || '요청 내용 없음';
      }
    } catch (e) {
      const match = rawResponse.match(/"summary"\s*:\s*"([^"]+)"/);
      if (match && match[1]) {
        return match[1];
      }
    }
    return '요청 내용 없음';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  };

  const StarDisplay = ({ rating }: { rating: number }) => (
    <span className={styles.stars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= rating ? styles.starFilled : styles.starEmpty}>★</span>
      ))}
    </span>
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>{t.frontdeskPage.taskBoard.titles.aiRouting}</h1>
        <div className={styles.headerActions}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
            <div style={{ flex: 1 }}>
              <InputField 
                variant="search" 
                placeholder={t.frontdeskPage.taskBoard.searchPlaceholder} 
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (matches.length > 0) {
                      const nextIndex = (currentMatchIndex + 1) % matches.length;
                      setCurrentMatchIndex(nextIndex);
                      setActiveMatchId(matches[nextIndex]);
                    }
                  }
                }}
              />
            </div>
            {searchValue && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-gray-600)', whiteSpace: 'nowrap', background: 'var(--color-gray-50)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-200)' }}>
                {matches.length > 0 ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <button 
                        onClick={() => {
                          const newIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
                          setCurrentMatchIndex(newIndex);
                          setActiveMatchId(matches[newIndex]);
                        }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                        aria-label="Previous match"
                      >
                        <ArrowUpIcon width={16} height={16} color="var(--color-gray-600)" />
                      </button>
                      <button 
                        onClick={() => {
                          const newIndex = (currentMatchIndex + 1) % matches.length;
                          setCurrentMatchIndex(newIndex);
                          setActiveMatchId(matches[newIndex]);
                        }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                        aria-label="Next match"
                      >
                        <ArrowDownIcon width={16} height={16} color="var(--color-gray-600)" />
                      </button>
                    </div>
                    <span>{currentMatchIndex + 1} / {matches.length}</span>
                  </>
                ) : (
                  <span>0 / 0</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <SummaryCard 
          title="평균 응답 속도" 
          value={summary ? `Avg. ${summary.averageLatencyMs.toLocaleString()}ms` : "Avg. 0ms"} 
          changeValue="●" 
          changeType="positive" 
        />
        <SummaryCard 
          title="누적 소모 토큰" 
          value={summary ? `Total ${summary.totalTokens.toLocaleString()} Tokens` : "Total 0 Tokens"} 
        />
        <SummaryCard 
          title="AI 라우팅 성공률" 
          value={summary ? `${summary.routingSuccessRate}%` : "0%"} 
          changeValue={summary ? `Fallback\n${summary.fallbackRate}%` : "Fallback\n0%"} 
          changeType="neutral" 
        />
        <SummaryCard 
          title="고객 만족도" 
          value={ratingsData.totalCount > 0 ? `${ratingsData.averageRating}/5` : "—"} 
          changeValue={ratingsData.totalCount > 0 ? `${ratingsData.totalCount}건` : undefined} 
          changeType={ratingsData.averageRating >= 4 ? 'positive' : ratingsData.averageRating >= 3 ? 'neutral' : 'negative'} 
          onClick={() => setIsRatingExpanded(!isRatingExpanded)}
        />
      </div>

      {/* Rating Detail Panel (Expandable) */}
      {isRatingExpanded && (
        <div className={styles.ratingPanel}>
          <div className={styles.ratingPanelHeader}>
            <h3 className={styles.ratingPanelTitle}>AI 처리 요청 별점 상세</h3>
            <button className={styles.ratingCloseBtn} onClick={() => setIsRatingExpanded(false)}>✕</button>
          </div>
          {ratingsData.ratings.length === 0 ? (
            <div className={styles.ratingEmpty}>등록된 AI 피드백이 없습니다.</div>
          ) : (
            <div className={styles.ratingList}>
              {ratingsData.ratings.map((item) => (
                <div key={item.requestId} className={styles.ratingItem}>
                  <div className={styles.ratingItemLeft}>
                    <StarDisplay rating={item.rating} />
                    <span className={styles.ratingDept}>{item.departmentId}</span>
                  </div>
                  <div className={styles.ratingItemCenter}>
                    {item.summary || '요청 내용 없음'}
                  </div>
                  <div className={styles.ratingItemRight}>
                    <span className={styles.ratingRoom}>{item.roomNo}호</span>
                    <span className={styles.ratingDate}>{formatDate(item.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Table Section */}
      <div className={styles.tableSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>세부 접속 로그</h2>
        </div>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'red' }}>{error}</div>
        ) : (
          <Table columns="1.5fr 4fr 1fr 1.5fr 1fr">
            <TableHeader>
              <TableCell>시간</TableCell>
              <TableCell>요청 미리보기</TableCell>
              <TableCell>총 토큰</TableCell>
              <TableCell>지연시간</TableCell>
              <TableCell></TableCell>
            </TableHeader>
            
            {filteredLogs.map(log => (
              <TableRow 
                key={log.id} 
                id={`log-${log.id}`}
                className={styles.autoHeightRow}
                style={activeMatchId === log.id ? { 
                  boxShadow: '0 0 0 2px var(--color-primary)', 
                  backgroundColor: 'var(--color-tag-background-violet)', 
                  transition: 'all 0.3s ease' 
                } : { 
                  transition: 'all 0.3s ease' 
                }}
              >
                <TableCell label="시간">
                  {renderHighlightedText(formatDate(log.createdAt), searchValue, activeMatchId === log.id)}
                </TableCell>
                <TableCell label="요청 미리보기" className={styles.autoWrapCell}>
                  {renderHighlightedText(extractSummaryFromResponse(log.rawResponse), searchValue, activeMatchId === log.id)}
                </TableCell>
                <TableCell label="총 토큰">
                  <b>{renderHighlightedText(log.totalTokens.toLocaleString(), searchValue, activeMatchId === log.id)}</b>
                </TableCell>
                <TableCell label="지연시간">
                  {log.latencyMs >= 3000 ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <b style={{ color: 'var(--color-tag-text-red)' }}>
                        {renderHighlightedText(`${log.latencyMs}ms`, searchValue, activeMatchId === log.id)}
                      </b>
                      <span style={{ 
                        background: 'var(--color-tag-bg-red)', 
                        color: 'var(--color-tag-text-red)', 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        fontSize: '12px',
                        fontWeight: 'bold' 
                      }}>SLOW</span>
                    </div>
                  ) : (
                    <b>
                      {renderHighlightedText(`${log.latencyMs}ms`, searchValue, activeMatchId === log.id)}
                    </b>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="secondary" onClick={() => handleOpenModal(log)}>상세 보기</Button>
                </TableCell>
              </TableRow>
            ))}
            
            {filteredLogs.length === 0 && (
              <TableRow>
                <TableCell>No logs found.</TableCell>
              </TableRow>
            )}
          </Table>
        )}
      </div>

      {/* Log Data Modal */}
      <LogDataModal
        isOpen={isLogModalOpen}
        onClose={handleCloseModal}
        log={selectedLog}
      />
    </div>
  );
}
