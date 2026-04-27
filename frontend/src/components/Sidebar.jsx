import React from "react";
import { NavLink, Link } from "react-router-dom";
import { Shield, Terminal, Stack, Brain, Books, Warning, FileText, Buildings, Pulse, GraduationCap } from "@phosphor-icons/react";

const links = [
  { to: "/",             label: "Overview",   icon: Pulse,           tid: "nav-overview" },
  { to: "/kernel",       label: "Kernel",     icon: Terminal,        tid: "nav-kernel" },
  { to: "/teacher",      label: "Teacher",    icon: GraduationCap,   tid: "nav-teacher" },
  { to: "/ledger",       label: "BDIA Ledger",icon: Stack,           tid: "nav-ledger" },
  { to: "/ai-gateway",   label: "AI / AGER",  icon: Brain,           tid: "nav-ai" },
  { to: "/policies",     label: "Policies",   icon: Books,           tid: "nav-policies" },
  { to: "/incidents",    label: "Incidents",  icon: Warning,         tid: "nav-incidents" },
  { to: "/disclosures",  label: "Disclosures",icon: FileText,        tid: "nav-disclosures" },
  { to: "/tenants",      label: "Tenants",    icon: Buildings,       tid: "nav-tenants" },
];

export default function Sidebar() {
  return (
    <aside
      style={{
        width: 240,
        minHeight: "100vh",
        background: "#0d0d0f",
        borderRight: "1px solid var(--border)",
        position: "sticky",
        top: 0,
      }}
      data-testid="sidebar"
    >
      <Link to="/" style={{ display: "block", padding: "22px 18px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Shield size={22} weight="fill" color="#22C55E" />
          <div>
            <div className="font-heading" style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-0.02em" }}>AEGIS-OS</div>
            <div className="overline" style={{ marginTop: 2 }}>Compliance Kernel</div>
          </div>
        </div>
      </Link>

      <nav style={{ padding: "10px 0" }}>
        {links.map(l => (
          <NavLink key={l.to} to={l.to} end={l.to === "/"} className={({isActive}) => `navlink ${isActive ? "active" : ""}`} data-testid={l.tid}>
            <l.icon size={14} weight="bold" />
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: 16, marginTop: 20, borderTop: "1px solid var(--border)" }}>
        <div className="overline" style={{ color: "#F59E0B" }}>Synthetic Only</div>
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--fg-3)", marginTop: 6, lineHeight: 1.6 }}>
          No real PII permitted.<br/>
          Kill-switch: ENGAGED
        </div>
      </div>

      <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
        <div className="overline">Compliance</div>
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--fg-2)", marginTop: 6, lineHeight: 1.7 }}>
          FERPA · 34 CFR Part 99<br/>
          COPPA · 16 CFR Part 312<br/>
          IDEA · §300.622<br/>
          NIST AI RMF · 600-1<br/>
          NIST CSF · 2.0
        </div>
      </div>
    </aside>
  );
}
