import React, { useEffect, useState } from "react";
import { fetchPolicies } from "../api";
import { Panel, Overline, StatusBadge } from "../components/ui-parts";

const LAYERS = [
  { key: "federal",  color: "#22C55E", label: "FEDERAL" },
  { key: "state",    color: "#F59E0B", label: "STATE" },
  { key: "district", color: "#4F46E5", label: "DISTRICT" },
];

export default function Policies() {
  const [all, setAll] = useState([]);
  const [layer, setLayer] = useState("");

  useEffect(() => { fetchPolicies().then(setAll); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = layer ? all.filter(p => p.layer === layer) : all;

  return (
    <div data-testid="policies-page">
      <div style={{ padding: "32px 40px 18px", borderBottom: "1px solid var(--border)" }}>
        <Overline>Policy Catalog · Federal → State → District layering · Versioned JSON</Overline>
        <h1 className="font-heading" style={{ fontWeight: 900, fontSize: 36, letterSpacing: "-0.02em", marginTop: 8 }}>
          Policy Packs
        </h1>
        <p style={{ color: "var(--fg-2)", marginTop: 6, fontSize: 14 }}>
          Every request is evaluated top-down. A DENY at any layer wins. Policies are citable.
        </p>
      </div>

      <div style={{ padding: 40 }}>
        <div className="row-inline" style={{ marginBottom: 20 }}>
          <button className={`btn ${layer===""?"":"btn-ghost"}`} onClick={()=>setLayer("")} data-testid="policy-layer-all">ALL</button>
          {LAYERS.map(l => (
            <button key={l.key} className={`btn ${layer===l.key?"":"btn-ghost"}`} onClick={()=>setLayer(l.key)} data-testid={`policy-layer-${l.key}`}>
              {l.label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
          {filtered.map(p => {
            const layerColor = LAYERS.find(l => l.key === p.layer)?.color || "#71717A";
            return (
              <div key={p.id} className="panel" style={{ borderLeft: `3px solid ${layerColor}` }} data-testid={`policy-${p.id}`}>
                <div className="panel-header">
                  <div>
                    <div className="overline" style={{ color: layerColor }}>{p.layer} · {p.jurisdiction}</div>
                    <div className="font-heading" style={{ fontWeight: 700, fontSize: 18, marginTop: 4, letterSpacing: "-0.02em" }}>{p.id}</div>
                  </div>
                  <StatusBadge value={`v${p.version}`}/>
                </div>
                <div className="panel-body">
                  <div style={{ fontSize: 12, color: "var(--fg-2)", fontFamily: "JetBrains Mono, monospace", marginBottom: 12 }}>
                    {p.citation}
                  </div>
                  <div className="overline" style={{ marginBottom: 6 }}>Rules ({p.rules.length})</div>
                  {p.rules.map((r, i) => (
                    <div key={`${p.id}-rule-${i}`} style={{ marginBottom: 10, padding: 10, background: "#0c0c0e", border: "1px solid var(--border)", fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--fg-2)", lineHeight: 1.6 }}>
                      <div><span style={{color:"#F59E0B"}}>IF</span>   {r.if}</div>
                      <div><span style={{color:"#22C55E"}}>THEN</span> {r.then}</div>
                      <div style={{color:"var(--fg-3)", marginTop:4}}>⟶ cite: {r.cite}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
