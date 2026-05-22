package com.anook.backend.knowledge.application.port.in;

import com.anook.backend.knowledge.application.dto.request.BatchRegisterKnowledgeCommand;
import com.anook.backend.knowledge.application.dto.response.CreateKnowledgeResult;

import java.util.List;

public interface BatchRegisterKnowledgeUseCase {
    List<CreateKnowledgeResult> registerBatch(BatchRegisterKnowledgeCommand command);
}
