package com.anook.backend.frontdesk.department.adapter.in.web;

import com.anook.backend.frontdesk.department.application.dto.response.DepartmentInfo;
import com.anook.backend.frontdesk.department.application.port.in.ListDepartmentsUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 부서 목록 조회 Controller — 읽기 전용
 *
 * 부서는 고정 시드 데이터이므로 조회만 지원합니다.
 */
@RestController
@RequestMapping("/frontdesk/departments")
@RequiredArgsConstructor
public class FrontdeskDepartmentController {

    private final ListDepartmentsUseCase listDepartmentsUseCase;

    @GetMapping
    public ResponseEntity<List<DepartmentInfo>> getAll() {
        return ResponseEntity.ok(listDepartmentsUseCase.getAll());
    }
}
