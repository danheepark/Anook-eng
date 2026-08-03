**English** | [한국어 (Korean)](README_KO.md)

# 🏨 Aneuk (Anook) : AI-Powered Intelligent Hotel Management System

> A next-generation hotel operations platform that uses AI to analyze guest requests, automatically generate and dispatch tasks to appropriate staff members, and track fulfillment in real-time.

---

## 📖 Project Overview

**Aneuk (Anook)** is an intelligent hospitality operations platform that transforms unstructured, multilingual guest messages into structured operational tasks. It automatically routes requests to designated hotel departments (Housekeeping, F&B, Facility, Concierge, Front Desk) with minimal latency.  
Hotel managers oversee task allocation using a **Hybrid Confirmation System** driven by AI Confidence Scores, while processed operational data continuously refines a self-evolving RAG knowledge engine.

## ✨ Core Values

- **One-Pass AI Processing**: Single-prompt analysis performing multilingual translation, intent classification, entity extraction, and safety checks in one step.
- **Ultra-Lightweight Task Code**: Standardized micro-task payload format (`[DEPT]|[URGENCY]|[CATEGORY]|[ITEM]|[QTY]`), reducing LLM token consumption by 80–90% while ensuring strict parsing stability.
- **Hybrid Automation**: High confidence (≥ 0.8) requests are fully automated, while lower confidence edge-cases are routed to an admin confirmation queue for semi-automated human-in-the-loop review.
- **Data Flywheel**: Unresolved inquiries and staff resolution histories automatically feed back into the RAG pipeline for domain-specific self-tuning.

---

## 👥 Roles & Platform Matrix

| Role | Description | Authentication | Primary Device |
|------|-------------|----------------|----------------|
| 🧑 **Guest** | Instant PWA access via in-room QR code without app installation; natural language multilingual chat requests | Room-number auto-auth (JWT) | Mobile |
| 👷 **Staff** | Real-time push notifications; accept, transfer, or complete department-assigned task tickets | Manager-issued PIN (JWT) | PC, Mobile |
| 🏨 **Admin** | Real-time task monitoring dashboard; manual escalation confirmation for ambiguous AI flags & shift briefing | ID / Password (JWT) | PC |

---

## 🚀 Key Features (MVP)

1. **AI Chatbot Guest Experience (Guest Chat)**: Natural language inquiry processing in guest's native language + quick option pills.
2. **Automated Task Generation & Routing**: Intent classification engine routing tasks to Housekeeping (HK), Food & Beverage (FB), Facility Management (FACILITY), Concierge, or Front Desk (FRONT).
3. **AI Clarification & Guardrails**: Multi-turn dialogue logic asking follow-up questions when required fields are missing, or offering human escalation when AI boundaries are reached.
4. **Real-time Status Tracking (WebSocket)**: Synchronized task lifecycle (`CREATED` → `ASSIGNED` → `IN_PROGRESS` → `COMPLETED`) across Guest and Staff UIs.
5. **Hybrid RAG FAQ Engine**: Combined Vector DB (pgvector) + Knowledge Graph DB (Neo4j) for zero-hallucination factual hotel inquiries.
6. **Automated Shift Handover Briefing**: AI summarizes pending tasks, special notes, and operational history into natural language briefings for incoming shifts.
7. **Multilingual PII Masking Guard**: Regex pre-processor masking sensitive personal information (phone, email, passport, card numbers) prior to AI model execution.
8. **Multimodal Vision Analysis**: Guests can attach photos (e.g., broken appliances), analyzed via Gemini Vision API to create Facility repair tickets automatically.

---

## 🛠 Tech Stack

### Backend
- **Language & Framework**: Java 21, Spring Boot 3.2.4
- **Architecture**: Hexagonal Architecture (Ports & Adapters), Domain-Driven Design (DDD)
- **Database**: PostgreSQL 16 + pgvector (Vector DB for RAG), Spring Data JPA
- **Cache**: Redis (Temporary image storage, session caching)
- **Real-time**: WebSocket (STOMP)
- **Security**: Spring Security, JWT (HttpOnly Cookie)
- **Utilities**: Apache POI 5.2.5 (Excel export for shift handover), WebFlux WebClient (AI HTTP communication)

### Frontend
- **Framework**: Next.js 16.x (App Router, BFF Pattern)
- **Platform**: PWA (Progressive Web App) — zero-install instant QR access
- **State Management**: Zustand
- **Styling**: CSS Modules, CSS Variables
- **Offline**: IndexedDB (idb), Background Sync
- **Libraries**: iron-session (Server session), lucide-react (Icons), qrcode.react (QR generation)

