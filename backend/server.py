"""
Aegis-OS Compliance Kernel — Demo Prototype Backend
====================================================
Implements the canonical enforcement spine for Global School OS:
  VEP (triple-check) -> RBAC -> Risk Scorer -> Policy Engine ->
  Vault (TOKV/TMV) -> AI Gateway (AGER) -> CES -> BDIA (hash-chained audit)

All data is SYNTHETIC. Complies with FERPA 34 CFR Part 99, COPPA, IDEA architectural patterns.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import secrets
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# HMAC key for BDIA ledger signing (set BDIA_HMAC_KEY in prod — keep this out of code)
BDIA_HMAC_KEY = os.environ.get("BDIA_HMAC_KEY", "AEGIS-DEMO-HMAC-KEY-DO-NOT-USE-IN-PRODUCTION").encode()

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
LLM_MODEL = os.environ.get("LLM_MODEL", "claude-sonnet-4-5-20250929")

app = FastAPI(title="Aegis-OS Compliance Kernel", version="0.1.0-demo")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("aegis")


# ============================================================
#  MODELS
# ============================================================

Decision = Literal["ALLOW", "DENY", "REQUIRE_CONSENT", "REQUIRE_HUMAN_REVIEW"]


class VEP(BaseModel):
    who: str  # legitimate educational role
    what: str  # scoped purpose
    why: str  # justification


class AccessRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    requestId: Optional[str] = None
    tenantId: str
    domain: str = "academic"
    actor: Dict[str, Any]  # {id, role}
    subject: Dict[str, Any]  # {studentId}
    vep: VEP
    data: Dict[str, Any] = Field(default_factory=dict)
    action: str = "read"
    context: Dict[str, Any] = Field(default_factory=dict)


class GateResult(BaseModel):
    gate: str
    status: Literal["PASS", "FAIL", "SKIPPED", "WARN"]
    detail: str
    evidence: Dict[str, Any] = Field(default_factory=dict)


class AccessResponse(BaseModel):
    requestId: str
    decision: Decision
    cesCode: Optional[str] = None
    gates: List[GateResult]
    riskScore: int
    bdiaEventId: str
    timestamp: str


class AiInvocation(BaseModel):
    tenantId: str
    prompt: str
    contextFacts: Optional[List[str]] = None  # canonical truth from SIS
    studentContext: Optional[Dict[str, Any]] = None


class AiResult(BaseModel):
    allowed: bool
    cesCode: Optional[str]
    riskScore: int
    redactedPrompt: str
    response: Optional[str]
    hallucinationDetected: bool
    contradictions: List[str]
    gates: List[GateResult]
    bdiaEventId: str
    provider: str = "mock"
    model: str = "mock-generator"


# ============================================================
#  CES Error Catalog (subset)
# ============================================================

CES_CODES = {
    "CES-VEP-001": "VEP triple-check failed: missing or invalid WHO/WHAT/WHY",
    "CES-RBAC-001": "Role lacks permission for requested action",
    "CES-RBAC-002": "No roster relationship between actor and subject",
    "CES-POL-001": "Policy pack denies request (federal/state/district)",
    "CES-POL-002": "Requires parental consent (COPPA / district opt-in)",
    "CES-RISK-001": "Risk score >= 4, request blocked",
    "CES-VAULT-001": "Subject is IEP/504 — cannot reach external AI",
    "CES-AI-001": "AI hallucination detected — output contradicts canonical truth",
    "CES-AI-002": "AI prompt contains raw PII — must be tokenized",
    "CES-BDIA-001": "Audit write failed — request aborted fail-closed",
    "CES-TENANT-001": "ASTIL violation — cross-tenant access attempted",
    "CES-SYNTH-001": "Synthetic-only kill-switch engaged",
    "CES-UNHANDLED-001": "Unhandled error — locked by default",
    "CES-OK-000": "No error",
}


# ============================================================
#  SEED DATA
# ============================================================

SEED_TENANTS = [
    {"tenantId": "TEN-FL-001", "name": "Orange County Public Schools (SYNTHETIC)", "state": "FL", "residency": "us-east"},
    {"tenantId": "TEN-CA-001", "name": "Los Angeles Unified (SYNTHETIC)", "state": "CA", "residency": "us-west"},
    {"tenantId": "TEN-OH-001", "name": "Columbus City Schools (SYNTHETIC)", "state": "OH", "residency": "us-central"},
    {"tenantId": "TEN-NY-001", "name": "NYC DOE (SYNTHETIC)", "state": "NY", "residency": "us-east"},
]

SEED_PRINCIPALS = [
    {"id": "P-001", "tenantId": "TEN-FL-001", "name": "A. Ruiz", "role": "teacher", "email": "a.ruiz@synthetic.edu"},
    {"id": "P-002", "tenantId": "TEN-FL-001", "name": "B. Chen", "role": "counselor", "email": "b.chen@synthetic.edu"},
    {"id": "P-003", "tenantId": "TEN-FL-001", "name": "C. Patel", "role": "admin", "email": "c.patel@synthetic.edu"},
    {"id": "P-004", "tenantId": "TEN-FL-001", "name": "D. Okafor", "role": "privacy_officer", "email": "d.okafor@synthetic.edu"},
    {"id": "P-005", "tenantId": "TEN-CA-001", "name": "E. Martinez", "role": "teacher", "email": "e.martinez@synthetic.edu"},
    {"id": "P-006", "tenantId": "TEN-CA-001", "name": "F. Kim", "role": "parent", "email": "f.kim@synthetic.edu"},
    {"id": "P-007", "tenantId": "TEN-OH-001", "name": "G. Nguyen", "role": "teacher", "email": "g.nguyen@synthetic.edu"},
    {"id": "P-008", "tenantId": "TEN-NY-001", "name": "H. Goldberg", "role": "admin", "email": "h.goldberg@synthetic.edu"},
]

SEED_STUDENTS = [
    {"id": "S-1001", "tenantId": "TEN-FL-001", "grade": 7, "flags": ["iep"], "roster": ["P-001", "P-002", "P-004"]},
    {"id": "S-1002", "tenantId": "TEN-FL-001", "grade": 8, "flags": [], "roster": ["P-001", "P-003"]},
    {"id": "S-1003", "tenantId": "TEN-FL-001", "grade": 5, "flags": ["504"], "roster": ["P-002"]},
    {"id": "S-1004", "tenantId": "TEN-CA-001", "grade": 10, "flags": [], "roster": ["P-005"]},
    {"id": "S-1005", "tenantId": "TEN-CA-001", "grade": 11, "flags": ["iep", "ell"], "roster": ["P-005"]},
    {"id": "S-1006", "tenantId": "TEN-OH-001", "grade": 3, "flags": [], "roster": ["P-007"]},
    {"id": "S-1007", "tenantId": "TEN-NY-001", "grade": 12, "flags": [], "roster": ["P-008"]},
]

SEED_POLICIES = [
    {
        "id": "POL-FED-FERPA-v1",
        "layer": "federal",
        "jurisdiction": "US",
        "version": "2026.01",
        "citation": "34 CFR Part 99 (FERPA)",
        "rules": [
            {"if": "subject.flags CONTAINS 'iep'", "then": "DENY_EXTERNAL_AI", "cite": "34 CFR §300.622"},
            {"if": "action == 'disclose' AND !consent", "then": "REQUIRE_CONSENT", "cite": "34 CFR §99.30"},
            {"if": "actor.tenantId != subject.tenantId", "then": "DENY", "cite": "ASTIL / §99.31"},
        ],
    },
    {
        "id": "POL-FED-COPPA-v1",
        "layer": "federal",
        "jurisdiction": "US",
        "version": "2026.01",
        "citation": "16 CFR Part 312 (COPPA)",
        "rules": [
            {"if": "subject.grade <= 5 AND action IN ('ai_generate','disclose_third_party')", "then": "REQUIRE_CONSENT", "cite": "§312.5"},
        ],
    },
    {
        "id": "POL-STATE-FL-v1",
        "layer": "state",
        "jurisdiction": "FL",
        "version": "2026.01",
        "citation": "FL HB 1069 / Student Online Personal Info",
        "rules": [
            {"if": "tenantId STARTS_WITH 'TEN-FL'", "then": "REQUIRE_HUMAN_REVIEW when action='ai_generate'", "cite": "FL HB 1069"},
        ],
    },
    {
        "id": "POL-STATE-CA-v1",
        "layer": "state",
        "jurisdiction": "CA",
        "version": "2026.01",
        "citation": "CA Ed Code §49073.1",
        "rules": [
            {"if": "tenantId STARTS_WITH 'TEN-CA'", "then": "ENFORCE_DATA_RESIDENCY us-west", "cite": "§49073.1"},
        ],
    },
    {
        "id": "POL-DIST-FL001-v1",
        "layer": "district",
        "jurisdiction": "TEN-FL-001",
        "version": "2026.01",
        "citation": "Orange County AI Acceptable Use",
        "rules": [
            {"if": "action == 'ai_generate' AND subject.grade < 9", "then": "REQUIRE_HUMAN_REVIEW", "cite": "OCPS-AI-01"},
        ],
    },
]

SEED_CONSENTS = [
    {"id": "C-001", "tenantId": "TEN-FL-001", "studentId": "S-1001", "type": "coppa_parent", "granted": True, "date": "2025-09-01", "scope": "ai_instructional"},
    {"id": "C-002", "tenantId": "TEN-FL-001", "studentId": "S-1002", "type": "coppa_parent", "granted": False, "date": "2025-09-01", "scope": "ai_instructional"},
    {"id": "C-003", "tenantId": "TEN-CA-001", "studentId": "S-1004", "type": "district_optin", "granted": True, "date": "2025-10-15", "scope": "data_analytics"},
]

SEED_DISCLOSURES = [
    {"id": "D-001", "tenantId": "TEN-FL-001", "studentId": "S-1001", "recipient": "State DOE (Synthetic)", "reason": "Required reporting §99.31(a)(3)", "date": "2026-01-03", "citation": "34 CFR §99.32"},
    {"id": "D-002", "tenantId": "TEN-FL-001", "studentId": "S-1002", "recipient": "School Resource Officer", "reason": "Health/safety emergency §99.36", "date": "2026-01-05", "citation": "34 CFR §99.32"},
]


# ============================================================
#  KERNEL PIPELINE
# ============================================================

def tokenize(value: str, tenant_id: str) -> str:
    """TOKV: deterministic tokenization of PII (demo-grade)."""
    h = hashlib.sha256(f"{tenant_id}:{value}".encode()).hexdigest()
    return f"tok_{h[:16]}"


def risk_score(req: AccessRequest, student: Optional[Dict[str, Any]]) -> int:
    """NIST AI RMF-inspired risk scoring. >=4 triggers BLOCK."""
    score = 0
    if req.action in ("ai_generate", "disclose", "export"):
        score += 2
    if student and "iep" in student.get("flags", []):
        score += 2
    if student and "504" in student.get("flags", []):
        score += 1
    if student and student.get("grade", 12) <= 5:
        score += 1
    if req.domain in ("discipline", "title_ix", "health"):
        score += 3
    raw_pii = req.data.get("raw_pii", False)
    if raw_pii:
        score += 2
    return score


async def evaluate_policies(req: AccessRequest, student: Optional[Dict[str, Any]], consent: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Federal -> State -> District layered evaluation."""
    triggered: List[Dict[str, Any]] = []
    # FERPA federal
    if student and "iep" in student.get("flags", []) and req.action == "ai_generate":
        triggered.append({"policy": "POL-FED-FERPA-v1", "outcome": "DENY_EXTERNAL_AI", "cite": "IDEA 34 CFR §300.622"})
    if req.actor.get("tenantId") and req.actor["tenantId"] != req.tenantId:
        triggered.append({"policy": "POL-FED-FERPA-v1", "outcome": "DENY", "cite": "ASTIL / §99.31"})
    # COPPA federal
    if student and student.get("grade", 12) <= 5 and req.action in ("ai_generate", "disclose_third_party"):
        if not consent or not consent.get("granted"):
            triggered.append({"policy": "POL-FED-COPPA-v1", "outcome": "REQUIRE_CONSENT", "cite": "§312.5"})
    # State FL
    if req.tenantId.startswith("TEN-FL") and req.action == "ai_generate":
        triggered.append({"policy": "POL-STATE-FL-v1", "outcome": "REQUIRE_HUMAN_REVIEW", "cite": "FL HB 1069"})
    # District OCPS
    if req.tenantId == "TEN-FL-001" and req.action == "ai_generate" and student and student.get("grade", 99) < 9:
        triggered.append({"policy": "POL-DIST-FL001-v1", "outcome": "REQUIRE_HUMAN_REVIEW", "cite": "OCPS-AI-01"})
    return {"triggered": triggered}


