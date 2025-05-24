<#
complete-setup-v2.ps1
Automates full Paid-to-Poo MVP setup + UI polish.
#>

# 1) Install dependencies
npm install firebase firebase-admin uuid leaflet prettier

# 2) Firebase client initializer
New-Item -ItemType Directory -Path "src\firebase" -Force | Out-Null
@"
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!getApps().length) initializeApp(firebaseConfig);
export const db = getFirestore();
"@ | Set-Content -Path "src\firebase\clientApp.js" -Encoding UTF8

# 3) Identity util
New-Item -ItemType Directory -Path "src\utils" -Force | Out-Null
@"
import { v4 as uuidv4 } from 'uuid';

const pooPuns = ['SirPoopsALot','DooDooDuke','StoolSurfer','BathroomBandit','CaptainCrapper'];
export function getIdentity() {
  if (typeof window === 'undefined') return { username: null, token: null };
  let u = localStorage.getItem('username');
  let t = localStorage.getItem('token');
  if (!u || !t) {
    u = pooPuns[Math.floor(Math.random() * pooPuns.length)];
    t = uuidv4();
    localStorage.setItem('username', u);
    localStorage.setItem('token', t);
  }
  return { username: u, token: t };
}
"@ | Set-Content -Path "src\utils\identity.js" -Encoding UTF8

# 4) API routes
New-Item -ItemType Directory -Path "src\pages\api" -Force | Out-Null

# 4a) profile.js
@"
import { db } from '@/firebase/clientApp';
import { doc, setDoc } from 'firebase/firestore';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { token, username, rate } = req.body;
  if (!token || !username || !rate) return res.status(400).end('Missing');
  await setDoc(doc(db, 'profiles', token), { username, rate });
  res.status(200).json({ success: true });
}
"@ | Set-Content -Path "src\pages\api\profile.js" -Encoding UTF8

# 4b) log.js with reverse geocode
@"
import { db } from '@/firebase/clientApp';
import { collection, addDoc, getDocs } from 'firebase/firestore';
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const e = req.body;
    let city = null;
    if (e.lat != null && e.lng != null) {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${e.lat}&lon=${e.lng}`;
        const d = await (await fetch(url, {
          headers: {
            'User-Agent': 'Paid-to-Poo-App/1.0',
            'Accept': 'application/json'
          }
        })).json();
        const a = d.address || {};
        city = a.city_district || a.suburb || a.municipality || a.county || null;
        if (!city && d.display_name) city = d.display_name.split(',')[1].trim();
      } catch (err) {
        console.error(err);
      }
    }
    if (!city && e.lat != null) city = `${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}`;
    const r = await addDoc(collection(db, 'pooLogs'), { ...e, city });
    return res.status(200).json({ id: r.id, city });
  }
  if (req.method === 'GET') {
    const s = await getDocs(collection(db, 'pooLogs'));
    return res.status(200).json(s.docs.map(d => ({ id: d.id, ...d.data() })));
  }
  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end();
}
"@ | Set-Content -Path "src\pages\api\log.js" -Encoding UTF8

# 5) Pages

# 5a) index.js
@"
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { getIdentity } from '@/utils/identity';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  const [identity, setIdentity] = useState({ username: null, token: null });
  const [rate, setRate] = useState(null);
  const [amt, setAmt] = useState('');
  const [unit, setUnit] = useState('hourly');
  const [step, setStep] = useState('form');
  const [timing, setTiming] = useState(false);
  const [start, setStart] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [city, setCity] = useState('');

  useEffect(() => {
    const id = getIdentity();
    setIdentity(id);
    const v = localStorage.getItem('rate');
    if (v) {
      setRate(JSON.parse(v));
      setStep('timer');
    }
  }, []);

  useEffect(() => {
    let iv;
    if (timing) {
      iv = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    }
    return () => clearInterval(iv);
  }, [timing, start]);

  const submitLog = async (data) => {
    const earn = ((rate * elapsed) / 3600).toFixed(2);
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, username: identity.username, token: identity.token, duration: elapsed, earnings: Number(earn), timestamp: Date.now() }),
    });
    router.push('/map');
  };

  if (step === 'form') {
    return (
      <>
        <Head><title>Enter Salary</title></Head>
        <div className="min-h-screen flex justify-center items-center">
          <div className="card p-4">
            <h2>Enter Salary</h2>
            <input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} />
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="hourly">Hourly</option>
              <option value="annual">Annual</option>
            </select>
            <button onClick={() => {
              const f = unit === 'annual' ? Number(amt) / 2080 : Number(amt);
              localStorage.setItem('rate', JSON.stringify(f));
              setRate(f);
              setStep('timer');
            }}>Save Salary</button>
          </div>
        </div>
      </>
    );
  }

  if (step === 'timer') {
    if (!timing) {
      return (
        <div className="flex flex-col items-center">
          <button onClick={() => { setStart(Date.now()); setTiming(true); }}>Start Poo-Timer</button>
          <button onClick={() => { localStorage.removeItem('rate'); setRate(null); setStep('form'); }}>Change Salary</button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center">
        <div>{Math.floor(elapsed / 60)}m {elapsed % 60}s</div>
        <div>${((rate * elapsed) / 3600).toFixed(2)}</div>
        <button onClick={() => setStep('loc')}>Stop</button>
      </div>
    );
  }

  if (step === 'loc') {
    return (
      <div className="flex flex-col items-center">
        <button onClick={() => navigator.geolocation.getCurrentPosition((p) => submitLog({ lat: p.coords.latitude, lng: p.coords.longitude, locationMethod: 'auto' }))}>Use Location</button>
        <button onClick={() => setStep('manual')}>Enter City</button>
      </div>
    );
  }

  if (step === 'manual') {
    return (
      <div className="flex flex-col items-center">
        <input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <button onClick={() => submitLog({ lat: null, lng: null, city, locationMethod: 'manual' })}>Submit City</button>
      </div>
    );
  }

  return null;
}
"@ | Set-Content -Path "src\pages\index.js" -Encoding UTF8

# 5b) map.js
@"
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';

export default function Map() {
  const [logs, setLogs] = useState([]);
  const mapRef = useRef(null);

  useEffect(() => {
    fetch('/api/log').then((r) => r.json()).then(setLogs);
  }, []);

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

  useEffect(() => {
    if (!mapRef.current) return;
    (async () => {
      const L = await import('leaflet');
      logs.forEach((l) => {
        if (typeof l.lat !== 'number') return;
        const mk = L.circleMarker([l.lat, l.lng], {
          radius: 8,
          color: l.locationMethod === 'auto' ? 'green' : 'orange',
        }).addTo(mapRef.current);
        mk.bindPopup(`
          <b>${l.username}</b><br/>
          ${l.duration}s — $${l.earnings}<br/>
          ${l.city || 'Unknown'}
        `);
      });
    })();
  }, [logs]);

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      <Link href='/'><a style={{ position: 'absolute', zIndex: 1, top: 10, left: 10, background: '#fff', padding: '0.5em' }}>Home</a></Link>
      <div id='map' style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
"@ | Set-Content -Path "src\pages\map.js" -Encoding UTF8

# 6) Run Prettier
npx prettier --write "src/**/*.{js,jsx}" | Out-Null
Write-Host "\n✅ Setup v2 fixed complete. Run 'npm run dev' to start!"