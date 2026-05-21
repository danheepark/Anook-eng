package com.anook.backend.frontdesk.role.application.port.out;

import com.anook.backend.frontdesk.role.domain.model.Role;

import java.util.List;
import java.util.Optional;

public interface RoleRepositoryPort {

    Optional<Role> findById(Long id);

    List<Role> findAll();

    Role save(Role role);

    void deleteById(Long id);

    boolean existsById(Long id);

    boolean existsByName(String name);
}