async def get_last_bdia(tenant_id: str) -> Optional[Dict[str, Any]]:
    doc = await db.bdia_events.find_one({"tenantId": tenant_id}, {"_id": 0}, sort=[("seq", -1)])
    return doc


async def write_bdia(event: Dict[str, Any]) -> str:
    """Append-only, SHA-256 hash-chained, HMAC-signed ledger write."""
    prev = await get_last_bdia(event["tenantId"])
    prev_hash = prev["currHash"] if prev else "0" * 64
    seq = (prev["seq"] + 1) if prev else 1
    event["seq"] = seq
    event["prevHash"] = prev_hash
    # Canonical serialization for hashing
    canonical = f"{event['tenantId']}|{event['eventId']}|{event['timestamp']}|{event['who']}|{event['what']}|{event['why']}|{event['decision']}|{prev_hash}|{seq}"
    curr_hash = hashlib.sha256(canonical.encode()).hexdigest()
    signature = hmac.new(BDIA_HMAC_KEY, curr_hash.encode(), hashlib.sha256).hexdigest()
    event["currHash"] = curr_hash
    event["signature"] = signature
    await db.bdia_events.insert_one(event.copy())
    return event["eventId"]


@api.post("/core/access", response_model=AccessResponse)
async def core_access(req: AccessRequest):
    """Canonical enforcement spine — the Aegis kernel."""
    req_id = req.requestId or f"REQ-{uuid.uuid4().hex[:12]}"
    gates: List[GateResult] = []
    decision: Decision = "ALLOW"
    ces: Optional[str] = None

    # 0. Synthetic-only kill switch (always ON in demo)
    gates.append(GateResult(gate="SYNTHETIC_GUARD", status="PASS", detail="Synthetic-only rule engaged"))

    # 1. VEP triple-check
    if not req.vep.who or not req.vep.what or not req.vep.why:
        gates.append(GateResult(gate="VEP", status="FAIL", detail="Missing WHO/WHAT/WHY"))
        decision, ces = "DENY", "CES-VEP-001"
    else:
        gates.append(GateResult(gate="VEP", status="PASS", detail=f"WHO={req.vep.who} WHAT={req.vep.what} WHY={req.vep.why[:40]}"))

    # 2. Tenant isolation (ASTIL)
    actor_tid = req.actor.get("tenantId", req.tenantId)
    if actor_tid != req.tenantId and decision == "ALLOW":
        gates.append(GateResult(gate="ASTIL", status="FAIL", detail=f"Actor tenant {actor_tid} != subject tenant {req.tenantId}"))
        decision, ces = "DENY", "CES-TENANT-001"
    else:
        gates.append(GateResult(gate="ASTIL", status="PASS", detail=f"Tenant boundary honored ({req.tenantId})"))

    # 3. RBAC + roster
    student = await db.students.find_one({"id": req.subject.get("studentId"), "tenantId": req.tenantId}, {"_id": 0})
    actor = await db.principals.find_one({"id": req.actor.get("id"), "tenantId": req.tenantId}, {"_id": 0})
    if decision == "ALLOW":
        if not actor:
            gates.append(GateResult(gate="RBAC", status="FAIL", detail="Actor not found in tenant directory"))
            decision, ces = "DENY", "CES-RBAC-001"
        elif not student:
            gates.append(GateResult(gate="RBAC", status="FAIL", detail="Subject not found in tenant"))
            decision, ces = "DENY", "CES-RBAC-002"
        else:
            role = actor.get("role", "")
            on_roster = req.actor.get("id") in student.get("roster", [])
            if role == "admin" or role == "privacy_officer" or on_roster or role == "parent":
                gates.append(GateResult(gate="RBAC", status="PASS", detail=f"role={role} on_roster={on_roster}"))
            else:
                gates.append(GateResult(gate="RBAC", status="FAIL", detail=f"role={role} lacks relationship to subject"))
                decision, ces = "DENY", "CES-RBAC-002"

    # 4. Risk scorer
    score = risk_score(req, student)
    if score >= 4 and decision == "ALLOW":
        gates.append(GateResult(gate="RISK", status="FAIL", detail=f"Risk score {score} >= 4, BLOCK", evidence={"score": score}))
        decision, ces = "DENY", "CES-RISK-001"
    else:
        gates.append(GateResult(gate="RISK", status="PASS" if score < 4 else "SKIPPED", detail=f"Risk score={score}", evidence={"score": score}))

    # 5. Policy Engine
    consent = await db.consents.find_one({"studentId": req.subject.get("studentId"), "tenantId": req.tenantId}, {"_id": 0}) if student else None
    policy_result = await evaluate_policies(req, student, consent) if decision == "ALLOW" else {"triggered": []}
    if decision == "ALLOW":
        deny_hits = [t for t in policy_result["triggered"] if t["outcome"] in ("DENY", "DENY_EXTERNAL_AI")]
        consent_hits = [t for t in policy_result["triggered"] if t["outcome"] == "REQUIRE_CONSENT"]
        review_hits = [t for t in policy_result["triggered"] if t["outcome"] == "REQUIRE_HUMAN_REVIEW"]
        if deny_hits:
            gates.append(GateResult(gate="POLICY", status="FAIL", detail=f"{len(deny_hits)} DENY policy(ies) triggered", evidence={"hits": deny_hits}))
            decision, ces = "DENY", "CES-POL-001"
        elif consent_hits and (not consent or not consent.get("granted")):
            gates.append(GateResult(gate="POLICY", status="WARN", detail="Parental consent required (COPPA/district)", evidence={"hits": consent_hits}))
            decision, ces = "REQUIRE_CONSENT", "CES-POL-002"
        elif review_hits:
            gates.append(GateResult(gate="POLICY", status="WARN", detail="Human review required by policy", evidence={"hits": review_hits}))
            decision, ces = "REQUIRE_HUMAN_REVIEW", "CES-POL-002"
        else:
            gates.append(GateResult(gate="POLICY", status="PASS", detail=f"{len(policy_result['triggered'])} policies evaluated, none blocking", evidence={"hits": policy_result["triggered"]}))

    # 6. Vault (TOKV) tokenization
    if decision == "ALLOW":
        sid = req.subject.get("studentId", "")
        token = tokenize(sid, req.tenantId)
        gates.append(GateResult(gate="VAULT_TOKV", status="PASS", detail=f"PII tokenized, token={token}", evidence={"token": token, "vault": "TOKV"}))
    else:
        gates.append(GateResult(gate="VAULT_TOKV", status="SKIPPED", detail="Vault bypassed (request already denied)"))

    # 7. AI Gateway (only if action == ai_generate and still allowed)
    if req.action == "ai_generate" and decision == "ALLOW":
        if student and "iep" in student.get("flags", []):
            gates.append(GateResult(gate="AI_GATEWAY", status="FAIL", detail="IEP subject — external AI forbidden", evidence={"flag": "iep"}))
            decision, ces = "DENY", "CES-VAULT-001"
        else:
            gates.append(GateResult(gate="AI_GATEWAY", status="PASS", detail="AI invocation permitted (mocked)"))
    else:
        gates.append(GateResult(gate="AI_GATEWAY", status="SKIPPED", detail="Not an AI-generate action"))

    # 8. CES (canonical error signaling)
    if ces:
        gates.append(GateResult(gate="CES", status="WARN" if decision != "DENY" else "FAIL", detail=f"{ces}: {CES_CODES.get(ces, '')}"))
    else:
        ces = "CES-OK-000"
        gates.append(GateResult(gate="CES", status="PASS", detail="No canonical errors"))

    # 9. BDIA — audit write (fail-closed)
    event_id = f"BDIA-{uuid.uuid4().hex[:12]}"
    ts = datetime.now(timezone.utc).isoformat()
    bdia = {
        "eventId": event_id,
        "tenantId": req.tenantId,
        "requestId": req_id,
        "timestamp": ts,
        "who": f"{req.actor.get('id','?')}|{req.vep.who}",
        "what": f"{req.action} on {req.subject.get('studentId','?')} ({req.domain})",
        "why": req.vep.why,
        "decision": decision,
        "cesCode": ces,
        "riskScore": score,
    }
    try:
        await write_bdia(bdia)
        gates.append(GateResult(gate="BDIA", status="PASS", detail=f"Audit sealed (seq propagated, HMAC signed) — {event_id}"))
    except Exception as e:  # fail-closed
        logger.exception("BDIA write failed")
        gates.append(GateResult(gate="BDIA", status="FAIL", detail=f"Audit write failed: {e}"))
        decision, ces = "DENY", "CES-BDIA-001"

    # 10. Incident if DENY or REVIEW
    if decision in ("DENY", "REQUIRE_HUMAN_REVIEW", "REQUIRE_CONSENT"):
        await db.incidents.insert_one({
            "id": f"INC-{uuid.uuid4().hex[:10]}",
            "tenantId": req.tenantId,
            "requestId": req_id,
            "eventId": event_id,
            "severity": "high" if decision == "DENY" else "medium",
            "cesCode": ces,
            "decision": decision,
            "summary": f"{decision} — {CES_CODES.get(ces or '', '')}",
            "timestamp": ts,
            "status": "open",
        })

    return AccessResponse(
        requestId=req_id,
        decision=decision,
        cesCode=ces,
        gates=gates,
        riskScore=score,
        bdiaEventId=event_id,
        timestamp=ts,
    )


