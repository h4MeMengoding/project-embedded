import { Fragment } from 'react';
import { formatWib } from '@ws/core';
import type { DeviceStatus } from '@ws/db';
import { Card } from '../Card';

const dur = (s: number | null) => (s == null ? '—' : `${Math.floor(s / 3600)} j ${Math.floor((s % 3600) / 60)} m`);

export function DeviceStatusCard({ s, deviceId }: { s: DeviceStatus; deviceId: string }) {
  const rows: [string, string][] = [
    ['Status', s.online ? 'Online' : 'Offline'],
    ['Terakhir terlihat', s.lastSeenAt ? `${formatWib(s.lastSeenAt, 'datetime')} WIB` : 'Belum pernah terlihat'],
    ['RSSI', s.rssi == null ? '—' : `${s.rssi} dBm`],
    ['Uptime', dur(s.uptimeS)],
    ['Sisa heap', s.heapFree == null ? '—' : `${(s.heapFree / 1024).toFixed(0)} KB`],
    ['Backlog buffer', s.backlog == null ? '—' : `${s.backlog} record`],
    ['buffer_full', s.bufferFull == null ? '—' : s.bufferFull ? 'Ya' : 'Tidak'],
    ['Firmware', s.fwVersion ?? '—'],
  ];
  return (
    <Card tone="light" title={`Perangkat ${deviceId}`}>
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 24px', marginTop: 16 }}>
        {rows.map(([k, v]) => (<Fragment key={k}><dt style={{ color: 'var(--muted)' }}>{k}</dt><dd style={{ fontWeight: 700 }}>{v}</dd></Fragment>))}
      </dl>
    </Card>
  );
}
