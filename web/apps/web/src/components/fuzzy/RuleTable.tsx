import { FUZZY_CONFIG_V1 } from '@ws/core';

export function RuleTable() {
  return (
    <div className="card light" style={{ overflowX: 'auto' }}>
      <h3>27 aturan (config {FUZZY_CONFIG_V1.version})</h3>
      <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse', minWidth: 480 }}>
        <thead>
          <tr style={{ textAlign: 'left', fontSize: 13, color: 'var(--muted)' }}>
            <th style={{ padding: 8 }}>No</th><th>ΔP3h</th><th>RH</th><th>DPD</th><th>Peluang</th>
          </tr>
        </thead>
        <tbody>
          {FUZZY_CONFIG_V1.rules.map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--card2)' }}>
              <td style={{ padding: 8, fontWeight: 700 }}>R{i + 1}</td><td>{r.dp}</td><td>{r.rh}</td><td>{r.dpd}</td><td>{r.out}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
