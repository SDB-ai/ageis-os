import React, { useEffect, useState, useCallback } from "react";
import {
  fetchPrincipals,
  fetchTeacherRoster,
  fetchTeacherAssignments,
  fetchTeacherSubmissions,
  submitTeacherGrade,
  approveGradeProposal,
  fetchGradeProposals,
  generateLesson,
  fetchLessons,
} from "../api";
import { Panel, Overline, StatusBadge, Hash, EmptyState } from "../components/ui-parts";
import {
  GraduationCap, Shield, Warning, Robot, BookOpen, CheckCircle, XCircle, PencilSimple, Lock,
} from "@phosphor-icons/react";

const TABS = [
  { id: "roster",    label: "My Roster",        icon: GraduationCap },
  { id: "grade",     label: "AI-Assisted Grading", icon: Robot },
  { id: "lesson",    label: "Lesson Plans",     icon: BookOpen },
  { id: "history",   label: "Graded History",   icon: CheckCircle },
];

export default function Teacher() {
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [tab, setTab] = useState("roster");

  useEffect(() => {
    fetchPrincipals().then((list) => {
      const onlyTeachers = list.filter((p) => p.role === "teacher");
      setTeachers(onlyTeachers);
      if (onlyTeachers.length && !teacherId) setTeacherId(onlyTeachers[0].id);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div data-testid="teacher-page">
      <TeacherHeader teachers={teachers} teacherId={teacherId} onChange={setTeacherId} />
      <ComplianceStrip />
      <div style={{ display: "flex", gap: 6, padding: "14px 40px 0", borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => {
          const Ico = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              data-testid={`teacher-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${active ? "#22C55E" : "transparent"}`,
                color: active ? "#fff" : "var(--fg-2)",
                padding: "12px 18px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "0.02em",
                fontFamily: "JetBrains Mono, monospace",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              <Ico size={14} weight="fill" /> {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: 40 }}>
        {!teacherId ? (
          <EmptyState label="No teachers seeded. Run POST /api/seed." />
        ) : tab === "roster" ? (
          <RosterPanel teacherId={teacherId} />
        ) : tab === "grade" ? (
          <GradingPanel teacherId={teacherId} />
        ) : tab === "lesson" ? (
          <LessonPanel teacherId={teacherId} />
        ) : (
          <HistoryPanel teacherId={teacherId} />
        )}
      </div>
    </div>
  );
}

function TeacherHeader({ teachers, teacherId, onChange }) {
  const current = teachers.find((t) => t.id === teacherId);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 0, borderBottom: "1px solid var(--border)" }}>
      <div style={{ padding: "40px 40px 24px" }}>
        <Overline>Teacher Workbench / Kernel-Gated</Overline>
        <h1 className="font-heading" style={{ fontWeight: 900, fontSize: 42, letterSpacing: "-0.03em", marginTop: 10, lineHeight: 1 }}>
          Teach with confidence.<br />
          <span style={{ color: "#22C55E" }}>Compliance runs on rails.</span>
        </h1>
        <p style={{ color: "var(--fg-2)", marginTop: 14, maxWidth: 620, fontSize: 14, lineHeight: 1.6 }}>
          Every grading call and lesson plan you generate routes through the 10-gate kernel before a byte reaches any AI.
          IEP/504 students never leave the vault. Every decision is sealed in the BDIA ledger.
        </p>
      </div>
      <div style={{ borderLeft: "1px solid var(--border)", padding: 26, background: "linear-gradient(180deg,#0c0c0e 0%,#18181B 100%)" }}>
        <Overline>Acting As</Overline>
        <select
          data-testid="teacher-selector"
          value={teacherId}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            background: "#0a0a0a",
            color: "#fff",
            border: "1px solid var(--border)",
            padding: "10px 12px",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 12,
            marginTop: 10,
          }}
        >
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {t.id} · {t.tenantId}
            </option>
          ))}
        </select>
        {current && (
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--fg-2)", marginTop: 16, lineHeight: 1.9 }}>
            <div>email ...... <span style={{ color: "#fff" }}>{current.email}</span></div>
            <div>tenant ..... <span style={{ color: "#fff" }}>{current.tenantId}</span></div>
            <div>role ....... <span style={{ color: "#22C55E" }}>{current.role.toUpperCase()}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

function ComplianceStrip() {
  const items = [
    { icon: Shield, text: "IEP/504 → locally processed only (IDEA §300.622)" },
    { icon: Lock, text: "PII tokenized before any AI call (FERPA §99.31)" },
    { icon: CheckCircle, text: "All AI grades require human approval (NIST AI RMF)" },
    { icon: BookOpen, text: "Every action sealed in BDIA ledger (FERPA §99.32)" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", background: "#0a0a0a", borderBottom: "1px solid var(--border)" }}>
      {items.map((it, i) => {
        const Ico = it.icon;
        return (
          <div key={i} style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, borderRight: i < 3 ? "1px solid var(--border)" : "none" }}>
            <Ico size={16} weight="fill" color="#22C55E" />
            <span style={{ color: "var(--fg-2)", fontSize: 11, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.4 }}>{it.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function RosterPanel({ teacherId }) {
  const [data, setData] = useState(null);
  useEffect(() => { fetchTeacherRoster(teacherId).then(setData); }, [teacherId]);
  if (!data) return null;

  return (
    <div>
      <Panel title={`My Roster — ${data.teacher?.name || teacherId} · ${data.tenant?.name || ""}`} testId="roster-panel">
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--fg-2)", marginBottom: 14, padding: "10px 12px", border: "1px dashed #3F3F46", background: "#0a0a0a" }}>
          {data.complianceNotice}
        </div>
        {(!data.students || data.students.length === 0) ? (
          <EmptyState label="No roster students for this teacher." />
        ) : (
          <table className="dt" data-testid="roster-table">
            <thead>
              <tr><th>Student (tokenized)</th><th>Grade</th><th>Flags</th><th>AI Eligible?</th><th>Protected?</th></tr>
            </thead>
            <tbody>
              {data.students.map((s) => (
                <tr key={s.id} data-testid={`roster-row-${s.id}`}>
                  <td><Hash value={s.displayId} /></td>
                  <td style={{ color: "#fff" }}>Grade {s.grade}</td>
                  <td>{(s.flags || []).map((f) => <StatusBadge key={f} value={f.toUpperCase()} />)}</td>
                  <td>{s.aiEligible ? <span className="badge badge-allow">YES</span> : <span className="badge badge-deny">NO · IEP LOCK</span>}</td>
                  <td>{s.protected ? <Shield size={16} weight="fill" color="#F59E0B" /> : <span style={{ color: "var(--fg-3)" }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function GradingPanel({ teacherId }) {
  const [subs, setSubs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const reload = useCallback(() => {
    fetchTeacherSubmissions(teacherId).then(setSubs);
  }, [teacherId]);

  useEffect(() => { reload(); setSelected(null); setResult(null); }, [reload]);

  const runGrade = async (submissionId, mode) => {
    setBusy(true); setResult(null);
    try {
      const r = await submitTeacherGrade({ teacherId, submissionId, mode });
      setResult(r); reload();
    } finally { setBusy(false); }
  };

  const approve = async (action) => {
    if (!result?.proposal) return;
    setBusy(true);
    try {
      await approveGradeProposal({ teacherId, proposalId: result.proposal.id, action });
      setResult(null); setSelected(null); reload();
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
      <Panel title="Ungraded Submissions" testId="submissions-panel">
        {subs.length === 0 ? <EmptyState label="No submissions queued." /> : (
          <table className="dt" data-testid="submissions-table">
            <thead><tr><th>Submission</th><th>Student</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} onClick={() => setSelected(s)} style={{ cursor: "pointer", background: selected?.id === s.id ? "rgba(34,197,94,0.06)" : "transparent" }} data-testid={`sub-row-${s.id}`}>
                  <td className="hash">{s.id} · {s.assignmentId}</td>
                  <td><Hash value={s.studentDisplayId} /></td>
                  <td>
                    {s.proposalStatus === "ungraded" && <span className="badge badge-warn">UNGRADED</span>}
                    {s.proposalStatus === "pending_teacher" && <span className="badge badge-review">PENDING TEACHER</span>}
                    {s.proposalStatus === "blocked" && <span className="badge badge-deny">AI BLOCKED</span>}
                    {s.proposalStatus === "final_approved" && <span className="badge badge-allow">APPROVED</span>}
                    {s.proposalStatus === "final_edited" && <span className="badge badge-allow">EDITED</span>}
                    {s.proposalStatus === "rejected" && <span className="badge badge-deny">REJECTED</span>}
                  </td>
                  <td>{s.protected && <Shield size={14} weight="fill" color="#F59E0B" title="IEP/504 protected" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Proposal Workspace" testId="proposal-panel">
        {!selected ? (
          <EmptyState label="Select a submission to grade." />
        ) : (
          <div>
            <div style={{ padding: 12, background: "#0a0a0a", border: "1px solid var(--border)", marginBottom: 14 }}>
              <div className="overline">Student Response · {selected.id}</div>
              <div style={{ color: "var(--fg-1)", fontSize: 13, marginTop: 8, fontFamily: "JetBrains Mono, monospace", whiteSpace: "pre-wrap" }}>{selected.response}</div>
            </div>
            {selected.protected && (
              <div data-testid="iep-warning" style={{ padding: 12, background: "rgba(245,158,11,0.08)", border: "1px solid #F59E0B", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <Shield size={18} weight="fill" color="#F59E0B" />
                <div style={{ color: "#F59E0B", fontSize: 12, fontFamily: "JetBrains Mono, monospace" }}>
                  This student is IEP/504 protected. External AI is blocked per IDEA §300.622. Manual grade only.
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <button disabled={busy || selected.protected} onClick={() => runGrade(selected.id, "ai_proposal")} data-testid="run-ai-grade-btn"
                style={primaryBtn(selected.protected)}>
                <Robot size={14} weight="fill" /> REQUEST AI PROPOSAL
              </button>
              <button disabled={busy} onClick={() => runGrade(selected.id, "manual")} data-testid="run-manual-grade-btn" style={ghostBtn}>
                <PencilSimple size={14} /> GRADE MANUALLY
              </button>
            </div>
            {result && <ProposalReview result={result} onApprove={() => approve("approve")} onReject={() => approve("reject")} />}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ProposalReview({ result, onApprove, onReject }) {
  const p = result.proposal;
  const kernel = result.kernel;
  return (
    <div data-testid="proposal-review" style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
      <div className="overline">Kernel Decision</div>
      <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
        <StatusBadge value={kernel.decision} />
        <span className="hash">{kernel.cesCode}</span>
        <span className="hash" title={kernel.bdiaEventId}>BDIA: {kernel.bdiaEventId.slice(0, 18)}…</span>
      </div>

      {p.status === "blocked" ? (
        <div style={{ marginTop: 14, padding: 12, background: "rgba(239,68,68,0.08)", border: "1px solid #EF4444" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#EF4444", fontSize: 13, fontWeight: 700 }}>
            <XCircle size={18} weight="fill" /> BLOCKED BY KERNEL
          </div>
          <div style={{ marginTop: 6, color: "var(--fg-2)", fontSize: 12, fontFamily: "JetBrains Mono, monospace" }}>{p.blockReason}</div>
          <div style={{ marginTop: 6, color: "var(--fg-3)", fontSize: 11 }}>{result.humanActionRequired}</div>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          {p.proposedScore !== null && p.proposedScore !== undefined && (
            <div className="kpi" style={{ background: "rgba(34,197,94,0.05)", borderColor: "#22C55E", marginBottom: 12 }}>
              <div className="label">AI Proposed Score</div>
              <div className="value" style={{ color: "#22C55E" }}>{p.proposedScore}</div>
              <div className="hint">{p.aiProvider} / {p.aiModel}</div>
            </div>
          )}
          {p.proposedFeedback && (
            <div style={{ padding: 12, background: "#0a0a0a", border: "1px solid var(--border)", marginBottom: 12 }}>
              <div className="overline">AI Feedback (proposal)</div>
              <div style={{ color: "var(--fg-1)", fontSize: 13, marginTop: 6 }}>{p.proposedFeedback}</div>
            </div>
          )}
          {p.hallucinationDetected && (
            <div style={{ padding: 10, background: "rgba(245,158,11,0.08)", border: "1px solid #F59E0B", marginBottom: 12 }}>
              <Warning size={16} weight="fill" color="#F59E0B" /> <span style={{ color: "#F59E0B", fontSize: 12, marginLeft: 6 }}>AGER detected {p.contradictions?.length} contradiction(s)</span>
            </div>
          )}
          <div style={{ padding: 10, border: "1px dashed #3F3F46", marginBottom: 14, background: "#0a0a0a" }}>
            <div style={{ fontSize: 11, color: "#F59E0B", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>HUMAN APPROVAL REQUIRED (NIST AI RMF 600-1 MANAGE-4.1)</div>
            <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 4 }}>AI is a proposal only. You are the decision-maker.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onApprove} data-testid="approve-btn" style={greenBtn}>
              <CheckCircle size={14} weight="fill" /> APPROVE & SEAL
            </button>
            <button onClick={onReject} data-testid="reject-btn" style={redBtn}>
              <XCircle size={14} weight="fill" /> REJECT
            </button>
          </div>
          <div style={{ marginTop: 10, fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "var(--fg-3)" }}>
            Citations: {p.citations?.join(" · ")}
          </div>
        </div>
      )}
    </div>
  );
}

function LessonPanel({ teacherId }) {
  const [roster, setRoster] = useState(null);
  const [form, setForm] = useState({
    subject: "math", grade: 7,
    standard: "CCSS.MATH.CONTENT.7.EE.B.4",
    learningObjective: "Solve one-variable linear equations with rational coefficients.",
    accommodations: ["extended-time"],
    targetStudentIds: [],
  });
  const [busy, setBusy] = useState(false);
  const [lesson, setLesson] = useState(null);
  const [saved, setSaved] = useState([]);

  useEffect(() => {
    fetchTeacherRoster(teacherId).then((r) => {
      setRoster(r);
      setForm((f) => ({ ...f, targetStudentIds: (r.students || []).map((s) => s.id) }));
    });
    fetchLessons(teacherId).then(setSaved);
  }, [teacherId]);

  const toggleStudent = (sid) => {
    setForm((f) => ({
      ...f,
      targetStudentIds: f.targetStudentIds.includes(sid)
        ? f.targetStudentIds.filter((x) => x !== sid)
        : [...f.targetStudentIds, sid],
    }));
  };

  const run = async () => {
    if (!roster?.teacher) return;
    setBusy(true); setLesson(null);
    try {
      const r = await generateLesson({ teacherId, tenantId: roster.teacher.tenantId, ...form });
      setLesson(r);
      fetchLessons(teacherId).then(setSaved);
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
      <Panel title="Lesson Plan Generator" testId="lesson-form-panel">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Subject" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} tid="lesson-subject" />
          <Field label="Grade" type="number" value={form.grade} onChange={(v) => setForm({ ...form, grade: parseInt(v, 10) || 0 })} tid="lesson-grade" />
        </div>
        <Field label="Standard code" value={form.standard} onChange={(v) => setForm({ ...form, standard: v })} tid="lesson-standard" />
        <Field label="Learning objective" value={form.learningObjective} onChange={(v) => setForm({ ...form, learningObjective: v })} multiline tid="lesson-objective" />
        <Field label="Accommodation tags (comma-separated, generic only)" value={form.accommodations.join(", ")} onChange={(v) => setForm({ ...form, accommodations: v.split(",").map((s) => s.trim()).filter(Boolean) })} tid="lesson-accom" />

        <Overline>Target Students</Overline>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {(roster?.students || []).map((s) => (
            <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#0a0a0a", border: "1px solid var(--border)", fontSize: 11, fontFamily: "JetBrains Mono, monospace", cursor: "pointer" }}>
              <input type="checkbox" checked={form.targetStudentIds.includes(s.id)} onChange={() => toggleStudent(s.id)} data-testid={`lesson-student-${s.id}`} />
              <span style={{ color: "var(--fg-1)" }}>{s.displayId.slice(0, 14)}…</span>
              {s.protected && <Shield size={12} weight="fill" color="#F59E0B" />}
            </label>
          ))}
        </div>

        <button disabled={busy} onClick={run} data-testid="generate-lesson-btn" style={{ ...greenBtn, marginTop: 16 }}>
          <BookOpen size={14} weight="fill" /> {busy ? "GENERATING…" : "GENERATE LESSON PLAN"}
        </button>
      </Panel>

      <Panel title="Generated Plan" testId="lesson-output-panel">
        {!lesson ? (
          saved.length ? (
            <div>
              <Overline>Previously Generated</Overline>
              <table className="dt" style={{ marginTop: 8 }}>
                <thead><tr><th>Lesson</th><th>Standard</th><th>Created</th></tr></thead>
                <tbody>
                  {saved.slice(0, 10).map((l) => (
                    <tr key={l.id}>
                      <td className="hash">{l.plan?.title || l.id}</td>
                      <td className="hash">{l.standard}</td>
                      <td className="hash">{new Date(l.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState label="Fill in the form and generate a lesson." />
        ) : <LessonView data={lesson} />}
      </Panel>
    </div>
  );
}

function LessonView({ data }) {
  const l = data.lesson;
  const plan = l.plan || {};
  return (
    <div data-testid="lesson-view">
      <div style={{ padding: 10, background: "#0a0a0a", border: "1px dashed #3F3F46", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "var(--fg-2)", fontFamily: "JetBrains Mono, monospace" }}>{data.complianceNotice}</div>
      </div>
      <h3 className="font-heading" style={{ fontSize: 20, fontWeight: 800 }}>{plan.title || l.standard}</h3>
      <div style={{ fontSize: 12, color: "var(--fg-3)", fontFamily: "JetBrains Mono, monospace", marginTop: 4 }}>
        Standard: {l.standard} · Duration: {plan.durationMin || 45} min
      </div>

      {plan.objectives && (
        <Section title="Objectives">
          <ul style={ulStyle}>{plan.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
        </Section>
      )}
      {plan.activities && (
        <Section title="Activities">
          <ol style={ulStyle}>
            {plan.activities.map((a, i) => (
              <li key={i}>
                <strong style={{ color: "#22C55E" }}>{a.phase}</strong> ({a.minutes} min) — {a.description}
              </li>
            ))}
          </ol>
        </Section>
      )}
      {plan.materials && (
        <Section title="Materials">
          <ul style={ulStyle}>{plan.materials.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </Section>
      )}
      {plan.assessment && <Section title="Assessment"><div style={textStyle}>{plan.assessment}</div></Section>}
      {plan.differentiation && (
        <Section title="Differentiation">
          <ul style={ulStyle}>{plan.differentiation.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </Section>
      )}

      {l.localPlanForIep && (
        <div data-testid="iep-local-plan" style={{ marginTop: 18, padding: 14, border: "1px solid #F59E0B", background: "rgba(245,158,11,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#F59E0B", fontWeight: 700, fontSize: 13 }}>
            <Shield size={16} weight="fill" /> {l.localPlanForIep.title}
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 6, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.6 }}>
            {l.localPlanForIep.note}
          </div>
          <div style={{ fontSize: 10, color: "var(--fg-3)", marginTop: 8, fontFamily: "JetBrains Mono, monospace" }}>
            Applied to: {l.localPlanForIep.studentIds.join(", ")}
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, padding: 10, background: "#0a0a0a", border: "1px solid var(--border)" }}>
        <div className="overline">Kernel Results (per target student)</div>
        {l.kernelResults.map((r) => (
          <div key={r.studentId} style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--fg-2)", marginTop: 4 }}>
            {r.studentId}: <StatusBadge value={r.decision} /> <span className="hash">{r.cesCode}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "var(--fg-3)" }}>
        Citations: {l.citations?.join(" · ")}
      </div>
    </div>
  );
}

function HistoryPanel({ teacherId }) {
  const [proposals, setProposals] = useState([]);
  useEffect(() => { fetchGradeProposals(teacherId).then(setProposals); }, [teacherId]);
  if (proposals.length === 0) return <EmptyState label="No grading history yet." />;
  return (
    <Panel title="Grading History" testId="history-panel">
      <table className="dt" data-testid="history-table">
        <thead>
          <tr><th>Proposal</th><th>Submission</th><th>Student</th><th>Kernel</th><th>Status</th><th>Final</th><th>Decided</th></tr>
        </thead>
        <tbody>
          {proposals.map((p) => (
            <tr key={p.id}>
              <td className="hash">{p.id}</td>
              <td className="hash">{p.submissionId}</td>
              <td className="hash">{p.studentId}</td>
              <td><StatusBadge value={p.kernelDecision} /></td>
              <td><StatusBadge value={p.status.toUpperCase()} /></td>
              <td style={{ color: "#fff" }}>{p.finalScore ?? (p.proposedScore ?? "—")}</td>
              <td className="hash">{p.decidedAt ? new Date(p.decidedAt).toLocaleString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function Field({ label, value, onChange, type = "text", multiline = false, tid }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div className="overline">{label}</div>
      {multiline ? (
        <textarea data-testid={tid} rows={2} value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
      ) : (
        <input data-testid={tid} type={type} value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div className="overline">{title}</div>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}

const inputStyle = {
  width: "100%", marginTop: 4, background: "#0a0a0a", color: "#fff",
  border: "1px solid var(--border)", padding: "8px 10px",
  fontFamily: "JetBrains Mono, monospace", fontSize: 12,
};
const ulStyle = { color: "var(--fg-1)", fontSize: 13, paddingLeft: 18, marginTop: 2, lineHeight: 1.6 };
const textStyle = { color: "var(--fg-1)", fontSize: 13, lineHeight: 1.6 };
const primaryBtn = (disabled) => ({
  background: disabled ? "#262626" : "#22C55E", color: disabled ? "#666" : "#0a0a0a",
  border: "none", padding: "10px 14px", fontWeight: 800, fontSize: 12,
  fontFamily: "JetBrains Mono, monospace", cursor: disabled ? "not-allowed" : "pointer",
  display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.02em",
});
const ghostBtn = {
  background: "transparent", color: "#fff", border: "1px solid var(--border)",
  padding: "10px 14px", fontWeight: 700, fontSize: 12,
  fontFamily: "JetBrains Mono, monospace", cursor: "pointer",
  display: "flex", alignItems: "center", gap: 8,
};
const greenBtn = {
  background: "#22C55E", color: "#0a0a0a", border: "none", padding: "10px 14px",
  fontWeight: 800, fontSize: 12, fontFamily: "JetBrains Mono, monospace",
  cursor: "pointer", display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.02em",
};
const redBtn = {
  background: "#EF4444", color: "#0a0a0a", border: "none", padding: "10px 14px",
  fontWeight: 800, fontSize: 12, fontFamily: "JetBrains Mono, monospace",
  cursor: "pointer", display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.02em",
};
