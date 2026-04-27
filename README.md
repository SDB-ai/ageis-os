# Aegis-OS — Global School OS Compliance Kernel

A K-12 student-data compliance prototype: every access request passes a
VEP triple-check, risk scoring, federal → state → district policy layering,
vault tokenization, AGER hallucination blocking, and a hash-chained BDIA
audit ledger.

**All data is synthetic.** Patterned after:
- FERPA 34 CFR Part 99
- COPPA 16 CFR Part 312 (amended, effective full-compliance April 22, 2026)
- IDEA 34 CFR §300.622
- NIST AI RMF 600-1
- NIST CSF 2.0

---

## What's inside

```
aegis-os/
├── README.md                  <- this file
├── .gitignore
├── backend/                   <- FastAPI + MongoDB compliance kernel
│   ├── server.py              <- the whole kernel (~800 lines, one file)
│   ├── requirements.txt
│   ├── Procfile               <- Railway/Heroku start command
│   ├── railway.json           <- Railway build config
│   ├── .env.example           <- copy to .env and fill in
│   └── tests/
│       └── test_aegis_kernel.py  <- 22 pytest tests
└── frontend/                  <- React 19 dark-mode "control room" UI
    ├── package.json
    ├── craco.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── .env.example
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js, App.js, App.css, index.css, api.js
        ├── components/
        │   ├── Sidebar.jsx
        │   └── ui-parts.jsx
        └── pages/ (8 pages)
            ├── Overview.jsx
            ├── Kernel.jsx
            ├── Ledger.jsx
            ├── AiGateway.jsx
            ├── Policies.jsx
            ├── Incidents.jsx
            ├── Disclosures.jsx
            └── Tenants.jsx
```

---

## Run locally (5 minutes)

### 1. Start MongoDB

Docker is easiest:
```bash
docker run -d --name aegis-mongo -p 27017:27017 mongo:7
```

Or use a free MongoDB Atlas cluster and put the connection string into
`backend/.env`.

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                # then fill in ANTHROPIC_API_KEY + BDIA_HMAC_KEY
uvicorn server:app --reload --port 8001
```

Check it's alive:
```bash
curl http://localhost:8001/api/
# {"service":"Aegis-OS Compliance Kernel","version":"0.1.0","synthetic":true}
```

The first request auto-seeds 4 tenants, 8 principals, 7 students, 5 policies,
3 consents, and 2 disclosures — all synthetic.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# edit .env: REACT_APP_BACKEND_URL=http://localhost:8001
npm install                          # or: yarn install
npm start                            # opens http://localhost:3000
```

### 4. Run the tests

```bash
cd backend
REACT_APP_BACKEND_URL=http://localhost:8001 pytest tests/ -v
# Expected: 22 passed
```

---

## Deploy to Railway (private repo friendly)

### Step 1 — push to a PRIVATE GitHub repo

```bash
cd aegis-os
git init
git add .
git commit -m "Initial commit"
# Create a PRIVATE repo at github.com, then:
git remote add origin git@github.com:YOURUSER/aegis-os.git
git branch -M main
git push -u origin main
```

### Step 2 — deploy backend on Railway

1. https://railway.app → **New Project** → **Deploy from GitHub repo** → pick repo
2. When it asks for a root directory, set it to **`backend`**
3. In the project canvas: **+ New** → **Database** → **Add MongoDB**
   (Railway provisions one and exposes `MONGO_URL` automatically)
4. On the backend service → **Variables** → add:

   | Key | Value |
   |---|---|
   | `MONGO_URL` | `${{MongoDB.MONGO_URL}}` |
   | `DB_NAME` | `aegis_os` |
   | `ANTHROPIC_API_KEY` | get at console.anthropic.com |
   | `BDIA_HMAC_KEY` | generate: `python -c "import secrets; print(secrets.token_hex(32))"` |
   | `CORS_ORIGINS` | `*` during testing, your frontend URL in prod |

5. Railway redeploys on every git push. Your backend URL:
   `https://<service-name>.up.railway.app`

### Step 3 — deploy frontend

**Option A — Vercel (recommended, free)**

1. https://vercel.com → **Import Project** → pick the same repo
2. **Root directory:** `frontend`
3. Env var: `REACT_APP_BACKEND_URL=https://<your-backend>.up.railway.app`
4. Deploy.

**Option B — Railway (same project)**

1. In the same Railway project: **+ New** → **GitHub Repo** → root = `frontend`
2. Variables: `REACT_APP_BACKEND_URL=https://<backend>.up.railway.app`
3. Build command: `npm install && npm run build`
4. Start command: `npx serve -s build -l $PORT`
   (add `"serve": "^14.2.0"` to `devDependencies` if needed)

---

