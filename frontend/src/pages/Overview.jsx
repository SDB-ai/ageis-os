import React, { useEffect, useState } from "react";
import { fetchStats, fetchIncidents } from "../api";
import { Kpi, Panel, Overline, StatusBadge } from "../components/ui-parts";
import { ShieldCheck, Lock, Stack, Brain, Buildings } from "@phosphor-icons/react";

const PILLAR_ICON = { ANS: Lock, VEP: ShieldCheck, BDIA: Stack, CES: Brain, ASTIL: Buildings };

export default function Overview() {
  const [stats, setStats] = useState(null);
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    fetchStats().then(setStats);
    fetchIncidents({ limit: 5 }).then(setIncidents);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!stats) return null;

  return (
    <div data-testid="overview-page">
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 0, borderBottom: "1px solid var(--border)" }}>
        <div style={{ padding: "40px 40px 30px" }}>
          <Overline>System Overview / Aegis-OS Kernel v0.1.0-demo</Overline>
          <h1 className="font-heading" style={{ fontWeight: 900, fontSize: 48, letterSpacing: "-0.03em", marginTop: 12, lineHeight: 1 }}>
            Compliance by architecture,<br/>
            <span style={{ color: "#22C55E" }}>not by policy.</span>
          </h1>
          <p style={{ color: "var(--fg-2)", marginTop: 18, maxWidth: 620, fontSize: 15, lineHeight: 1.6 }}>
            A demo prototype of the K-12 compliance kernel: every student-data request passes the VEP triple-check,
            risk scoring, federal → state → district policy layering, vault tokenization, AGER hallucination
            blocking, and a hash-chained BDIA audit ledger. All data is synthetic.
          </p>
          <div className="row-inline" style={{ marginTop: 24 }}>
            <StatusBadge value="ALLOW"/>
            <StatusBadge value="DENY"/>
            <StatusBadge value="REQUIRE_HUMAN_REVIEW"/>
            <StatusBadge value="REQUIRE_CONSENT"/>
          </div>
          <a
            href="/aegis-os.zip"
            download="aegis-os.zip"
            data-testid="download-source-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              marginTop: 28,
              padding: "14px 22px",
              background: "#22C55E",
              color: "#0a0a0a",
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: "0.02em",
              textDecoration: "none",
              border: "1px solid #22C55E",
              borderRadius: 2,
              fontFamily: "JetBrains Mono, monospace",
              textTransform: "uppercase",
            }}
          >
            <Stack size={18} weight="fill" />
            Download Source Code (.zip · 217 KB)
          </a>
          <div style={{ color: "var(--fg-3)", fontSize: 11, marginTop: 10, fontFamily: "JetBrains Mono, monospace" }}>
            37 files · backend + frontend · ready for Railway deploy
          </div>
        </div>
        <div style={{ borderLeft: "1px solid var(--border)", padding: 30, display: "flex", flexDirection: "column", justifyContent: "flex-end", background: "linear-gradient(180deg,#0c0c0e 0%,#18181B 100%)" }}>
          <Overline>Kernel Status</Overline>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "var(--fg-2)", marginTop: 14, lineHeight: 2 }}>
            <div>synthetic-only ............ <span style={{color:"#22C55E"}}>ENGAGED</span></div>
            <div>locked-by-default ......... <span style={{color:"#22C55E"}}>ENFORCED</span></div>
            <div>bdia-audit-coupling ....... <span style={{color:"#22C55E"}}>ACTIVE</span></div>
            <div>single-ai-gateway ......... <span style={{color:"#22C55E"}}>ACTIVE</span></div>
            <div>tenant-isolation (ASTIL) .. <span style={{color:"#22C55E"}}>ACTIVE</span></div>
          </div>
        </div>
      </div>

      <div style={{ padding: 40 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <Kpi testId="kpi-allow" label="Allow Decisions" value={stats.allow} hint="BDIA sealed" />
          <Kpi testId="kpi-deny" label="Deny Decisions" value={stats.deny} hint="Fail-closed" />
          <Kpi testId="kpi-review" label="Review / Consent" value={stats.review} hint="Human-in-loop" />
          <Kpi testId="kpi-incidents" label="Open Incidents" value={stats.openIncidents} hint="CES escalations" />
        </div>

        <div style={{ marginTop: 32 }}>
          <Overline>The Five Pillars</Overline>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginTop: 14 }}>
            {stats.pillars.map(p => {
              const Ico = PILLAR_ICON[p.code] || ShieldCheck;
              return (
                <div key={p.code} className="panel" style={{ padding: 18 }} data-testid={`pillar-${p.code}`}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Ico size={22} weight="fill" color="#22C55E" />
                    <span className="badge badge-allow">{p.status}</span>
                  </div>
                  <div className="font-heading" style={{ fontWeight: 700, fontSize: 22, marginTop: 14, letterSpacing: "-0.02em" }}>{p.code}</div>
                  <div style={{ color: "var(--fg-2)", fontSize: 12, marginTop: 4, fontWeight: 500 }}>{p.name}</div>
                  <div style={{ color: "var(--fg-3)", fontSize: 11, marginTop: 8, lineHeight: 1.5, fontFamily: "JetBrains Mono, monospace" }}>
                    {p.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          <Panel title="Recent Incidents" testId="recent-incidents">
            {incidents.length === 0 ? (
              <div style={{ color: "var(--fg-3)", fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>
                No incidents yet. Run a few access requests in the Kernel playground.
              </div>
            ) : (
              <table className="dt">
                <thead><tr><th>ID</th><th>Tenant</th><th>Decision</th><th>CES</th><th>Severity</th><th>Summary</th></tr></thead>
                <tbody>
                  {incidents.map(i => (
                    <tr key={i.id}>
                      <td className="hash">{i.id}</td>
                      <td className="hash">{i.tenantId}</td>
                      <td><StatusBadge value={i.decision}/></td>
                      <td className="hash">{i.cesCode}</td>
                      <td><StatusBadge value={i.severity}/></td>
                      <td style={{ color: "var(--fg-2)", fontSize: 12 }}>{i.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Corpus Stats">
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, lineHeight: 2, color: "var(--fg-2)" }}>
              <div>tenants ................. <span style={{color:"#fff"}}>{stats.tenants}</span></div>
              <div>students ................ <span style={{color:"#fff"}}>{stats.students}</span></div>
              <div>policy-packs ............ <span style={{color:"#fff"}}>{stats.policies}</span></div>
              <div>bdia-events ............. <span style={{color:"#fff"}}>{stats.totalAuditEvents}</span></div>
              <div>synthetic-only .......... <span style={{color:"#22C55E"}}>TRUE</span></div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
