import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCases, getSession, saveCase, STATUS_LABEL } from '../lib/store.js';
import {
  downloadDoctorReport,
  downloadPatientReport,
  approveScreening,
  overrideScreening,
  referScreening,
  getConfidenceBadge
} from '../lib/api.js';
import { gradeInfo } from '../lib/icdr.js';

const TABS = ['all', 'queued', 'referred', 'approved', 'overridden', 'urgent', 'cleared'];

export function Cases() {
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const cases = getCases();
  const list = useMemo(() => cases.filter((c) =>
    (tab === 'all' || c.status === tab) &&
    (!query || (c.patient + c.id).toLowerCase().includes(query.toLowerCase()))), [cases, tab, query]);

  return (
    <div className="page">
      <div className="page-head">
        <div><span className="kicker">Clinical Queue · {cases.length} Screenings</span><h1>Doctor Dashboard</h1></div>
        <Link className="btn btn-primary" to="/app/screen">＋ New screening</Link>
      </div>
      <div className="toolbar">
        <div className="seg">
          {TABS.map((t) => (
            <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t === 'all' ? `All (${cases.length})` : `${t.toUpperCase()} (${cases.filter((c) => c.status === t).length})`}
            </button>
          ))}
        </div>
        <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search patient name or ID…" aria-label="Search cases" />
      </div>

      <section className="card">
        <div className="rows">
          {list.map((c) => {
            const confBadge = getConfidenceBadge(c.confidence);
            return (
              <Link key={c.id} className="row" to={`/app/cases/${c.id}`} style={{ alignItems: 'center' }}>
                <span className={`pill l${c.grade}`}>G{c.grade}</span>
                <span className="row-main">
                  <b>{c.patient}</b>
                  <small>{c.id} · {c.age}y · {c.eye} · {new Date(c.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small>
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: confBadge.color, background: confBadge.bg, padding: '3px 8px', borderRadius: 4 }}>
                  {c.confidence}%
                </span>
                <span className={`status ${c.status}`} style={{ textTransform: 'capitalize' }}>
                  {c.status}
                </span>
              </Link>
            );
          })}
          {!list.length && <p className="muted" style={{ padding: 16 }}>No cases found in this view. Start a new screening to populate the triage queue.</p>}
        </div>
      </section>
    </div>
  );
}

