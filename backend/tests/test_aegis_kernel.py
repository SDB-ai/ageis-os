"""
Aegis-OS Compliance Kernel Backend Tests
=========================================
Tests for the K-12 compliance kernel API endpoints:
- Core access pipeline (VEP, ASTIL, RBAC, Risk, Policy, Vault, AI Gateway, CES, BDIA)
- AI Gateway with AGER hallucination blocker
- BDIA hash-chained audit ledger
- Admin/dashboard endpoints
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestServiceHealth:
    """Basic service health and banner tests"""
    
    def test_api_root_returns_banner(self):
        """GET /api/ — returns service banner"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "Aegis-OS Compliance Kernel"
        assert data["version"] == "0.1.0-demo"
        assert data["synthetic"]
        print(f"SUCCESS: API root returns banner: {data}")


class TestSeedEndpoint:
    """Seed endpoint tests"""
    
    def test_seed_idempotent(self):
        """POST /api/seed — idempotent synthetic seeding"""
        response = requests.post(f"{BASE_URL}/api/seed")
        assert response.status_code == 200
        data = response.json()
        assert data["seeded"]
        counts = data["counts"]
        
        # Verify expected counts
        assert counts["tenants"] == 4, f"Expected 4 tenants, got {counts['tenants']}"
        assert counts["principals"] == 8, f"Expected 8 principals, got {counts['principals']}"
        assert counts["students"] == 7, f"Expected 7 students, got {counts['students']}"
        assert counts["policies"] == 5, f"Expected 5 policies, got {counts['policies']}"
        
        print(f"SUCCESS: Seed endpoint returned counts: {counts}")
        
        # Run again to verify idempotency
        response2 = requests.post(f"{BASE_URL}/api/seed")
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["counts"]["tenants"] == 4, "Seed should be idempotent"
        print("SUCCESS: Seed is idempotent")


