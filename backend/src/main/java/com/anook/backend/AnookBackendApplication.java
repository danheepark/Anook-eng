package com.anook.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class AnookBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(AnookBackendApplication.class, args);
    }
}
