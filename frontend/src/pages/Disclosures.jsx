import React, { useEffect, useState } from "react";
import { fetchDisclosures, fetchConsents } from "../api";
import { Panel, Overline, StatusBadge, Hash, EmptyState } from "../components/ui-parts";

export default function Disclosures() {
  const [disclosures, setD] = useState([]);
  const [consents, setC] = useState([]);
  useEffect(() => {
    fetchDisclosures().then(setD);
    fetchConsents().then(setC);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div data-testid="disclosures-page">
      <div style={{ padding: "32px 40px 18px", borderBottom: "1px solid var(--border)" }}>
        <Overline>FERPA §99.32 · Disclosure Log · COPPA Consent Grants</Overline>
        <h1 className="font-heading" style={{ fontWeight: 900, fontSize: 36, letterSpacing: "-0.02em", marginTop: 8 }}>
          Disclosures &amp; Consents
        </h1>
        <p style={{ color: "var(--fg-2)", marginTop: 6, fontSize: 14 }}>
          FERPA 34 CFR §99.32 requires a record of each disclosure of PII. COPPA §312.5 requires verifiable parental consent.
        </p>
      </div>

      <div style={{ padding: 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Panel title="Disclosures · 34 CFR §99.32" testId="disclosures-panel">
          {disclosures.length === 0 ? <EmptyState label="no disclosures"/> : (
            <table className="dt">
              <thead><tr><th>ID</th><th>Tenant</th><th>Student</th><th>Recipient</th><th>Reason</th><th>Date</th><th>Citation</th></tr></thead>
              <tbody>
                {disclosures.map(d => (
                  <tr key={d.id}>
                    <td><Hash value={d.id} chars={4}/></td>
                    <td className="hash">{d.tenantId}</td>
                    <td className="hash">{d.studentId}</td>
                    <td style={{fontSize:12, color:"var(--fg-2)"}}>{d.recipient}</td>
                    <td style={{fontSize:12, color:"var(--fg-2)"}}>{d.reason}</td>
                    <td className="hash">{d.date}</td>
                    <td className="hash">{d.citation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Consents · COPPA / District" testId="consents-panel">
          {consents.length === 0 ? <EmptyState label="no consents"/> : (
            <table className="dt">
              <thead><tr><th>ID</th><th>Tenant</th><th>Student</th><th>Type</th><th>Scope</th><th>Granted</th><th>Date</th></tr></thead>
              <tbody>
                {consents.map(c => (
                  <tr key={c.id}>
                    <td><Hash value={c.id} chars={4}/></td>
                    <td className="hash">{c.tenantId}</td>
                    <td className="hash">{c.studentId}</td>
                    <td className="hash">{c.type}</td>
                    <td className="hash">{c.scope}</td>
                    <td><StatusBadge value={c.granted ? "ALLOW" : "DENY"}/></td>
                    <td className="hash">{c.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