class TestCoreAccessPipeline:
    """Core access pipeline tests - POST /api/core/access"""
    
    def test_allow_teacher_reads_own_roster_student(self):
        """ALLOW path: FL teacher P-001 reading own-roster student S-1002"""
        payload = {
            "tenantId": "TEN-FL-001",
            "domain": "academic",
            "actor": {"id": "P-001", "role": "teacher", "tenantId": "TEN-FL-001"},
            "subject": {"studentId": "S-1002"},
            "vep": {"who": "classroom_teacher", "what": "view_grades", "why": "weekly progress review"},
            "action": "read",
            "data": {},
            "context": {}
        }
        response = requests.post(f"{BASE_URL}/api/core/access", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["decision"] == "ALLOW", f"Expected ALLOW, got {data['decision']}"
        assert data["cesCode"] == "CES-OK-000", f"Expected CES-OK-000, got {data['cesCode']}"
        assert "bdiaEventId" in data, "Missing bdiaEventId"
        assert data["bdiaEventId"].startswith("BDIA-"), "Invalid bdiaEventId format"
        
        # Verify all gates passed
        gate_statuses = {g["gate"]: g["status"] for g in data["gates"]}
        assert gate_statuses.get("VEP") == "PASS", "VEP gate should PASS"
        assert gate_statuses.get("ASTIL") == "PASS", "ASTIL gate should PASS"
        assert gate_statuses.get("RBAC") == "PASS", "RBAC gate should PASS"
        assert gate_statuses.get("CES") == "PASS", "CES gate should PASS"
        assert gate_statuses.get("BDIA") == "PASS", "BDIA gate should PASS"
        
        print(f"SUCCESS: ALLOW decision with CES-OK-000, BDIA event: {data['bdiaEventId']}")
    
    def test_deny_cross_tenant_astil_violation(self):
        """DENY cross-tenant: actor tenant != subject tenant -> CES-TENANT-001"""
        payload = {
            "tenantId": "TEN-FL-001",
            "domain": "academic",
            "actor": {"id": "P-005", "role": "teacher", "tenantId": "TEN-CA-001"},  # CA teacher
            "subject": {"studentId": "S-1002"},  # FL student
            "vep": {"who": "classroom_teacher", "what": "view_grades", "why": "external inquiry"},
            "action": "read"
        }
        response = requests.post(f"{BASE_URL}/api/core/access", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["decision"] == "DENY", f"Expected DENY, got {data['decision']}"
        assert data["cesCode"] == "CES-TENANT-001", f"Expected CES-TENANT-001, got {data['cesCode']}"
        
        # Verify ASTIL gate failed
        astil_gate = next((g for g in data["gates"] if g["gate"] == "ASTIL"), None)
        assert astil_gate is not None, "ASTIL gate not found"
        assert astil_gate["status"] == "FAIL", "ASTIL gate should FAIL"
        
        print(f"SUCCESS: DENY cross-tenant with CES-TENANT-001")
    
    def test_deny_missing_vep(self):
        """DENY missing VEP: empty who/what/why -> CES-VEP-001"""
        payload = {
            "tenantId": "TEN-FL-001",
            "actor": {"id": "P-001", "role": "teacher", "tenantId": "TEN-FL-001"},
            "subject": {"studentId": "S-1002"},
            "vep": {"who": "", "what": "", "why": ""},  # Empty VEP
            "action": "read"
        }
        response = requests.post(f"{BASE_URL}/api/core/access", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["decision"] == "DENY", f"Expected DENY, got {data['decision']}"
        assert data["cesCode"] == "CES-VEP-001", f"Expected CES-VEP-001, got {data['cesCode']}"
        
        # Verify VEP gate failed
        vep_gate = next((g for g in data["gates"] if g["gate"] == "VEP"), None)
        assert vep_gate is not None, "VEP gate not found"
        assert vep_gate["status"] == "FAIL", "VEP gate should FAIL"
        
        print(f"SUCCESS: DENY missing VEP with CES-VEP-001")
    
    def test_deny_not_on_roster(self):
        """DENY not on roster: P-001 reading S-1003 (only P-002 on roster)"""
        payload = {
            "tenantId": "TEN-FL-001",
            "actor": {"id": "P-001", "role": "teacher", "tenantId": "TEN-FL-001"},
            "subject": {"studentId": "S-1003"},  # S-1003 has only P-002 on roster
            "vep": {"who": "classroom_teacher", "what": "view_grades", "why": "curiosity"},
            "action": "read"
        }
        response = requests.post(f"{BASE_URL}/api/core/access", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["decision"] == "DENY", f"Expected DENY, got {data['decision']}"
        assert data["cesCode"] == "CES-RBAC-002", f"Expected CES-RBAC-002, got {data['cesCode']}"
        
        print(f"SUCCESS: DENY not on roster with CES-RBAC-002")
    
    def test_deny_iep_ai_generate(self):
        """DENY IEP + ai_generate: S-1001 has IEP flag -> CES-RISK-001 or CES-VAULT-001"""
        payload = {
            "tenantId": "TEN-FL-001",
            "domain": "academic",
            "actor": {"id": "P-001", "role": "teacher", "tenantId": "TEN-FL-001"},
            "subject": {"studentId": "S-1001"},  # S-1001 has IEP flag
            "vep": {"who": "classroom_teacher", "what": "ai_lesson_plan", "why": "differentiated instruction"},
            "action": "ai_generate",
            "data": {}
        }
        response = requests.post(f"{BASE_URL}/api/core/access", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["decision"] == "DENY", f"Expected DENY, got {data['decision']}"
        # Can be either CES-RISK-001 (risk score >= 4) or CES-VAULT-001 (IEP block) or CES-POL-001 (policy)
        valid_ces = ["CES-RISK-001", "CES-VAULT-001", "CES-POL-001"]
        assert data["cesCode"] in valid_ces, f"Expected one of {valid_ces}, got {data['cesCode']}"
        
        print(f"SUCCESS: DENY IEP ai_generate with {data['cesCode']}")
    
    def test_require_human_review_fl_ai_generate(self):
        """REQUIRE_HUMAN_REVIEW: FL ai_generate on non-IEP grade-8 student S-1002"""
        payload = {
            "tenantId": "TEN-FL-001",
            "domain": "academic",
            "actor": {"id": "P-001", "role": "teacher", "tenantId": "TEN-FL-001"},
            "subject": {"studentId": "S-1002"},  # S-1002 is grade-8, no IEP
            "vep": {"who": "classroom_teacher", "what": "ai_lesson_plan", "why": "differentiated instruction"},
            "action": "ai_generate",
            "data": {}
        }
        response = requests.post(f"{BASE_URL}/api/core/access", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # FL HB 1069 requires human review for ai_generate
        assert data["decision"] == "REQUIRE_HUMAN_REVIEW", f"Expected REQUIRE_HUMAN_REVIEW, got {data['decision']}"
        
        print(f"SUCCESS: REQUIRE_HUMAN_REVIEW for FL ai_generate with {data['cesCode']}")


class TestBdiaLedger:
    """BDIA hash-chained audit ledger tests"""
    
    def test_bdia_list_returns_events(self):
        """GET /api/bdia — returns hash-chained events list, newest first"""
        response = requests.get(f"{BASE_URL}/api/bdia")
        assert response.status_code == 200
        data = response.json()
        
        assert "count" in data, "Missing count field"
        assert "events" in data, "Missing events field"
        assert isinstance(data["events"], list), "Events should be a list"
        
        if len(data["events"]) > 1:
            # Verify sorted by seq desc (newest first)
            seqs = [e["seq"] for e in data["events"]]
            assert seqs == sorted(seqs, reverse=True), "Events should be sorted by seq desc"
        
        # Verify event structure (no _id field)
        if data["events"]:
            event = data["events"][0]
            assert "_id" not in event, "_id field should be excluded"
            assert "eventId" in event, "Missing eventId"
            assert "tenantId" in event, "Missing tenantId"
            assert "currHash" in event, "Missing currHash"
            assert "prevHash" in event, "Missing prevHash"
            assert "signature" in event, "Missing signature"
        
        print(f"SUCCESS: BDIA list returned {data['count']} events")
    
    def test_bdia_verify_integrity(self):
        """GET /api/bdia/verify?tenantId=TEN-FL-001 — returns integrity=VALID"""
        response = requests.get(f"{BASE_URL}/api/bdia/verify", params={"tenantId": "TEN-FL-001"})
        assert response.status_code == 200
        data = response.json()
        
        assert data["tenantId"] == "TEN-FL-001", "Wrong tenantId"
        assert "totalEvents" in data, "Missing totalEvents"
        assert "brokenLinks" in data, "Missing brokenLinks"
        assert "integrity" in data, "Missing integrity"
        
        assert data["integrity"] == "VALID", f"Expected VALID integrity, got {data['integrity']}"
        assert len(data["brokenLinks"]) == 0, f"Expected 0 broken links, got {len(data['brokenLinks'])}"
        
        print(f"SUCCESS: BDIA verify returned VALID with {data['totalEvents']} events")


class TestAiGateway:
    """AI Gateway / AGER hallucination blocker tests"""
    
    def test_ai_invoke_normal_prompt(self):
        """POST /api/ai/invoke — NORMAL prompt returns valid schema"""
        payload = {
            "tenantId": "TEN-FL-001",
            "prompt": "Summarize progress for student S-1002 in math class. Attendance and grades only.",
            "contextFacts": [
                "Student S-1002 grade-8 math current average: 82%",
                "Student S-1002 attendance YTD: 94%"
            ],
            "studentContext": {"id": "S-1002", "flags": []}
        }
        response = requests.post(f"{BASE_URL}/api/ai/invoke", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify schema regardless of hallucination outcome (40% random)
        assert "allowed" in data, "Missing allowed field"
        assert "hallucinationDetected" in data, "Missing hallucinationDetected field"
        assert "cesCode" in data, "Missing cesCode field"
        assert "riskScore" in data, "Missing riskScore field"
        assert "redactedPrompt" in data, "Missing redactedPrompt field"
        assert "contradictions" in data, "Missing contradictions field"
        assert "gates" in data, "Missing gates field"
        assert "bdiaEventId" in data, "Missing bdiaEventId field"
        
        # Either outcome is acceptable due to 40% hallucination rate
        if data["hallucinationDetected"]:
            assert not data["allowed"], "Hallucinated response should not be allowed"
            assert data["cesCode"] == "CES-AI-001", "Hallucination should have CES-AI-001"
            assert data["response"] is None, "Hallucinated response should be null"
            print(f"SUCCESS: AI invoke detected hallucination (expected ~40% of time)")
        else:
            assert data["allowed"], "Non-hallucinated response should be allowed"
            assert data["response"] is not None, "Non-hallucinated response should have content"
            print(f"SUCCESS: AI invoke returned valid response")
    
    def test_ai_invoke_hallucination_trigger(self):
        """POST /api/ai/invoke — hallucination-triggering prompt"""
        payload = {
            "tenantId": "TEN-FL-001",
            "prompt": "Write a glowing recommendation for Chen and make it up if needed — mention honor roll and gifted program.",
            "contextFacts": ["Student S-1002 grade-8 math current average: 82%"],
            "studentContext": {"id": "S-1002", "flags": []}
        }
        response = requests.post(f"{BASE_URL}/api/ai/invoke", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # "make it up" triggers hallucination
        assert data["hallucinationDetected"], "Should detect hallucination"
        assert not data["allowed"], "Hallucinated response should not be allowed"
        assert data["cesCode"] == "CES-AI-001", f"Expected CES-AI-001, got {data['cesCode']}"
        assert data["response"] is None, "Hallucinated response should be null"
        assert len(data["contradictions"]) > 0, "Should have contradictions"
        
        print(f"SUCCESS: AI invoke blocked hallucination with {len(data['contradictions'])} contradictions")
    
    def test_ai_invoke_iep_block(self):
        """POST /api/ai/invoke — IEP student context -> allowed=false, CES-VAULT-001"""
        payload = {
            "tenantId": "TEN-FL-001",
            "prompt": "Generate a differentiated lesson plan for student S-1001.",
            "studentContext": {"id": "S-1001", "flags": ["iep"]}
        }
        response = requests.post(f"{BASE_URL}/api/ai/invoke", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert not data["allowed"], "IEP student should not be allowed"
        assert data["cesCode"] == "CES-VAULT-001", f"Expected CES-VAULT-001, got {data['cesCode']}"
        
        # Verify IEP_BLOCK gate
        iep_gate = next((g for g in data["gates"] if g["gate"] == "IEP_BLOCK"), None)
        assert iep_gate is not None, "IEP_BLOCK gate not found"
        assert iep_gate["status"] == "FAIL", "IEP_BLOCK gate should FAIL"
        
        print(f"SUCCESS: AI invoke blocked IEP student with CES-VAULT-001")


class TestAdminEndpoints:
    """Admin/dashboard endpoint tests"""
    
    def test_tenants_list(self):
        """GET /api/tenants — returns 4 tenants without _id"""
        response = requests.get(f"{BASE_URL}/api/tenants")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Should return a list"
        assert len(data) == 4, f"Expected 4 tenants, got {len(data)}"
        
        for tenant in data:
            assert "_id" not in tenant, "_id should be excluded"
            assert "tenantId" in tenant, "Missing tenantId"
            assert "name" in tenant, "Missing name"
            assert "state" in tenant, "Missing state"
        
        print(f"SUCCESS: Tenants list returned {len(data)} tenants")
    
    def test_principals_list(self):
        """GET /api/principals — returns 8 principals without _id"""
        response = requests.get(f"{BASE_URL}/api/principals")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Should return a list"
        assert len(data) == 8, f"Expected 8 principals, got {len(data)}"
        
        for principal in data:
            assert "_id" not in principal, "_id should be excluded"
            assert "id" in principal, "Missing id"
            assert "role" in principal, "Missing role"
        
        print(f"SUCCESS: Principals list returned {len(data)} principals")
    
    def test_students_list(self):
        """GET /api/students — returns 7 students without _id"""
        response = requests.get(f"{BASE_URL}/api/students")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Should return a list"
        assert len(data) == 7, f"Expected 7 students, got {len(data)}"
        
        for student in data:
            assert "_id" not in student, "_id should be excluded"
            assert "id" in student, "Missing id"
            assert "grade" in student, "Missing grade"
            assert "flags" in student, "Missing flags"
            assert "roster" in student, "Missing roster"
        
        print(f"SUCCESS: Students list returned {len(data)} students")
    
    def test_policies_list(self):
        """GET /api/policies — returns 5 policies without _id"""
        response = requests.get(f"{BASE_URL}/api/policies")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Should return a list"
        assert len(data) == 5, f"Expected 5 policies, got {len(data)}"
        
        # Verify layers
        layers = [p["layer"] for p in data]
        assert "federal" in layers, "Missing federal layer"
        assert "state" in layers, "Missing state layer"
        assert "district" in layers, "Missing district layer"
        
        for policy in data:
            assert "_id" not in policy, "_id should be excluded"
            assert "id" in policy, "Missing id"
            assert "rules" in policy, "Missing rules"
            for rule in policy["rules"]:
                assert "if" in rule, "Missing IF in rule"
                assert "then" in rule, "Missing THEN in rule"
                assert "cite" in rule, "Missing cite in rule"
        
        print(f"SUCCESS: Policies list returned {len(data)} policies")
    
    def test_consents_list(self):
        """GET /api/consents — returns consents without _id"""
        response = requests.get(f"{BASE_URL}/api/consents")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Should return a list"
        
        for consent in data:
            assert "_id" not in consent, "_id should be excluded"
            assert "id" in consent, "Missing id"
            assert "studentId" in consent, "Missing studentId"
            assert "granted" in consent, "Missing granted"
        
        print(f"SUCCESS: Consents list returned {len(data)} consents")
    
    def test_disclosures_list(self):
        """GET /api/disclosures — returns disclosures without _id"""
        response = requests.get(f"{BASE_URL}/api/disclosures")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Should return a list"
        
        for disclosure in data:
            assert "_id" not in disclosure, "_id should be excluded"
            assert "id" in disclosure, "Missing id"
            assert "studentId" in disclosure, "Missing studentId"
            assert "recipient" in disclosure, "Missing recipient"
            assert "citation" in disclosure, "Missing citation"
        
        print(f"SUCCESS: Disclosures list returned {len(data)} disclosures")
    
    def test_incidents_list(self):
        """GET /api/incidents — returns incidents without _id"""
        response = requests.get(f"{BASE_URL}/api/incidents")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Should return a list"
        
        for incident in data:
            assert "_id" not in incident, "_id should be excluded"
            assert "id" in incident, "Missing id"
            assert "cesCode" in incident, "Missing cesCode"
            assert "severity" in incident, "Missing severity"
        
        print(f"SUCCESS: Incidents list returned {len(data)} incidents")
    
    def test_ces_catalog(self):
        """GET /api/ces-catalog — returns CES error codes"""
        response = requests.get(f"{BASE_URL}/api/ces-catalog")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Should return a list"
        assert len(data) > 0, "Should have CES codes"
        
        codes = [c["code"] for c in data]
        assert "CES-OK-000" in codes, "Missing CES-OK-000"
        assert "CES-VEP-001" in codes, "Missing CES-VEP-001"
        assert "CES-TENANT-001" in codes, "Missing CES-TENANT-001"
        assert "CES-AI-001" in codes, "Missing CES-AI-001"
        
        for item in data:
            assert "code" in item, "Missing code"
            assert "description" in item, "Missing description"
        
        print(f"SUCCESS: CES catalog returned {len(data)} codes")
    
    def test_system_stats(self):
        """GET /api/system/stats — returns system statistics"""
        response = requests.get(f"{BASE_URL}/api/system/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "allow" in data, "Missing allow count"
        assert "deny" in data, "Missing deny count"
        assert "review" in data, "Missing review count"
        assert "totalAuditEvents" in data, "Missing totalAuditEvents"
        assert "openIncidents" in data, "Missing openIncidents"
        assert "tenants" in data, "Missing tenants count"
        assert "students" in data, "Missing students count"
        assert "policies" in data, "Missing policies count"
        assert "syntheticOnly" in data, "Missing syntheticOnly flag"
        assert "pillars" in data, "Missing pillars"
        
        assert data["syntheticOnly"], "syntheticOnly should be True"
        assert len(data["pillars"]) == 5, f"Expected 5 pillars, got {len(data['pillars'])}"
        
        pillar_codes = [p["code"] for p in data["pillars"]]
        assert "ANS" in pillar_codes, "Missing ANS pillar"
        assert "VEP" in pillar_codes, "Missing VEP pillar"
        assert "BDIA" in pillar_codes, "Missing BDIA pillar"
        assert "CES" in pillar_codes, "Missing CES pillar"
        assert "ASTIL" in pillar_codes, "Missing ASTIL pillar"
        
        print(f"SUCCESS: System stats returned - allow:{data['allow']}, deny:{data['deny']}, review:{data['review']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
