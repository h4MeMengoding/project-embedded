export function StationIllustration() {
  return (
    <div className="stn" aria-hidden="true">
      <svg viewBox="0 0 330 330">
        <defs>
          <linearGradient id="metal" x1="0" x2="1"><stop offset="0" stopColor="#f2f5f2" /><stop offset="1" stopColor="#b9c3bb" /></linearGradient>
          <linearGradient id="plate" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#27412f" /><stop offset="1" stopColor="#0f2216" /></linearGradient>
        </defs>
        <ellipse cx="170" cy="312" rx="125" ry="12" fill="rgba(0,0,0,.18)" />
        <rect x="163" y="64" width="9" height="236" rx="4" fill="url(#metal)" />
        <g className="float"><g transform="translate(167 40)">
          <g stroke="#ffe27a" strokeWidth="2.5" strokeLinecap="round">
            <line className="ray" x1="0" y1="-26" x2="0" y2="-38" />
            <line className="ray" x1="-20" y1="-20" x2="-28" y2="-29" style={{ animationDelay: '.3s' }} />
            <line className="ray" x1="20" y1="-20" x2="28" y2="-29" style={{ animationDelay: '.6s' }} />
            <line className="ray" x1="-28" y1="-4" x2="-40" y2="-8" style={{ animationDelay: '.9s' }} />
            <line className="ray" x1="28" y1="-4" x2="40" y2="-8" style={{ animationDelay: '1.2s' }} />
          </g>
          <path d="M-20 14a20 20 0 0 1 40 0z" fill="#fff" stroke="#c8d2c9" />
          <rect x="-22" y="14" width="44" height="7" rx="3" fill="url(#metal)" />
        </g></g>
        <g transform="translate(167 108)">
          <rect x="-34" y="0" width="68" height="9" rx="4" fill="#f4f7f4" stroke="#c8d2c9" />
          <rect x="-34" y="13" width="68" height="9" rx="4" fill="#eef2ee" stroke="#c8d2c9" />
          <rect x="-34" y="26" width="68" height="9" rx="4" fill="#e6ece6" stroke="#c8d2c9" />
          <rect x="-34" y="39" width="68" height="9" rx="4" fill="#dde5de" stroke="#c8d2c9" />
        </g>
        <g transform="translate(185 178)">
          <rect width="38" height="26" rx="5" fill="#1d3b27" />
          <rect x="6" y="6" width="26" height="14" rx="3" fill="#2e5a3d" />
          <circle cx="19" cy="13" r="3" fill="#7dff8a" className="led" />
        </g>
        <line x1="172" y1="191" x2="185" y2="191" stroke="#b9c3bb" strokeWidth="4" />
        <g transform="translate(70 196) rotate(-14)">
          <rect width="86" height="54" rx="7" fill="url(#plate)" stroke="#cfd9d1" strokeWidth="2" />
          <path d="M8 8h70M8 18h70M8 28h70M8 38h70M8 48h70" stroke="#8fd3a0" strokeWidth="1.6" fill="none" opacity=".8" strokeDasharray="3 3" />
        </g>
        <line x1="150" y1="248" x2="163" y2="246" stroke="#b9c3bb" strokeWidth="4" />
        <g fill="#aee3ff">
          <ellipse className="drop" cx="88" cy="132" rx="2.4" ry="4.4" />
          <ellipse className="drop" cx="104" cy="126" rx="2.4" ry="4.4" />
          <ellipse className="drop" cx="120" cy="136" rx="2.4" ry="4.4" />
          <ellipse className="drop" cx="136" cy="128" rx="2.4" ry="4.4" />
          <ellipse className="drop" cx="96" cy="140" rx="2.4" ry="4.4" />
        </g>
        <g transform="translate(205 232)">
          <rect width="82" height="62" rx="9" fill="url(#metal)" stroke="#aeb9b0" />
          <rect x="8" y="9" width="66" height="30" rx="4" fill="#173625" />
          <rect x="14" y="15" width="22" height="9" rx="2" fill="#2f6a46" />
          <text x="41" y="33" fontSize="8" fill="#9fe3b0" fontFamily="monospace">ESP32</text>
          <circle cx="16" cy="51" r="3" fill="#7dff8a" className="led" />
          <circle cx="28" cy="51" r="3" fill="#ffc93c" className="led" style={{ animationDelay: '.5s' }} />
        </g>
        <line x1="172" y1="262" x2="205" y2="262" stroke="#b9c3bb" strokeWidth="4" />
        <g transform="translate(296 224)" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
          <path className="wave" d="M-14 0a20 20 0 0 1 28 0" />
          <path className="wave" d="M-9 5a13 13 0 0 1 18 0" />
          <path className="wave" d="M-4 10a6 6 0 0 1 8 0" />
          <circle cy="15" r="2" fill="#fff" />
        </g>
      </svg>
      <div className="tag" style={{ left: '54%', top: '-4%' }}><i />BH1750 <em>Cahaya</em></div>
      <div className="tag" style={{ right: '-6%', top: '33%' }}><i />DHT22 <em>Suhu &amp; RH</em></div>
      <div className="tag" style={{ right: '-2%', top: '53%' }}><i />BMP280 <em>Tekanan</em></div>
      <div className="tag" style={{ left: '-4%', top: '51%' }}><i />FC-37 <em>Hujan</em></div>
    </div>
  );
}
