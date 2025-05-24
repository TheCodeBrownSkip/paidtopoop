import Head from 'next/head';
import { useEffect, useState } from 'react';
import { getIdentity } from '@/utils/identity';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  const [identity, setIdentity] = useState({ username: '', token: '' });
  const [rate, setRate]         = useState(null);
  const [stage, setStage]       = useState('loading'); // loading → intro → timer → loc → manual
  const [tempAmt, setTempAmt]   = useState('');
  const [unit, setUnit]         = useState('hourly');
  const [timing, setTiming]     = useState(false);
  const [start, setStart]       = useState(0);
  const [elapsed, setElapsed]   = useState(0);
  const [city, setCity]         = useState('');

  // Load identity + rate
  useEffect(() => {
    const id = getIdentity();
    setIdentity(id);
    const saved = localStorage.getItem('rate');
    if (saved) {
      setRate(JSON.parse(saved));
      setStage('timer');
    } else {
      setStage('intro');
    }
  }, []);

  // Timer tick
  useEffect(() => {
    if (!timing) return;
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [timing, start]);

  const saveRateAndStart = () => {
    const final = unit === 'annual' ? Number(tempAmt) / 2080 : Number(tempAmt);
    localStorage.setItem('rate', JSON.stringify(final));
    setRate(final);
    setTiming(true);
    setStart(Date.now());
    setStage('timer');
  };

  const resetRate = () => {
    localStorage.removeItem('rate');
    setRate(null);
    setElapsed(0);
    setTiming(false);
    setStage('intro');
  };

  const submitLog = async (data) => {
    const earn = ((rate * elapsed) / 3600).toFixed(2);
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        username: identity.username,
        token: identity.token,
        duration: elapsed,
        earnings: Number(earn),
        timestamp: Date.now(),
      }),
    });
    router.push('/map');
  };

  if (stage === 'loading') return null;

  return (
    <>
      <Head><title>Paid-to-Poo</title></Head>

      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        {/* iPhone frame */}
        <div className="relative w-[360px] h-[780px] bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-7 bg-black rounded-b-xl z-10" />

          {/* Content */}
          <div className="absolute inset-0 pt-10 overflow-y-auto">
            {/* Blurb */}
            <div className="px-6 text-center mb-6">
              <h1 className="text-3xl font-bold text-green-600">Paid-to-Poo</h1>
              <p className="mt-2 text-sm text-gray-600">
                Track your break earnings—and map them around the world!
              </p>
            </div>

            {/* INTRO */}
            {stage === 'intro' && (
              <div className="px-6 space-y-4">
                <h2 className="text-xl font-semibold">
                  {identity.username
                    ? `Welcome back, ${identity.username}!`
                    : 'Let’s get started!'}
                </h2>
                <p className="text-gray-500 text-sm">
                  {identity.username
                    ? 'Enter a new salary to continue tracking.'
                    : 'Enter your salary below. Use your recovery code to return anytime.'}
                </p>
                <input
                  type="number"
                  placeholder="Salary"
                  className="input input-bordered w-full"
                  value={tempAmt}
                  onChange={e => setTempAmt(e.target.value)}
                />
                <select
                  className="select select-bordered w-full"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                >
                  <option value="hourly">Hourly</option>
                  <option value="annual">Annual</option>
                </select>
                <button
                  className="btn btn-primary w-full"
                  onClick={saveRateAndStart}
                >
                  Save & Continue
                </button>
              </div>
            )}

            {/* TIMER */}
            {rate && stage === 'timer' && (
              <div className="px-6 flex flex-col items-center space-y-6">
                {!timing ? (
                  <button
                    className="btn btn-accent btn-block"
                    onClick={() => {
                      setTiming(true);
                      setStart(Date.now());
                    }}
                  >
                    Start Poo-Timer
                  </button>
                ) : (
                  <>
                    <div className="text-5xl font-mono text-green-600">
                      {Math.floor(elapsed / 60)}m {elapsed % 60}s
                    </div>
                    <div className="text-lg">
                      Earned{' '}
                      <span className="font-bold">${((rate * elapsed) / 3600).toFixed(2)}</span>
                    </div>
                    <button
                      className="btn btn-error btn-block"
                      onClick={() => setStage('loc')}
                    >
                      Stop & Log
                    </button>
                  </>
                )}
                <button className="btn btn-link text-xs" onClick={resetRate}>
                  Change Salary
                </button>
              </div>
            )}

            {/* LOCATION */}
            {stage === 'loc' && (
              <div className="px-6 flex flex-col items-center space-y-4">
                <p className="text-sm">Share your location:</p>
                <button
                  className="btn btn-primary w-full"
                  onClick={() =>
                    navigator.geolocation.getCurrentPosition(pos =>
                      submitLog({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        locationMethod: 'auto'
                      })
                    )
                  }
                >
                  Use My Location
                </button>
                <button
                  className="btn btn-secondary w-full"
                  onClick={() => setStage('manual')}
                >
                  Enter City
                </button>
              </div>
            )}

            {/* MANUAL */}
            {stage === 'manual' && (
              <div className="px-6 flex flex-col items-center space-y-4">
                <p className="text-sm">Enter city name:</p>
                <input
                  type="text"
                  placeholder="City"
                  className="input input-bordered w-full"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                />
                <button
                  className="btn btn-accent w-full"
                  onClick={() =>
                    submitLog({ lat: null, lng: null, city, locationMethod: 'manual' })
                  }
                >
                  Submit
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