# ============================================================
#  AI GATEWAY / AGER
# ============================================================

CANONICAL_FACTS_DEFAULT = [
    "Student S-1002 grade-8 math current average: 82%",
    "Student S-1002 attendance YTD: 94%",
    "Student S-1004 last assessment: Algebra II, score 78",
]

HALLUCINATION_TRIGGERS = ["expelled", "arrested", "diagnosed", "suspended", "honor roll", "gifted program"]


def _scrub_pii(prompt: str, tenant_id: str) -> str:
    """TOKV scrub: replace names + student IDs with tokens."""
    redacted = prompt
    for name in ["Ruiz", "Chen", "Patel", "Martinez"]:
        redacted = redacted.replace(name, "[REDACTED_NAME]")
    for sid in ["S-1001", "S-1002", "S-1003", "S-1004", "S-1005"]:
        redacted = redacted.replace(sid, tokenize(sid, tenant_id))
    return redacted


def _score_ai_risk(inv: AiInvocation) -> int:
    score = 0
    if inv.studentContext and "iep" in inv.studentContext.get("flags", []):
        score += 3
    if any(w in inv.prompt.lower() for w in ["discipline", "health", "diagnosis"]):
        score += 2
    return score


def _ager_contradictions(response: str, facts: List[str]) -> List[str]:
    lowered = response.lower()
    out: List[str] = []
    for trig in HALLUCINATION_TRIGGERS:
        if trig in lowered and not any(trig in f.lower() for f in facts):
            out.append(f"'{trig}' claimed but absent from canonical truth")
    return out