## API surface

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/core/access` | Run an AccessRequest through the 10-gate kernel |
| `POST` | `/api/ai/invoke` | AI gateway with AGER hallucination blocker |
| `GET` | `/api/bdia` | List the hash-chained audit ledger |
| `GET` | `/api/bdia/verify?tenantId=X` | Replay chain + HMAC — returns VALID or BROKEN |
| `GET` | `/api/system/stats` | Dashboard KPIs + 5-pillar status |
| `POST` | `/api/seed` | Idempotent synthetic seeding |
| `GET` | `/api/tenants` | List districts |
| `GET` | `/api/principals?tenantId=` | Teachers/admins/etc. per tenant |
| `GET` | `/api/students?tenantId=` | Students per tenant |
| `GET` | `/api/policies?layer=federal\|state\|district` | Policy packs |
| `GET` | `/api/consents` | COPPA / district consent grants |
| `GET` | `/api/disclosures` | FERPA §99.32 log |
| `GET` | `/api/incidents?status=open` | Incident register |
| `GET` | `/api/ces-catalog` | Canonical error codes |
| **Teacher Portal** | | |
| `GET` | `/api/teacher/roster?teacherId=` | RBAC-filtered student roster (tokenized) |
| `GET` | `/api/teacher/assignments?teacherId=` | Teacher's assignments |
| `GET` | `/api/teacher/submissions?teacherId=` | Submissions awaiting grading |
| `POST` | `/api/teacher/grade` | Kernel-gated AI grade proposal (blocks IEP/504) |
| `POST` | `/api/teacher/grade/approve` | Human-in-loop approve/edit/reject (NIST AI RMF) |
| `GET` | `/api/teacher/grade/proposals?teacherId=` | Grading history & pending approvals |
| `POST` | `/api/teacher/lesson` | Kernel-gated lesson plan (local-only for IEP students) |
| `GET` | `/api/teacher/lessons?teacherId=` | Saved lesson plans |

---

## Teacher Portal — compliance design

Every teacher action routes through the 10-gate kernel *before* any AI call.
The UI at `/teacher` has four tabs: **My Roster**, **AI-Assisted Grading**,
**Lesson Plans**, **Graded History**.

### AI-Assisted Grading flow

```
teacher clicks "Request AI Proposal"
        │
        ▼
┌────────────────────────┐
│ POST /api/teacher/grade│   (kernel runs POST /api/core/access first)
└────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Kernel decision                     │
│   DENY  → IEP/504 student          │
│          → status = "blocked"       │
│          → manual grading only      │
│   REVIEW→ FL district / grade ≤5    │
│          → AI runs, flagged review  │
│   ALLOW → AI runs routine           │
└─────────────────────────────────────┘
        │
        ▼
  AI proposal (score + rubric + feedback)
        │
        ▼
  Teacher APPROVES / EDITS / REJECTS  ← required
        │
        ▼
  BDIA ledger entry sealed + signed
```

### Lesson Plan Generator flow

- For each target student → kernel check → bucketed into `aiEligible` or `iepLocallyGenerated`.
- AI generates a single-class plan (45 min) for the eligible cohort; no student PII ever enters the prompt.
- IEP/504 students automatically get a **locally-generated modified plan** (extended time, chunked instructions, multi-modal representation, visual supports) — zero external AI per IDEA §300.622.
- AGER scans the AI output for hallucinated standards or inventions.
- Plan + kernel results + BDIA event saved to `db.lessons`.

---

## The 10 gates (every `POST /api/core/access` runs through these)

```
1.  SYNTHETIC_GUARD   → kill-switch for any non-synthetic data
2.  VEP               → who / what / why triple-check
3.  TENANT_ISOLATION  → actor tenant == subject tenant
4.  RBAC              → role + roster relationship
5.  RISK              → NIST AI RMF-inspired score (>=4 blocks)
6.  POLICY            → federal → state → district layered eval
7.  VAULT_TOKV        → PII tokenization (no raw PII downstream)
8.  AI_GATEWAY        → IEP/504 external-AI block per IDEA §300.622
9.  CES               → canonical error signaling
10. BDIA              → SHA-256 hash-chained + HMAC-signed ledger write (fail-closed)
```

---

## Demo scenarios to try

Once running, click the **Kernel** page. Six pre-built scenarios:

| Scenario | Expected decision | Why |
|---|---|---|
| ALLOW · Teacher reads own roster student | `ALLOW` | All gates pass |
| DENY · AI generate on IEP student | `DENY` (CES-RISK-001 / CES-VAULT-001) | IDEA §300.622 |
| REVIEW · AI generate in FL district | `REQUIRE_HUMAN_REVIEW` | FL HB 1069 |
| DENY · Cross-tenant | `DENY` (CES-TENANT-001) | ASTIL violation |
| DENY · Missing VEP | `DENY` (CES-VEP-001) | No WHO/WHAT/WHY |
| DENY · Teacher not on roster | `DENY` (CES-RBAC-002) | No relationship |

Then open **AI / AGER** and pick the "Hallucination" scenario — watch Claude
get caught inventing honor-roll and gifted-program claims that aren't in
the canonical facts.

---

## Production hardening checklist (before going live with real districts)

- [ ] Replace hardcoded `BDIA_HMAC_KEY` env var with AWS KMS / Azure Key Vault / GCP KMS
- [ ] Add OIDC/SAML authentication (Entra ID, Okta, or Auth0)
- [ ] Migrate MongoDB → Postgres with Row Level Security for per-tenant isolation
- [ ] Add WORM (write-once-read-many) Blob storage for BDIA chain immutability
- [ ] SOC 2 Type II, StateRAMP, 1EdTech Data Privacy Agreement
- [ ] Implement the DSR (Data Subject Request) workflows per FERPA §99.10
- [ ] Title IX — separate-key TMV vault
- [ ] Real SIS adapters (PowerSchool, Infinite Campus, Skyward) for live canonical-truth

---

## License

Copyright © 2026. All rights reserved.
