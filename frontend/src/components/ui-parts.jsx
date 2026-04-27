import React from "react";

export function StatusBadge({ value }) {
  const map = {
    ALLOW: "badge-allow",
    DENY:  "badge-deny",
    REQUIRE_CONSENT: "badge-review",
    REQUIRE_HUMAN_REVIEW: "badge-review",
    PASS: "badge-pass",
    FAIL: "badge-fail",
    SKIPPED: "badge-skip",
    WARN: "badge-warn",
    VALID: "badge-allow",
    BROKEN: "badge-deny",
    open: "badge-fail",
    closed: "badge-skip",
    high: "badge-deny",
    medium: "badge-warn",
    low: "badge-skip",
  };
  const cls = map[value] || "badge-skip";
  return <span className={`badge ${cls}`} data-testid={`status-badge-${String(value).toLowerCase()}`}>{String(value)}</span>;
}

export function Overline({ children }) {
  return <div className="overline">{children}</div>;
}

export function Panel({ title, right, children, testId }) {
  return (
    <div className="panel" data-testid={testId}>
      {(title || right) && (
        <div className="panel-header">
          <div className="overline">{title}</div>
          <div>{right}</div>
        </div>
      )}
      <div className="panel-body">{children}</div>
    </div>
  );
}

export function Kpi({ label, value, hint, testId }) {
  return (
    <div className="kpi" data-testid={testId}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Hash({ value, chars = 10 }) {
  if (!value) return <span className="hash">—</span>;
  const short = value.length > chars * 2 + 1 ? `${value.slice(0, chars)}…${value.slice(-chars)}` : value;
  return <span className="hash" title={value}>{short}</span>;
}

export function EmptyState({ label }) {
  return <div style={{ padding: 40, textAlign: "left", color: "var(--fg-3)", fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>— {label} —</div>;
}
