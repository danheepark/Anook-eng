package com.anook.backend.frontdesk.role.adapter.out.persistence;

import com.anook.backend.frontdesk.role.adapter.out.persistence.entity.RoleJpaEntity;
import com.anook.backend.frontdesk.role.application.port.out.RoleRepositoryPort;
import com.anook.backend.frontdesk.role.domain.model.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class RolePersistenceAdapter implements RoleRepositoryPort {

    private final RoleJpaRepository jpaRepository;

    @Override
    public Optional<Role> findById(Long id) {
        return jpaRepository.findById(id).map(RoleJpaEntity::toDomain);
    }

    @Override
    public List<Role> findAll() {
        return jpaRepository.findAll().stream()
                .map(RoleJpaEntity::toDomain)
                .toList();
    }

    @Override
    public Role save(Role role) {
        RoleJpaEntity entity = RoleJpaEntity.fromDomain(role);
        return jpaRepository.save(entity).toDomain();
    }

    @Override
    public void deleteById(Long id) {
        jpaRepository.deleteById(id);
    }

    @Override
    public boolean existsById(Long id) {
        return jpaRepository.existsById(id);
    }

    @Override
    public boolean existsByName(String name) {
        return jpaRepository.existsByName(name);
    }
}
