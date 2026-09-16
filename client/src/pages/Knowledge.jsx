import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAudit, getPacket } from '../lib/api.js';

// Static dataset nodes — the four public sets grounding the pipeline.
const DATASETS = [
  { id: 'ds-aptos', name: 'APTOS 2019', sub: '3,662 rural-camp photos · L0–4', role: 'Grading head + noise robustness' },
  { id: 'ds-idrid', name: 'IDRiD', sub: '516 graded · 81 pixel masks · India', role: 'Explainability truth (MA/HE/EX/SE)' },
  { id: 'ds-drive', name: 'DRIVE', sub: '40 images · vessel tracings', role: 'Vessel-branch sanity check' },
  { id: 'ds-messidor', name: 'Messidor-2', sub: '1,748 paired images', role: 'Referable L2+ validation' },
];

const GRADE_C = ['#0e9f8a', '#65a30d', '#b45309', '#ea580c', '#dc2626'];
const W = 980, LCOL = 150, MCOL = 480, RCOL = 810;

function anchorDatasets(a) {
  const s = (a.dataset || '').toUpperCase();
  const out = [];
  if (s.includes('IDRID')) out.push('ds-idrid');
  if (s.includes('APTOS')) out.push('ds-aptos');
  return out;
}

export default function Knowledge() {
  const [packet, setPacket] = useState(null);
  const [audit, setAudit] = useState(null);
  const [gradeFilter, setGradeFilter] = useState('all');
  const [showPeers, setShowPeers] = useState(true);
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => { getPacket().then(setPacket); getAudit(30).then(setAudit); }, []);

  const anchors = useMemo(() => (packet?.anchors || []).map((a, i) => ({ ...a, kind: 'anchor', nid: a.id, y: 0, i })), [packet]);
  const analyses = useMemo(() => {
    const list = (audit?.audits || []).filter((a) => gradeFilter === 'all' || a.grade === Number(gradeFilter));
    // Group by grade lanes, newest first.
    const lanes = [[], [], [], [], []];
    [...list].reverse().forEach((a) => lanes[a.grade]?.push(a));
    return lanes.flat().map((a, i) => ({ ...a, kind: 'analysis', nid: a.aid }));
  }, [audit, gradeFilter]);

  // Positions: datasets left column, anchors middle, analyses right in grade lanes.
  const nodes = useMemo(() => {
    const H = Math.max(460, analyses.length * 52 + 140);
    const map = {};
    DATASETS.forEach((d, i) => { map[d.id] = { ...d, kind: 'dataset', nid: d.id, x: LCOL, y: 90 + i * ((H - 160) / Math.max(1, DATASETS.length - 1 || 1)) }; });
    anchors.forEach((a, i) => { map[a.nid] = { ...a, x: MCOL, y: 90 + i * ((H - 160) / Math.max(1, anchors.length - 1 || 1)) }; });
    const lanes = [[], [], [], [], []];
    analyses.forEach((a) => lanes[a.grade]?.push(a));
    lanes.forEach((lane, g) => lane.forEach((a, j) => {
      map[a.nid] = { ...a, x: RCOL, y: 70 + g * ((H - 120) / 5) + j * 40 + 20 };
    }));
    return { map, H };
  }, [anchors, analyses]);

  // Edges = similarities. Every edge has a human-readable reason.
  const edges = useMemo(() => {
    const E = [];
    const byAnchor = {};
    anchors.forEach((a) => {
      anchorDatasets(a).forEach((ds) => E.push({ from: ds, to: a.nid, kind: 'source', label: `anchor drawn from ${DATASETS.find((d) => d.id === ds)?.name}` }));
      byAnchor[a.grade] = a.id;
    });
    // Role edges for sets with no direct anchors (honest about what they validate).
    anchors.forEach((a) => {
      E.push({ from: 'ds-drive', to: a.nid, kind: 'role', label: 'DRIVE validates vessel branch' });
      if (a.grade >= 2) E.push({ from: 'ds-messidor', to: a.nid, kind: 'role', label: 'Messidor-2 validates referable grades' });
    });
    analyses.forEach((a) => {
      const an = byAnchor[a.grade];
      if (an) E.push({ from: a.nid, to: an, kind: 'grade', label: `graded L${a.grade} — matches anchor` });
    });
    if (showPeers) {
      const seen = {};
      analyses.forEach((a) => {
        analyses.forEach((b) => {
          if (a.nid >= b.nid || a.grade !== b.grade) return;
          const k = a.nid + b.nid;
          if (!seen[k]) { seen[k] = 1; E.push({ from: a.nid, to: b.nid, kind: 'peer', label: `both L${a.grade}` }); }
        });
      });
    }
    return E;
  }, [anchors, analyses, showPeers]);

  const adj = useMemo(() => {
    const m = {};
    edges.forEach((e) => { (m[e.from] = m[e.from] || new Set()).add(e.to); (m[e.to] = m[e.to] || new Set()).add(e.from); });
    return m;
  }, [edges]);

  const lit = (id) => !hover || hover === id || adj[hover]?.has(id);
  const edgeLit = (e) => !hover || hover === e.from || hover === e.to;
  const curve = (a, b) => `M ${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}`;

  const sel = selected ? nodes.map[selected] : null;
  const selEdges = selected ? edges.filter((e) => e.from === selected || e.to === selected) : [];

  return (
    <div className="page">
      <div className="page-head">
        <div><span className="kicker">Knowledge base</span><h1>Graph of what the system knows</h1>
          <p className="muted"><span className="swatch ds" /> datasets · <span className="swatch an" /> your analysed tests · grey hubs are grade anchors linking them. Hover any node to trace its similarities.</p></div>
        <Link className="btn btn-primary" to="/app/memory">Memory →</Link>
      </div>

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Filter by grade">
          {['all', '0', '1', '2', '3', '4'].map((g) => <button key={g} aria-pressed={gradeFilter === g} onClick={() => setGradeFilter(g)}>{g === 'all' ? `All (${(audit?.audits || []).length})` : `L${g}`}</button>)}
        </div>
        <label className="check"><input type="checkbox" checked={showPeers} onChange={(e) => setShowPeers(e.target.checked)} /> peer links (same-grade tests)</label>
      </div>

      {!packet && !audit ? <section className="card"><div className="card-b"><p className="muted">Start the API (:4000) — the graph is built live from its anchors + audit trail.</p></div></section> : (
        <div className="kg-wrap">
          <section className="card kg-canvas">
            <svg viewBox={`0 0 ${W} ${nodes.H}`} className="kg-svg" role="img" aria-label="Knowledge graph: datasets, anchors, analysed tests">
              <text x={LCOL} y={34} textAnchor="middle" className="kg-col">DATASETS</text>
              <text x={MCOL} y={34} textAnchor="middle" className="kg-col">GRADE ANCHORS</text>
              <text x={RCOL} y={34} textAnchor="middle" className="kg-col">ANALYSED TESTS</text>
              {[0, 1, 2, 3, 4].map((g) => (
                <text key={g} x={W - 24} y={70 + g * ((nodes.H - 120) / 5) + 24} textAnchor="end" className="kg-lane">L{g}</text>
              ))}
              {edges.map((e, i) => {
                const a = nodes.map[e.from], b = nodes.map[e.to];
                if (!a || !b) return null;
                return <path key={i} d={curve(a, b)} className={`kg-edge ${e.kind}${edgeLit(e) ? ' lit' : ''}`} />;
              })}
              {Object.values(nodes.map).map((n) => (
                <g key={n.nid} className={`kg-node${lit(n.nid) ? ' lit' : ''}${selected === n.nid ? ' sel' : ''}`}
                   onMouseEnter={() => setHover(n.nid)} onMouseLeave={() => setHover(null)}
                   onClick={() => setSelected(selected === n.nid ? null : n.nid)} tabIndex={0}
                   onKeyDown={(e) => { if (e.key === 'Enter') setSelected(selected === n.nid ? null : n.nid); }}
                   role="button" aria-label={n.kind === 'dataset' ? n.name : n.kind === 'anchor' ? `${n.nid} grade ${n.grade}` : `${n.nid} grade ${n.grade}`}>
                  {n.kind === 'dataset' && <><rect x={n.x - 62} y={n.y - 24} width={124} height={48} rx={10} className="kg-ds" /><text x={n.x} y={n.y - 2} textAnchor="middle" className="kg-t">{n.name}</text><text x={n.x} y={n.y + 14} textAnchor="middle" className="kg-s">{n.sub}</text></>}
                  {n.kind === 'anchor' && <><circle cx={n.x} cy={n.y} r={17} className="kg-an" /><text x={n.x} y={n.y + 5} textAnchor="middle" className="kg-an-t">G{n.grade}</text><text x={n.x + 24} y={n.y + 4} className="kg-s">{n.nid}</text></>}
                  {n.kind === 'analysis' && <><circle cx={n.x} cy={n.y} r={13} className="kg-ax" style={{ '--gc': GRADE_C[n.grade] }} /><text x={n.x} y={n.y + 4} textAnchor="middle" className="kg-ax-t">{n.grade}</text><text x={n.x + 20} y={n.y + 4} className="kg-s">{n.nid} · {n.confidence}%</text></>}
                </g>
              ))}
            </svg>
            <div className="kg-legend">
              <span><i className="swatch ds" /> dataset (public, blue)</span>
              <span><i className="swatch ax" /> analysed test (yours, teal)</span>
              <span><i className="swatch an" /> grade anchor (hub)</span>
              <span className="muted">solid = grade match · dashed = peer · dotted = validates</span>
            </div>
          </section>

          <aside className="card kg-side">
            <div className="card-h"><b>{sel ? 'Selected' : 'How to read this'}</b><span className="mono">{analyses.length} TESTS</span></div>
            <div className="card-b">
              {!sel ? <>
                <p className="muted">Blue datasets ground the grey anchors; your teal tests hang off the anchor they matched. A test far from its anchor's lane, or with many peer links at a high grade, deserves a second look.</p>
                <p className="muted">Click any node for detail. Empty right side? Screen someone first.</p>
              </> : sel.kind === 'dataset' ? <>
                <h3>{sel.name}</h3><p className="muted">{sel.sub}</p><p><b>Role:</b> {sel.role}</p>
                <p className="muted">{selEdges.length} links in current view.</p>
              </> : sel.kind === 'anchor' ? <>
                <h3>{sel.nid} · Grade {sel.grade}</h3><p className="muted">{sel.dataset}</p><p>{sel.note}</p>
                <p className="muted">{selEdges.length} links in current view.</p>
              </> : <>
                <h3>{sel.nid} · Grade {sel.grade}</h3>
                <p className="muted">{sel.confidence}% sure · quality {sel.quality}/100 · {sel.provider} · {new Date(sel.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
                <div className="tag">RULES APPLIED</div>
                <ul className="anchor-list">{(sel.rules || []).map((r) => <li key={r} className="mono">{r}</li>)}</ul>
                <div className="tag">SIMILARITIES ({selEdges.length})</div>
                <ul className="anchor-list">{selEdges.map((e, i) => <li key={i}>{e.label}</li>)}</ul>
              </>}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