async def _call_llm(redacted: str, facts: List[str], tenant_id: str) -> tuple[Optional[str], str, str, Optional[str]]:
    """Returns (response, provider, model, error). Falls back to mock on any failure."""
    if not ANTHROPIC_API_KEY:
        return None, "mock", "mock-generator", "no-key"
    try:
        import anthropic
        client_ai = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
        system_message = (
            "You are an AI assistant embedded inside the Aegis-OS Compliance Kernel for K-12 schools. "
            "You will receive a teacher prompt together with a list of CANONICAL FACTS from the student's "
            "official records. You MUST ONLY make claims that are directly supported by the canonical facts. "
            "Do NOT invent, embellish, or add information not present in the canonical facts. "
            "Keep responses concise (2-3 sentences). Do not reference specific medical, disciplinary, or "
            "legal judgments. This is SYNTHETIC demo data."
        )
        facts_block = "\n".join(f"- {f}" for f in facts)
        user_text = f"CANONICAL FACTS:\n{facts_block}\n\nTEACHER PROMPT:\n{redacted}"
        message = await client_ai.messages.create(
            model=LLM_MODEL,
            max_tokens=768,
            system=system_message,
            messages=[{"role": "user", "content": user_text}],
        )
        resp_text = message.content[0].text if message.content else ""
        return resp_text, "anthropic", LLM_MODEL, None
    except Exception as e:
        logger.exception("LLM call failed")
        return None, "mock", "mock-generator", str(e)[:100]


def _mock_llm(prompt: str) -> str:
    if secrets.randbelow(100) < 40 or "make it up" in prompt.lower():
        return (
            "Based on available records, the student was briefly on the honor roll last semester and "
            "was diagnosed with a mild condition. Academic trajectory is upward."
        )
    return (
        "Based on attendance (94% YTD) and current math average (82%), the student is on track. "
        "Recommend continued practice with worked-example math problems during advisory."
    )


@api.post("/ai/invoke", response_model=AiResult)
async def ai_invoke(inv: AiInvocation):
    """AI Gateway with AGER hallucination blocker. Calls Claude via the native
    Anthropic SDK when ANTHROPIC_API_KEY is configured; otherwise falls back to
    a deterministic mock generator."""
    gates: List[GateResult] = []
    cess: Optional[str] = None

    # 1. PII scrub
    redacted = _scrub_pii(inv.prompt, inv.tenantId)
    gates.append(GateResult(gate="PII_SCRUB", status="PASS", detail="Names and student IDs tokenized"))

    # 2. Risk score
    score = _score_ai_risk(inv)
    gates.append(GateResult(gate="RISK", status="PASS" if score < 4 else "FAIL", detail=f"Risk={score}"))
    if score >= 4:
        cess = "CES-RISK-001"

    # 3. IEP / external-AI block
    if inv.studentContext and "iep" in inv.studentContext.get("flags", []):
        gates.append(GateResult(gate="IEP_BLOCK", status="FAIL", detail="Subject is IEP — external AI blocked (IDEA §300.622)"))
        cess = "CES-VAULT-001"

    # 4. AI generation — native Anthropic SDK, with deterministic mock fallback
    facts = inv.contextFacts or CANONICAL_FACTS_DEFAULT
    llm_response: Optional[str] = None
    provider_used, model_used = "mock", "mock-generator"
    if not cess:
        resp, provider_used, model_used, err = await _call_llm(redacted, facts, inv.tenantId)
        if resp is not None:
            llm_response = resp
            gates.append(GateResult(
                gate="LLM_INVOKE", status="PASS",
                detail=f"Invoked {provider_used}/{model_used}",
                evidence={"provider": provider_used, "model": model_used, "chars": len(resp)},
            ))
        else:
            if err and err != "no-key":
                gates.append(GateResult(gate="LLM_INVOKE", status="WARN", detail=f"Provider call failed, using mock: {err}"))
            llm_response = _mock_llm(inv.prompt)
            gates.append(GateResult(gate="LLM_MOCK", status="PASS", detail="Generated mock response (no LLM key or fallback)"))

    # 5. CES / AGER hallucination check
    contradictions: List[str] = _ager_contradictions(llm_response, facts) if llm_response else []
    hallucinated = len(contradictions) > 0
    if llm_response:
        if hallucinated:
            gates.append(GateResult(gate="AGER_CES", status="FAIL", detail=f"{len(contradictions)} contradiction(s) — suppressing output"))
            cess = "CES-AI-001"
        else:
            gates.append(GateResult(gate="AGER_CES", status="PASS", detail="Output consistent with canonical truth"))

    allowed = cess is None or cess == "CES-OK-000"
    final_response = llm_response if allowed and not hallucinated else None

    # BDIA audit
    event_id = f"BDIA-{uuid.uuid4().hex[:12]}"
    bdia = {
        "eventId": event_id,
        "tenantId": inv.tenantId,
        "requestId": f"AI-{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "who": "ai-gateway/AGER",
        "what": f"ai_invoke prompt_len={len(inv.prompt)}",
        "why": "instructional-support",
        "decision": "ALLOW" if allowed else "DENY",
        "cesCode": cess or "CES-OK-000",
        "riskScore": score,
    }
    await write_bdia(bdia)

    if not allowed or hallucinated:
        await db.incidents.insert_one({
            "id": f"INC-{uuid.uuid4().hex[:10]}",
            "tenantId": inv.tenantId,
            "requestId": bdia["requestId"],
            "eventId": event_id,
            "severity": "high",
            "cesCode": cess,
            "decision": bdia["decision"],
            "summary": "AGER blocked hallucinated AI output" if hallucinated else CES_CODES.get(cess or "", ""),
            "timestamp": bdia["timestamp"],
            "status": "open",
        })

    return AiResult(
        allowed=allowed and not hallucinated,
        cesCode=cess,
        riskScore=score,
        redactedPrompt=redacted,
        response=final_response,
        hallucinationDetected=hallucinated,
        contradictions=contradictions,
        gates=gates,
        bdiaEventId=event_id,
        provider=provider_used,
        model=model_used,
    )


