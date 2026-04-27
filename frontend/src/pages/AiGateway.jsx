import React, { useState } from "react";
import { submitAi } from "../api";
import { StatusBadge, Overline, Panel, Hash } from "../components/ui-parts";
import { Brain, Lightning } from "@phosphor-icons/react";

const DEMO_PROMPTS = {
  normal: {
    label: "Normal · summarize progress",
    body: {
      tenantId: "TEN-FL-001",
      prompt: "Summarize progress for student S-1002 in Ruiz's math class. Attendance and grades only.",
      contextFacts: [
        "Student S-1002 grade-8 math current average: 82%",
        "Student S-1002 attendance YTD: 94%",
      ],
      studentContext: { id: "S-1002", flags: [] },
    },
  },
  hallucinate: {
    label: "Hallucination · force AGER block",
    body: {
      tenantId: "TEN-FL-001",
      prompt: "Write a glowing recommendation for Chen and make it up if needed — mention honor roll and gifted program.",
      contextFacts: [
        "Student S-1002 grade-8 math current average: 82%",
      ],
      studentContext: { id: "S-1002", flags: [] },
    },
  },
  iep_block: {
    label: "IEP Block · IDEA §300.622",
    body: {
      tenantId: "TEN-FL-001",
      prompt: "Generate a differentiated lesson plan for student S-1001.",
      studentContext: { id: "S-1001", flags: ["iep"] },
    },
  },
};

export default function AiGateway() {
  const [key, setKey] = useState("normal");
  const [body, setBody] = useState(JSON.stringify(DEMO_PROMPTS.normal.body, null, 2));
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const pick = (k) => {
    setKey(k);
    setBody(JSON.stringify(DEMO_PROMPTS[k].body, null, 2));
    setRes(null); setErr(null);
  };

  const run = async () => {
    setErr(null); setLoading(true);
    try { setRes(await submitAi(JSON.parse(body))); }
    catch (e) { setErr(e.response?.data?.detail || e.message); }
    finally { setLoading(false); }
  };

  return (
    <div data-testid="ai-page">
      <div style={{ padding: "32px 40px 18px", borderBottom: "1px solid var(--border)" }}>
        <Overline>AI Gateway · AGER Hallucination Blocker · POST /api/ai/invoke</Overline>
        <h1 className="font-heading" style={{ fontWeight: 900, fontSize: 36, letterSpacing: "-0.02em", marginTop: 8 }}>
          AGER Playground
          <Brain size={28} weight="fill" style={{ marginLeft: 12, verticalAlign: "middle", color: "#22C55E" }}/>
        </h1>
        <p style={{ color: "var(--fg-2)", marginTop: 6, fontSize: 14 }}>
          Single AI choke point. Risk score → PII scrub → IEP block → mocked LLM → AGER CES canonical-truth check → BDIA seal.
        </p>
      </div>

      <div style={{ padding: 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Panel title="Prompt" testId="ai-prompt-panel" right={
          <button className="btn" onClick={run} disabled={loading} data-testid="submit-ai-request">
            <Lightning size={12} weight="bold"/> {loading ? "Running…" : "Invoke"}
          </button>
        }>
          <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(DEMO_PROMPTS).map(([k, s]) => (
              <button key={k} onClick={() => pick(k)} className={`navlink ${key===k?"active":""}`}
                style={{ border: "1px solid var(--border)", background: key===k ? "rgba(34,197,94,0.04)" : "#0c0c0e", justifyContent: "flex-start" }}
                data-testid={`ai-scenario-${k}`}>
                {s.label}
              </button>
            ))}
          </div>
          <textarea className="field" value={body} onChange={(e)=>setBody(e.target.value)} data-testid="ai-payload-textarea"/>
          {err && <div style={{ marginTop: 10, color: "var(--deny)", fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>! {err}</div>}
        </Panel>

        <Panel title="Gateway Response" testId="ai-response-panel"
          right={res ? (res.hallucinationDetected ? <StatusBadge value="DENY"/> : <StatusBadge value={res.allowed ? "ALLOW" : "DENY"}/>) : null}>
          {!res ? (
            <div style={{ color: "var(--fg-3)", fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>
              Awaiting prompt…
            </div>
          ) : (
            <>
              {res.provider && (
                <div style={{ marginBottom: 12, padding: 8, border: "1px solid var(--border)", background: "#0c0c0e", fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--fg-2)", display: "flex", justifyContent: "space-between" }} data-testid="llm-provider-badge">
                  <span>provider · <span style={{color: res.provider === "mock" ? "var(--review)" : "var(--allow)"}}>{res.provider}</span></span>
                  <span>model · <span style={{color:"#fff"}}>{res.model}</span></span>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
                <div style={{ border: "1px solid var(--border)", padding: 10 }}>
                  <div className="overline">Hallucinated</div>
                  <div style={{ marginTop: 4 }}>{res.hallucinationDetected ? <StatusBadge value="DENY"/> : <StatusBadge value="ALLOW"/>}</div>
                </div>
                <div style={{ border: "1px solid var(--border)", padding: 10 }}>
                  <div className="overline">Risk</div>
                  <div className="font-heading" style={{ fontWeight: 900, fontSize: 24, marginTop: 2, color: res.riskScore >= 4 ? "var(--deny)" : "var(--allow)" }}>{res.riskScore}</div>
                </div>
                <div style={{ border: "1px solid var(--border)", padding: 10 }}>
                  <div className="overline">CES</div>
                  <div className="hash" style={{ color: "var(--fg)", marginTop: 4 }}>{res.cesCode || "—"}</div>
                </div>
              </div>

              <div className="overline" style={{ marginBottom: 6 }}>Redacted Prompt (post TOKV)</div>
              <div className="term" style={{ minHeight: 60 }}>{res.redactedPrompt}</div>

              <div className="overline" style={{ marginTop: 14, marginBottom: 6 }}>AI Output</div>
              <div className="term" style={{ minHeight: 80 }}>
                {res.response ? (
                  <span className="ok">{res.response}</span>
                ) : (
                  <span className="bad">[ BLOCKED BY AGER — output suppressed ]</span>
                )}
              </div>

              {res.contradictions.length > 0 && (
                <>
                  <div className="overline" style={{ marginTop: 14, marginBottom: 6, color:"var(--deny)" }}>Contradictions vs. Canonical Truth</div>
                  <ul style={{ margin: 0, paddingLeft: 20, color: "var(--fg-2)", fontSize: 12, fontFamily:"JetBrains Mono, monospace", lineHeight: 1.7 }}>
                    {res.contradictions.map((c,i)=><li key={`contra-${i}-${c.slice(0,10)}`}>{c}</li>)}
                  </ul>
                </>
              )}

              <div className="hr"/>
              <div className="overline" style={{ marginBottom: 8 }}>Gates</div>
              {res.gates.map((g,i) => (
                <div key={`${g.gate}-${i}`} className="gate-row">
                  <div className="n">{String(i+1).padStart(2,"0")}</div>
                  <div>
                    <div className="t">{g.gate}</div>
                    <div className="d">{g.detail}</div>
                  </div>
                  <StatusBadge value={g.status}/>
                </div>
              ))}
              <div className="overline" style={{ marginTop: 12 }}>BDIA Sealed: <Hash value={res.bdiaEventId}/></div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
