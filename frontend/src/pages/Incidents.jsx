import React, { useEffect, useState } from "react";
import { fetchIncidents, fetchCes } from "../api";
import { Panel, Overline, StatusBadge, Hash, EmptyState } from "../components/ui-parts";

export default function Incidents() {
  const [items, setItems] = useState([]);
  const [ces, setCes] = useState([]);

  useEffect(() => {
    fetchIncidents({ limit: 500 }).then(setItems);
    fetchCes().then(setCes);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div data-testid="incidents-page">
      <div style={{ padding: "32px 40px 18px", borderBottom: "1px solid var(--border)" }}>
        <Overline>CES · Canonical Error Signaling · Incident Register</Overline>
        <h1 className="font-heading" style={{ fontWeight: 900, fontSize: 36, letterSpacing: "-0.02em", marginTop: 8 }}>
          Incidents
        </h1>
        <p style={{ color: "var(--fg-2)", marginTop: 6, fontSize: 14 }}>
          Every DENY, REQUIRE_CONSENT, REQUIRE_HUMAN_REVIEW, and AGER hallucination block opens an incident.
        </p>
      </div>

      <div style={{ padding: 40, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18 }}>
        <Panel title={`Open Incidents · ${items.length}`} testId="incidents-panel">
          {items.length === 0 ? <EmptyState label="no incidents — all clear"/> : (
            <table className="dt" data-testid="incidents-table">
              <thead><tr>
                <th>ID</th><th>Tenant</th><th>Severity</th><th>Decision</th><th>CES</th><th>Summary</th><th>Timestamp</th><th>Status</th>
              </tr></thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.id}>
                    <td><Hash value={i.id} chars={6}/></td>
                    <td className="hash">{i.tenantId}</td>
                    <td><StatusBadge value={i.severity}/></td>
                    <td><StatusBadge value={i.decision}/></td>
                    <td className="hash">{i.cesCode}</td>
                    <td style={{fontSize:12, color:"var(--fg-2)", maxWidth:320}}>{i.summary}</td>
                    <td className="hash">{i.timestamp?.slice(0,19).replace("T"," ")}</td>
                    <td><StatusBadge value={i.status}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="CES Error Catalog" testId="ces-catalog-panel">
          <table className="dt">
            <thead><tr><th>Code</th><th>Description</th></tr></thead>
            <tbody>
              {ces.map(c => (
                <tr key={c.code}>
                  <td className="hash" style={{whiteSpace:"nowrap", color: c.code === "CES-OK-000" ? "var(--allow)" : "var(--fg)"}}>{c.code}</td>
                  <td style={{fontSize:12, color:"var(--fg-2)"}}>{c.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
