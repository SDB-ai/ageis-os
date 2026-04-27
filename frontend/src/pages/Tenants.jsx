import React, { useEffect, useState } from "react";
import { fetchTenants, fetchPrincipals, fetchStudents } from "../api";
import { Panel, Overline, StatusBadge, Hash } from "../components/ui-parts";
import { Buildings } from "@phosphor-icons/react";

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [principals, setPrincipals] = useState([]);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    fetchTenants().then(t => { setTenants(t); if (t[0]) setSelected(t[0].tenantId); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selected) return;
    fetchPrincipals(selected).then(setPrincipals);
    fetchStudents(selected).then(setStudents);
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div data-testid="tenants-page">
      <div style={{ padding: "32px 40px 18px", borderBottom: "1px solid var(--border)" }}>
        <Overline>ASTIL · Advanced Secure Tenant Isolation Layers</Overline>
        <h1 className="font-heading" style={{ fontWeight: 900, fontSize: 36, letterSpacing: "-0.02em", marginTop: 8 }}>
          Tenants (Districts)
        </h1>
        <p style={{ color: "var(--fg-2)", marginTop: 6, fontSize: 14 }}>
          Each district receives its own encryption keys, TOKV vault, BDIA chain, and data residency region.
        </p>
      </div>

      <div style={{ padding: 40, display: "grid", gridTemplateColumns: "1fr 2fr", gap: 18 }}>
        <Panel title="Districts" testId="tenants-panel">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tenants.map(t => (
              <button key={t.tenantId} onClick={() => setSelected(t.tenantId)}
                className={`navlink ${selected===t.tenantId?"active":""}`}
                style={{ border: "1px solid var(--border)", background: selected===t.tenantId ? "rgba(34,197,94,0.04)" : "#0c0c0e", justifyContent: "flex-start" }}
                data-testid={`tenant-${t.tenantId}`}>
                <Buildings size={14} weight="bold"/>
                <div style={{ textAlign: "left", textTransform: "none", letterSpacing: 0, fontFamily: "IBM Plex Sans, sans-serif", fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div style={{ color: "var(--fg-3)", fontFamily: "JetBrains Mono, monospace", fontSize: 10, marginTop: 2 }}>
                    {t.tenantId} · {t.state} · {t.residency}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Panel title={`Principals · ${selected || ""}`}>
            <table className="dt" data-testid="principals-table">
              <thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Email</th><th>ASTIL</th></tr></thead>
              <tbody>
                {principals.map(p => (
                  <tr key={p.id}>
                    <td className="hash">{p.id}</td>
                    <td style={{fontSize:13}}>{p.name}</td>
                    <td><span className="tag">{p.role}</span></td>
                    <td className="hash">{p.email}</td>
                    <td><StatusBadge value="VALID"/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title={`Students · ${selected || ""}`}>
            <table className="dt" data-testid="students-table">
              <thead><tr><th>ID</th><th>Grade</th><th>Flags</th><th>Roster (principals)</th></tr></thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td className="hash">{s.id}</td>
                    <td className="hash">{s.grade}</td>
                    <td>{s.flags.length === 0 ? <span className="hash" style={{color:"var(--fg-3)"}}>—</span> : s.flags.map(f => <span key={f} className="tag" style={{color: f==="iep"?"#F59E0B":"var(--fg-2)"}}>{f}</span>)}</td>
                    <td>{s.roster.map(r => <span key={r} className="tag">{r}</span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      </div>
    </div>
  );
}
