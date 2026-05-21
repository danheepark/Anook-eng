package com.anook.backend.pms.domain.model;

import java.util.List;

public record MenuOptionGroup(
        String groupName,
        boolean isRequired,
        List<String> items
) {}
