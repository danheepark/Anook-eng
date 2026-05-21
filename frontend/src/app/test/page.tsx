'use client';

import React, { useState } from 'react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';

import { ConfirmModal, ModalOverlay, ModalCard, LogDataModal } from '@/components/ui/Modal';
import * as Icons from '@/components/icons';
import Button from '@/components/ui/Button/Button';
import InputField from '@/components/ui/Inputfield/InputField';
import Dropdown from '@/components/ui/Dropdown/Dropdown';
import Tabs from '@/components/ui/Tab/Tabs';
import Pagination from '@/components/ui/Pagenation/Pagination';
import RequestCard from '@/components/ui/Card/RequestCard';
import GuestRequestCard from '@/app/guest/chat/_components/RequestCard/RequestCard';
import RequestStatusBar from '@/app/guest/chat/_components/RequestStatusBar/RequestStatusBar';
import ChatBubble from '@/app/guest/chat/_components/ChatBubble';
import ChatInput from '@/app/guest/chat/_components/ChatInput';

import ChatScreen from '@/app/guest/chat/_components/ChatScreen';
import Pill from '@/components/ui/Pill/Pill';
import FeedbackCard from '@/app/guest/chat/_components/FeedbackCard';
import ChatEndCard from '@/app/guest/chat/_components/ChatEndCard/ChatEndCard';
import { HandoverRecord } from '@/components/ui/HandoverRecord';
import TaskTicket from '@/components/ui/TaskBoard/TaskTicket';
import TaskColumn from '@/components/ui/TaskBoard/TaskColumn';
import SummaryCard from '@/components/ui/Card/SummaryCard';
import ChartCard from '@/components/ui/Card/ChartCard';
import FilterButton from '@/components/ui/FilterButton/FilterButton';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/Table/Table';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import Toggle from '@/components/ui/Button/Toggle';
import Toast from '@/components/ui/Modal/Toast';

import ChatHistory from '@/components/ui/ChatHistory/ChatHistory';
import KnowledgeItem from '@/components/ui/Knowledge/KnowledgeItem';
import KnowledgeModal from '@/components/ui/Knowledge/KnowledgeModal';
import KnowledgeEditModal from '@/components/ui/Knowledge/KnowledgeEditModal';
import BoardSkeleton from '@/app/staff/_components/BoardSkeleton/BoardSkeleton';

// 실서비스 내 모든 모달 상세 수집 및 모킹용 임포트
import CreateRequestModal from '@/app/frontdesk/requests/_components/CreateRequestModal/CreateRequestModal';
import ApproveEscalationModal from '@/app/frontdesk/requests/_components/ApproveEscalationModal/ApproveEscalationModal';
import RejectEscalationModal from '@/app/frontdesk/requests/_components/RejectEscalationModal/RejectEscalationModal';
import ApproveCancellationModal from '@/app/frontdesk/requests/_components/ApproveCancellationModal/ApproveCancellationModal';
import RejectCancellationModal from '@/app/frontdesk/requests/_components/RejectCancellationModal/RejectCancellationModal';
import RegisterTrainingModal from '@/app/frontdesk/requests/_components/RegisterTrainingModal/RegisterTrainingModal';
import AssignModal from '@/app/frontdesk/requests/_components/AssignModal/AssignModal';
import ManualAssignModal from '@/app/frontdesk/requests/_components/ManualAssignModal/ManualAssignModal';
import RequestDetailModal from '@/app/frontdesk/requests/_components/RequestDetailModal/RequestDetailModal';
import StaffFormModal from '@/app/frontdesk/staff-management/_components/StaffFormModal/StaffFormModal';
import RoleFormModal from '@/app/frontdesk/staff-management/_components/RoleFormModal/RoleFormModal';
import TaskDetailModal from '@/app/staff/_components/TaskDetailModal/TaskDetailModal';
import ChatHistoryModal from '@/app/staff/_components/TaskDetailModal/ChatHistoryModal';

import chatScreenStyles from '@/app/guest/chat/_components/ChatScreen.module.css';
import {
  LayoutDashboard, Inbox, AlertTriangle, Wrench, Home, Utensils,
  ConciergeBell, List, Database, Target, User, History,
  MessageSquare, Users, Monitor, Layers, FileSearch, FileText
} from 'lucide-react';

const lucideIcons = {
  LayoutDashboard, Inbox, AlertTriangle, Wrench, Home, Utensils,
  ConciergeBell, List, Database, Target, User, History,
  MessageSquare, Users, Monitor, Layers, FileSearch, FileText
};
import { useUiStore } from '@/stores/useUiStore';
import { useChat } from '@/app/guest/chat/useChat';

const ComponentLabel = ({ path }: { path: string }) => (
  <div style={{ font: 'var(--text-caption-regular)', color: 'var(--color-primary)', marginBottom: 'var(--space-8)', padding: 'var(--space-4) var(--space-8)', background: 'var(--color-primary-50)', borderRadius: 'var(--radius-sm)', display: 'inline-block' }}>
    <code style={{ fontFamily: 'monospace' }}>{path}</code>
  </div>
);

