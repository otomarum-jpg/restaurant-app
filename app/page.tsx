'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

const DEFAULT_CENTER: [number, number] = [35.4232, 136.7608];

const MODES = {
  walk: { max: 1, default: 0.5, step: 0.1, hint: '徒歩：最大1km（約12分）', color: '#1D9E75' },
  bike: { max: 3, default: 1.5, step: 0.1, hint: '自転車：最大3km（約10分）', color: '#378ADD' },
  car:  { max: 10, default: 5, step: 0.5, hint: '車：最大10km（約15分）', color: '#D85A30' },
};

const SITES = [
  { id: 'google', name: 'Google', dot: '#4285F4' },
  { id: 'tabelog', name: '食べログ', dot: '#8B4513' },
  { id: 'retty', name: 'Retty', dot: '#FF9500' },
  { id: 'gurunavi', name: 'ぐるなび', dot: '#00AA44' },
  { id: 'hotpepper', name: 'ホットペッパー', dot: '#CC0066' },
];

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return <span style={{ color: '#EF9F27', fontSize: 11 }}>{'★'.repeat(full)}{'☆'.repeat(5-full)}</span>;
}

function haversine(a: number, b: number, c: number, d: number) {
  const R = 6371, dL = (c-a)*Math.PI/180, dG = (d-b)*Math.PI/180;
  const x = Math.sin(dL/2)**2 + Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dG/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

export default function Home() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circleRef = useRef<any>(null);
  const currentMarkerRef = useRef<any>(null);

  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [mode, setMode] = useState<keyof typeof MODES>('walk');
  const [radius, setRadius] = useState(0.5);
  const [openOnly, setOpenOnly] = useState(false);
  const [activeId, setActiveId] = useState<number|null>(null);
  const [places, setPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [site, setSite] = useState('google');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) setSidebarOpen(false);
  }, []);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
      () => setCenter(DEFAULT_CENTER)
    );
  }, []);

  const fetchPlaces = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/places?lat=${center[0]}&lng=${center[1]}&radius=${radius * 1000}`);
      const data = await res.json();
      setPlaces(data.places || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [center, radius]);

  useEffect(() => { fetchPlaces(); }, [fetchPlaces]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstance.current) {
      mapInstance.current.setView(center, 15);
      if (currentMarkerRef.current) currentMarkerRef.current.setLatLng(center);
      return;
    }
    import('leaflet').then(L => {
      import('leaflet/dist/leaflet.css');
      const map = L.map(mapRef.current!).setView(center, 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
      currentMarkerRef.current = L.circleMarker(center, { radius: 6, color: '#fff', weight: 2, fillColor: '#534AB7', fillOpacity: 1 }).addTo(map).bindTooltip('現在地');
      mapInstance.current = map;
    });
  }, [center]);

  useEffect(() => {
    if (!mapInstance.current) return;
    import('leaflet').then(L => {
      markersRef.current.forEach(m => m && mapInstance.current.removeLayer(m));
      markersRef.current = [];
      if (circleRef.current) mapInstance.current.removeLayer(circleRef.current);
      const modeColor = MODES[mode].color;
      circleRef.current = L.circle(center, { radius: radius * 1000, color: modeColor, weight: 1.5, fillColor: modeColor, fillOpacity: 0.07 }).addTo(mapInstance.current);
      places.forEach((p, i) => {
        const lat = p.location?.latitude;
        const lng = p.location?.longitude;
        if (!lat || !lng) return;
        const isOpen = p.regularOpeningHours?.openNow;
        const bg = isOpen ? '#1D9E75' : '#E24B4A';
        const icon = L.divIcon({ html: `<div style="width:12px;height:12px;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`, iconSize: [16,16], iconAnchor: [8,8], className: '' });
        const m = L.marker([lat, lng], { icon }).addTo(mapInstance.current)
          .bindPopup(`<b>${p.displayName?.text}</b><br>評価: ${p.rating ?? 'なし'}<br>${isOpen ? '営業中' : '準備中'}`);
        m.on('click', () => setActiveId(i));
        markersRef.current[i] = m;
      });
    });
  }, [places, mode, radius, center]);

  useEffect(() => {
    if (mapInstance.current) {
      setTimeout(() => mapInstance.current.invalidateSize(), 300);
    }
  }, [sidebarOpen]);

  const modeConfig = MODES[mode];
  const visible = places
    .map((p, i) => ({
      p, i,
      dist: haversine(center[0], center[1], p.location?.latitude, p.location?.longitude),
      isOpen: p.regularOpeningHours?.openNow,
    }))
    .filter(({ isOpen }) => !openOnly || isOpen)
    .sort((a, b) => (b.p.rating ?? 0) - (a.p.rating ?? 0));

  const handleCardClick = (i: number) => {
    setActiveId(i);
    const m = markersRef.current[i];
    const p = places[i];
    if (m && p) {
      m.openPopup();
      mapInstance.current?.setView([p.location.latitude, p.location.longitude], 16);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', position: 'relative' }}>
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'fixed', top: 60, left: sidebarOpen ? 308 : 12, zIndex: 9999,
          width: 32, height: 32, borderRadius: '50%', border: '1px solid #ddd',
          background: '#fff', cursor: 'pointer', fontSize: 14, transition: 'left 0.3s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
        }}>
        {sidebarOpen ? '◀' : '▶'}
      </button>
      <div style={{
        width: sidebarOpen ? 300 : 0, minWidth: 0, background: '#fff',
        borderRight: '1px solid #eee', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', transition: 'width 0.3s', flexShrink: 0
      }}>
        <div style={{ width: 300, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #eee' }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10 }}>近くのお店を探す</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(Object.keys(MODES) as (keyof typeof MODES)[]).map(m => (
                <button key={m} onClick={() => { setMode(m); setRadius(MODES[m].default); }}
                  style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: `1px solid ${mode===m ? '#378ADD' : '#ddd'}`, background: mode===m ? '#EBF4FF' : '#fff', color: mode===m ? '#185FA5' : '#666', fontSize: 12, cursor: 'pointer' }}>
                  {m==='walk'?'🚶 徒歩': m==='bike'?'🚲 自転車':'🚗 車'}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 3 }}>
                <span>検索範囲</span><span style={{ fontWeight: 600, color: '#111' }}>{radius.toFixed(1)} km</span>
              </div>
              <input type="range" min={0.1} max={modeConfig.max} step={modeConfig.step} value={radius}
                onChange={e => setRadius(parseFloat(e.target.value))} style={{ width: '100%' }} />
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>{modeConfig.hint}</div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#555', cursor: 'pointer' }}>
              <div onClick={() => setOpenOnly(!openOnly)}
                style={{ width: 34, height: 18, borderRadius: 9, background: openOnly ? '#1D9E75' : '#ccc', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: '#fff', top: 2, left: openOnly ? 18 : 2, transition: 'left 0.2s' }} />
              </div>
              営業中のみ表示
            </label>
          </div>
          <div style={{ display: 'flex', borderBottom: '1px solid #eee', overflowX: 'auto' }}>
            {SITES.map(s => (
              <div key={s.id} onClick={() => setSite(s.id)}
                style={{ padding: '8px 10px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: site===s.id ? '2px solid #111' : '2px solid transparent', color: site===s.id ? '#111' : '#888', fontWeight: site===s.id ? 600 : 400, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />{s.name}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#888', padding: '5px 14px', borderBottom: '1px solid #eee' }}>
            {loading ? '読み込み中...' : `${visible.length}件のお店`}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {visible.length === 0 && !loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#aaa', fontSize: 13 }}>条件に合うお店が見つかりません</div>
            ) : visible.map(({ p, i, dist, isOpen }) => (
              <div key={i} onClick={() => handleCardClick(i)}
                style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${activeId===i ? '#378ADD' : 'transparent'}`, background: activeId===i ? '#EBF4FF' : 'transparent', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 3 }}>{p.displayName?.text}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {p.rating && <><Stars rating={p.rating} /><span style={{ fontSize: 12, fontWeight: 600 }}>{p.rating}</span><span style={{ fontSize: 10, color: '#aaa' }}>（{p.userRatingCount}件）</span></>}
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: isOpen ? '#EAF3DE' : '#FCEBEB', color: isOpen ? '#3B6D11' : '#A32D2D', fontWeight: 600 }}>{isOpen ? '営業中' : '準備中'}</span>
                  <span style={{ fontSize: 11, color: '#bbb' }}>{dist.toFixed(1)}km</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {p.googleMapsUri && <a href={p.googleMapsUri} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#EBF4FF', color: '#185FA5', textDecoration: 'none', border: '1px solid #B5D4F4' }}>Google マップ</a>}
                  {p.websiteUri && <a href={p.websiteUri} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#EAF3DE', color: '#3B6D11', textDecoration: 'none', border: '1px solid #C0DD97' }}>公式サイト</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div ref={mapRef} style={{ flex: 1 }} />
    </div>
  );
}