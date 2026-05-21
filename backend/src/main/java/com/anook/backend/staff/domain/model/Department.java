package com.anook.backend.staff.domain.model;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class Department {
    private String id;
    private String name;
    private boolean isFrontdesk;
}
