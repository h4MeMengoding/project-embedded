import { ACTIVE_FUZZY_CONFIG } from '@ws/core';

export function RuleTable() {
  return (
    <div className="card light" data-aos="fade-up" style={{ overflowX: 'auto' }}>
      <h3>27 aturan (config {ACTIVE_FUZZY_CONFIG.version})</h3>
      <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse', minWidth: 480 }}>
        <thead>
          <tr style={{ textAlign: 'left', fontSize: 13, color: 'var(--muted)' }}>
            <th style={{ padding: 8 }}>No</th><th>ΔP3h terkoreksi</th><th>RH</th><th>DPD</th><th>Peluang</th>
          </tr>
        </thead>
        <tbody>
          {ACTIVE_FUZZY_CONFIG.rules.map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--card2)' }}>
              <td style={{ padding: 8, fontWeight: 700 }}>R{i + 1}</td><td>{r.dp}</td><td>{r.rh}</td><td>{r.dpd}</td><td>{r.out}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
