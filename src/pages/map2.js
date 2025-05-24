// src/pages/map.js
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';

export default function MapPage() {
  const [logs, setLogs] = useState([]);
  const mapRef = useRef(null);

  // Fetch logs
  useEffect(() => {
    fetch('/api/log')
      .then(r => r.json())
      .then(setLogs)
      .catch(console.error);
  }, []);

  // Initialize map once
  useEffect(() => {
    if (!logs.length || mapRef.current) return;
    (async () => {
      const L = await import('leaflet');
      const map = L.map('map').setView([0, 0], 2);
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap',
      }).addTo(map);
    })();
  }, [logs]);

  // Add markers
  useEffect(() => {
    if (!mapRef.current) return;
    (async () => {
      const L = await import('leaflet');
      logs.forEach(log => {
        if (typeof log.lat !== 'number') return;
        const marker = L.circleMarker([log.lat, log.lng], {
          radius: 8,
          color: log.locationMethod === 'auto' ? 'green' : 'orange',
        }).addTo(mapRef.current);
        marker.bindPopup(`
          <b>${log.username}</b><br/>
          ${log.duration}s — $${log.earnings}<br/>
          ${log.city}
        `);
      });
    })();
  }, [logs]);

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      <Link
        href="/"
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: 1000,
          background: 'white',
          padding: '0.5em 1em',
          borderRadius: '4px',
          textDecoration: 'none',
          color: '#333',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      >
        ← Home
      </Link>
      <div id="map" style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