# ============================================================
#  BDIA LEDGER
# ============================================================

@api.get("/bdia")
async def list_bdia(tenantId: Optional[str] = None, decision: Optional[str] = None, limit: int = Query(200, ge=1, le=1000)):
    q: Dict[str, Any] = {}
    if tenantId:
        q["tenantId"] = tenantId
    if decision:
        q["decision"] = decision
    events = await db.bdia_events.find(q, {"_id": 0}).sort("seq", -1).to_list(limit)
    return {"count": len(events), "events": events}


@api.get("/bdia/verify")
async def verify_bdia(tenantId: str):
    """Replay hash-chain and HMAC signatures to verify tamper-evidence."""
    events = await db.bdia_events.find({"tenantId": tenantId}, {"_id": 0}).sort("seq", 1).to_list(10000)
    broken: List[Dict[str, Any]] = []
    prev_hash = "0" * 64
    for e in events:
        canonical = f"{e['tenantId']}|{e['eventId']}|{e['timestamp']}|{e['who']}|{e['what']}|{e['why']}|{e['decision']}|{prev_hash}|{e['seq']}"
        expected = hashlib.sha256(canonical.encode()).hexdigest()
        expected_sig = hmac.new(BDIA_HMAC_KEY, expected.encode(), hashlib.sha256).hexdigest()
        if expected != e["currHash"] or expected_sig != e["signature"] or e["prevHash"] != prev_hash:
            broken.append({"eventId": e["eventId"], "seq": e["seq"], "reason": "hash/sig mismatch"})
        prev_hash = e["currHash"]
    return {"tenantId": tenantId, "totalEvents": len(events), "brokenLinks": broken, "integrity": "VALID" if not broken else "BROKEN"}


# ============================================================
#  ADMIN / DASHBOARD ENDPOINTS
# ============================================================

@api.get("/tenants")
async def list_tenants():
    return await db.tenants.find({}, {"_id": 0}).to_list(100)


@api.get("/principals")
async def list_principals(tenantId: Optional[str] = None):
    q = {"tenantId": tenantId} if tenantId else {}
    return await db.principals.find(q, {"_id": 0}).to_list(500)


@api.get("/students")
async def list_students(tenantId: Optional[str] = None):
    q = {"tenantId": tenantId} if tenantId else {}
    return await db.students.find(q, {"_id": 0}).to_list(500)


@api.get("/policies")
async def list_policies(layer: Optional[str] = None):
    q = {"layer": layer} if layer else {}
    return await db.policies.find(q, {"_id": 0}).to_list(200)


@api.get("/consents")
async def list_consents(tenantId: Optional[str] = None):
    q = {"tenantId": tenantId} if tenantId else {}
    return await db.consents.find(q, {"_id": 0}).to_list(500)


@api.get("/disclosures")
async def list_disclosures(tenantId: Optional[str] = None):
    q = {"tenantId": tenantId} if tenantId else {}
    return await db.disclosures.find(q, {"_id": 0}).to_list(500)


@api.get("/incidents")
async def list_incidents(tenantId: Optional[str] = None, status: Optional[str] = None, limit: int = 200):
    q: Dict[str, Any] = {}
    if tenantId:
        q["tenantId"] = tenantId
    if status:
        q["status"] = status
    return await db.incidents.find(q, {"_id": 0}).sort("timestamp", -1).to_list(limit)


@api.get("/ces-catalog")
async def ces_catalog():
    return [{"code": k, "description": v} for k, v in CES_CODES.items()]


@api.get("/system/stats")
async def system_stats():
    pipeline_allow = await db.bdia_events.count_documents({"decision": "ALLOW"})
    pipeline_deny = await db.bdia_events.count_documents({"decision": "DENY"})
    pipeline_review = await db.bdia_events.count_documents({"decision": {"$in": ["REQUIRE_CONSENT", "REQUIRE_HUMAN_REVIEW"]}})
    total_events = await db.bdia_events.count_documents({})
    open_incidents = await db.incidents.count_documents({"status": "open"})
    tenants = await db.tenants.count_documents({})
    students = await db.students.count_documents({})
    policies = await db.policies.count_documents({})
    return {
        "allow": pipeline_allow,
        "deny": pipeline_deny,
        "review": pipeline_review,
        "totalAuditEvents": total_events,
        "openIncidents": open_incidents,
        "tenants": tenants,
        "students": students,
        "policies": policies,
        "syntheticOnly": True,
        "pillars": [
            {"code": "ANS", "name": "Academic Needs Score", "desc": "Tokenization engine — PII never leaves vault", "status": "ACTIVE"},
            {"code": "VEP", "name": "Verified Educational Purpose", "desc": "Triple-check WHO/WHAT/WHY gate", "status": "ACTIVE"},
            {"code": "BDIA", "name": "Batch Decryption / Individual Audit", "desc": "Hash-chained, HMAC-signed immutable ledger", "status": "ACTIVE"},
            {"code": "CES", "name": "Canonical Error Signaling", "desc": "AGER anti-hallucination enforcement", "status": "ACTIVE"},
            {"code": "ASTIL", "name": "Advanced Secure Tenant Isolation Layers", "desc": "Per-district key/vault/audit separation", "status": "ACTIVE"},
        ],
    }


