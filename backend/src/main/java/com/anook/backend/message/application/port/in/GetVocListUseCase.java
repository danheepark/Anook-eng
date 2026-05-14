package com.anook.backend.message.application.port.in;

import com.anook.backend.message.application.dto.response.GetVocListResult;
import java.util.List;

public interface GetVocListUseCase {
    List<GetVocListResult> getVocList();
}
