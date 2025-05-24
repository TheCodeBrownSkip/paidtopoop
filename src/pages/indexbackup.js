import Head from 'next/head';
import { useEffect, useState } from 'react';
import { getIdentity } from '@/utils/identity';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  const [identity, setIdentity] = useState({ username: null, token: null });
  const [rate, setRate]         = useState(null);
  const [tempAmt, setTempAmt]   = useState('');
  const [unit, setUnit]         = useState('hourly');
  const [step, setStep]         = useState('form');
  const [timing, setTiming]     = useState(false);
  const [start, setStart]       = useState(0);
  const [elapsed, setElapsed]   = useState(0);
  const [city, setCity]         = useState('');

  // Load identity and saved rate
  useEffect(() => {
    const id = getIdentity();
    setIdentity(id);
    const saved = localStorage.getItem('rate');
    if (saved) {
      setRate(JSON.parse(saved));
      setStep('timer');
    }
  }, []);

  // Timer tick
  useEffect(() => {
    let iv;
    if (timing) {
      iv = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    }
    return () => clearInterval(iv);
  }, [timing, start]);

  // Helper to submit log then go to map
  const submitLog = async (data) => {
    const earnings = ((rate * elapsed) / 3600).toFixed(2);
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        username: identity.username,
        token: identity.token,
        duration: elapsed,
        earnings: Number(earnings),
        timestamp: Date.now(),
      }),
    });
    router.push('/map');
  };

  // Step: salary form
  if (step === 'form') {
    return (
      <>
        <Head><title>Enter Salary</title></Head>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="card w-full max-w-md bg-base-100 shadow-md p-4">
            <h2 className="card-title">Enter your salary</h2>
            <input
              type="number"
              placeholder="Amount"
              className="input input-bordered w-full my-2"
              value={tempAmt}
              onChange={e => setTempAmt(e.target.value)}
            />
            <select
              className="select select-bordered w-full mb-4"
              value={unit}
              onChange={e => setUnit(e.target.value)}
            >
              <option value="hourly">Hourly</option>
              <option value="annual">Annual</option>
            </select>
            <button
              className="btn btn-primary w-full"
              onClick={() => {
                const finalRate = unit === 'annual'
                  ? Number(tempAmt) / 2080
                  : Number(tempAmt);
                localStorage.setItem('rate', JSON.stringify(finalRate));
                setRate(finalRate);
                setStep('timer');
              }}
            >
              Save Salary
            </button>
          </div>
        </div>
      </>
    );
  }

  // Step: timer screen
  if (step === 'timer') {
    if (!timing) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center space-y-4 p-4">
          <button
            className="btn btn-primary btn-lg"
            onClick={() => {
              setStart(Date.now());
              setTiming(true);
            }}
          >
            Start Poo-Timer
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              localStorage.removeItem('rate');
              setRate(null);
              setStep('form');
            }}
          >
            Change Salary
          </button>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4 p-4">
        <div className="text-3xl font-mono">
          {Math.floor(elapsed / 60)}m {elapsed % 60}s
        </div>
        <div className="text-2xl">
          You’ve earned <strong>${((rate * elapsed) / 3600).toFixed(2)}</strong>
        </div>
        <button
          className="btn btn-error"
          onClick={() => setStep('loc')}
        >
          Stop Poo-Timer
        </button>
      </div>
    );
  }

  // Step: pick location method
  if (step === 'loc') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4 p-4">
        <button
          className="btn btn-primary"
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
          className="btn btn-secondary"
          onClick={() => setStep('manual')}
        >
          Enter City Manually
        </button>
      </div>
    );
  }

  // Step: manual city entry
  if (step === 'manual') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4 p-4">
        <input
          className="input input-bordered w-full max-w-xs"
          type="text"
          placeholder="City"
          value={city}
          onChange={e => setCity(e.target.value)}
        />
        <button
          className="btn btn-accent w-full max-w-xs"
          onClick={() =>
            submitLog({
              lat: null,
              lng: null,
              city,
              locationMethod: 'manual'
            })
          }
        >
          Submit City
        </button>
      </div>
    );
  }

  return null;
}
