package com.anook.backend.room.application.service;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "inventory")
public class InventoryPolicyProperties {

    private List<PolicyItem> policies = new ArrayList<>();

    public List<PolicyItem> getPolicies() {
        return policies;
    }

    public void setPolicies(List<PolicyItem> policies) {
        this.policies = policies;
    }

    public static class PolicyItem {
        private String code;
        private List<String> aliases = new ArrayList<>();
        private int allowance;
        private int extraCharge;

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public List<String> getAliases() {
            return aliases;
        }

        public void setAliases(List<String> aliases) {
            this.aliases = aliases;
        }

        public int getAllowance() {
            return allowance;
        }

        public void setAllowance(int allowance) {
            this.allowance = allowance;
        }

        public int getExtraCharge() {
            return extraCharge;
        }

        public void setExtraCharge(int extraCharge) {
            this.extraCharge = extraCharge;
        }
    }
}
