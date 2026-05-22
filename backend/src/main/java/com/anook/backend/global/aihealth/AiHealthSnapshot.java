package com.anook.backend.global.aihealth;

import java.time.Instant;

public record AiHealthSnapshot(
        AiServerStatus status,
        Instant unhealthySince
) {
}