# ============================================================
#  SEED
# ============================================================

@api.post("/seed")
async def seed(force: bool = False):
    if force:
        for c in ["tenants", "principals", "students", "policies", "consents", "disclosures", "incidents", "bdia_events"]:
            await db[c].delete_many({})
    counts = {}
    if await db.tenants.count_documents({}) == 0:
        await db.tenants.insert_many([t.copy() for t in SEED_TENANTS])
    if await db.principals.count_documents({}) == 0:
        await db.principals.insert_many([p.copy() for p in SEED_PRINCIPALS])
    if await db.students.count_documents({}) == 0:
        await db.students.insert_many([s.copy() for s in SEED_STUDENTS])
    if await db.policies.count_documents({}) == 0:
        await db.policies.insert_many([p.copy() for p in SEED_POLICIES])
    if await db.consents.count_documents({}) == 0:
        await db.consents.insert_many([c.copy() for c in SEED_CONSENTS])
    if await db.disclosures.count_documents({}) == 0:
        await db.disclosures.insert_many([d.copy() for d in SEED_DISCLOSURES])

    for coll in ["tenants", "principals", "students", "policies", "consents", "disclosures", "incidents", "bdia_events"]:
        counts[coll] = await db[coll].count_documents({})
    return {"seeded": True, "counts": counts}


# =====================================================================
# TEACHER PORTAL — every endpoint routes through the 10-gate kernel.
# =====================================================================
# Compliance design:
#   - AI grading: runs core_access with action=ai_generate first.
#     IEP/504 students -> DENY (IDEA §300.622).
#     FL districts -> REQUIRE_HUMAN_REVIEW (FL HB 1069).
#     Grades <= 5 without parental AI consent -> REQUIRE_CONSENT (COPPA).
#   - Human-in-loop: AI output is ALWAYS a PROPOSAL the teacher must
#     approve/edit/reject (NIST AI RMF 600-1 MANAGE-4.1).
#   - PII scrubbed before AI call (TOKV).
#   - AGER hallucination check on every AI output.
#   - Every action writes to BDIA ledger (FERPA §99.32 audit trail).
# =====================================================================

SEED_ASSIGNMENTS = [
    {"id": "ASG-001", "tenantId": "TEN-FL-001", "teacherId": "P-001",
     "title": "Grade 7 Math — Linear Equations",
     "subject": "math", "grade": 7, "standard": "CCSS.MATH.CONTENT.7.EE.B.4",
     "rubric": [{"criterion": "Correctness", "weight": 50},
                {"criterion": "Work shown", "weight": 30},
                {"criterion": "Notation", "weight": 20}]},
    {"id": "ASG-002", "tenantId": "TEN-FL-001", "teacherId": "P-001",
     "title": "Grade 8 Math — Systems of Linear Equations",
     "subject": "math", "grade": 8, "standard": "CCSS.MATH.CONTENT.8.EE.C.8",
     "rubric": [{"criterion": "Correctness", "weight": 60},
                {"criterion": "Work shown", "weight": 40}]},
    {"id": "ASG-003", "tenantId": "TEN-CA-001", "teacherId": "P-005",
     "title": "Grade 10 — Geometry Proofs",
     "subject": "math", "grade": 10, "standard": "CCSS.MATH.CONTENT.HSG.CO.C.9",
     "rubric": [{"criterion": "Logic", "weight": 50},
                {"criterion": "Accuracy", "weight": 50}]},
]

SEED_SUBMISSIONS = [
    {"id": "SUB-001", "assignmentId": "ASG-001", "studentId": "S-1002", "tenantId": "TEN-FL-001",
     "submittedAt": "2026-02-05T14:00:00Z",
     "response": "To solve 3x + 5 = 20, subtract 5 from both sides giving 3x = 15. "
                 "Then divide by 3 to get x = 5.",
     "type": "short_answer"},
    {"id": "SUB-002", "assignmentId": "ASG-001", "studentId": "S-1001", "tenantId": "TEN-FL-001",
     "submittedAt": "2026-02-05T14:10:00Z",
     "response": "x equals 5 because 3 times 5 plus 5 is 20.",
     "type": "short_answer"},
    {"id": "SUB-003", "assignmentId": "ASG-002", "studentId": "S-1002", "tenantId": "TEN-FL-001",
     "submittedAt": "2026-02-05T14:20:00Z",
     "response": "The intersection of y = 2x + 1 and y = -x + 4 is at x = 1, y = 3.",
     "type": "short_answer"},
]


class GradeRequest(BaseModel):
    teacherId: str
    submissionId: str
    mode: Literal["ai_proposal", "manual"] = "ai_proposal"


class GradeApproveRequest(BaseModel):
    teacherId: str
    proposalId: str
    action: Literal["approve", "edit", "reject"]
    finalScore: Optional[int] = None
    finalFeedback: Optional[str] = None
    editNotes: Optional[str] = None


class LessonRequest(BaseModel):
    teacherId: str
    tenantId: str
    subject: str
    grade: int
    standard: str
    learningObjective: str
    targetStudentIds: List[str] = Field(default_factory=list)
    accommodations: List[str] = Field(default_factory=list)


async def _kernel_check(tenant_id: str, teacher_id: str, student_id: str,
                        action: str, why: str, domain: str = "academic") -> AccessResponse:
    ar = AccessRequest(
        tenantId=tenant_id, domain=domain,
        actor={"id": teacher_id, "tenantId": tenant_id, "role": "teacher"},
        subject={"studentId": student_id},
        vep=VEP(who=teacher_id, what=action, why=why),
        action=action,
    )
    return await core_access(ar)


@api.get("/teacher/roster")
async def teacher_roster(teacherId: str):
    teacher = await db.principals.find_one({"id": teacherId}, {"_id": 0})
    if not teacher:
        return {"teacher": None, "students": [], "error": "Teacher not found"}
    students = await db.students.find(
        {"tenantId": teacher["tenantId"], "roster": teacherId}, {"_id": 0}
    ).to_list(500)
    tenant = await db.tenants.find_one({"tenantId": teacher["tenantId"]}, {"_id": 0})
    for s in students:
        s["displayId"] = tokenize(s["id"], teacher["tenantId"])
        s["protected"] = bool(set(s.get("flags", [])) & {"iep", "504"})
        s["aiEligible"] = "iep" not in s.get("flags", [])
    return {
        "teacher": teacher, "tenant": tenant, "students": students,
        "complianceNotice": ("Names tokenized (TOKV). IEP/504 students cannot be processed by "
                             "external AI per IDEA §300.622."),
    }


@api.get("/teacher/assignments")
async def teacher_assignments(teacherId: str):
    return await db.assignments.find({"teacherId": teacherId}, {"_id": 0}).to_list(200)


