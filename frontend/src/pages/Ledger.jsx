import React, { useEffect, useState, useCallback } from "react";
import { fetchBdia, fetchTenants, verifyBdia } from "../api";
import { StatusBadge, Overline, Hash, Panel, EmptyState } from "../components/ui-parts";
import { ShieldCheck, ArrowClockwise } from "@phosphor-icons/react";

export default function Ledger() {
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState("");
  const [decision, setDecision] = useState("");
  const [events, setEvents] = useState([]);
  const [verify, setVerify] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchBdia({ tenantId: tenantId || undefined, decision: decision || undefined, limit: 500 });
      setEvents(r.events);
    } finally { setLoading(false); }
  }, [tenantId, decision]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchTenants().then(setTenants); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const runVerify = async () => {
    if (!tenantId) return alert("Select a tenant first");
    const r = await verifyBdia(tenantId);
    setVerify(r);
  };

  return (
    <div data-testid="ledger-page">
      <div style={{ padding: "32px 40px 18px", borderBottom: "1px solid var(--border)" }}>
        <Overline>BDIA · Batch Decryption / Individual Audit · SHA-256 hash-chain + HMAC</Overline>
        <h1 className="font-heading" style={{ fontWeight: 900, fontSize: 36, letterSpacing: "-0.02em", marginTop: 8 }}>
          Immutable Audit Ledger
        </h1>
        <p style={{ color: "var(--fg-2)", marginTop: 6, fontSize: 14 }}>
          Every access decision is append-only, cryptographically chained, and signed. Verify integrity at any time.
        </p>
      </div>

      <div style={{ padding: 40 }}>
        <div className="row-inline" style={{ marginBottom: 18 }}>
          <select className="field" style={{ width: 300 }} value={tenantId} onChange={(e)=>setTenantId(e.target.value)} data-testid="ledger-tenant-filter">
            <option value="">ALL TENANTS</option>
            {tenants.map(t => <option key={t.tenantId} value={t.tenantId}>{t.tenantId} · {t.name}</option>)}
          </select>
          <select className="field" style={{ width: 240 }} value={decision} onChange={(e)=>setDecision(e.target.value)} data-testid="ledger-decision-filter">
            <option value="">ALL DECISIONS</option>
            <option value="ALLOW">ALLOW</option>
            <option value="DENY">DENY</option>
            <option value="REQUIRE_CONSENT">REQUIRE_CONSENT</option>
            <option value="REQUIRE_HUMAN_REVIEW">REQUIRE_HUMAN_REVIEW</option>
          </select>
          <button className="btn btn-ghost" onClick={load} data-testid="ledger-refresh"><ArrowClockwise size={12} weight="bold"/> Refresh</button>
          <button className="btn" onClick={runVerify} data-testid="ledger-verify"><ShieldCheck size={12} weight="bold"/> Verify Chain</button>
          {verify && (
            <div className="row-inline" style={{ marginLeft: "auto" }}>
              <span className="overline">Integrity</span>
              <StatusBadge value={verify.integrity}/>
              <span className="hash">{verify.totalEvents} event(s) · {verify.brokenLinks.length} broken</span>
            </div>
          )}
        </div>

        <Panel title={`Ledger Events · ${events.length}`}>
          {events.length === 0 ? <EmptyState label={loading ? "loading" : "no events yet — run requests in the Kernel Playground"}/> : (
            <div style={{ overflowX: "auto" }}>
            <table className="dt" data-testid="ledger-table">
              <thead>
                <tr>
                  <th>SEQ</th><th>EVENT ID</th><th>Tenant</th><th>Timestamp</th>
                  <th>Who</th><th>What</th><th>Why</th><th>Decision</th><th>CES</th><th>Risk</th>
                  <th>prev</th><th>curr</th><th>HMAC</th>
                </tr>
              </thead>
              <tbody>
                {events.map(e => (
                  <tr key={e.eventId}>
                    <td className="hash">#{e.seq}</td>
                    <td><Hash value={e.eventId} chars={6}/></td>
                    <td className="hash">{e.tenantId}</td>
                    <td className="hash">{e.timestamp?.slice(0,19).replace("T"," ")}</td>
                    <td className="hash">{e.who}</td>
                    <td style={{fontSize:12, color:"var(--fg-2)"}}>{e.what}</td>
                    <td style={{fontSize:12, color:"var(--fg-2)", maxWidth:180}}>{e.why}</td>
                    <td><StatusBadge value={e.decision}/></td>
                    <td className="hash">{e.cesCode}</td>
                    <td className="hash" style={{color: e.riskScore >= 4 ? "var(--deny)" : "var(--fg-2)"}}>{e.riskScore}</td>
                    <td><Hash value={e.prevHash} chars={5}/></td>
                    <td><Hash value={e.currHash} chars={5}/></td>
                    <td><Hash value={e.signature} chars={5}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