### AI Server
- **Framework**: Python FastAPI + Uvicorn
- **AI Engine**: Google Gemini API (`gemini-2.5-flash`)
- **Vector DB**: pgvector (Semantic similarity search)
- **Graph DB**: Neo4j 5 (Menu / Price / Allergen relational search — Hybrid RAG)
- **AI Modules**: Intent/Entity Classification, Clarification Loops, Multilingual Response, PII Masking Guard, Multimodal Vision, Shift Summary Generation
- **Libraries**: SQLAlchemy, pgvector, neo4j-python-driver, langchain-community

### Infrastructure
- **Container**: Docker, Docker Compose
- **Reverse Proxy**: Nginx (SSL Termination, WebSocket Proxy)
- **External API**: Export-Import Bank of Korea Exchange Rate API (Real-time currency conversion for multilingual pricing)

---

## 🏗 System Architecture

### 4-Container Deployment Topography

```
[Guest Mobile / Staff Tablet / Admin PC]
              │ HTTPS
              ▼
┌──────────────────────────┐
│  Nginx (Reverse Proxy)   │  ← Single exposed entry point (Ports 80, 443)
│  - /** → next:3000       │
│  - /ws/** → app:8080     │  ← WebSocket direct routing
└────────────┬─────────────┘
             │ Internal Net
             ▼
┌──────────────────────────┐
│  Next.js (BFF · PWA)     │  ← BFF layer strips /api → proxies to app:8080
└────────────┬─────────────┘
             │ Internal Net (HTTP)
             ▼
┌──────────────────────────┐
│  Spring Boot (app:8080)  │  ← REST API + WebSocket (STOMP)
└─────┬─────────────┬──────┘
      │              │ HTTP
      ▼              ▼
┌──────────┐  ┌──────────────────────────────┐
│PostgreSQL│  │  Python AI (FastAPI :8000)    │
│+ pgvector│  │  ┌─ Router (Gemini)           │
│          │  │  ├─ HK Agent                 │
│  Redis   │  │  ├─ FB Agent (Hybrid RAG)    │
│ (Cache)  │  │  ├─ FACILITY Agent           │
└──────────┘  │  ├─ CONCIERGE Agent          │
              │  ├─ EMERGENCY Agent          │
              │  └─ FRONT Agent (Fallback)   │
              │  Neo4j (Graph RAG)           │
              └──────────────────────────────┘
```

### Key Defensive Architecture

- **Concurrency Control**: `@Version` JPA Optimistic Locking solving task state race conditions across multiple staff workers.
- **Privacy (PII)**: Regex pre-masking prior to LLM processing; no sensitive PII exposed in API responses.
- **Offline-First PWA**: IndexedDB + Background Sync for seamless operation during temporary network drops.
- **AI Reliability**: Confidence Score Hybrid Confirmation (≥ 0.8 auto-dispatch / < 0.8 sent to admin confirmation queue).

---

## ⚡ Quick Start

### Prerequisites