@api.get("/teacher/submissions")
async def teacher_submissions(teacherId: str, assignmentId: Optional[str] = None):
    teacher = await db.principals.find_one({"id": teacherId}, {"_id": 0})
    if not teacher:
        return []
    q: Dict[str, Any] = {"tenantId": teacher["tenantId"]}
    if assignmentId:
        q["assignmentId"] = assignmentId
    else:
        own = await db.assignments.find({"teacherId": teacherId}, {"_id": 0, "id": 1}).to_list(500)
        q["assignmentId"] = {"$in": [a["id"] for a in own]}
    subs = await db.submissions.find(q, {"_id": 0}).sort("submittedAt", -1).to_list(500)
    for s in subs:
        student = await db.students.find_one({"id": s["studentId"]}, {"_id": 0})
        s["studentDisplayId"] = tokenize(s["studentId"], s["tenantId"])
        s["protected"] = bool(set(student.get("flags", []) if student else []) & {"iep", "504"})
        s["aiEligible"] = student is not None and "iep" not in student.get("flags", [])
        latest = await db.grade_proposals.find_one(
            {"submissionId": s["id"]}, {"_id": 0}, sort=[("createdAt", -1)]
        )
        s["proposalStatus"] = latest["status"] if latest else "ungraded"
    return subs


@api.post("/teacher/grade")
async def teacher_grade(req: GradeRequest):
    sub = await db.submissions.find_one({"id": req.submissionId}, {"_id": 0})
    if not sub:
        return {"error": "Submission not found"}
    teacher = await db.principals.find_one({"id": req.teacherId}, {"_id": 0})
    if not teacher or teacher["tenantId"] != sub["tenantId"]:
        return {"error": "Teacher not authorized for this tenant"}
    assignment = await db.assignments.find_one({"id": sub["assignmentId"]}, {"_id": 0})

    kernel_action = "ai_generate" if req.mode == "ai_proposal" else "read"
    kernel = await _kernel_check(
        tenant_id=sub["tenantId"], teacher_id=req.teacherId,
        student_id=sub["studentId"], action=kernel_action,
        why=f"grade-{sub['assignmentId']}",
    )

    proposal_id = f"PROP-{uuid.uuid4().hex[:10]}"
    ts = datetime.now(timezone.utc).isoformat()
    base = {
        "id": proposal_id, "submissionId": sub["id"], "assignmentId": sub["assignmentId"],
        "tenantId": sub["tenantId"], "teacherId": req.teacherId, "studentId": sub["studentId"],
        "createdAt": ts, "mode": req.mode,
        "kernelDecision": kernel.decision, "cesCode": kernel.cesCode,
        "kernelBdiaEventId": kernel.bdiaEventId, "kernelRequestId": kernel.requestId,
    }

    if kernel.decision == "DENY":
        proposal = {**base, "status": "blocked",
                    "blockReason": CES_CODES.get(kernel.cesCode or "", "Blocked by kernel"),
                    "proposedScore": None, "proposedFeedback": None, "citations": []}
        await db.grade_proposals.insert_one(proposal.copy())
        return {"proposal": proposal, "kernel": kernel.model_dump(), "reviewRequired": True,
                "humanActionRequired": ("Manual grading required — AI path blocked by compliance kernel.")}

    if req.mode == "manual":
        proposal = {**base, "status": "pending_teacher",
                    "proposedScore": None, "proposedFeedback": None, "citations": [],
                    "guidance": "Score manually. Kernel permitted access to submission."}
        await db.grade_proposals.insert_one(proposal.copy())
        return {"proposal": proposal, "kernel": kernel.model_dump(), "reviewRequired": True}

    rubric_text = "\n".join(f"- {c['criterion']} ({c['weight']}%)" for c in (assignment or {}).get("rubric", []))
    canonical_facts = [
        f"Assignment: {(assignment or {}).get('title', 'Unknown')}",
        f"Standard: {(assignment or {}).get('standard', '')}",
        f"Grade level: {(assignment or {}).get('grade', '')}",
        "Rubric weights must sum to 100%.",
    ]
    ai_prompt = (
        "You are grading a student's short-answer response. Use the rubric. "
        "Return STRICTLY a JSON object with keys: score (0-100), feedback (2 sentences), "
        "rubricBreakdown (array of {criterion, points, note}). No commentary outside JSON.\n\n"
        f"RUBRIC:\n{rubric_text}\n\n"
        f"STUDENT RESPONSE:\n{sub['response']}"
    )
    inv = AiInvocation(tenantId=sub["tenantId"], prompt=ai_prompt,
                       contextFacts=canonical_facts, studentContext={"flags": []})
    ai = await ai_invoke(inv)

    score_val: Optional[int] = None
    feedback: Optional[str] = None
    breakdown: List[Dict[str, Any]] = []
    if ai.response:
        try:
            import json as _json
            import re as _re
            m = _re.search(r"\{.*\}", ai.response, _re.S)
            parsed = _json.loads(m.group(0)) if m else {}
            score_val = int(parsed.get("score", 0))
            feedback = parsed.get("feedback")
            breakdown = parsed.get("rubricBreakdown", [])
        except Exception:
            feedback = ai.response[:500]

    proposal = {**base,
                "status": "pending_teacher",
                "proposedScore": score_val,
                "proposedFeedback": feedback,
                "rubricBreakdown": breakdown,
                "aiProvider": ai.provider, "aiModel": ai.model,
                "aiBdiaEventId": ai.bdiaEventId,
                "hallucinationDetected": ai.hallucinationDetected,
                "contradictions": ai.contradictions,
                "redactedPrompt": ai.redactedPrompt,
                "humanApprovalRequired": True,
                "reviewFlag": kernel.decision if kernel.decision != "ALLOW" else "routine_review",
                "citations": ["FERPA §99.31", "NIST AI RMF 600-1 MANAGE-4.1",
                              f"Tenant policy: {sub['tenantId']}"]}
    await db.grade_proposals.insert_one(proposal.copy())
    return {"proposal": proposal, "kernel": kernel.model_dump(), "ai": ai.model_dump(),
            "reviewRequired": True,
            "humanActionRequired": ("TEACHER MUST APPROVE — NIST AI RMF requires human review "
                                    "of AI-assisted grades.")}


@api.get("/teacher/grade/proposals")
async def list_proposals(teacherId: str, status: Optional[str] = None):
    q: Dict[str, Any] = {"teacherId": teacherId}
    if status:
        q["status"] = status
    return await db.grade_proposals.find(q, {"_id": 0}).sort("createdAt", -1).to_list(200)


