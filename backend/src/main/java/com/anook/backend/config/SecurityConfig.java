package com.anook.backend.config;

import com.anook.backend.security.JwtAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.access.hierarchicalroles.RoleHierarchyImpl;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public RoleHierarchy roleHierarchy() {
        RoleHierarchyImpl roleHierarchy = new RoleHierarchyImpl();
        roleHierarchy.setHierarchy("ROLE_FRONTDESK > ROLE_STAFF");
        return roleHierarchy;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                // JWT를 사용하므로 스프링 시큐리티의 세션(메모리) 기능을 완전히 끕니다.
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // 각 API 주소별로 필요한 권한을 설정합니다.
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/auth/**").permitAll() // 로그인 API는 누구나 접근 가능
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/chat/*/progress").permitAll() // AI
                                                                                                                   // 서버
                                                                                                                   // 진입점
                        .requestMatchers("/frontdesk/**").hasRole("FRONTDESK") // 프론트 데스크 API는 FRONTDESK 권한 필요
                        .requestMatchers("/staff/**").hasRole("STAFF") // 직원 API는 STAFF 권한 필요
                        .requestMatchers("/chat/**").hasRole("GUEST") // 채팅 API는 GUEST 권한 필요
                        .anyRequest().permitAll() // 임시로 나머지 요청은 모두 허용 (이후 점진적 통제)
                )
                // 기본 로그인 필터가 작동하기 전에, 우리가 만든 JwtAuthFilter(쿠키 검사기)를 먼저 실행하게 합니다.
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
