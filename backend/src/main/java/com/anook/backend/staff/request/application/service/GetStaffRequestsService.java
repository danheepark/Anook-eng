package com.anook.backend.staff.request.application.service;

import com.anook.backend.staff.request.adapter.in.web.dto.response.StaffTaskResult;
import com.anook.backend.staff.request.application.port.in.GetStaffRequestsUseCase;
import com.anook.backend.staff.request.application.port.out.RequestQueryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.anook.backend.global.util.RedisImageCacheUtil;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GetStaffRequestsService implements GetStaffRequestsUseCase {

    private final RequestQueryPort requestQueryPort;
    private final RedisImageCacheUtil redisImageCacheUtil;

    @Override
    public List<StaffTaskResult> getRequests(String departmentId, String status, String priority) {
        List<StaffTaskResult> requests = requestQueryPort.findRequests(departmentId, status, priority);
        return requests.stream()
                .map(r -> {
                    String base64Image = redisImageCacheUtil.getImage(r.roomNumber(), r.id());
                    String imageUrl = base64Image != null && !base64Image.startsWith("data:") 
                            ? "data:image/jpeg;base64," + base64Image 
                            : base64Image;
                    return new StaffTaskResult(
                            r.id(), r.status(), r.priority(), r.departmentId(), r.summary(),
                            r.rawText(), r.roomNumber(), r.assignedStaffId(), r.confidence(),
                            r.createdAt(), r.version(), r.cancelRequested(), r.cancelRequestedAt(), r.entities(), imageUrl, r.reasoning()
                    );
                })
                .collect(Collectors.toList());
    }
}
