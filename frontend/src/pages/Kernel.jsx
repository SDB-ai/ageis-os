import React, { useState } from "react";
import { submitAccess } from "../api";
import { StatusBadge, Overline, Hash, Panel } from "../components/ui-parts";
import { Lightning, CaretRight } from "@phosphor-icons/react";

const SCENARIOS = {
  allow_normal: {
    label: "ALLOW · Teacher reads own roster student",
    body: {
      tenantId: "TEN-FL-001",
      domain: "academic",
      actor: { id: "P-001", role: "teacher", tenantId: "TEN-FL-001" },
      subject: { studentId: "S-1002" },
      vep: { who: "classroom_teacher", what: "view_grades", why: "weekly progress review" },
      action: "read",
      data: {},
      context: {},
    },
  },
  deny_iep_ai: {
    label: "DENY · AI generate on IEP student (IDEA §300.622)",
    body: {
      tenantId: "TEN-FL-001",
      domain: "academic",
      actor: { id: "P-001", role: "teacher", tenantId: "TEN-FL-001" },
      subject: { studentId: "S-1001" },
      vep: { who: "classroom_teacher", what: "ai_lesson_plan", why: "differentiated instruction" },
      action: "ai_generate",
      data: {},
    },
  },
  review_fl_ai: {
    label: "REVIEW · AI generate in FL district (HB 1069)",
    body: {
      tenantId: "TEN-FL-001",
      domain: "academic",
      actor: { id: "P-001", role: "teacher", tenantId: "TEN-FL-001" },
      subject: { studentId: "S-1002" },
      vep: { who: "classroom_teacher", what: "ai_lesson_plan", why: "differentiated instruction" },
      action: "ai_generate",
      data: {},
    },
  },
  deny_cross_tenant: {
    label: "DENY · Cross-tenant (ASTIL violation)",
    body: {
      tenantId: "TEN-FL-001",
      domain: "academic",
      actor: { id: "P-005", role: "teacher", tenantId: "TEN-CA-001" },
      subject: { studentId: "S-1002" },
      vep: { who: "classroom_teacher", what: "view_grades", why: "external inquiry" },
      action: "read",
    },
  },
  deny_no_vep: {
    label: "DENY · Missing VEP",
    body: {
      tenantId: "TEN-FL-001",
      actor: { id: "P-001", role: "teacher", tenantId: "TEN-FL-001" },
      subject: { studentId: "S-1002" },
      vep: { who: "", what: "", why: "" },
      action: "read",
    },
  },
  deny_no_roster: {
    label: "DENY · Teacher not on roster",
    body: {
      tenantId: "TEN-FL-001",
      actor: { id: "P-001", role: "teacher", tenantId: "TEN-FL-001" },
      subject: { studentId: "S-1003" },
      vep: { who: "classroom_teacher", what: "view_grades", why: "curiosity" },
      action: "read",
    },
  },
};

export default function Kernel() {
  const [key, setKey] = useState("allow_normal");
  const [payload, setPayload] = useState(JSON.stringify(SCENARIOS.allow_normal.body, null, 2));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const pick = (k) => {
    setKey(k);
    setPayload(JSON.stringify(SCENARIOS[k].body, null, 2));
    setResult(null);
    setErr(null);
  };

  const run = async () => {
    setErr(null);
    setLoading(true);
    try {
      const body = JSON.parse(payload);
      const r = await submitAccess(body);
      setResult(r);
    } catch (e) {
      setErr(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="kernel-page">
      <div style={{ padding: "32px 40px 18px", borderBottom: "1px solid var(--border)" }}>
        <Overline>Core Kernel · POST /api/core/access</Overline>
        <h1 className="font-heading" style={{ fontWeight: 900, fontSize: 36, letterSpacing: "-0.02em", marginTop: 8 }}>
          Access Playground
        </h1>
        <p style={{ color: "var(--fg-2)", marginTop: 6, fontSize: 14 }}>
          Submit an AccessRequest. The kernel evaluates every gate in sequence and seals the decision into the immutable BDIA audit ledger.
        </p>
      </div>

      <div style={{ padding: 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Panel title="Request Payload" testId="kernel-request-panel" right={
          <button className="btn" onClick={run} disabled={loading} data-testid="submit-access-request">
            <Lightning size={12} weight="bold"/> {loading ? "Running…" : "Execute"}
          </button>
        }>
          <div style={{ marginBottom: 12 }}>
            <div className="overline" style={{ marginBottom: 6 }}>Scenarios</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(SCENARIOS).map(([k, s]) => (
                <button key={k} onClick={() => pick(k)} className={`navlink ${key===k?"active":""}`}
                  style={{ border: "1px solid var(--border)", background: key===k ? "rgba(34,197,94,0.04)" : "#0c0c0e", justifyContent: "space-between" }}
                  data-testid={`scenario-${k}`}>
                  <span style={{textTransform:"none", letterSpacing:0, fontFamily:"IBM Plex Sans, sans-serif", fontSize:12}}>{s.label}</span>
                  <CaretRight size={12}/>
                </button>
              ))}
            </div>
          </div>
          <textarea className="field" value={payload} onChange={(e)=>setPayload(e.target.value)} data-testid="request-payload-textarea"/>
          {err && <div style={{ marginTop: 10, color: "var(--deny)", fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>! {err}</div>}
        </Panel>

        <Panel title={result ? `Decision · ${result.requestId}` : "Decision"} testId="kernel-decision-panel"
          right={result ? <StatusBadge value={result.decision}/> : null}>
          {!result ? (
            <div style={{ color: "var(--fg-3)", fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>
              Awaiting request… select a scenario and press Execute.
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
                <div style={{ border: "1px solid var(--border)", padding: 10 }}>
                  <div className="overline">CES</div>
                  <div className="hash" style={{ color: "var(--fg)", marginTop: 4 }}>{result.cesCode}</div>
                </div>
                <div style={{ border: "1px solid var(--border)", padding: 10 }}>
                  <div className="overline">Risk Score</div>
                  <div className="font-heading" style={{ fontWeight: 900, fontSize: 24, marginTop: 2, color: result.riskScore >= 4 ? "var(--deny)" : "var(--allow)" }}>{result.riskScore}</div>
                </div>
                <div style={{ border: "1px solid var(--border)", padding: 10 }}>
                  <div className="overline">BDIA Event</div>
                  <div style={{ marginTop: 4 }}><Hash value={result.bdiaEventId} chars={6}/></div>
                </div>
              </div>

              <div className="overline" style={{ marginBottom: 8 }}>Gate Pipeline</div>
              <div data-testid="gate-pipeline">
                {result.gates.map((g, i) => (
                  <div key={`${g.gate}-${i}`} className="gate-row" data-testid={`gate-${g.gate}`}>
                    <div className="n">{String(i+1).padStart(2,"0")}</div>
                    <div>
                      <div className="t">{g.gate}</div>
                      <div className="d">{g.detail}</div>
                      {g.evidence && Object.keys(g.evidence).length > 0 && (
                        <div style={{ marginTop: 6, padding: 8, background: "#0c0c0e", border: "1px solid var(--border)", fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--fg-3)", maxHeight: 120, overflow: "auto" }}>
                          {JSON.stringify(g.evidence, null, 2)}
                        </div>
                      )}
                    </div>
                    <StatusBadge value={g.status}/>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