- Docker & Docker Compose
- [Google AI Studio Key](https://aistudio.google.com/) — `GEMINI_API_KEY`
- [Export-Import Bank of Korea OpenAPI](https://www.koreaexim.go.kr/ir/HPHKIR020M01) — `KOREAEXIM_AUTH_KEY` (Optional, for currency conversion)

### 1. Environment Configuration

```bash
cp .env.example .env
```

Open `.env` and fill in required keys:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET=your_random_secret_32chars_or_more

# Neo4j (Graph RAG) — Local default: neo4j / anook2026
NEO4J_USER=neo4j
NEO4J_PASSWORD=anook2026

# Optional (Currency conversion)
KOREAEXIM_AUTH_KEY=your_koreaexim_authkey_here

# Database
POSTGRES_USER=anook_user
POSTGRES_PASSWORD=anook_password
POSTGRES_DB=anook_db
```

### 2. Full Application Stack (Docker Compose — Recommended)

```bash
# Run local development environment (All ports exposed + Neo4j Browser)
docker-compose -f docker-compose.yml -f docker-compose.local.yml up -d

# Include build step (First run or after code changes)
docker-compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

### 3. Local Development (Individual Containers)

Run Spring Boot and Next.js in your local IDE while spinning up DB & AI containers via Docker:

```bash
# Start DB, AI, Redis, and Neo4j only
docker-compose -f docker-compose.yml -f docker-compose.local.yml up -d db redis ai neo4j

# Backend (Separate terminal)
cd backend && ./gradlew bootRun

# Frontend (Separate terminal)
cd frontend && npm install && npm run dev
```

### 4. Service Endpoints

| Service | URL | Notes |
|---------|-----|-------|
| Web App (Full Stack) | `http://localhost` | Via Nginx Proxy |
| Web App (Frontend Dev) | `http://localhost:3000` | Next.js direct |
| AI Server (Swagger UI) | `http://localhost:8000/docs` | FastAPI OpenAPI Docs |
| Neo4j Browser | `http://localhost:7474` | Graph Database Visualizer |
| PostgreSQL | `localhost:5432` | DB Port |
| Redis | `localhost:6379` | Cache Port |

---

## 🔑 Test Accounts & Service Flow

> Pre-seeded test accounts populated automatically via `backend/src/main/resources/data.sql`.

### Test Accounts

| Role | Name | PIN | Access URL | Notes |
|------|------|-----|------------|-------|
| 🏨 Admin | Manager Choi | `000000` | `/admin` | Real-time monitoring · Check-in · Handover |
| 👷 Staff | Kim Aneuk | `1234` | `/staff` | Housekeeping (HK) |
| 👷 Staff | Staff Kim | `111111` | `/staff` | Housekeeping (HK) |
| 🧑 Guest | — | Auto QR Auth | `/chat/{roomNo}` | Accessible post check-in |

---

### Full End-to-End Flow

```
[STEP 1] Admin  — Guest Check-in (PMS)
[STEP 2] Guest  — Scan QR → Access AI Chat
[STEP 3] AI     — Request Analysis → Auto Task Generation
[STEP 4] Staff  — Accept Task → Process → Complete
[STEP 5] Guest  — Real-time Status Updates
```

---

#### STEP 1 — Admin: Guest Check-in (PMS)

Admin logs into `/admin` and registers guest check-in under Guest Management (`/admin/guests`).

```
1. Access http://localhost/admin
2. Enter PIN: 000000 → Log in
3. Left Menu → [Guest Management] → [Register Check-in]
4. Input Room No. (e.g., 302) + Guest Name + Preferred Language → Save
5. Generated QR code displayed (Print or Share Screen)
```

> Upon check-in, the room's QR access is activated.  
> Upon check-out, the QR access token is immediately invalidated for room privacy protection.

---

#### STEP 2 — Guest: Scan QR → Access AI Chat

The guest scans the room QR code or navigates directly to the chat URL.

```
# URL automatically target by room QR (e.g., Room 302)
http://localhost/chat/302

# Auto-authenticated without login → Instant AI Chat Interface
```

> Automatically detects guest browser settings to serve localized UI in **English, Korean, Japanese, or Chinese**.

---

#### STEP 3 — AI: Intent Analysis & Task Generation

As the guest inputs natural language requests, Gemini AI classifies intent and routes tasks to the target department.

| Guest Message Example | AI Classification | Assigned Department |
|-----------------------|-------------------|---------------------|
| `"Bring 2 more towels please"` | Amenity Request | Housekeeping (HK) |
| `"The bathroom light is flickering"` | Maintenance Issue | Facility Management (FACILITY) |
| `"I'd like to order pasta from room service"` | Room Service Order | Food & Beverage (FB) |
| `"Can I get extra pillows?"` | Multilingual Request | Housekeeping (HK) |
| `"How much is my checkout bill tomorrow?"` | Billing Inquiry | Front Desk (FRONT) |

> Confidence ≥ 0.8 triggers **instant automatic assignment**;  
> Confidence < 0.8 queues the request on the Admin Dashboard **Confirmation Queue** for manual review.

---

#### STEP 4 — Staff: Accept → Fulfill → Complete

Staff members log into `/staff` to receive real-time task cards.

```
1. Access http://localhost/staff
2. Enter PIN: 1234 → Log in
3. View new assigned tasks on dashboard (WebSocket real-time notification)
4. Click Task Card → [Accept] → [Complete]
5. Reassign to another department or reply directly to guest if needed
```

---

#### STEP 5 — Guest: Real-time Status Sync

Guests observe real-time task progress directly in the chat interface:

```
CREATED → ASSIGNED → IN_PROGRESS → COMPLETED
```

> State changes triggered by staff update guest screens instantly via STOMP WebSockets.

---

## 🗂 Project Directory Structure

```
team3-Anook/
├── backend/                    # Spring Boot (Java 21)
│   └── src/main/java/com/anook/
│       ├── config/             # Security, WebSocket, Gemini Config
│       ├── security/           # JWT, Auth Services & Controllers
│       ├── guest/              # Guest Session (Check-in/out)
│       ├── message/            # Customer AI Chat History
│       ├── request/            # Request Processing & AI Bridge
│       ├── knowledge/          # RAG Knowledge Search & Admin Approval
│       ├── staff/request/      # Staff Task Acceptance & Transfer
│       └── admin/              # Admin Monitoring, Handover & Staff Management
│
├── frontend/                   # Next.js 16 (App Router · PWA)
│   └── src/
│       ├── app/
│       │   ├── chat/[roomNo]/  # Guest Chat UI (QR Auto-Auth)
│       │   ├── staff/          # Staff Dashboard UI
│       │   ├── admin/          # Admin Dashboard UI
│       │   └── api/[...path]/  # BFF Layer (Proxy to Spring Boot)
│       ├── components/         # Shared UI Components
│       └── stores/             # Zustand State Management
│
├── ai/                         # Python FastAPI (AI Engine)
│   └── app/
│       ├── domains/            # Department Agents (HK, FB, FACILITY, CONCIERGE, FRONT)
│       ├── core/               # Main Router & Hybrid RAG Engine
│       ├── prompts/            # Prompt Templates
│       └── infrastructure/     # Database Adapters (pgvector, Neo4j)
│
├── nginx/                      # Reverse Proxy Config
├── docs/                       # Design & Architecture Specs
├── docker-compose.yml          # Production Compose
├── docker-compose.local.yml    # Local Dev Override
└── .env.example                # Environment Variable Template
```

---

## 🧠 Architectural Decisions (ADR)

### 1. Hybrid RAG — 0% Hallucination Target

**Problem**: Vector DB (pgvector) alone scattered menu prices and allergen facts across text chunks, leading LLMs to combine invalid information (e.g., answering "Safe" to a guest with a shrimp allergy asking about seafood pasta).  
**Solution**: Introduced Neo4j Graph DB to model strict relationships (`[Pasta] ──HAS_ALLERGY──> [Shrimp]`).

| Database | Primary Role |
|----------|--------------|
| **Vector DB** (pgvector) | Semantic intent & query similarity search |
| **Graph DB** (Neo4j) | Strict 1:1 relational query for menu items, pricing & allergen safety |

**Outcome**: Achieved **0% hallucination rate** on F&B menu prices and allergen warnings.

---

### 2. Gemini 2.5 Flash vs 3.5 Flash A/B Testing

**Method**: Configured 50/50 randomized traffic splits via `GEMINI_AB_MODEL` in `.env` and logged telemetry in `ai_log.model_name`.

| Metric | Gemini 2.5 Flash | Gemini 3.5 Flash |
|--------|------------------|------------------|
| Avg Response Latency | **3,916 ms** ✅ | 8,704 ms |
| Token Efficiency | Standard | **High** ✅ |
| Speed Ratio | Benchmark | **2.2x Slower** |

**Decision**: Retained **Gemini 2.5 Flash** as primary model — real-time hospitality chat demands minimal latency over minor token cost optimizations.

---

### 3. Smart Guardrails & 2-Tier Department Scope Boundaries

**Problem**: Vague inputs (e.g., "It's noisy") or out-of-scope requests could cause misrouting or infinite clarification loops.  
**Solution**: 
- **Tier 1 (Main Router)**: Detects "State vs Action" ambiguity and presents quick clickable option pills instead of blind routing.
- **Tier 2 (Department Agents)**: Department prompts enforce strict scope boundaries. Out-of-scope or conditional requests are gracefully transferred to the Front Desk (`FRONT`).
- **Loop Prevention**: Automatically terminates infinite clarification loops if guest input lacks intent over multiple turns.

---

## 📚 Related Documentation

| Document | Description |
|----------|-------------|
| [Architecture Structure](docs/아키텍처_구조_제안.md) | Hexagonal Package Map, Frontend Architecture & Dependency Rules |
| [API Specification](docs/API_명세서.md) | Full REST API Endpoints List |
| [ERD](docs/ERD.md) | Database Schema Diagrams (Mermaid) |
| [RAG Workflow](docs/RAG_workflow.md) | Hybrid Vector + Graph RAG Pipeline |
| [AI Model Comparison](docs/AI_model_comparison_report.md) | Gemini 2.5 vs 3.5 A/B Test Findings |
| [AI Latency Optimization](docs/AI_latency_optimization.md) | Latency Analysis & Parallelization Review |
| [Frontend Design Guide](docs/FRONTEND_DESIGN_GUIDE.md) | Component Patterns, Naming & Style Rules |
| [Authentication & Security](docs/인증_보안_구현_플랜.md) | JWT, PII Masking & Offline Auth Plan |

---

*(Documentation derived from `docs/아키텍처_구조_제안.md`, `docs/기술_스펙_정리안.md`, and `docs/AI_model_comparison_report.md`)*