export default function ComponentShowcasePage() {
  const { showToast } = useUiStore();
  const { messages, isTyping, sendMessage } = useChat();
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [sidebarRole, setSidebarRole] = useState<'frontdesk' | 'housekeeping' | 'facility' | 'fb' | 'concierge'>('frontdesk');
  const [selectedQuickBtn, setSelectedQuickBtn] = useState<string>('');
  const [testProgress, setTestProgress] = useState<number>(33);
  const [sidebarActivePath, setSidebarActivePath] = useState('/frontdesk/dashboard');
  const [activeRoomId, setActiveRoomId] = useState<string | number>('1001');
  const [selectedKnowledge, setSelectedKnowledge] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [chatScreenStatus, setChatScreenStatus] = useState<'normal' | 'emergency' | 'escalated' | 'progress'>('normal');
  const [requestCardKey, setRequestCardKey] = useState(0);

  const sampleRooms = [
    { id: '1001', roomNumber: '1001', statusText: '보관됨' },
    { id: '1204', roomNumber: '1204', statusText: '활성 대화' },
    { id: '2105', roomNumber: '2105', statusText: '보관됨' },
    { id: '302', roomNumber: '302', statusText: '보관됨' },
    { id: '502', roomNumber: '502', statusText: '보관됨' },
    { id: '805', roomNumber: '805', statusText: '보관됨' }
  ];

  const sampleKnowledges = [
    {
      id: 1,
      domainCode: 'FRONT',
      question: '체크아웃 시간 연장(Late Checkout)',
      answer: '오후 2시까지 연장 가능하며, 시간당 2,500엔의 추가 비용이 발생합니다. 멤버십 등급에 따라 무료 연장이 가능할 수 있으니 프론트에 문의 바랍니다.',
      updatedAt: '2024-04-15'
    },
    {
      id: 2,
      domainCode: 'FACILITY',
      question: '천연 온천(대욕장) 이용 안내',
      answer: '호텔 12층에 위치한 천연 온천은 오후 3시부터 익일 오전 10시까지 이용 가능합니다. 문신이 있으신 고객님은 제공해 드리는 커버 씰을 부착해 주시기 바랍니다.',
      updatedAt: '2024-04-10'
    },
    {
      id: 3,
      domainCode: 'CONCIERGE',
      question: '도쿄 타워(Tokyo Tower) 방문 가이드',
      answer: '호텔 서쪽 출구에서 도보로 약 10분 거리에 위치해 있습니다. 메인 데크 예매권은 호텔 컨시어지 데스크에서 할인된 가격으로 구매 가능합니다.',
      updatedAt: '2024-04-18'
    }
  ];

  const sampleHandoverItems = [
    { id: 1, roomNumber: '1204', guestName: '김민수', requestDetails: '[에어컨 수리] 에어컨 작동 안 됨' },
    { id: 2, roomNumber: '1204', guestName: '김민수', requestDetails: '[수건 교체] 새 수건 3장 추가 요청' },
    { id: 3, roomNumber: '805', guestName: '박지원', requestDetails: '[룸서비스] 치즈버거 1세트 주문' },
    { id: 4, roomNumber: '502', guestName: '이지현', requestDetails: '[침구류 정리] 엑스트라 베드 설치 요청' },
    { id: 5, roomNumber: '302', guestName: '최승우', requestDetails: '[샤워기 헤드 교체] 수압 약함' },
    { id: 6, roomNumber: '2105', guestName: '홍길동', requestDetails: '[레스토랑 예약] 오늘 저녁 7시 미슐랭 레스토랑 2명 예약 요청' },
    { id: 7, roomNumber: '1001', guestName: '홍길동', requestDetails: '[객실 내 응급 환자] 심한 복통 호소, 의료진 지원 필요' },
  ];

  const sampleHandoverBriefing = {
    id: 1,
    shiftStart: '2026-04-28 09:00',
    shiftEnd: '2026-04-28 18:00',
    totalRequestCount: 45,
    pendingCount: 2,
    escalatedCount: 1,
    summary: '대부분의 요청이 원활하게 처리되었으나, 1204호 에어컨 수리 건이 부품 문제로 지연 중. 야간 근무 시 진행 상황 팔로업 요망.',
    createdAt: '2026-04-28 17:55'
  };

  const closeModal = () => setActiveModal(null);

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const role = e.target.value as any;
    setSidebarRole(role);
    setSidebarActivePath(role === 'frontdesk' ? '/frontdesk/dashboard' : `/dept/${role}/my-tasks`);
  };

  const handleSidebarClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault(); // 페이지 이동 방지
    setSidebarActivePath(href);
  };


  const [isToggled, setIsToggled] = useState(false);

  const [inputValue, setInputValue] = useState('');
  const [dropdownValue, setDropdownValue] = useState('');
  const [tabValue, setTabValue] = useState('tab1');
  const [currentPage, setCurrentPage] = useState(1);

  const modalNames = [
    'ConfirmModal',
    '기본 모달 (ModalOverlay+Card)',
    'CreateRequestModal',
    'ApproveEscalationModal',
    'RejectEscalationModal',
    'ApproveCancellationModal',
    'RejectCancellationModal',
    'RegisterTrainingModal',
    'AssignModal',
    'ManualAssignModal',
    'RequestDetailModal',
    'StaffFormModal',
    'RoleFormModal',
    'TaskDetailModal',
    'ChatHistoryModal',
    'KnowledgeModal',
    'KnowledgeEditModal',
    'LogDataModal'
  ];

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column', font: 'var(--font-sans)' }}>
      <Toast />

      <div style={{ flex: 1, padding: 'var(--space-48) var(--space-60)' }}>
        <h1 style={{ font: 'var(--text-hero-bold)', marginBottom: 'var(--space-48)', color: 'var(--color-gray-900)' }}>
          🛠️ UI Component Showcase
        </h1>

        {/* 1. HEADER */}
        <section style={{ marginBottom: 'var(--space-60)' }}>
          <h2 style={{ font: 'var(--text-h2-bold)', marginBottom: 'var(--space-16)', color: 'var(--color-gray-700)' }}>
            1. Header Component
          </h2>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
            <ComponentLabel path="components/layout/Header.tsx" />
            <Header />
          </div>
        </section>

        <div style={{ display: 'flex', gap: 'var(--space-48)', marginBottom: 'var(--space-60)' }}>
          {/* 2. SIDEBAR */}
          <section style={{ flex: '0 0 260px' }}>
            <h2 style={{ font: 'var(--text-h2-bold)', marginBottom: 'var(--space-16)', color: 'var(--color-gray-700)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              2. Sidebar
              <select
                value={sidebarRole}
                onChange={handleRoleChange}
                style={{ font: 'var(--text-body-medium)', padding: 'var(--space-4)', borderRadius: 'var(--radius-sm)' }}
              >
                <option value="frontdesk">Frontdesk</option>
                <option value="housekeeping">하우스키핑</option>
                <option value="fb">식음료(F&B)</option>
                <option value="facility">시설관리</option>
                <option value="concierge">컨시어지</option>
              </select>
            </h2>
            <div style={{ borderRadius: 'var(--radius-lg)' }}>
              <div style={{ width: '100%' }}>
                <ComponentLabel path="components/layout/Sidebar.tsx" />
                <React.Suspense fallback={<div style={{ height: '100%' }} />}>
                  <Sidebar
                    role={sidebarRole}
                    fakePathname={sidebarActivePath}
                    onMenuClick={handleSidebarClick}
                  />
                </React.Suspense>
              </div>
            </div>
          </section>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-60)' }}>
            {/* 3. MODAL */}
            <section>
              <h2 style={{ font: 'var(--text-h2-bold)', marginBottom: 'var(--space-16)', color: 'var(--color-gray-700)' }}>
                3. Modal Component
              </h2>
              <div style={{ background: 'var(--color-bg)', padding: 'var(--space-32)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' }}>
                <p style={{ font: 'var(--text-body-regular)', marginBottom: 'var(--space-16)', color: 'var(--color-gray-500)' }}>버튼을 클릭하여 각 모달의 UI를 확인합니다.</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-12)' }}>
                  {modalNames.map((m) => (
                    <button
                      key={m}
                      onClick={() => setActiveModal(m)}
                      style={{ background: 'var(--color-primary)', color: 'var(--color-white)', padding: 'var(--space-8) var(--space-16)', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', font: 'var(--text-body-regular)' }}
                    >
                      Open {m}
                    </button>
                  ))}
                </div>

                <ComponentLabel path="components/ui/Modal/ConfirmModal.tsx" />
                <ConfirmModal
                  isOpen={activeModal === 'ConfirmModal'}
                  onClose={closeModal}
                  onConfirm={closeModal}
                  title="Confirm 테스트"
                  subtitle="모달이 정상적으로 뜨는지 확인합니다."
                  requireCheckbox={true}
                  checkboxLabel="안내사항을 확인했습니다."
                />

                {/* 기본 ModalOverlay + ModalCard 조합 테스트 */}
                <ComponentLabel path="components/ui/Modal/ModalOverlay.tsx & ModalCard.tsx" />
                <ModalOverlay isOpen={activeModal === '기본 모달 (ModalOverlay+Card)'} onClose={closeModal}>
                  <ModalCard size="sm">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                      <h2 style={{ font: 'var(--text-h2-bold)' }}>기본 모달 (Modal Card)</h2>
                      <p style={{ font: 'var(--text-body-regular)', color: 'var(--color-gray-500)' }}>
                        이것은 ModalOverlay와 ModalCard를 사용하여 직접 만든 기본 형태의 모달입니다.
                      </p>
                      <Button variant="primary" onClick={closeModal} fullWidth>
                        닫기
                      </Button>
                    </div>
                  </ModalCard>
                </ModalOverlay>

                <div style={{ marginTop: 'var(--space-32)', paddingTop: 'var(--space-24)', borderTop: '1px solid var(--color-surface)' }}>
                  <h3 style={{ font: 'var(--text-h3-bold)', marginBottom: 'var(--space-12)' }}>Toast Notifications</h3>
                  <div style={{ display: 'flex', gap: 'var(--space-16)' }}>
                    <Button variant="primary" onClick={() => showToast('성공적으로 저장되었습니다.', 'success')}>Show Success Toast</Button>
                    <Button variant="danger" onClick={() => showToast('오류가 발생했습니다.', 'error', '잠시 후 다시 시도해주세요.')}>Show Error Toast</Button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* 4. UI COMPONENTS */}
        <section style={{ marginBottom: 'var(--space-60)' }}>
          <h2 style={{ font: 'var(--text-h2-bold)', marginBottom: 'var(--space-16)', color: 'var(--color-gray-700)' }}>
            4. UI Components
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-32)' }}>

            {/* Group 1: Buttons & Controls */}
            <div style={{ background: 'var(--color-bg)', padding: 'var(--space-32)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
              <h3 style={{ font: 'var(--text-h3-bold)', color: 'var(--color-gray-700)', borderBottom: '1px solid var(--color-surface)', paddingBottom: 'var(--space-8)' }}>1. Buttons & Controls</h3>
              <div>
                <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-12)' }}>Buttons</h4>
                <ComponentLabel path="components/ui/Button/Button.tsx" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-16)', alignItems: 'center' }}>
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="danger">Danger</Button>
                  <Button variant="outlined">Outlined</Button>
                  <Button size="large">Large</Button>
                  <Button size="medium">Medium</Button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-32)', marginTop: 'var(--space-12)' }}>
                <div>
                  <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-12)' }}>Toggle</h4>
                  <ComponentLabel path="components/ui/Button/Toggle.tsx" />
                  <Toggle checked={isToggled} onChange={(e) => setIsToggled(e.target.checked)} label="Toggle On/Off" />
                </div>
                <div>
                  <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-12)' }}>Filter Button</h4>
                  <ComponentLabel path="components/ui/FilterButton/FilterButton.tsx" />
                  <FilterButton
                    filterOptions={[{ label: '최신순', value: 'latest' }, { label: '오래된순', value: 'oldest' }, { label: '우선순위', value: 'priority' }]}
                    selectedFilter="latest"
                    onFilterSelect={(val) => alert(`필터 선택: ${val}`)}
                  />
                </div>
              </div>
            </div>

            {/* Group 2: Inputs & Forms */}
            <div style={{ background: 'var(--color-bg)', padding: 'var(--space-32)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
              <h3 style={{ font: 'var(--text-h3-bold)', color: 'var(--color-gray-700)', borderBottom: '1px solid var(--color-surface)', paddingBottom: 'var(--space-8)' }}>2. Inputs & Forms</h3>
              <div style={{ display: 'flex', gap: 'var(--space-32)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 'var(--space-16)', flexDirection: 'column', flex: 1, minWidth: '300px' }}>
                  <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-8)' }}>InputField</h4>
                  <ComponentLabel path="components/ui/InputField/InputField.tsx" />
                  <InputField label="기본 입력" placeholder="텍스트를 입력하세요" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                  <InputField variant="search" placeholder="검색어를 입력하세요..." />
                  <InputField label="에러 상태" error="올바르지 않은 값입니다." value="Error test" readOnly />
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-8)' }}>Dropdown</h4>
                  <ComponentLabel path="components/ui/Dropdown/Dropdown.tsx" />
                  <Dropdown
                    label="옵션 선택"
                    options={[{ label: '옵션 1', value: '1' }, { label: '옵션 2', value: '2' }, { label: '옵션 3', value: '3' }]}
                    value={dropdownValue}
                    onChange={setDropdownValue}
                  />
                </div>
              </div>
            </div>

            {/* Group 3: Navigation & Status */}
            <div style={{ background: 'var(--color-bg)', padding: 'var(--space-32)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
              <h3 style={{ font: 'var(--text-h3-bold)', color: 'var(--color-gray-700)', borderBottom: '1px solid var(--color-surface)', paddingBottom: 'var(--space-8)' }}>3. Navigation & Status</h3>
              <Tabs options={[{ label: '전체', value: 'tab1', count: 12 }, { label: '객실', value: 'tab2', count: 5 }]} activeValue={activeModal || 'tab1'} onChange={(v) => setActiveModal(v)} />
              <Pill options={['알림', '공지사항', '시스템']} selectedOption={activeModal || '알림'} onSelect={(v) => setActiveModal(v)} />
              <div style={{ display: 'flex', gap: 'var(--space-16)', alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusBadge variant="gray">기본(Gray)</StatusBadge>
                <StatusBadge variant="red">위험(Red)</StatusBadge>
                <StatusBadge variant="purple">보라(Purple)</StatusBadge>
                <StatusBadge variant="green">성공(Green)</StatusBadge>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-32)', flexWrap: 'wrap', marginTop: 'var(--space-12)' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-12)' }}>Tabs</h4>
                  <ComponentLabel path="components/ui/Tab/Tabs.tsx" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                    <Tabs options={[{ label: '전체', value: 'tab1', count: 12 }, { label: '진행중', value: 'tab2', count: 3 }, { label: '완료', value: 'tab3', count: 9 }]} activeValue={tabValue} onChange={setTabValue} />
                    <Pill options={['알림', '설정']} selectedOption={tabValue} onSelect={setTabValue} />
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-12)' }}>Pagination</h4>
                  <ComponentLabel path="components/ui/Pagenation/Pagination.tsx" />
                  <Pagination currentPage={currentPage} totalPages={10} onPageChange={setCurrentPage} />
                </div>
              </div>
            </div>

            {/* Group 4: Chat UI */}
            <div style={{ background: 'var(--color-bg)', padding: 'var(--space-32)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
              <h3 style={{ font: 'var(--text-h3-bold)', color: 'var(--color-gray-700)', borderBottom: '1px solid var(--color-surface)', paddingBottom: 'var(--space-8)' }}>4. Chat UI</h3>
              
              <div style={{ display: 'flex', gap: 'var(--space-32)', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                  <div>
                    <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-12)' }}>Chat Bubble (Sent)</h4>
                    <ComponentLabel path="app/guest/chat/_components/ChatBubble.tsx" />
                    <div style={{ padding: 'var(--space-24)', background: 'var(--color-gray-50)', border: '1px solid var(--color-surface)', borderRadius: 'var(--radius-lg)' }}>
                      <ChatBubble variant="sent">수건 2장 더 가져다주세요. 그리고 가습기가 있으면 좋겠어요.</ChatBubble>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-12)' }}>Chat Bubble (Received)</h4>
                    <ComponentLabel path="app/guest/chat/_components/ChatBubble.tsx" />
                    <div style={{ padding: 'var(--space-24)', background: 'var(--color-gray-50)', border: '1px solid var(--color-surface)', borderRadius: 'var(--radius-lg)' }}>
                      <ChatBubble variant="received">네, 고객님! 수건 2장과 가습기를 객실로 가져다 드리겠습니다. 잠시만 기다려주세요.</ChatBubble>
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-12)' }}>Chat Input</h4>
                  <ComponentLabel path="app/guest/chat/_components/ChatInput.tsx" />
                  <div style={{ padding: 'var(--space-24)', background: 'var(--color-gray-50)', border: '1px solid var(--color-surface)', borderRadius: 'var(--radius-lg)', marginTop: 'auto', marginBottom: 'auto' }}>
                    <ChatInput onSend={(text) => alert(`전송: ${text}`)} />
                  </div>
                  
                  <div style={{ marginTop: 'var(--space-24)' }}>
                    <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-12)' }}>Chat Bubble (Fallback)</h4>
                    <div style={{ padding: 'var(--space-24)', background: 'var(--color-gray-50)', border: '1px solid var(--color-surface)', borderRadius: 'var(--radius-lg)' }}>
                      <ChatBubble variant="received" isFallback>보다 정확한 안내를 위해 <strong>프론트 데스크</strong>로 내용을 전달했습니다. 잠시만 기다려주세요! 😊</ChatBubble>
                    </div>
                  </div>

                  <div style={{ marginTop: 'var(--space-24)' }}>
                    <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-12)' }}>Staff Typing Indicator (상담사 입력 중)</h4>
                    <ComponentLabel path="app/guest/chat/_components/ChatScreen.module.css (.typingDots)" />
                    <div style={{ padding: 'var(--space-24)', background: 'var(--color-gray-50)', border: '1px solid var(--color-surface)', borderRadius: 'var(--radius-lg)' }}>
                      <ChatBubble variant="received" isFallback>
                        <span className={chatScreenStyles.typingDots}>
                          <span className={chatScreenStyles.dot} />
                          <span className={chatScreenStyles.dot} />
                          <span className={chatScreenStyles.dot} />
                        </span>
                      </ChatBubble>
                    </div>
                  </div>


                  <div style={{ marginTop: 'var(--space-24)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-12)' }}>
                      <h4 style={{ font: 'var(--text-body-bold)', margin: 0 }}>Guest Request Card (10초 타이머)</h4>
                      <Button variant="outlined" onClick={() => setRequestCardKey(k => k + 1)}>타이머 재시작 🔄</Button>
                    </div>
                    <ComponentLabel path="app/guest/chat/_components/RequestCard/RequestCard.tsx" />
                    <div style={{ padding: 'var(--space-24)', background: 'var(--bg-bubble)', border: '1px solid var(--color-surface)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                      <GuestRequestCard
                        key={requestCardKey}
                        requestId={1001}
                        domainCode="HK"
                        summary="수건 2장 추가 요청"
                        entities={{ items: [{ item: "수건", count: 2 }] }}
                        status="PENDING"
                        progress={0}
                        graceRemaining={10}
                        priority="NORMAL"
                        createdAt={new Date().toISOString()}
                        onAccept={() => alert('요청 접수')}
                        onCancel={() => alert('취소')}
                      />
                      
                      {/* 색상 테스트용 카드들 (타이머 종료 상태) */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-16)', marginTop: 'var(--space-24)' }}>
                        <GuestRequestCard requestId={2} domainCode="HK" summary="하우스키핑 컬러" status="PENDING" progress={0} graceRemaining={-1} priority="NORMAL" />
                        <GuestRequestCard requestId={3} domainCode="FB" summary="식음료 컬러" status="PENDING" progress={0} graceRemaining={-1} priority="NORMAL" />
                        <GuestRequestCard requestId={4} domainCode="FACILITY" summary="시설관리 컬러" status="PENDING" progress={0} graceRemaining={-1} priority="NORMAL" />
                        <GuestRequestCard requestId={5} domainCode="CONCIERGE" summary="컨시어지 컬러" status="PENDING" progress={0} graceRemaining={-1} priority="NORMAL" />
                        <GuestRequestCard requestId={6} domainCode="FRONT" summary="프론트 컬러" status="PENDING" progress={0} graceRemaining={-1} priority="NORMAL" />
                        <GuestRequestCard requestId={7} domainCode="EMERGENCY" summary="긴급 컬러" status="PENDING" progress={0} graceRemaining={-1} priority="NORMAL" />
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 'var(--space-24)' }}>
                    <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-12)' }}>Request Status Bar (상태 진행바)</h4>
                    <ComponentLabel path="app/guest/chat/_components/RequestStatusBar/RequestStatusBar.tsx" />
                    <div style={{ padding: 'var(--space-24)', background: 'var(--bg-bubble)', border: '1px solid var(--color-surface)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                      <RequestStatusBar
                        requestId={1001}
                        domainCode="HK"
                        summary="수건 추가 요청"
                        status="IN_PROGRESS"
                        progress={testProgress}
                        entities={{ item: "수건", count: "2" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-32)', flexWrap: 'wrap', marginTop: 'var(--space-8)' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-12)' }}>Pill Component</h4>
                  <ComponentLabel path="components/ui/Pill/Pill.tsx" />
                  <div style={{ padding: 'var(--space-24)', background: 'var(--color-gray-50)', border: '1px solid var(--color-surface)', borderRadius: 'var(--radius-lg)' }}>
                    <Pill 
                      options={['🛏️ 수건 요청', '🧴 어메니티 추가', '🧹 룸 클리닝', '🔑 체크아웃 문의']} 
                      selectedOption={selectedQuickBtn}
                      onSelect={(opt) => setSelectedQuickBtn(opt)} 
                    />
                  </div>
                </div>
                
                
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-12)' }}>Feedback Card (Deprecated)</h4>
                  <ComponentLabel path="app/guest/chat/_components/FeedbackCard.tsx" />
                  <div style={{ padding: 'var(--space-24)', background: 'var(--color-gray-50)', border: '1px solid var(--color-surface)', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'center' }}>
                    <FeedbackCard onSubmit={(rating) => alert(`별점: ${rating}점 제출!`)} />
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: '300px' }}>
                  <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-12)' }}>Chat End Card (New Feedback)</h4>
                  <ComponentLabel path="app/guest/chat/_components/ChatEndCard/ChatEndCard.tsx" />
                  <div style={{ padding: 'var(--space-24)', background: 'var(--color-gray-50)', border: '1px solid var(--color-surface)', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'center' }}>
                    <ChatEndCard 
                      summary="[에어컨 수리] 기사님 방문 완료 및 정상 작동 확인"
                      completedAt={new Date().toISOString()}
                      onSubmitRating={(rating) => alert(`별점: ${rating}점 제출!`)}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-32)', flexWrap: 'wrap', marginTop: 'var(--space-24)' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-12)' }}>Guest Request Card (게스트용)</h4>
                  <ComponentLabel path="app/guest/chat/_components/RequestCard/RequestCard.tsx" />
                  <div style={{ width: '100%' }}>
                    <GuestRequestCard 
                      requestId={1}
                      domainCode="HK"
                      summary="수건 2장 요청"
                      status="PENDING"
                      progress={0}
                      graceRemaining={5}
                      priority="NORMAL"
                      entities={{ item: "수건", count: 2 }}
                    />
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: '300px' }}>
                  <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-12)' }}>Request Status Bar (게스트용 진행상황)</h4>
                  <ComponentLabel path="app/guest/chat/_components/RequestStatusBar/RequestStatusBar.tsx" />
                  <div style={{ width: '100%' }}>
                    <RequestStatusBar 
                      requestId={1}
                      domainCode="FB"
                      summary="룸서비스 예약"
                      status="IN_PROGRESS"
                      progress={50}
                      entities={{ menu: "조식 세트" }}
                    />
                  </div>
                </div>
                

              </div>


            </div>

            {/* Group 5: Data Display & Cards */}
            <div style={{ background: 'var(--color-bg)', padding: 'var(--space-32)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
              <h3 style={{ font: 'var(--text-h3-bold)', color: 'var(--color-gray-700)', borderBottom: '1px solid var(--color-surface)', paddingBottom: 'var(--space-8)' }}>5. Data Display & Cards</h3>

              <div>
                <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-12)' }}>Table (세부 접속 로그)</h4>
                <ComponentLabel path="components/ui/Table/Table.tsx" />
                <Table columns="1.5fr 4fr 1fr 1.5fr 1fr">
                  <TableHeader>
                    <TableCell>시간</TableCell>
                    <TableCell>요청 미리보기</TableCell>
                    <TableCell>총 토큰</TableCell>
                    <TableCell>지연시간</TableCell>
                    <TableCell></TableCell>
                  </TableHeader>
                  <TableRow>
                    <TableCell>2026.10.26 14:05:12</TableCell>
                    <TableCell>수건 2장 더 가져다주세요. 그리고 가습기가 있으면 좋겠어요.</TableCell>
                    <TableCell><b>1,520</b></TableCell>
                    <TableCell><b>850ms</b></TableCell>
                    <TableCell><Button variant="secondary" size="medium" onClick={() => setIsLogModalOpen(true)}>상세보기</Button></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>2026.10.26 14:12:45</TableCell>
                    <TableCell>화장실 전구가 나갔어요. 확인 부탁드립니다.</TableCell>
                    <TableCell><b>1,430</b></TableCell>
                    <TableCell><b style={{ color: 'red' }}>3100ms</b></TableCell>
                    <TableCell><Button variant="secondary" size="medium" onClick={() => setIsLogModalOpen(true)}>상세보기</Button></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>2026.10.26 14:15:33</TableCell>
                    <TableCell>저녁 7시에 이탈리안 레스토랑 예약 가능한가요?</TableCell>
                    <TableCell><b>1,650</b></TableCell>
                    <TableCell><b>920ms</b></TableCell>
                    <TableCell><Button variant="secondary" size="medium" onClick={() => setIsLogModalOpen(true)}>상세보기</Button></TableCell>
                  </TableRow>
                </Table>
                <div style={{ marginTop: 'var(--space-16)' }}>
                  <Button variant="primary" size="medium" onClick={() => setIsLogModalOpen(true)}>로그 데이터 분석 모달 열기</Button>
                </div>
              </div>

              <div style={{ marginTop: 'var(--space-24)' }}>
                <h4 style={{ font: 'var(--text-body-bold)', marginBottom: 'var(--space-12)' }}>Cards (Request, Summary, Task Ticket)</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
                    <div style={{ flex: 1 }}>
                      <h5 style={{ font: 'var(--text-caption-bold)', color: 'var(--color-gray-500)', marginBottom: 'var(--space-8)' }}>Request Card</h5>
                      <ComponentLabel path="components/ui/Card/RequestCard.tsx" />
                      <div style={{ width: '100%' }}>
                        <RequestCard roomNumber={1502} createdAt={new Date(Date.now() - 34 * 60 * 1000).toISOString()} title="비건 메뉴 중에 견과류가 아예 안 들어간 메뉴가 있나요?" onSecondaryAction={() => alert('무시하기')} />
                      </div>
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <h5 style={{ font: 'var(--text-caption-bold)', color: 'var(--color-gray-500)', marginBottom: 'var(--space-8)' }}>Summary Card</h5>
                      <ComponentLabel path="components/ui/Card/SummaryCard.tsx" />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-12)' }}>
                        <SummaryCard title="오늘 총 요청" value="7" changeValue="+12%" changeType="positive" />
                        <SummaryCard title="평균 응답 시간" value="1.5m" changeValue="-0.2m" changeType="neutral" />
                        <SummaryCard title="해결률" value="94%" changeValue="+2%" changeType="positive" />
                        <SummaryCard title="고객 만족도" value="4.8" changeValue="+0.1" changeType="positive" />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                    <h5 style={{ font: 'var(--text-caption-bold)', color: 'var(--color-gray-500)', marginBottom: 'var(--space-8)' }}>Chart Card (대시보드 그래프용)</h5>
                    <ComponentLabel path="components/ui/Card/ChartCard.tsx" />
                    <div style={{ display: 'flex', gap: 'var(--space-24)', width: '100%' }}>
                      <ChartCard title="부서별 평균 처리 시간" subtitle="AVERAGE RESOLUTION TIME (MINUTES)">
                        <div style={{ height: '200px', width: '100%', backgroundColor: 'var(--color-gray-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)' }}>
                          Graph Placeholder
                        </div>
                      </ChartCard>
                    </div>
                  </div>

                  <div>
                    <h5 style={{ font: 'var(--text-caption-bold)', color: 'var(--color-gray-500)', marginBottom: 'var(--space-8)' }}>Task Ticket Column</h5>
                    <ComponentLabel path="components/ui/TaskBoard/TaskColumn.tsx & TaskTicket.tsx" />
                    <div style={{ display: 'flex', gap: 'var(--space-24)', overflowX: 'auto', paddingBottom: 'var(--space-8)' }}>
                      <TaskColumn title="진행 전" count={1}><TaskTicket status="TODO" ticketId="1204" priority="URGENT" title="에어컨 수리" description="에어컨 작동 안 됨" createdAt={new Date(Date.now() - 45 * 60 * 1000).toISOString()} /></TaskColumn>
                      <TaskColumn title="진행 중" count={1}><TaskTicket status="IN_PROGRESS" ticketId="1205" priority="NORMAL" title="수건 추가" description="수건 2장 요청" createdAt={new Date(Date.now() - 120 * 60 * 1000).toISOString()} updatedAt={new Date(Date.now() - 15 * 60 * 1000).toISOString()} /></TaskColumn>
                      <TaskColumn title="완료" count={1}><TaskTicket status="DONE" ticketId="302" priority="NORMAL" title="샤워기 헤드 교체" description="수압 약함" createdAt={new Date(Date.now() - 150 * 60 * 1000).toISOString()} /></TaskColumn>
                    </div>
                  </div>


                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Chat History (객실 선택) 섹션 추가 */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)', marginBottom: 'var(--space-32)' }}>
          <h2 style={{ font: 'var(--text-h2-bold)', color: 'var(--color-gray-900)' }}>
            Chat History (객실 선택)
          </h2>
          <div style={{ display: 'flex', gap: 'var(--space-24)', height: '600px' }}>
            <div style={{ width: '280px', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <ComponentLabel path="components/ui/ChatHistory/ChatHistory.tsx" />
              <ChatHistory
                rooms={sampleRooms}
                activeRoomId={activeRoomId}
                onRoomSelect={setActiveRoomId}
              />
            </div>
          </div>
        </section>

        {/* Knowledge Library 섹션 추가 */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)', marginBottom: 'var(--space-32)' }}>
          <h2 style={{ font: 'var(--text-h2-bold)', color: 'var(--color-gray-900)' }}>
            Knowledge Library (지식 라이브러리)
          </h2>
          <div style={{ background: 'var(--color-bg)', padding: '0 var(--space-32)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' }}>
            {sampleKnowledges.map((item, idx) => (
              <div key={idx}>
                <ComponentLabel path="components/ui/Knowledge/KnowledgeItem.tsx" />
                <KnowledgeItem
                  id={item.id}
                  domainCode={item.domainCode}
                  question={item.question}
                  answer={item.answer}
                  updatedAt={item.updatedAt}
                  onClick={() => setSelectedKnowledge(item)}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 'var(--space-8)' }}>
            <Button variant="outlined" onClick={() => setSelectedKnowledge(sampleKnowledges[0])}>
              Knowledge Modal 열기
            </Button>
          </div>
        </section>

        {/* Handover Record 섹션 추가 */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)', marginBottom: 'var(--space-32)' }}>
          <h2 style={{ font: 'var(--text-h2-bold)', color: 'var(--color-gray-900)' }}>
            Handover Record (인수인계 문서)
          </h2>
          <ComponentLabel path="components/ui/HandoverRecord/HandoverRecord.tsx" />
          <HandoverRecord
            managerName="박단희"
            briefing={sampleHandoverBriefing}
            items={sampleHandoverItems}
          />
        </section>

        {/* Skeleton UI Showcase */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)', marginBottom: 'var(--space-32)' }}>
          <h2 style={{ font: 'var(--text-h2-bold)', color: 'var(--color-gray-900)' }}>
            Skeleton UI
          </h2>

          {/* Board Skeleton */}
          <div style={{ background: 'var(--color-bg)', padding: 'var(--space-32)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' }}>
            <h3 style={{ font: 'var(--text-h3-bold)', marginBottom: 'var(--space-4)', color: 'var(--color-gray-700)' }}>Board Skeleton (Staff 칸반보드 로딩)</h3>
            <ComponentLabel path="app/staff/_components/BoardSkeleton/BoardSkeleton.tsx" />
            <p style={{ font: 'var(--text-caption-regular)', color: 'var(--color-gray-500)', marginBottom: 'var(--space-16)' }}>
              Staff 대시보드에서 태스크 데이터를 불러오는 동안 표시되는 Skeleton UI입니다.
            </p>
            <div style={{ padding: 'var(--space-24)', boxSizing: 'border-box', height: '360px', overflow: 'hidden', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-100)' }}>
              <BoardSkeleton />
            </div>
          </div>

        </section>

        {/* 5. ICONS */}
        <section style={{ paddingBottom: 'var(--space-100)' }}>
          <h2 style={{ font: 'var(--text-h2-bold)', marginBottom: 'var(--space-16)', color: 'var(--color-gray-700)' }}>
            5. Imported Icon Components ({Object.keys({ ...Icons }).length} EA)
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: 'var(--space-16)',
            background: 'var(--color-bg)',
            padding: 'var(--space-32)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-md)'
          }}>
            {Object.entries({ ...Icons }).map(([name, IconComponent]: [string, any]) => {
              if (typeof IconComponent !== 'function' && typeof IconComponent !== 'object') return null;
              return (
                <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-12)', padding: 'var(--space-16)', border: `1px solid var(--color-surface)`, borderRadius: 'var(--radius-md)', transition: 'var(--transition)', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'} onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-surface)'}>
                  <IconComponent size={28} color="var(--color-gray-900)" strokeWidth={2} />
                  <span style={{ font: 'var(--text-caption-medium)', color: 'var(--color-gray-500)', textAlign: 'center', wordBreak: 'break-all' }}>
                    {name}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5.1 LUCIDE ICONS */}
        <section style={{ paddingBottom: 'var(--space-100)' }}>
          <h2 style={{ font: 'var(--text-h2-bold)', marginBottom: 'var(--space-16)', color: 'var(--color-gray-700)' }}>
            5.1 Lucide Icons (Sidebar) ({Object.keys(lucideIcons).length} EA)
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: 'var(--space-16)',
            background: 'var(--color-bg)',
            padding: 'var(--space-32)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-md)'
          }}>
            {Object.entries(lucideIcons).map(([name, IconComponent]: [string, any]) => {
              if (typeof IconComponent !== 'function' && typeof IconComponent !== 'object') return null;
              return (
                <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-12)', padding: 'var(--space-16)', border: `1px solid var(--color-surface)`, borderRadius: 'var(--radius-md)', transition: 'var(--transition)', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'} onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-surface)'}>
                  <IconComponent size={28} color="var(--color-gray-900)" strokeWidth={2} />
                  <span style={{ font: 'var(--text-caption-medium)', color: 'var(--color-gray-500)', textAlign: 'center', wordBreak: 'break-all' }}>
                    {name}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* 6. REAL PAGE FOOTER */}


      {(selectedKnowledge || activeModal === 'KnowledgeModal') && !isEditModalOpen && (
        <KnowledgeModal
          isOpen={!!selectedKnowledge || activeModal === 'KnowledgeModal'}
          onClose={() => {
            setSelectedKnowledge(null);
            closeModal();
          }}
          domainCode={selectedKnowledge?.domainCode || 'HK'}
          question={selectedKnowledge?.question || '체크아웃 시간 연장(Late Checkout)'}
          answer={selectedKnowledge?.answer || '오후 2시까지 연장 가능하며, 시간당 2,500엔의 추가 비용이 발생합니다.'}
          updatedAt={selectedKnowledge?.updatedAt || '2026-05-20'}
          onEdit={() => {
            setIsEditModalOpen(true);
            setActiveModal('KnowledgeEditModal');
          }}
        />
      )}

      {((selectedKnowledge && isEditModalOpen) || activeModal === 'KnowledgeEditModal') && (
        <KnowledgeEditModal
          isOpen={isEditModalOpen || activeModal === 'KnowledgeEditModal'}
          onClose={() => {
            setIsEditModalOpen(false);
            closeModal();
            if (selectedKnowledge?.isNew) {
              setSelectedKnowledge(null);
            }
          }}
          initialDomainCode={selectedKnowledge?.domainCode || 'HK'}
          initialQuestion={selectedKnowledge?.question || '체크아웃 시간 연장(Late Checkout)'}
          initialAnswer={selectedKnowledge?.answer || '오후 2시까지 연장 가능하며, 시간당 2,500엔의 추가 비용이 발생합니다.'}
          onSave={(data) => {
            setIsEditModalOpen(false);
            closeModal();
            setSelectedKnowledge(null);
          }}
        />
      )}


      {/* Log Data Modal */}
      <LogDataModal
        isOpen={isLogModalOpen || activeModal === 'LogDataModal'}
        onClose={() => {
          setIsLogModalOpen(false);
          closeModal();
        }}
      />

      {/* CreateRequestModal */}
      <CreateRequestModal
        isOpen={activeModal === 'CreateRequestModal'}
        onClose={closeModal}
        onSuccess={() => {
          closeModal();
          showToast('요청이 생성되었습니다.', 'success');
        }}
      />

      {/* ApproveEscalationModal */}
      <ApproveEscalationModal
        isOpen={activeModal === 'ApproveEscalationModal'}
        onClose={closeModal}
        requestId={1001}
        onSuccess={() => {
          closeModal();
          showToast('에스컬레이션이 승인되었습니다.', 'success');
        }}
      />

      {/* RejectEscalationModal */}
      <RejectEscalationModal
        isOpen={activeModal === 'RejectEscalationModal'}
        onClose={closeModal}
        requestId={1001}
        onSuccess={() => {
          closeModal();
          showToast('에스컬레이션이 반려되었습니다.', 'success');
        }}
      />

      {/* ApproveCancellationModal */}
      <ApproveCancellationModal
        isOpen={activeModal === 'ApproveCancellationModal'}
        onClose={closeModal}
        requestId={1001}
        onSuccess={() => {
          closeModal();
          showToast('취소가 승인되었습니다.', 'success');
        }}
      />

      {/* RejectCancellationModal */}
      <RejectCancellationModal
        isOpen={activeModal === 'RejectCancellationModal'}
        onClose={closeModal}
        requestId={1001}
        onSuccess={() => {
          closeModal();
          showToast('취소가 반려되었습니다.', 'success');
        }}
      />

      {/* RegisterTrainingModal */}
      <RegisterTrainingModal
        isOpen={activeModal === 'RegisterTrainingModal'}
        onClose={closeModal}
        departmentId="HK"
        summary="수건 추가 요청"
        roomNo="707"
        requestId={1001}
      />

      {/* AssignModal */}
      <AssignModal
        isOpen={activeModal === 'AssignModal'}
        onClose={closeModal}
        requestId={1001}
        requestSummary="수건 2장 추가 요청"
        roomNo="707"
        onSuccess={() => {
          closeModal();
          showToast('수동 배정이 완료되었습니다.', 'success');
        }}
      />

      {/* ManualAssignModal */}
      <ManualAssignModal
        isOpen={activeModal === 'ManualAssignModal'}
        onClose={closeModal}
        detail={{
          id: 1001,
          priority: 'NORMAL',
          departmentId: 'HK',
          departmentName: '하우스키핑',
          roomNo: '707',
          summary: '수건 2장 추가 요청',
          createdAt: new Date().toISOString(),
          status: 'PENDING'
        }}
        departments={[
          { id: 'HK', name: '하우스키핑' },
          { id: 'FACILITY', name: '시설관리' },
          { id: 'FB', name: '식음료' },
          { id: 'CONCIERGE', name: '컨시어지' }
        ]}
        onSave={async (editDeptId, editPriority, editSummary, editDescription) => {
          closeModal();
          showToast(`부서 ${editDeptId}로 이관/배정되었습니다.`, 'success');
        }}
        saving={false}
      />

      {/* RequestDetailModal */}
      <RequestDetailModal
        isOpen={activeModal === 'RequestDetailModal'}
        onClose={closeModal}
        requestId={1001}
        onUpdate={() => {
          closeModal();
          showToast('요청 상세 정보가 업데이트되었습니다.', 'success');
        }}
      />

      {/* StaffFormModal */}
      <StaffFormModal
        isOpen={activeModal === 'StaffFormModal'}
        onClose={closeModal}
        onSave={async (data) => {
          closeModal();
          showToast(`직원 ${data.name} 저장되었습니다.`, 'success');
        }}
        roles={[
          { id: 1, name: '시니어 크루', departmentId: 'HK' },
          { id: 2, name: '주니어 크루', departmentId: 'HK' }
        ]}
        departments={[
          { id: 'HK', name: '하우스키핑' },
          { id: 'FACILITY', name: '시설관리' }
        ]}
      />

      {/* RoleFormModal */}
      <RoleFormModal
        isOpen={activeModal === 'RoleFormModal'}
        onClose={closeModal}
        onSave={async (data) => {
          closeModal();
          showToast(`역할 ${data.name} 저장되었습니다.`, 'success');
        }}
        departments={[
          { id: 'HK', name: '하우스키핑' },
          { id: 'FACILITY', name: '시설관리' }
        ]}
      />

      {/* TaskDetailModal */}
      <TaskDetailModal
        isOpen={activeModal === 'TaskDetailModal'}
        onClose={closeModal}
        task={{
          id: 1001,
          roomNumber: '707',
          priority: 'URGENT',
          summary: '수건 2장 추가 및 화장실 전구 교체 요청',
          status: 'PENDING',
          departmentId: 'HK',
          createdAt: new Date().toISOString(),
          version: 1,
          cancelRequested: false,
          entities: { item: '수건', count: 2 },
          reasoning: '고객이 수건 추가 및 긴급한 상황을 명시함',
          rawText: '수건 2장 가져다주세요. 화장실 전구도 나갔어요.',
          assignedStaffName: null,
          assignedStaffId: null,
          confidence: 1.0,
          cancelRequestedAt: null
        }}
        onAccept={async (id, version) => {
          closeModal();
          showToast('업무를 수락했습니다.', 'success');
        }}
        onComplete={async (id, version) => {
          closeModal();
          showToast('업무를 완료했습니다.', 'success');
        }}
        onTransfer={async (id, version, toDept, reason) => {
          closeModal();
          showToast(`업무를 ${toDept} 부서로 이관했습니다. 사유: ${reason}`, 'success');
        }}
      />

      {/* ChatHistoryModal */}
      <ChatHistoryModal
        isOpen={activeModal === 'ChatHistoryModal'}
        onClose={closeModal}
        roomNumber="707"
      />
    </div>
  );
}