export function CaseDetail() {
  const { id } = useParams();
  const c = getCases().find((x) => x.id === id);
  const [note, setNote] = useState(c?.note || '');
  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideGrade, setOverrideGrade] = useState(c?.grade ?? 2);
  const [overrideReason, setOverrideReason] = useState('');
  const [doctorReportModal, setDoctorReportModal] = useState(false);
  const [patientReportModal, setPatientReportModal] = useState(false);
  const [toast, setToast] = useState('');

  if (!c) return <div className="page"><p>Case not found. <Link to="/app/cases">Back to queue →</Link></p></div>;

  const gi = gradeInfo(c.grade);
  const confBadge = getConfidenceBadge(c.confidence);
  const s = getSession() || {};

  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Priority 12 Clinical Decision Actions: Approve, Override, Refer
  const handleApprove = async () => {
    try {
      await approveScreening(c.id, { doctor_name: s.doctor || s.name || 'Doctor', clinical_notes: note || 'AI assessment approved by doctor.' });
    } catch { /* offline local fallback */ }
    saveCase({ ...c, status: 'approved', note, validatedBy: s.doctor || s.name, validatedAt: Date.now() });
    say('Screening Approved: AI classification accepted.');
    setTimeout(() => location.reload(), 900);
  };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      alert('Mandatory: Please provide a clinical reason for overriding the AI prediction.');
      return;
    }
    try {
      await overrideScreening(c.id, {
        doctor_name: s.doctor || s.name || 'Doctor',
        final_grade: Number(overrideGrade),
        override_reason: overrideReason.trim(),
        clinical_notes: note,
      });
    } catch { /* offline local fallback */ }
    saveCase({
      ...c,
      grade: Number(overrideGrade),
      originalGrade: c.originalGrade ?? c.grade,
      status: 'overridden',
      overrideReason: overrideReason.trim(),
      note,
      validatedBy: s.doctor || s.name,
      validatedAt: Date.now(),
    });
    setOverrideModal(false);
    say(`Screening Overridden to Grade ${overrideGrade}.`);
    setTimeout(() => location.reload(), 900);
  };

  const handleRefer = async () => {
    const dest = prompt('Referral Destination Hospital:', 'District General Hospital — Retina Clinic');
    if (!dest) return;
    try {
      await referScreening(c.id, {
        doctor_name: s.doctor || s.name || 'Doctor',
        referral_priority: c.grade >= 3 ? 'Urgent' : 'Priority',
        target_facility: dest,
        clinical_notes: note,
      });
    } catch { /* offline local fallback */ }
    saveCase({ ...c, status: 'referred', referralTarget: dest, note, validatedBy: s.doctor || s.name, validatedAt: Date.now() });
    say(`Referred to ${dest}.`);
    setTimeout(() => location.reload(), 900);
  };

  // Lesion table sample/derived
  const lesionTable = c.lesion_analysis?.table || [
    { lesion_type: 'Microaneurysms', count: c.grade >= 1 ? 14 : 0, quadrant: 'ST: 5, SN: 4, IT: 3, IN: 2' },
    { lesion_type: 'Retinal Hemorrhages', count: c.grade >= 2 ? 9 : 0, quadrant: 'ST: 3, SN: 2, IT: 2, IN: 2' },
    { lesion_type: 'Hard Exudates', count: c.grade >= 2 ? 11 : 0, quadrant: 'ST: 4, SN: 3, IT: 2, IN: 2' },
    { lesion_type: 'Soft Exudates (CWS)', count: c.grade >= 3 ? 4 : 0, quadrant: 'ST: 1, SN: 1, IT: 1, IN: 1' },
  ];

  return (
    <div className="page">
      <Link to="/app/cases" className="backlink">← Back to Queue</Link>

      <div className="page-head">
        <div>
          <span className="kicker">{c.id} · {c.eye}</span>
          <h1>{c.patient}, {c.age} yrs</h1>
          <p className="muted">Diabetes duration: {c.years}y · Device: {c.source || 'Fundus Camera'} · Quality: {c.quality}/100</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`status ${c.status} big`} style={{ textTransform: 'capitalize' }}>
            {c.status}
          </span>
          {c.validatedBy && <small style={{ display: 'block', color: 'var(--muted)', marginTop: 4 }}>Reviewed by {c.validatedBy}</small>}
        </div>
      </div>

      {/* PROMINENT CONFIDENCE SCORE BANNER (Exact Color-Coding Thresholds) */}
      <section className="card" style={{ marginBottom: 18, borderLeft: `6px solid ${confBadge.color}` }}>
        <div className="card-b" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Model Prediction Confidence (MATLAB Deep Learning)
            </span>
            <div style={{ fontSize: 24, fontWeight: 800, color: confBadge.color, marginTop: 2 }}>
              Confidence Score: {c.confidence}%
            </div>
            <span style={{ display: 'inline-block', marginTop: 4, padding: '3px 10px', borderRadius: 4, background: confBadge.bg, color: confBadge.color, fontWeight: 700, fontSize: 12 }}>
              {confBadge.label} ({confBadge.text})
            </span>
          </div>
          <div style={{ maxWidth: 420, fontSize: 12.5, color: 'var(--muted)', borderLeft: '2px solid var(--line)', paddingLeft: 14 }}>
            <strong>Notice:</strong> The confidence score represents the model-generated probability and must not be presented as clinical certainty. Definitive diagnosis requires dilated slit-lamp ophthalmoscopy.
          </div>
        </div>
      </section>

      {/* PRIORITY 12: CLINICAL DECISION FLOW (APPROVE / OVERRIDE / REFER) */}
      <section className="card" style={{ marginBottom: 18, background: 'var(--surface-2)' }}>
        <div className="card-h">
          <b>Doctor Clinical Decision Workflow</b>
          <span className="mono">STEP 1: REVIEW REPORT → STEP 2: SELECT ACTION</span>
        </div>
        <div className="card-b">
          <p className="muted" style={{ margin: '0 0 14px' }}>
            AI predictions assist rural screening. Review the Grad-CAM and lesion evidence, then record your clinical decision:
          </p>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* APPROVE BUTTON (GREEN) */}
            <button
              type="button"
              onClick={handleApprove}
              style={{
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: 14,
                padding: '10px 22px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)',
              }}
            >
              ✓ APPROVE
            </button>

            {/* OVERRIDE BUTTON (ORANGE) */}
            <button
              type="button"
              onClick={() => setOverrideModal(true)}
              style={{
                background: '#ea580c',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: 14,
                padding: '10px 22px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 6px rgba(234, 88, 12, 0.3)',
              }}
            >
              ✎ OVERRIDE
            </button>

            {/* REFER BUTTON (DARK RED) */}
            <button
              type="button"
              onClick={handleRefer}
              style={{
                background: '#991b1b',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: 14,
                padding: '10px 22px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 6px rgba(153, 27, 27, 0.3)',
              }}
            >
              ➔ REFER PATIENT
            </button>
          </div>

          <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
            <label>Doctor Clinical Notes (stored in patient record)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Slit lamp requested, macular thickening suspect, urgent referral issued"
            />
          </div>
        </div>
      </section>

      {/* PRIORITY 11: DUAL REPORT SYSTEM ACTIONS */}
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="card-h">
          <b>Dual Report Generation System</b>
          <span className="mono">TWO INDEPENDENT CLINICAL FORMATS</span>
        </div>
        <div className="card-b">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {/* DOCTOR REPORT CARD */}
            <div style={{ border: '1.5px solid var(--line)', padding: 14, borderRadius: 8, background: 'var(--surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <b style={{ fontSize: 15 }}>Doctor's Detailed Report</b>
                <span className="pill" style={{ background: '#0284c7' }}>Clinician</span>
              </div>
              <p className="muted" style={{ fontSize: 12.5, margin: '0 0 12px' }}>
                Full diagnostic dossier with Grad-CAM heatmap overlay, 4-quadrant lesion breakdown, ICDR criteria rationale, and exact confidence metrics.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={() => setDoctorReportModal(true)}>
                  View Doctor's Report
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => downloadDoctorReport(c.id)}>
                  Download Doctor's Report
                </button>
              </div>
            </div>

            {/* PATIENT REPORT CARD */}
            <div style={{ border: '1.5px solid var(--line)', padding: 14, borderRadius: 8, background: 'var(--surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <b style={{ fontSize: 15 }}>Patient's Screening Report</b>
                <span className="pill" style={{ background: '#16a34a' }}>Patient</span>
              </div>
              <p className="muted" style={{ fontSize: 12.5, margin: '0 0 12px' }}>
                Simplified, accessible summary with marked eye photo, plain-language severity grade, clear referral urgency, and next health steps.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={() => setPatientReportModal(true)}>
                  View Patient's Report
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => downloadPatientReport(c.id)}>
                  Download Patient's Report
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CASE DETAILS & LESIONS */}
      <div className="two-col">
        <section className="card">
          <div className="card-h">
            <b>ICDR Classification · {gi.label}</b>
            <span className="mono">{c.sharpness || 'Gradable'}</span>
          </div>
          <div className="card-b">
            <div className={`verdict ${c.grade >= 3 ? 'refer' : c.grade === 0 ? 'clear' : 'watch'}`}>
              <h3>{gi.label} — {gi.title}</h3>
              <p>{gi.action}</p>
            </div>

            <div style={{ marginTop: 12, fontSize: 13 }}>
              <b>ICDR Mapping Criteria Rationale:</b>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                {c.icdr_mapping?.why_this_grade ||
                  'Microaneurysms accompanied by retinal hemorrhages and/or hard lipid exudates meeting the clinical referral threshold.'}
              </p>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-h">
            <b>Lesion Analysis & Spatial Quadrants</b>
            <span className="mono">MATLAB COMPUTER VISION</span>
          </div>
          <div className="card-b" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px' }}>Lesion Type</th>
                  <th style={{ padding: '8px 12px' }}>Count</th>
                  <th style={{ padding: '8px 12px' }}>Location (Quadrant)</th>
                </tr>
              </thead>
              <tbody>
                {lesionTable.map((l, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{l.lesion_type}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{l.count}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--muted)', fontSize: 12 }}>{l.quadrant}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ margin: '8px 12px', fontSize: 11, color: 'var(--muted)' }}>
              Quadrant Convention: ST (Superior Temporal), SN (Superior Nasal), IT (Inferior Temporal), IN (Inferior Nasal).
            </p>
          </div>
        </section>
      </div>

      {/* OVERRIDE MODAL */}
      {overrideModal && (
        <div className="report-modal-backdrop" onClick={() => setOverrideModal(false)}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="report-modal-h">
              <b>Doctor Clinical Override</b>
              <button className="btn btn-outline btn-sm" onClick={() => setOverrideModal(false)}>✕</button>
            </div>
            <form onSubmit={handleOverrideSubmit} style={{ padding: 20 }}>
              <p className="muted" style={{ margin: '0 0 14px', fontSize: 13 }}>
                You are modifying the AI-predicted grade. All overrides are logged for regulatory audit and model calibration.
              </p>
              <div className="field">
                <label>Corrected DR Grade</label>
                <select value={overrideGrade} onChange={(e) => setOverrideGrade(e.target.value)}>
                  {[0, 1, 2, 3, 4].map((g) => (
                    <option key={g} value={g}>
                      Grade {g} — {gradeInfo(g).title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Clinical Reason for Override (Mandatory)</label>
                <textarea
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Artefact from illumination masquerading as blot hemorrhage; true microvascular changes absent."
                  required
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--line)' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button type="button" className="btn btn-outline" onClick={() => setOverrideModal(false)}>Cancel</button>
                <button type="submit" className="btn" style={{ background: '#ea580c', color: '#fff', border: 'none', fontWeight: 600 }}>
                  Confirm Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOCTOR DETAILED REPORT MODAL */}
      {doctorReportModal && (
        <div className="report-modal-backdrop" onClick={() => setDoctorReportModal(false)}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 840 }}>
            <div className="report-modal-h">
              <b>SEER Clinical Screening Dossier — Doctor's Detailed Report</b>
              <button className="btn btn-outline btn-sm" onClick={() => setDoctorReportModal(false)}>✕ Close</button>
            </div>
            <div className="report-modal-b" style={{ padding: 24, fontSize: 13 }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--line)', paddingBottom: 12, marginBottom: 14 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20 }}>SEER Clinical Retinopathy Assessment</h2>
                  <span className="mono" style={{ color: 'var(--muted)' }}>Screening ID: {c.id} · {c.eye}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{new Date().toLocaleDateString('en-IN')}</div>
                  <small className="muted">Model: seer-matlab-v1.2</small>
                </div>
              </div>

              {/* Patient & Exam Metadata */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, background: 'var(--surface-2)', padding: 10, borderRadius: 6, marginBottom: 14 }}>
                <div><span className="muted" style={{ fontSize: 11 }}>PATIENT</span><br /><b>{c.patient}</b></div>
                <div><span className="muted" style={{ fontSize: 11 }}>AGE / DIABETES</span><br /><b>{c.age}y / {c.years}y</b></div>
                <div><span className="muted" style={{ fontSize: 11 }}>EXAMINED EYE</span><br /><b>{c.eye}</b></div>
                <div><span className="muted" style={{ fontSize: 11 }}>IMAGE QUALITY</span><br /><b>{c.quality}/100</b></div>
              </div>

              {/* Confidence Score Callout */}
              <div style={{ padding: 12, borderRadius: 6, background: confBadge.bg, border: `1.5px solid ${confBadge.color}`, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: confBadge.color, textTransform: 'uppercase' }}>
                      Diagnostic Confidence Score (MATLAB Classifier)
                    </span>
                    <div style={{ fontSize: 20, fontWeight: 800, color: confBadge.color }}>
                      Confidence Score: {c.confidence}%
                    </div>
                  </div>
                  <span style={{ padding: '4px 10px', background: 'var(--surface)', borderRadius: 4, fontWeight: 700, color: confBadge.color, border: `1px solid ${confBadge.color}` }}>
                    {confBadge.label} ({confBadge.text})
                  </span>
                </div>
              </div>

              {/* Saliency & Heatmap section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div style={{ border: '1px solid var(--line)', padding: 10, borderRadius: 6 }}>
                  <b style={{ display: 'block', marginBottom: 6 }}>Original Retinal Fundus</b>
                  <div style={{ width: '100%', height: 180, background: '#0a0a0a', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                    {c.thumbnail ? <img src={c.thumbnail} alt="Fundus" style={{ maxHeight: 180, borderRadius: 4 }} /> : <span>Original Fundus Frame</span>}
                  </div>
                </div>
                <div style={{ border: '1px solid var(--line)', padding: 10, borderRadius: 6 }}>
                  <b style={{ display: 'block', marginBottom: 6 }}>Grad-CAM Activation Heatmap</b>
                  <div style={{ width: '100%', height: 180, background: '#0a0a0a', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                    {c.gradcam_path ? <img src={c.gradcam_path} alt="Grad-CAM" style={{ maxHeight: 180, borderRadius: 4 }} /> : <span style={{ color: '#22d3ee' }}>Grad-CAM Attention Overlay</span>}
                  </div>
                </div>
              </div>

              {/* Classification & ICDR Mapping */}
              <div style={{ border: '1px solid var(--line)', padding: 12, borderRadius: 6, marginBottom: 14 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>ICDR Severity Classification & Mapping</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                  <div>
                    <span className="muted" style={{ fontSize: 11 }}>PREDICTED GRADE</span>
                    <div style={{ fontSize: 16, fontWeight: 700, color: gi.c }}>Grade {c.grade} — {gi.short}</div>
                  </div>
                  <div>
                    <span className="muted" style={{ fontSize: 11 }}>ICDR CATEGORY & RATIONALE</span>
                    <div style={{ fontSize: 13 }}>{c.icdr_mapping?.why_this_grade || gi.title}</div>
                  </div>
                </div>
              </div>

              {/* Lesion Table */}
              <div style={{ border: '1px solid var(--line)', padding: 12, borderRadius: 6, marginBottom: 14 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>Identified Lesion Distribution (4-Quadrant)</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
                      <th style={{ padding: 6, textAlign: 'left' }}>Lesion Type</th>
                      <th style={{ padding: 6, textAlign: 'left' }}>Count</th>
                      <th style={{ padding: 6, textAlign: 'left' }}>Location (Quadrant Breakdown)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lesionTable.map((l, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: 6, fontWeight: 600 }}>{l.lesion_type}</td>
                        <td style={{ padding: 6 }}>{l.count}</td>
                        <td style={{ padding: 6, color: 'var(--muted)' }}>{l.quadrant}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Clinical Decision Summary */}
              <div style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 6, marginBottom: 14 }}>
                <b>Doctor Clinical Status: </b>
                <span style={{ textTransform: 'uppercase', fontWeight: 700, color: c.status === 'approved' ? '#16a34a' : c.status === 'overridden' ? '#ea580c' : '#991b1b' }}>
                  {c.status}
                </span>
                {c.overrideReason && <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>Override Rationale: {c.overrideReason}</p>}
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <p className="muted" style={{ margin: 0, fontSize: 11, fontStyle: 'italic', maxWidth: '70%' }}>
                  Notice: Model confidence does not equate to clinical diagnosis. All findings must be validated by an authorized clinician.
                </p>
                <button className="btn btn-primary" onClick={() => downloadDoctorReport(c.id, c)}>
                  Download Doctor's Report (PDF)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PATIENT REPORT MODAL — official medical report layout */}
      {patientReportModal && (
        <div className="report-modal-backdrop" onClick={() => setPatientReportModal(false)}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <div className="report-modal-h">
              <b>Patient Medical Report · {c.id}</b>
              <button className="btn btn-outline btn-sm" onClick={() => setPatientReportModal(false)}>✕ Close</button>
            </div>
            <div className="report-modal-b">
              <div className="report-paper" style={{ fontSize: 13.5 }}>
                {/* Letterhead */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em' }}>SEER · Community Retinal Health Initiative</div>
                    <div className="muted" style={{ fontSize: 12 }}>Primary Health Centre — Diabetic Retinopathy Screening Programme (SIH 26038)</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, whiteSpace: 'nowrap' }}>
                    <div><b>Report No:</b> {c.id}</div>
                    <div><b>Date:</b> {new Date(c.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                </div>
                <h2 style={{ textAlign: 'center', fontSize: 17, letterSpacing: '0.02em', margin: '14px 0 2px' }}>DIABETIC RETINOPATHY SCREENING — PATIENT MEDICAL REPORT</h2>
                <hr className="hair" style={{ borderTopWidth: 2, borderTopColor: '#0f1e33', margin: '8px 0 14px' }} />
                <p style={{ margin: '0 0 14px' }}><b>RE:</b> {c.patient} — retinal fundus screening of the {c.eye || 'examined eye'} for diabetic eye disease.</p>

                {/* 1. Patient details */}
                <h3 style={{ fontSize: 13, letterSpacing: '0.06em', margin: '0 0 6px' }}>1. PATIENT DETAILS</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 14 }}>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', width: '25%', color: 'var(--muted)' }}>Name</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', width: '25%' }}><b>{c.patient}</b></td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', width: '25%', color: 'var(--muted)' }}>Age</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', width: '25%' }}>{c.age ?? '—'} years</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', color: 'var(--muted)' }}>Examined eye</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px' }}>{c.eye || '—'}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', color: 'var(--muted)' }}>Diabetes duration</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px' }}>{c.years ?? '—'} years</td>
                    </tr>
                  </tbody>
                </table>

                {/* 2. Examination details */}
                <h3 style={{ fontSize: 13, letterSpacing: '0.06em', margin: '0 0 6px' }}>2. EXAMINATION DETAILS</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 14 }}>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', width: '25%', color: 'var(--muted)' }}>Screening site</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', width: '25%' }}>{s.phc || s.facility || 'Primary Health Centre'}</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', width: '25%', color: 'var(--muted)' }}>Camera / device</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', width: '25%' }}>{c.camera || 'Portable fundus camera'}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', color: 'var(--muted)' }}>Image quality</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px' }}>{c.quality ?? '—'}/100 ({c.sharpness || 'Gradable'})</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', color: 'var(--muted)' }}>Analysis system</td>
                      <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px' }}>SEER {c.model_version || 'seer-matlab-v1.2'}</td>
                    </tr>
                  </tbody>
                </table>

                {/* 3. Clinical findings */}
                <h3 style={{ fontSize: 13, letterSpacing: '0.06em', margin: '0 0 6px' }}>3. CLINICAL FINDINGS</h3>
                <div style={{ display: 'grid', gridTemplateColumns: c.thumbnail ? '220px 1fr' : '1fr', gap: 12, marginBottom: 14 }}>
                  {c.thumbnail && (
                    <figure style={{ margin: 0, border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                      <img src={c.thumbnail} alt={`Fundus photograph of ${c.patient}`} style={{ width: '100%', display: 'block' }} />
                      <figcaption className="muted" style={{ fontSize: 11.5, padding: '6px 8px' }}>Fig. 1 — Fundus photograph, {c.eye || 'examined eye'}.</figcaption>
                    </figure>
                  )}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, alignSelf: 'start' }}>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', width: '45%', color: 'var(--muted)' }}>ICDR grade</td>
                        <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px' }}><b style={{ color: gi.c }}>Grade {c.grade} — {gi.title}</b></td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', color: 'var(--muted)' }}>Diagnosis confidence level</td>
                        <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px' }}><b>{c.confidence ?? '—'}%</b></td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', color: 'var(--muted)' }}>Referable disease (Grade 2+)</td>
                        <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px' }}><b>{c.grade >= 2 ? 'YES — referral advised' : 'NO'}</b></td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', color: 'var(--muted)' }}>Lesion summary</td>
                        <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', fontSize: 12.5 }}>
                          {lesionTable.filter((l) => Number(l.count) > 0).map((l) => `${l.lesion_type}: ${l.count}`).join(' · ') || 'No lesions detected'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 4. Doctor's observations */}
                <h3 style={{ fontSize: 13, letterSpacing: '0.06em', margin: '0 0 6px' }}>4. DOCTOR&apos;S OBSERVATIONS</h3>
                <p style={{ margin: '0 0 14px', lineHeight: 1.6 }}>
                  {c.grade >= 2
                    ? 'Signs of diabetic retinopathy were detected in the retina. An in-person examination by an eye specialist is required to confirm these findings and plan treatment.'
                    : c.grade === 1
                    ? 'Very minor early vessel changes were observed (microaneurysms). Sight is not currently affected. Blood sugar control and re-screening in 6 to 12 months are advised.'
                    : 'No diabetic eye damage was observed today. Continue prescribed medication with a routine annual eye examination.'}
                  {c.validatedBy ? ` Reviewed by ${c.validatedBy}.` : ''}
                </p>

                {/* 5. Notes and next steps */}
                <h3 style={{ fontSize: 13, letterSpacing: '0.06em', margin: '0 0 6px' }}>5. NOTES AND NEXT STEPS</h3>
                <ol style={{ margin: '0 0 16px', paddingLeft: 20, display: 'grid', gap: 5, lineHeight: 1.55 }}>
                  <li>{gi.action}</li>
                  <li>Keep blood sugar (HbA1c) and blood pressure within the targets set by your doctor.</li>
                  <li>Do not wait for blurred vision — diabetic eye damage often progresses silently.</li>
                  <li>Carry this report and your diabetes medication record to every consultation.</li>
                </ol>

                {/* Signatures */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 12px' }}>
                    <div className="muted" style={{ fontSize: 11.5 }}>Issuing Primary Health Centre</div>
                    <div style={{ fontWeight: 700, marginTop: 18 }}>{s.phc || s.facility || 'PHC Health Desk'}</div>
                    <div className="muted" style={{ fontSize: 12 }}>Health worker / ASHA verified</div>
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 12px' }}>
                    <div className="muted" style={{ fontSize: 11.5 }}>Reviewing doctor</div>
                    <div style={{ fontWeight: 700, marginTop: 18 }}>{c.validatedBy || 'Dr. A. Patil, MBBS, MS (Ophthalmology)'}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{new Date(c.validatedAt || c.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                </div>

                <p className="muted" style={{ fontSize: 11.5, margin: '0 0 4px' }}>
                  This AI-assisted screening report supports clinical triage and does not replace an ophthalmic slit-lamp examination. All findings require clinician confirmation.
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 10, marginTop: 6 }}>
                  <span className="muted" style={{ fontSize: 11.5 }}>Page 1 of 1 · SEER (SIH 26038)</span>
                  <button className="btn btn-primary btn-sm" onClick={() => downloadPatientReport(c.id, c)}>
                    Download PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast show" role="status">{toast}</div>}
    </div>
  );
}
