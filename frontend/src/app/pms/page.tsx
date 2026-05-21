'use client';

import React, { useEffect, useState } from 'react';
import styles from './page.module.css';
import useGuests, { Guest } from './useGuests';
import useRooms from './useRooms';
import useReceipts from './useReceipts';
import { QRCodeCanvas } from 'qrcode.react';

/* ── 날짜 포맷 ── */
function formatDateTime(dateStr: string) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

/* ── 타입 라벨 ── */
const TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  STANDARD: { label: '스탠다드', emoji: '🛏️' },
  SUPERIOR: { label: '슈페리어', emoji: '⭐' },
  DELUXE: { label: '디럭스', emoji: '💎' },
  FAMILY: { label: '패밀리', emoji: '👨‍👩‍👧‍👦' },
  SUITE: { label: '스위트', emoji: '🏆' },
  PRESIDENTIAL: { label: '프레지덴셜', emoji: '👑' },
};

/* ══════════════════════════════════════════════════════════
   PMS  –  Virtual Hotel Management Console
   ══════════════════════════════════════════════════════════ */
export default function PmsPage() {
  const { guests, loading, error, fetchGuests, checkIn, checkOut } = useGuests();
  const { rooms, loading: roomsLoading, fetchRooms } = useRooms();
  const { receipts, loading: receiptsLoading, fetchUnpaidReceipts, payAll } = useReceipts();

  // ── 탭 상태 ──
  const [activeTab, setActiveTab] = useState<'guests' | 'rooms'>('guests');

  // ── 모달 상태 ──
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkOutTarget, setCheckOutTarget] = useState<{
    id: number; roomNumber: string; name: string;
  } | null>(null);
  const [showUnpaid, setShowUnpaid] = useState(false);
  const [payingAll, setPayingAll] = useState(false);
  const [selectedGuestForQR, setSelectedGuestForQR] = useState<Guest | null>(null);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  // ── 폼 상태 ──
  const [roomNumber, setRoomNumber] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [checkoutDate, setCheckoutDate] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // ── 객실 필터 ──
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  useEffect(() => { fetchGuests(); fetchRooms(); }, [fetchGuests, fetchRooms]);

  // ── 체크인 ──
  const handleCheckIn = async () => {
    const errs: Record<string, string> = {};
    if (!roomNumber) errs.roomNumber = '필수';
    if (!name.trim()) errs.name = '필수';
    if (!checkoutDate) errs.checkoutDate = '필수';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      await checkIn({
        roomNumber,
        name: name.trim(),
        phone: phone.trim(),
        checkoutDate,
      });
      resetForm();
      setShowCheckIn(false);
      fetchRooms(); // 객실 상태 갱신
    } catch { /* useGuests handles error */ }
    finally { setSubmitting(false); }
  };

  const resetForm = () => {
    setRoomNumber(''); setName(''); setPhone('');
    setCheckoutDate(''); setFormErrors({});
  };

  // ── 체크아웃 버튼 클릭 → 미결제 확인 ──
  const handleCheckOutClick = async (guest: { id: number; roomNumber: string; name: string }) => {
    setCheckOutTarget(guest);
    const unpaid = await fetchUnpaidReceipts(guest.roomNumber);
    if (unpaid.length > 0) {
      setShowUnpaid(true);
    } else {
      setShowUnpaid(false);
    }
  };

  // ── 체크아웃 실행 ──
  const handleCheckOut = async () => {
    if (!checkOutTarget) return;
    try {
      await checkOut(checkOutTarget.id);
      fetchRooms();
    }
    catch { /* useGuests handles error */ }
    finally { setCheckOutTarget(null); setShowUnpaid(false); }
  };

  // ── 일괄 결제 후 체크아웃 ──
  const handlePayAllAndCheckOut = async () => {
    if (!checkOutTarget) return;
    setPayingAll(true);
    try {
      await payAll(checkOutTarget.roomNumber);
      await checkOut(checkOutTarget.id);
      fetchRooms();
    } catch { /* error handled */ }
    finally {
      setPayingAll(false);
      setCheckOutTarget(null);
      setShowUnpaid(false);
    }
  };

  // ── 빈 객실 목록 (체크인 드롭다운용) ──
  const availableRooms = rooms.filter(r => !r.occupied);

  // ── 객실 필터링 ──
  const filteredRooms = typeFilter === 'ALL'
    ? rooms
    : rooms.filter(r => r.type === typeFilter);

  // ── 층별 그룹핑 ──
  const floors = Array.from(new Set(filteredRooms.map(r => r.number.charAt(0))))
    .sort()
    .map(floor => ({
      floor,
      rooms: filteredRooms.filter(r => r.number.charAt(0) === floor),
    }));

  // ── 타입별 카운트 ──
  const typeList = Array.from(new Set(rooms.map(r => r.type)));

  // ── 요금 계산 (미결제 영수증) ──
  const receiptSubtotal = receipts.reduce((sum, r) => sum + r.totalPrice, 0);
  const receiptVat = Math.round(receiptSubtotal * 0.1);
  const receiptServiceCharge = Math.round(receiptSubtotal * 0.1);
  const receiptTotal = receiptSubtotal + receiptVat + receiptServiceCharge;

  /* ═══════ RENDER ═══════ */
  return (
    <div className={styles.pmsRoot}>
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <div className={styles.brandMark}>
          <div className={styles.brandIcon}>A</div>
          <span className={styles.brandName}>ANEUK PMS</span>
          <span className={styles.brandTag}>VIRTUAL</span>
        </div>
        <div className={styles.topBarRight}>
          <div className={styles.statusDot} />
          <span className={styles.statusText}>System Online</span>
        </div>
      </div>

      {/* ── Main ── */}
      <div className={styles.mainContainer}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <div className={styles.titleGroup}>
            <h1 className={styles.pageTitle}>호텔 관리 시스템</h1>
            <p className={styles.pageSubtitle}>
              개발 및 테스트를 위한 가상 PMS — 투숙객 및 객실 관리
            </p>
          </div>
          <button className={styles.checkInBtn} onClick={() => setShowCheckIn(true)}>
            <span style={{ fontSize: 18 }}>+</span> 손님 추가 (체크인)
          </button>
        </div>

        {/* Stats */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconGreen}`}>🏠</div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>전체 객실</span>
              <span className={styles.statValue}>{rooms.length}</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconBlue}`}>🛏️</div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>투숙 중</span>
              <span className={styles.statValue}>{rooms.filter(r => r.occupied).length}</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconPurple}`}>🔓</div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>빈 객실</span>
              <span className={styles.statValue}>{rooms.filter(r => !r.occupied).length}</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconGreen}`}>📋</div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>오늘 체크아웃</span>
              <span className={styles.statValue}>
                {guests.filter(g => {
                  const d = new Date(g.checkoutDate);
                  const today = new Date();
                  return d.toDateString() === today.toDateString();
                }).length}
              </span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className={styles.errorBanner}>⚠️ {error}</div>
        )}

        {/* Tabs */}
        <div className={styles.tabRow}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'guests' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('guests')}
          >
            👤 투숙객 관리
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'rooms' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('rooms')}
          >
            🏨 객실 현황
          </button>
        </div>

        {/* ═══ Tab: 투숙객 관리 ═══ */}
        {activeTab === 'guests' && (
          <div className={styles.tableCard}>
            <div className={styles.tableTitle}>📋 투숙객 목록</div>

            <div className={styles.tableHeader}>
              <span>객실 번호</span>
              <span>이름</span>
              <span>체크인</span>
              <span>체크아웃 예정</span>
              <span>상태</span>
              <span style={{ textAlign: 'right' }}>체크아웃</span>
            </div>

            {loading ? (
              <>
                {[1, 2, 3].map(i => (
                  <div key={i} className={styles.skeletonRow}>
                    {[1, 2, 3, 4, 5, 6].map(j => (
                      <div key={j} className={styles.skeletonBlock} />
                    ))}
                  </div>
                ))}
              </>
            ) : guests.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🏨</div>
                현재 투숙 중인 손님이 없습니다.<br />
                <span style={{ fontSize: 12, color: '#475569' }}>
                  &quot;+ 손님 추가&quot; 버튼으로 체크인해보세요.
                </span>
              </div>
            ) : (
              guests.map((guest, idx) => (
                <div
                  key={guest.id}
                  className={styles.tableRow}
                  style={{ animationDelay: `${idx * 0.08}s` }}
                >
                  <div>
                    <span className={styles.roomBadge}>{guest.roomNumber}</span>
                  </div>
                  <div className={styles.guestName}>{guest.name}</div>
                  <div className={styles.dateText}>{formatDateTime(guest.checkinDate)}</div>
                  <div className={styles.dateText}>{formatDate(guest.checkoutDate)}</div>
                  <div>
                    <span className={styles.statusBadge}>
                      <span className={styles.statusDotInline} />
                      투숙 중
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className={styles.actionBtn}
                      style={{ marginRight: 8 }}
                      title="QR 코드 보기"
                      onClick={() => setSelectedGuestForQR(guest)}
                    >
                      📱
                    </button>
                    <button
                      className={styles.actionBtn}
                      title="체크아웃 (Hard Delete)"
                      onClick={() => handleCheckOutClick({
                        id: guest.id,
                        roomNumber: guest.roomNumber,
                        name: guest.name,
                      })}
                    >
                      🚪
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══ Tab: 객실 현황 ═══ */}
        {activeTab === 'rooms' && (
          <div className={styles.tableCard}>
            <div className={styles.tableTitle}>
              🏨 객실 현황
            </div>

            {/* 타입 필터 */}
            <div className={styles.filterRow}>
              <button
                className={`${styles.filterBtn} ${typeFilter === 'ALL' ? styles.filterBtnActive : ''}`}
                onClick={() => setTypeFilter('ALL')}
              >
                전체 ({rooms.length})
              </button>
              {typeList.map(type => {
                const info = TYPE_LABELS[type] || { label: type, emoji: '🏠' };
                const count = rooms.filter(r => r.type === type).length;
                return (
                  <button
                    key={type}
                    className={`${styles.filterBtn} ${typeFilter === type ? styles.filterBtnActive : ''}`}
                    onClick={() => setTypeFilter(type)}
                  >
                    {info.emoji} {info.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* 층별 객실 카드 */}
            {roomsLoading ? (
              <div className={styles.emptyState}>로딩 중...</div>
            ) : (
              floors.map(({ floor, rooms: floorRooms }) => (
                <div key={floor} className={styles.floorSection}>
                  <div className={styles.floorLabel}>{floor}층</div>
                  <div className={styles.roomGrid}>
                    {floorRooms.map(room => {
                      const info = TYPE_LABELS[room.type] || { label: room.type, emoji: '🏠' };
                      return (
                        <div
                          key={room.number}
                          className={`${styles.roomCard} ${room.occupied ? styles.roomCardOccupied : styles.roomCardVacant}`}
                        >
                          <div className={styles.roomCardNumber}>{room.number}</div>
                          <div className={styles.roomCardType}>
                            {info.emoji} {info.label}
                          </div>
                          <div className={styles.roomCardStatus}>
                            {room.occupied ? (
                              <span className={styles.occupiedBadge}>
                                👤 {room.guestName}
                              </span>
                            ) : (
                              <span className={styles.vacantBadge}>빈 객실</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ══ Check-In Modal ══ */}
      {showCheckIn && (
        <div className={styles.overlay} onClick={() => { setShowCheckIn(false); resetForm(); }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>🔑 손님 추가 (체크인)</h2>
              <button className={styles.modalClose} onClick={() => { setShowCheckIn(false); resetForm(); }}>✕</button>
            </div>

            <div className={styles.formGroup}>
              <div>
                <label className={styles.fieldLabel}>객실 선택</label>
                <select
                  className={styles.fieldSelect}
                  value={roomNumber}
                  onChange={e => setRoomNumber(e.target.value)}
                >
                  <option value="">-- 빈 객실을 선택하세요 --</option>
                  {availableRooms.map(room => {
                    const info = TYPE_LABELS[room.type] || { label: room.type, emoji: '🏠' };
                    return (
                      <option key={room.number} value={room.number}>
                        {room.number}호 ({info.label})
                      </option>
                    );
                  })}
                </select>
                {formErrors.roomNumber && <div className={styles.fieldError}>{formErrors.roomNumber}</div>}
              </div>

              <div>
                <label className={styles.fieldLabel}>투숙객 이름</label>
                <input
                  className={styles.fieldInput}
                  placeholder="예: 홍길동"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
                {formErrors.name && <div className={styles.fieldError}>{formErrors.name}</div>}
              </div>

              <div>
                <label className={styles.fieldLabel}>연락처</label>
                <input
                  className={styles.fieldInput}
                  placeholder="예: 010-1234-5678"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>

              <div>
                <label className={styles.fieldLabel}>체크아웃 예정일</label>
                <input
                  className={styles.fieldInput}
                  type="date"
                  value={checkoutDate}
                  onChange={e => setCheckoutDate(e.target.value)}
                />
                {formErrors.checkoutDate && <div className={styles.fieldError}>{formErrors.checkoutDate}</div>}
              </div>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.btnCancel} onClick={() => { setShowCheckIn(false); resetForm(); }}>
                취소
              </button>
              <button className={styles.btnSubmit} onClick={handleCheckIn} disabled={submitting}>
                {submitting ? '처리 중...' : '체크인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Check-Out Confirm Modal (미결제 없을 때) ══ */}
      {checkOutTarget && !showUnpaid && (
        <div className={styles.overlay} onClick={() => setCheckOutTarget(null)}>
          <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmIcon}>🚪</div>
            <h3 className={styles.confirmTitle}>
              {checkOutTarget.roomNumber}호 {checkOutTarget.name} 체크아웃
            </h3>
            <p className={styles.confirmSubtitle} style={{ color: '#6ee7b7', marginBottom: 8 }}>
              ✅ 미결제 내역이 없습니다.
            </p>
            <p className={styles.confirmSubtitle}>
              체크아웃 시 데이터가 완전 삭제(Hard Delete)되며<br />복구할 수 없습니다.
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.btnCancel} onClick={() => setCheckOutTarget(null)}>취소</button>
              <button className={styles.btnDanger} onClick={handleCheckOut}>체크아웃</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 미결제 영수증 모달 ══ */}
      {checkOutTarget && showUnpaid && (
        <div className={styles.overlay} onClick={() => { setShowUnpaid(false); setCheckOutTarget(null); }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>🧾 미결제 룸서비스 내역</h2>
              <button className={styles.modalClose} onClick={() => { setShowUnpaid(false); setCheckOutTarget(null); }}>✕</button>
            </div>

            <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 16 }}>
              {checkOutTarget.roomNumber}호 {checkOutTarget.name}님의 미결제 내역이 있습니다.
              결제 후 체크아웃이 가능합니다.
            </p>

            {receiptsLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>로딩 중...</div>
            ) : (
              <>
                <div className={styles.tableHeader} style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                  <span>메뉴명</span>
                  <span style={{ textAlign: 'center' }}>수량</span>
                  <span style={{ textAlign: 'right' }}>금액</span>
                </div>
                {receipts.map(r => (
                  <div key={r.id} className={styles.tableRow} style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                    <div>{r.menuName}</div>
                    <div style={{ textAlign: 'center' }}>x{r.quantity}</div>
                    <div style={{ textAlign: 'right' }}>{r.totalPrice.toLocaleString()}원</div>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #334155', marginTop: 8, paddingTop: 16, paddingBottom: 20, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#94a3b8' }}>
                    <span>소계</span>
                    <span>{receiptSubtotal.toLocaleString()}원</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#94a3b8' }}>
                    <span>부가세 (10%)</span>
                    <span>{receiptVat.toLocaleString()}원</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#94a3b8' }}>
                    <span>봉사료 (10%)</span>
                    <span>{receiptServiceCharge.toLocaleString()}원</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 18, color: '#fff', marginTop: 8, paddingTop: 12, borderTop: '1px dashed #475569' }}>
                    <span>최종 합계</span>
                    <span>{receiptTotal.toLocaleString()}원</span>
                  </div>
                </div>
              </>
            )}

            <div className={styles.modalActions}>
              <button className={styles.btnCancel} onClick={() => { setShowUnpaid(false); setCheckOutTarget(null); }}>취소</button>
              <button className={styles.btnSubmit} onClick={handlePayAllAndCheckOut} disabled={payingAll}>
                {payingAll ? '처리 중...' : '💳 일괄 결제 후 체크아웃'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ══ QR Modal ══ */}
      {selectedGuestForQR && (
        <div className={styles.overlay} onClick={() => setSelectedGuestForQR(null)}>
          <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div className={styles.qrTitleGroup}>
              <h3 className={styles.confirmTitle}>
                {selectedGuestForQR.roomNumber}호 {selectedGuestForQR.name}님
              </h3>
              <p className={styles.confirmSubtitle}>AI 서비스 접속 QR 코드</p>
            </div>
            
            <div className={styles.qrWrapper}>
              <QRCodeCanvas 
                value={`${baseUrl}/chat?code=${selectedGuestForQR.accessCode}`}
                size={200}
                level="H"
                includeMargin={true}
                imageSettings={{
                  src: "/favicon.ico",
                  x: undefined,
                  y: undefined,
                  height: 40,
                  width: 40,
                  excavate: true,
                }}
              />
            </div>

            <p className={styles.qrUrlText}>
              {baseUrl}/chat?code={selectedGuestForQR.accessCode}
            </p>

            <div className={styles.confirmActions}>
              <button className={styles.btnSubmit} onClick={() => setSelectedGuestForQR(null)}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
