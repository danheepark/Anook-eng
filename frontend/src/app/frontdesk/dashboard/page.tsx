'use client';

import React, { useState } from 'react';
import DateRangeSelector, { DateRange } from '@/components/ui/DateRangeSelector/DateRangeSelector';
import ChartCard from '@/components/ui/Card/ChartCard';
import SummaryCard from '@/components/ui/Card/SummaryCard';
import useFrontdeskStats from './useFrontdeskStats';
import styles from './page.module.css';
import { useTranslation } from '@/app/useTranslation';

const PRIORITY_NAMES: Record<string, string> = {
  HIGH: '높음', NORMAL: '보통', LOW: '낮음'
};

const DONUT_COLORS = ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db'];

/**
 * 세로 막대 그래프 (참고 디자인: 검은 바, Y축 눈금, X축 부서명)
 */
function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  // Y축 눈금: 0 ~ maxVal를 4등분
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round((maxVal / 4) * (4 - i)));

  return (
    <div className={styles.barChart}>
      <div className={styles.barYAxis}>
        {ticks.map((t, i) => (
          <span key={i} className={styles.barYLabel}>{t}</span>
        ))}
      </div>
      <div className={styles.barArea}>
        <div className={styles.barGridLines}>
          {ticks.map((_, i) => <div key={i} className={styles.barGridLine} />)}
        </div>
        <div className={styles.barColumns}>
          {data.map((item) => (
            <div key={item.label} className={styles.barCol}>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{ height: `${(item.value / maxVal) * 100}%` }}
                />
              </div>
              <span className={styles.barXLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 도넛 차트 (참고 디자인: 다크 컬러, 우측 범례)
 */
function DonutChart({ data, colors }: { data: { label: string; value: number; pct: number }[]; colors: string[] }) {
  const size = 160;
  const strokeWidth = 32;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={styles.donutWrapper}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((item, i) => {
          const sliceLength = (item.pct / 100) * circumference;
          const gap = 4; // 슬라이스 사이의 간격(px)
          const dash = Math.max(0, sliceLength - gap);
          const currentOffset = -offset;
          offset += sliceLength;
          return (
            <circle
              key={item.label}
              cx={size / 2} cy={size / 2} r={radius}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={currentOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <div className={styles.donutLegend}>
        {data.map((item, i) => (
          <div key={item.label} className={styles.legendRow}>
            <span className={styles.legendDot} style={{ background: colors[i % colors.length] }} />
            <span className={styles.legendName}>{item.label}</span>
            <span className={styles.legendPct}>{item.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Utility to format date to YYYY-MM-DD
const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return { startDate: formatDate(start), endDate: formatDate(end) };
  });

  const { stats, loading, error } = useFrontdeskStats(dateRange.startDate, dateRange.endDate);
  const { t } = useTranslation();

  const deptData = stats
    ? Object.entries(stats.byDepartment).map(([k, v]) => ({ 
        label: t.frontdeskPage.dashboard.departments[k as keyof typeof t.frontdeskPage.dashboard.departments] || k, 
        value: v 
      }))
    : [];

  const frequentRequestsList = stats && stats.frequentRequests
    ? Object.entries(stats.frequentRequests).map(([k, v]) => ({ label: k, value: v }))
    : [];
  
  const totalFrequentCount = frequentRequestsList.reduce((acc, curr) => acc + curr.value, 0);

  const frequentRequestsData = frequentRequestsList
    .map(item => ({
      ...item,
      pct: totalFrequentCount > 0 ? Math.round((item.value / totalFrequentCount) * 100) : 0
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className={styles.container}>
      {/* Header Section */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t.frontdeskPage.dashboard.title}</h1>
        </div>
        <div className={styles.headerActions}>
          <DateRangeSelector 
            dateRange={dateRange}
            onChange={(range) => setDateRange(range)}
          />
        </div>
      </div>

      {/* Top Content Section (Summaries) */}
      <div className={styles.summaryGrid}>
        <SummaryCard 
          title={t.frontdeskPage.dashboard.summaries.totalToday} 
          value={loading ? '-' : stats?.total ?? 0} 
          changeValue={stats?.totalChange ?? '+0%'} 
          changeType={(stats?.totalChange?.startsWith('-') || stats?.totalChange === '+0%') ? 'negative' : 'positive'} 
          size="md" 
        />
        <SummaryCard 
          title={t.frontdeskPage.dashboard.summaries.avgResponseTime} 
          value={loading ? '-' : `${stats?.avgResolutionTimeMins ?? 0}m`} 
          changeValue={stats?.avgResolutionTimeChange ?? '-0.0m'} 
          changeType={(stats?.avgResolutionTimeChange?.startsWith('-') || stats?.avgResolutionTimeChange === '+0.0m') ? 'positive' : 'negative'} 
          size="md" 
        />
        <SummaryCard 
          title={t.frontdeskPage.dashboard.summaries.resolutionRate} 
          value={loading ? '-' : `${stats?.resolutionRatePct ?? 0}%`} 
          changeValue={stats?.resolutionRateChange ?? '+0.0%'} 
          changeType={(stats?.resolutionRateChange?.startsWith('-') || stats?.resolutionRateChange === '+0.0%') ? 'negative' : 'positive'} 
          size="md" 
        />
        <SummaryCard 
          title={t.frontdeskPage.dashboard.summaries.csat} 
          value={loading ? '-' : stats?.customerSatisfaction ?? 0} 
          changeValue={stats?.customerSatisfactionChange ?? '+0.0'} 
          changeType={(stats?.customerSatisfactionChange?.startsWith('-') || stats?.customerSatisfactionChange === '+0.0') ? 'negative' : 'positive'} 
          size="md" 
        />
      </div>

      {/* Main Content Section (Charts) */}
      <div className={styles.chartsGrid}>
        <ChartCard title={t.frontdeskPage.dashboard.charts.avgResTime} subtitle="AVERAGE RESOLUTION TIME (MINUTES)">
           <div className={styles.chartPlaceholder}>
              {loading ? t.common.loading : error ? error : <BarChart data={deptData} />}
           </div>
        </ChartCard>
        
        <ChartCard title={t.frontdeskPage.dashboard.charts.frequentReqs} subtitle="MOST FREQUENT REQUESTS (%)">
           <div className={styles.chartPlaceholder}>
              {loading ? t.common.loading : error ? error : (
                <DonutChart data={frequentRequestsData} colors={DONUT_COLORS} />
              )}
           </div>
        </ChartCard>
      </div>
    </div>
  );
}
