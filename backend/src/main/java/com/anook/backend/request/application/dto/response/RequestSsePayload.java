package com.anook.backend.request.application.dto.response;

import java.util.Map;

/**
 * WebSocket으로 전송될 알림 페이로드
 *
 * 필드 'type'은 Message 도메인의 WebSocket 페이로드와 동일한 이름으로 통일.
 * 프론트엔드에서 같은 채널(/topic/room/{roomNo})로 들어오는
 * AI 응답(type=AI_RESPONSE)과 요청 이벤트(type=NEW_REQUEST)를 구분할 수 있다.
 *
 * [AN-252] entities, graceRemaining, priority 추가
 * - entities: AI가 추출한 구조화 데이터 (Generative UI 위젯 카드 렌더링용)
 * - graceRemaining: Grace Period 남은 초 (0이면 즉시 전달, 프론트 카운트다운용)
 * - priority: 요청 우선순위 (URGENT이면 Grace Period 스킵)
 */
public record RequestSsePayload(
                String type, // "NEW_REQUEST", "STATUS_CHANGED", "GRACE_EXPIRED"
                Long requestId, // 요청 ID
                String status, // 상태 (PENDING, IN_PROGRESS, COMPLETED 등)
                String domainCode, // 부서 코드 (HK, FB 등)
                String summary, // 요약
                String roomNo, // 객실 번호
                Map<String, Object> entities, // AI 추출 데이터 ({item: "수건", count: 2})
                int graceRemaining, // Grace Period 남은 초 (URGENT=0)
                String priority, // "NORMAL" | "URGENT"
                String initiatedBy, // 취소/변경 주체 (GUEST, STAFF 등)
        String cancelReason // 취소 사유 (REPLACED 등)
) {
        /**
         * 신규 요청용 정적 팩토리 (Grace Period 포함)
         */
        public static RequestSsePayload newRequest(Long id, String status, String domainCode,
                        String summary, String roomNo,
                        Map<String, Object> entities,
                        int graceRemaining, String priority) {
                return new RequestSsePayload("NEW_REQUEST", id, status, domainCode, summary, roomNo,
                                entities, graceRemaining, priority, null, null);
        }

        /**
         * 상태 변경용 정적 팩토리
         */
        public static RequestSsePayload statusChanged(Long id, String status, String domainCode,
                        String summary, String roomNo) {
                return statusChanged(id, status, domainCode, summary, roomNo, null, null);
        }

        /**
         * 상태 변경용 정적 팩토리 (취소 주체 포함)
         */
        public static RequestSsePayload statusChanged(Long id, String status, String domainCode,
                        String summary, String roomNo, String initiatedBy) {
                return statusChanged(id, status, domainCode, summary, roomNo, initiatedBy, null);
        }

        /**
         * 상태 변경용 정적 팩토리 (취소 사유 포함)
         */
        public static RequestSsePayload statusChanged(Long id, String status, String domainCode,
                        String summary, String roomNo, String initiatedBy, String cancelReason) {
                return new RequestSsePayload("STATUS_CHANGED", id, status, domainCode, summary, roomNo,
                                null, 0, null, initiatedBy, cancelReason);
        }

        /**
         * Grace Period 만료 알림용 정적 팩토리
         */
        public static RequestSsePayload graceExpired(Long id, String roomNo) {
                return new RequestSsePayload("GRACE_EXPIRED", id, null, null, null, roomNo,
                                null, 0, null, null, null);
        }

        public static RequestSsePayload cancelRequestReceived(Long id, String domainCode, String summary,
                        String roomNo) {
                return new RequestSsePayload("CANCEL_REQUEST_RECEIVED", id, "IN_PROGRESS", domainCode, summary,
                                roomNo, null, 0, "NORMAL", null, null);
        }

        public static RequestSsePayload cancelApproved(Long id, String domainCode, String summary,
                        String roomNo) {
                return cancelApproved(id, domainCode, summary, roomNo, null);
        }

        public static RequestSsePayload cancelApproved(Long id, String domainCode, String summary,
                        String roomNo, String initiatedBy) {
                return new RequestSsePayload("CANCEL_APPROVED", id, "CANCELLED", domainCode, summary, roomNo,
                                null, 0, "NORMAL", initiatedBy, null);
        }

        public static RequestSsePayload cancelRejected(Long id, String domainCode, String summary,
                        String roomNo) {
                return cancelRejected(id, domainCode, summary, roomNo, null);
        }

        public static RequestSsePayload cancelRejected(Long id, String domainCode, String summary,
                        String roomNo, String initiatedBy) {
                return new RequestSsePayload("CANCEL_REJECTED", id, "IN_PROGRESS", domainCode, summary, roomNo,
                                null, 0, "NORMAL", initiatedBy, null);
        }
}
