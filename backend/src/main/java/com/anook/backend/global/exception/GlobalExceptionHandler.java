package com.anook.backend.global.exception;

import com.anook.backend.global.dto.ErrorResponse;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 전역 예외 핸들러 — BusinessException 하나만 잡아서 처리
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

        @ExceptionHandler(BusinessException.class)
        public ResponseEntity<ErrorResponse> handleBusiness(BusinessException e) {
                ErrorCode code = e.getErrorCode();
                return ResponseEntity.status(code.getStatus())
                                .body(ErrorResponse.of(
                                                code.name(),
                                                e.getMessage(),
                                                code.getDetail()));
        }

        @ExceptionHandler(DataIntegrityViolationException.class)
        public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException e) {
                ErrorCode code = ErrorCode.DUPLICATE_KNOWLEDGE;
                return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(ErrorResponse.of(
                                                code.name(),
                                                code.getMessage(),
                                                code.getDetail()));
        }

        @ExceptionHandler(org.springframework.dao.OptimisticLockingFailureException.class)
        public ResponseEntity<String> handleOptimisticLocking(org.springframework.dao.OptimisticLockingFailureException e) {
                return ResponseEntity.status(org.springframework.http.HttpStatus.CONFLICT).body(e.getMessage());
        }

        @ExceptionHandler(IllegalArgumentException.class)
        public ResponseEntity<String> handleIllegalArgument(IllegalArgumentException e) {
                return ResponseEntity.status(org.springframework.http.HttpStatus.BAD_REQUEST).body(e.getMessage());
        }

        @ExceptionHandler(NoResourceFoundException.class)
        public ResponseEntity<String> handleNoResourceFound(NoResourceFoundException e) {
                // 과거 WebSocket 클라이언트의 자동 재연결 등 단순 404 요청이 스택트레이스를 도배하는 것을 방지합니다.
                return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND).body("Not Found");
        }

        @ExceptionHandler(Exception.class)
        public ResponseEntity<String> handleException(Exception e) {
                e.printStackTrace();
                return ResponseEntity.status(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage() != null ? e.getMessage() : e.toString());
        }
}