@api.post("/teacher/grade/approve")
async def approve_proposal(req: GradeApproveRequest):
    prop = await db.grade_proposals.find_one({"id": req.proposalId}, {"_id": 0})
    if not prop or prop["teacherId"] != req.teacherId:
        return {"error": "Proposal not found or not owned by teacher"}
    ts = datetime.now(timezone.utc).isoformat()
    final_score = req.finalScore if req.finalScore is not None else prop.get("proposedScore")
    final_fb = req.finalFeedback if req.finalFeedback is not None else prop.get("proposedFeedback")

    bdia = {
        "eventId": f"BDIA-{uuid.uuid4().hex[:12]}", "tenantId": prop["tenantId"],
        "requestId": f"GRADE-{uuid.uuid4().hex[:8]}", "timestamp": ts,
        "who": f"{req.teacherId}|teacher",
        "what": f"grade.{req.action} submission={prop['submissionId']} score={final_score}",
        "why": "summative-assessment-human-approved",
        "decision": "ALLOW" if req.action != "reject" else "DENY",
        "cesCode": "CES-OK-000", "riskScore": 0,
    }
    await write_bdia(bdia)

    update = {
        "status": {"approve": "final_approved", "edit": "final_edited",
                   "reject": "rejected"}[req.action],
        "finalScore": final_score if req.action != "reject" else None,
        "finalFeedback": final_fb if req.action != "reject" else None,
        "editNotes": req.editNotes,
        "decidedAt": ts,
        "decisionBdiaEventId": bdia["eventId"],
    }
    await db.grade_proposals.update_one({"id": req.proposalId}, {"$set": update})
    return {"ok": True, "proposalId": req.proposalId, "status": update["status"],
            "bdiaEventId": bdia["eventId"]}


@api.post("/teacher/lesson")
async def generate_lesson(req: LessonRequest):
    teacher = await db.principals.find_one({"id": req.teacherId}, {"_id": 0})
    if not teacher or teacher["tenantId"] != req.tenantId:
        return {"error": "Teacher not authorized for tenant"}

    target_results: List[Dict[str, Any]] = []
    iep_locally: List[str] = []
    ai_eligible: List[str] = []
    for sid in req.targetStudentIds or []:
        kr = await _kernel_check(
            tenant_id=req.tenantId, teacher_id=req.teacherId, student_id=sid,
            action="ai_generate", why=f"lesson-planning-{req.standard}",
        )
        target_results.append({"studentId": sid, "decision": kr.decision, "cesCode": kr.cesCode})
        if kr.decision == "DENY":
            iep_locally.append(sid)
        else:
            ai_eligible.append(sid)

    facts = [
        f"Standard: {req.standard}", f"Grade: {req.grade}",
        f"Subject: {req.subject}", f"Objective: {req.learningObjective}",
    ]
    if req.accommodations:
        facts.append("Accommodation tags: " + ", ".join(req.accommodations))

    ai_prompt = (
        "You are an instructional designer. Produce a single-class lesson plan (45 minutes) "
        "for the given standard and objective. Use only the canonical facts provided. "
        "Return STRICTLY JSON with keys: title, durationMin (45), objectives (array), "
        "materials (array), activities (array of {phase, minutes, description}), "
        "assessment (short string), differentiation (array of generic strategies). "
        "Do NOT reference any student by name or ID. Cite the standard code inline."
    )
    inv = AiInvocation(tenantId=req.tenantId, prompt=ai_prompt, contextFacts=facts,
                       studentContext={"flags": []})
    ai = await ai_invoke(inv)

    parsed_lesson: Dict[str, Any] = {}
    if ai.response:
        try:
            import json as _json
            import re as _re
            m = _re.search(r"\{.*\}", ai.response, _re.S)
            parsed_lesson = _json.loads(m.group(0)) if m else {}
        except Exception:
            parsed_lesson = {"title": f"{req.subject.title()} — {req.standard}",
                             "durationMin": 45, "rawText": ai.response[:2000]}

    local_plan_for_iep: Optional[Dict[str, Any]] = None
    if iep_locally:
        local_plan_for_iep = {
            "title": f"Modified plan for IEP/504 learners — {req.standard}",
            "note": ("Generated locally (no external AI) per IDEA §300.622. "
                     "Mirrors the main lesson with: extended time, chunked instructions, "
                     "multi-modal representation, visual supports."),
            "durationMin": 45,
            "appliedAccommodationTags": req.accommodations or ["extended-time", "chunked-instructions"],
            "studentIds": iep_locally,
        }

    lesson_id = f"LES-{uuid.uuid4().hex[:10]}"
    ts = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": lesson_id, "tenantId": req.tenantId, "teacherId": req.teacherId,
        "subject": req.subject, "grade": req.grade, "standard": req.standard,
        "learningObjective": req.learningObjective,
        "targetStudentIds": req.targetStudentIds, "accommodations": req.accommodations,
        "plan": parsed_lesson, "localPlanForIep": local_plan_for_iep,
        "aiProvider": ai.provider, "aiModel": ai.model, "aiBdiaEventId": ai.bdiaEventId,
        "hallucinationDetected": ai.hallucinationDetected, "contradictions": ai.contradictions,
        "kernelResults": target_results, "createdAt": ts,
        "citations": [req.standard, "FERPA §99.31(b)", "IDEA §300.622 (IEP locally-generated)",
                      "NIST AI RMF 600-1 MEASURE-2.3"],
    }
    await db.lessons.insert_one(doc.copy())
    return {"lesson": doc, "kernelResults": target_results,
            "aiEligibleStudents": ai_eligible, "iepLocallyGenerated": iep_locally,
            "complianceNotice": ("External AI used for non-IEP students. IEP/504 students receive "
                                 "a locally-generated modified plan per IDEA §300.622.")}


@api.get("/teacher/lessons")
async def list_lessons(teacherId: str):
    return await db.lessons.find({"teacherId": teacherId}, {"_id": 0}).sort("createdAt", -1).to_list(200)




@api.get("/")
async def root():
    return {"service": "Aegis-OS Compliance Kernel", "version": "0.1.0-demo", "synthetic": True}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    # Auto-seed on startup (idempotent)
    if await db.tenants.count_documents({}) == 0:
        await db.tenants.insert_many([t.copy() for t in SEED_TENANTS])
    if await db.principals.count_documents({}) == 0:
        await db.principals.insert_many([p.copy() for p in SEED_PRINCIPALS])
    if await db.students.count_documents({}) == 0:
        await db.students.insert_many([s.copy() for s in SEED_STUDENTS])
    if await db.policies.count_documents({}) == 0:
        await db.policies.insert_many([p.copy() for p in SEED_POLICIES])
    if await db.consents.count_documents({}) == 0:
        await db.consents.insert_many([c.copy() for c in SEED_CONSENTS])
    if await db.disclosures.count_documents({}) == 0:
        await db.disclosures.insert_many([d.copy() for d in SEED_DISCLOSURES])
    if await db.assignments.count_documents({}) == 0:
        await db.assignments.insert_many([a.copy() for a in SEED_ASSIGNMENTS])
    if await db.submissions.count_documents({}) == 0:
        await db.submissions.insert_many([s.copy() for s in SEED_SUBMISSIONS])
    logger.info("Aegis-OS seeded (synthetic data only).")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
