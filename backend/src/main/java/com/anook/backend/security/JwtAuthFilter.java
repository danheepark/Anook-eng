package com.anook.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
@lombok.extern.slf4j.Slf4j
// 클라이언트의 모든 API 요청을 중간에 가로채서 쿠키 안의 토큰을 검사하는 문지기 필터
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtProvider jwtProvider;
    private final com.anook.backend.staff.application.port.out.StaffRepositoryPort staffRepositoryPort;
    private final com.anook.backend.guest.application.port.out.GuestRepositoryPort guestRepositoryPort;

    public JwtAuthFilter(JwtProvider jwtProvider,
                         com.anook.backend.staff.application.port.out.StaffRepositoryPort staffRepositoryPort,
                         com.anook.backend.guest.application.port.out.GuestRepositoryPort guestRepositoryPort) {
        this.jwtProvider = jwtProvider;
        this.staffRepositoryPort = staffRepositoryPort;
        this.guestRepositoryPort = guestRepositoryPort;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String token = extractTokenFromHeader(request);

        if (token != null && jwtProvider.validateToken(token)) {
            var claims = jwtProvider.getClaims(token);
            String identifier = claims.getSubject();
            String role = claims.get("role", String.class);
            String jti = claims.getId();

            boolean isAuthorized = true;

            if ("GUEST".equals(role)) {
                // 체크아웃(Hard Delete) 시 DB에서 삭제되므로, 존재 여부만으로 세션 유효성 판단
                try {
                    Long guestId = Long.parseLong(identifier);
                    if (guestRepositoryPort.findById(guestId).isEmpty()) {
                        log.info("체크아웃된 게스트 토큰 차단: guestId={}", identifier);
                        isAuthorized = false;
                    }
                } catch (Exception e) {
                    log.error("Guest 검증 중 오류 발생: {}", e.getMessage());
                    isAuthorized = false;
                }
            } else if ("STAFF".equals(role) || "FRONTDESK".equals(role)) {
                try {
                    Long staffId = Long.parseLong(identifier);
                    var staffOpt = staffRepositoryPort.findById(staffId);
                    
                    if (staffOpt.isPresent()) {
                        String dbJti = staffOpt.get().getJti();
                        // JTI 비교
                        if (jti == null || !jti.equals(dbJti)) {
                            log.warn("중복 로그인 감지: Staff={}, TokenJTI={}, DBJTI={}", identifier, jti, dbJti);
                            sendErrorResponse(response, com.anook.backend.global.exception.ErrorCode.DUPLICATE_LOGIN);
                            return; // 필터 체인 중단
                        }
                    } else {
                        isAuthorized = false;
                    }
                } catch (Exception e) {
                    log.error("JTI 검증 중 오류 발생: {}", e.getMessage());
                    isAuthorized = false;
                }
            }

            if (isAuthorized) {
                var authority = new SimpleGrantedAuthority("ROLE_" + role);
                var authentication = new UsernamePasswordAuthenticationToken(
                        identifier, null, Collections.singletonList(authority));
                
                // 클레임 정보를 details에 저장하여 컨트롤러에서 접근 가능하게 함
                authentication.setDetails(claims);
                
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }

        filterChain.doFilter(request, response);
    }

    private void sendErrorResponse(HttpServletResponse response, com.anook.backend.global.exception.ErrorCode errorCode) throws IOException {
        response.setStatus(errorCode.getStatus().value());
        response.setContentType("application/json;charset=UTF-8");

        com.anook.backend.global.dto.ErrorResponse errorResponse = com.anook.backend.global.dto.ErrorResponse.of(
                errorCode.name(),
                errorCode.getMessage(),
                errorCode.getDetail()
        );

        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper()
                .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
        
        String json = mapper.writeValueAsString(errorResponse);
        response.getWriter().write(json);
    }

    private String extractTokenFromHeader(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
