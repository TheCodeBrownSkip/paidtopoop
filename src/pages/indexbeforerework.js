import Head from 'next/head';
import { useEffect, useState } from 'react';
import { getIdentity } from '@/utils/identity'; // Assuming this exists
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
    try {
      const response = await fetch('/api/log', {
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
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      // const result = await response.json(); // Optional: if your API returns something useful
      router.push('/map');
    } catch (error) {
      console.error("Failed to submit log:", error);
      // Optionally, provide user feedback here
      alert("Failed to submit log. Please try again.");
    }
  };

  if (stage === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
        <p className="text-blue-600 dark:text-blue-400 text-lg">Loading...</p>
      </div>
    );
  }

  // --- Reusable Tailwind Class Strings for Blue Theme ---
  const primaryButtonClasses = "w-full text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-3 text-center dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800 transition-colors duration-150";
  const accentButtonClasses = "w-full text-white bg-sky-500 hover:bg-sky-600 focus:ring-4 focus:outline-none focus:ring-sky-300 font-medium rounded-lg text-sm px-5 py-3 text-center dark:bg-sky-400 dark:hover:bg-sky-500 dark:focus:ring-sky-700 transition-colors duration-150";
  const secondaryButtonClasses = "w-full text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-3 text-center border border-blue-300 dark:bg-blue-200 dark:text-blue-600 dark:hover:bg-blue-300 dark:border-blue-400 transition-colors duration-150";
  const errorButtonClasses = "w-full text-white bg-red-600 hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-3 text-center dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-800 transition-colors duration-150";
  const linkButtonClasses = "text-sm text-blue-500 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-150";

  const inputClasses = "block w-full px-4 py-3 text-gray-800 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:border-slate-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 transition-colors duration-150";
  const selectClasses = "block w-full px-4 py-3 text-gray-800 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 transition-colors duration-150";
  // --- End Reusable Classes ---

  return (
    <>
      <Head><title>Paid-to-Poo | Track Your Earnings</title></Head>

      {/* Full-screen background and centering container */}
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-sky-100 dark:from-slate-900 dark:via-slate-800 dark:to-sky-900 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 transition-colors duration-300">
        
        {/* Main UI Card: Rounded square, responsive, centered */}
        <main className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 sm:p-8 overflow-hidden">
          
          {/* Blurb / Header Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-blue-600 dark:text-blue-400">Paid-to-Poo</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Track your break earnings—and map them!
            </p>
          </div>

          {/* Dynamic Content Area based on stage */}
          <div className="space-y-6"> {/* Add consistent spacing between stage elements */}
            
            {/* INTRO STAGE */}
            {stage === 'intro' && (
              <section aria-labelledby="intro-heading" className="space-y-4 animate-fadeIn">
                <h2 id="intro-heading" className="text-xl font-semibold text-blue-700 dark:text-blue-300">
                  {identity.username
                    ? `Welcome back, ${identity.username}!`
                    : 'Let’s Get Started!'}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {identity.username
                    ? 'Enter your current salary to continue tracking.'
                    : 'Enter your salary below. Use your recovery code if you have one.'}
                </p>
                <div>
                  <label htmlFor="salary" className="sr-only">Salary</label>
                  <input
                    id="salary"
                    type="number"
                    placeholder="Your Salary Amount"
                    className={inputClasses}
                    value={tempAmt}
                    onChange={e => setTempAmt(e.target.value)}
                    aria-describedby="salary-unit-description"
                  />
                </div>
                <div>
                  <label htmlFor="unit" className="sr-only">Salary Unit</label>
                  <select
                    id="unit"
                    className={selectClasses}
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    aria-describedby="salary-unit-description"
                  >
                    <option value="hourly">Hourly Rate</option>
                    <option value="annual">Annual Salary</option>
                  </select>
                  <p id="salary-unit-description" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {unit === 'annual' ? 'Annual salary will be converted to an hourly rate.' : 'Enter your direct hourly rate.'}
                  </p>
                </div>
                <button
                  className={primaryButtonClasses}
                  onClick={saveRateAndStart}
                  disabled={!tempAmt}
                >
                  Save & Start Tracking
                </button>
              </section>
            )}

            {/* TIMER STAGE */}
            {rate && stage === 'timer' && (
              <section aria-labelledby="timer-heading" className="flex flex-col items-center space-y-6 animate-fadeIn">
                {!timing ? (
                  <>
                    <h2 id="timer-heading" className="text-xl font-semibold text-blue-700 dark:text-blue-300">Ready to Start?</h2>
                    <button
                      className={`${accentButtonClasses} py-4 text-lg`} // Larger start button
                      onClick={() => {
                        setElapsed(0); // Reset elapsed time if restarting
                        setTiming(true);
                        setStart(Date.now());
                      }}
                    >
                      Start Poo-Timer
                    </button>
                  </>
                ) : (
                  <>
                    <h2 id="timer-heading" className="sr-only">Timer Active</h2>
                    <div className="text-5xl sm:text-6xl font-mono text-blue-600 dark:text-blue-400 tabular-nums">
                      {`${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`}
                    </div>
                    <div className="text-lg text-gray-700 dark:text-gray-200">
                      Earned so far:
                      <span className="block text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                        ${((rate * elapsed) / 3600).toFixed(2)}
                      </span>
                    </div>
                    <button
                      className={`${errorButtonClasses} py-3`}
                      onClick={() => setStage('loc')}
                    >
                      Stop Timer & Log Break
                    </button>
                  </>
                )}
                <button className={linkButtonClasses} onClick={resetRate}>
                  Change Salary / Reset
                </button>
              </section>
            )}

            {/* LOCATION STAGE */}
            {stage === 'loc' && (
              <section aria-labelledby="location-heading" className="flex flex-col items-center space-y-4 animate-fadeIn">
                <h2 id="location-heading" className="text-xl font-semibold text-blue-700 dark:text-blue-300">Log Your Location</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  Optionally share where this epic break took place!
                </p>
                <button
                  className={primaryButtonClasses}
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        pos => submitLog({
                          lat: pos.coords.latitude,
                          lng: pos.coords.longitude,
                          locationMethod: 'auto'
                        }),
                        (err) => {
                           console.warn(`ERROR(${err.code}): ${err.message}`);
                           alert("Could not get location. You can enter city manually or skip.");
                           // Optionally proceed to manual or allow skipping
                        }
                      );
                    } else {
                      alert("Geolocation is not supported by this browser. Please enter city manually.");
                      setStage('manual');
                    }
                  }}
                >
                  Use My Current Location
                </button>
                <button
                  className={secondaryButtonClasses}
                  onClick={() => setStage('manual')}
                >
                  Enter City Manually
                </button>
                 <button
                  className={linkButtonClasses}
                  onClick={() => submitLog({ lat: null, lng: null, city: null, locationMethod: 'skipped' })}
                >
                  Skip Location & Log
                </button>
              </section>
            )}

            {/* MANUAL LOCATION STAGE */}
            {stage === 'manual' && (
              <section aria-labelledby="manual-location-heading" className="flex flex-col items-center space-y-4 animate-fadeIn">
                <h2 id="manual-location-heading" className="text-xl font-semibold text-blue-700 dark:text-blue-300">Enter City</h2>
                <div>
                  <label htmlFor="city" className="sr-only">City</label>
                  <input
                    id="city"
                    type="text"
                    placeholder="e.g., New York"
                    className={inputClasses}
                    value={city}
                    onChange={e => setCity(e.target.value)}
                  />
                </div>
                <button
                  className={accentButtonClasses}
                  onClick={() =>
                    submitLog({ lat: null, lng: null, city: city || null, locationMethod: 'manual' })
                  }
                  disabled={!city.trim()}
                >
                  Submit with City
                </button>
                <button
                  className={linkButtonClasses}
                  onClick={() => setStage('loc')} // Go back to location choice
                >
                  Back
                </button>
              </section>
            )}
          </div>
        </main>
        <footer className="mt-8 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
                Inspired by workplace philosophers everywhere.
            </p>
        </footer>
      </div>
      {/* Basic CSS for fadeIn animation - place in your global CSS or a <style jsx global> tag if preferred */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        .tabular-nums {
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </>
  );
}

// Make sure you have a `getIdentity` function, e.g., in @/utils/identity.js
// Example:
// export const getIdentity = () => {
//   // Retrieve from localStorage or generate new
//   let username = localStorage.getItem('ptp_username');
//   let token = localStorage.getItem('ptp_token');
//   if (!username || !token) {
//     username = `User${Math.floor(Math.random() * 10000)}`;
//     token = Math.random().toString(36).substring(2);
//     localStorage.setItem('ptp_username', username);
//     localStorage.setItem('ptp_token', token);
//   }
//   return { username, token };
// };