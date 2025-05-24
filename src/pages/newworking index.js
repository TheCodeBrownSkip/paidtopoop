// src/pages/index.js (or a new DashboardPage.js)
import Head from 'next/head';
import { useEffect, useState, useRef } from 'react';
import { getIdentity } from '@/utils/identity'; // Assuming this provides/generates username & token
import Link from 'next/link';
import { useRouter } from 'next/router';

// Helper to format duration
const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

export default function DashboardPage() { // Renamed component for clarity
  const router = useRouter();
  
  // --- Core State ---
  const [identity, setIdentity] = useState({ username: '', token: '' });
  const [rate, setRate] = useState(null); // Hourly rate
  const [userLogs, setUserLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // --- Timer State ---
  const [timing, setTiming] = useState(false);
  const [start, setStart] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // --- Rate Setting State ---
  const [showRateModal, setShowRateModal] = useState(false);
  const [tempAmt, setTempAmt] = useState('');
  const [unit, setUnit] = useState('hourly');

  // --- Log Submission Modal State ---
  const [showLogLocationModal, setShowLogLocationModal] = useState(false);
  const [logLocationMethod, setLogLocationMethod] = useState('auto'); // 'auto', 'manual', 'skipped'
  const [logCity, setLogCity] = useState('');
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);

  // --- Initial Load ---
  useEffect(() => {
    const id = getIdentity(); // This should also handle setting ptp_identity if new
    setIdentity(id);

    const savedRate = localStorage.getItem('rate');
    if (savedRate) {
      setRate(JSON.parse(savedRate));
    } else {
      setShowRateModal(true); // Prompt for rate if not set
    }
  }, []);

  // Fetch user's logs when identity is available
  const fetchUserLogs = async () => {
    if (!identity.username) return;
    setLoadingLogs(true);
    try {
      // Assuming /api/log can be filtered by username via query param
      // OR fetch all and filter client-side if API doesn't support it.
      // For simplicity, let's assume client-side filtering for now.
      const response = await fetch('/api/log'); 
      if (!response.ok) throw new Error('Failed to fetch logs');
      const allLogs = await response.json();
      const filtered = (allLogs || []).filter(log => log.username === identity.username);
      setUserLogs(filtered.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error("Error fetching user logs:", error);
      setUserLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchUserLogs();
  }, [identity.username]);


  // Timer tick
  useEffect(() => {
    if (!timing) return;
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [timing, start]);

  // --- Handlers ---
  const handleSaveRate = () => {
    if (!tempAmt) {
        alert("Please enter a salary amount.");
        return;
    }
    const finalRate = unit === 'annual' ? Number(tempAmt) / 2080 : Number(tempAmt);
    localStorage.setItem('rate', JSON.stringify(finalRate));
    setRate(finalRate);
    setTempAmt(''); // Clear temp amount
    setShowRateModal(false);
  };

  const handleStartTimer = () => {
    if (!rate) {
      setShowRateModal(true);
      alert("Please set your salary/rate first!");
      return;
    }
    setElapsed(0);
    setTiming(true);
    setStart(Date.now());
  };

  const handleStopTimerAndPrepareLog = () => {
    setTiming(false); // Stop the timer interval
    setShowLogLocationModal(true); // Open modal for location input
    setLogLocationMethod('auto'); // Default to auto
    setLogCity('');
  };

  const handleSubmitLog = async () => {
    if (!rate || elapsed <= 0) {
        alert("Cannot submit log: Rate not set or timer not run.");
        setShowLogLocationModal(false);
        return;
    }
    setIsSubmittingLog(true);
    const earnings = ((rate * elapsed) / 3600).toFixed(2);
    let logDataPayload = {
      username: identity.username,
      token: identity.token,
      duration: elapsed,
      earnings: Number(earnings),
      timestamp: Date.now(),
    };

    if (logLocationMethod === 'auto') {
      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => 
            navigator.geolocation.getCurrentPosition(resolve, reject, {timeout:10000})
          );
          logDataPayload.lat = position.coords.latitude;
          logDataPayload.lng = position.coords.longitude;
          logDataPayload.locationMethod = 'auto';
        } catch (geoError) {
          console.warn("Geolocation failed:", geoError.message);
          alert(`Geolocation failed: ${geoError.message}. You can enter city manually or skip.`);
          // Keep modal open, allow user to change method
          setIsSubmittingLog(false);
          return; 
        }
      } else {
        alert("Geolocation is not supported by this browser. Please enter city manually or skip.");
        setIsSubmittingLog(false);
        return;
      }
    } else if (logLocationMethod === 'manual') {
      if (!logCity.trim()) {
        alert("Please enter a city name for manual location.");
        setIsSubmittingLog(false);
        return;
      }
      logDataPayload.city = logCity;
      logDataPayload.locationMethod = 'manual';
    } else { // 'skipped'
      logDataPayload.locationMethod = 'skipped';
    }

    try {
      const response = await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logDataPayload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      // const newLog = await response.json(); // Get newly created log
      
      fetchUserLogs(); // Refresh the log list
      setShowLogLocationModal(false);
      setElapsed(0); // Reset timer display for next use
      // Optionally navigate: router.push(`/mapfocus?logId=${newLog.id}`);
      alert("Break logged successfully!");

    } catch (error) {
      console.error("Failed to submit log:", error);
      alert(`Failed to submit log: ${error.message}. Please try again.`);
    } finally {
      setIsSubmittingLog(false);
    }
  };

  const handleLogItemClick = (log) => {
    // Navigate to a map view for the selected log
    if (log.lat !== null && log.lng !== null) {
        router.push(`/mapfocus?lat=${log.lat}&lng=${log.lng}&city=${encodeURIComponent(log.city || '')}&user=${encodeURIComponent(log.username)}&dur=${log.duration}&earn=${log.earnings}`);
    } else if (log.city) {
        router.push(`/mapfocus?city=${encodeURIComponent(log.city)}&user=${encodeURIComponent(log.username)}&dur=${log.duration}&earn=${log.earnings}`);
    } else {
        alert("This log entry doesn't have location data to display on a map.");
    }
  };


  // --- Reusable Tailwind Classes ---
  const buttonClasses = "font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors duration-150 focus:ring-4 focus:outline-none";
  const primaryButtonClasses = `text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-300 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800 ${buttonClasses}`;
  const accentButtonClasses = `text-white bg-sky-500 hover:bg-sky-600 focus:ring-sky-300 dark:bg-sky-400 dark:hover:bg-sky-500 dark:focus:ring-sky-700 ${buttonClasses}`;
  const errorButtonClasses = `text-white bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-800 ${buttonClasses}`;
  const secondaryButtonClasses = `text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-blue-300 border border-blue-300 dark:bg-slate-700 dark:text-blue-300 dark:hover:bg-slate-600 dark:border-slate-500 dark:focus:ring-blue-800 ${buttonClasses}`;
  const inputClasses = "block w-full px-4 py-3 text-gray-800 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:border-slate-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500";
  const selectClasses = `${inputClasses}`; // Can be same as input for consistency

  if (!identity.username && !identity.token) { // Initial loading of identity
    return <div className="min-h-screen flex items-center justify-center bg-blue-50 dark:bg-slate-900"><p className="text-blue-600">Loading Identity...</p></div>;
  }

  return (
    <>
      <Head><title>Poo Dashboard | Paid-to-Poo</title></Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-sky-100 dark:from-slate-900 dark:via-slate-800 dark:to-sky-900 p-4 sm:p-6 md:p-8">
        <main className="container mx-auto max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col gap-8">
          
          {/* Header & User Info */}
          <section className="pb-6 border-b border-gray-200 dark:border-slate-700">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-blue-600 dark:text-blue-400">Poo Dashboard</h1>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Welcome, <span className="font-semibold">{identity.username || "Guest"}</span>! Track breaks & view history.
                    </p>
                </div>
                <Link href="/loghistory" className={`${secondaryButtonClasses} whitespace-nowrap`}>View All Logs</Link>
            </div>
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              <p>Your Recovery Code: <strong className="select-all bg-blue-50 dark:bg-slate-700 p-1 rounded">{identity.token}</strong></p>
              <p className="mt-1">Current Rate: {rate ? `$${Number(rate).toFixed(2)}/hr` : 'Not set'} 
                <button onClick={() => setShowRateModal(true)} className="ml-2 text-blue-500 hover:underline text-xs">(Change)</button>
              </p>
            </div>
          </section>

          {/* Timer Section */}
          <section className="text-center p-6 bg-blue-50 dark:bg-slate-750 rounded-xl shadow-md">
            <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300 mb-4">Track New Break</h2>
            <div className="text-5xl sm:text-6xl font-mono text-blue-600 dark:text-blue-400 tabular-nums mb-3">
              {`${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`}
            </div>
            {rate && timing && (
              <div className="text-lg text-gray-700 dark:text-gray-200 mb-4">
                Earned so far: <span className="font-bold text-blue-700 dark:text-blue-300">${((rate * elapsed) / 3600).toFixed(2)}</span>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {!timing ? (
                <button onClick={handleStartTimer} className={`${accentButtonClasses} py-3 text-lg flex-1`}>
                  Start Poo-Timer
                </button>
              ) : (
                <button onClick={handleStopTimerAndPrepareLog} className={`${errorButtonClasses} py-3 text-lg flex-1`}>
                  Stop & Log Break
                </button>
              )}
            </div>
             {!rate && !showRateModal && <p className="text-xs text-red-500 mt-2">Please set your salary/rate to enable timer and earnings.</p>}
          </section>

          {/* Recent User Logs Section */}
          <section>
            <h2 className="text-2xl font-semibold text-blue-700 dark:text-blue-300 mb-4">Your Recent Breaks</h2>
            {loadingLogs && <p className="text-gray-500 dark:text-gray-400">Loading your breaks...</p>}
            {!loadingLogs && userLogs.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400">You haven't logged any breaks yet with this account.</p>
            )}
            {!loadingLogs && userLogs.length > 0 && (
              <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {userLogs.slice(0, 5).map(log => ( // Show recent 5, for example
                  <li 
                    key={log.timestamp + log.duration} 
                    onClick={() => handleLogItemClick(log)}
                    className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-750 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-sm"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {new Date(log.timestamp).toLocaleDateString()} - {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">${Number(log.earnings).toFixed(2)}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Duration: {formatDuration(log.duration)}
                      {log.city && <span className="ml-2 pl-2 border-l border-gray-300 dark:border-slate-600"> | {log.city}</span>}
                    </p>
                  </li>
                ))}
                 {userLogs.length > 5 && (
                    <li className="text-center mt-2">
                        <Link href="/loghistory" className="text-blue-500 hover:underline text-sm">
                            View all {userLogs.length} breaks...
                        </Link>
                    </li>
                 )}
              </ul>
            )}
          </section>
        </main>

        {/* Rate Setting Modal */}
        {showRateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl w-full max-w-md space-y-4">
              <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Set Your Salary/Rate</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {rate ? "Update your current rate." : "Enter your salary to calculate earnings during breaks."}
              </p>
              <div>
                <label htmlFor="modalSalary" className="sr-only">Salary Amount</label>
                <input id="modalSalary" type="number" placeholder="Salary Amount" value={tempAmt} onChange={e => setTempAmt(e.target.value)} className={inputClasses}/>
              </div>
              <div>
                <label htmlFor="modalUnit" className="sr-only">Salary Unit</label>
                <select id="modalUnit" value={unit} onChange={e => setUnit(e.target.value)} className={selectClasses}>
                  <option value="hourly">Hourly Rate</option>
                  <option value="annual">Annual Salary</option>
                </select>
                 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {unit === 'annual' ? 'Annual salary will be converted to an hourly rate.' : 'Enter your direct hourly rate.'}
                  </p>
              </div>
              <div className="flex gap-3">
                {rate && <button onClick={() => setShowRateModal(false)} className={`${secondaryButtonClasses} w-full`}>Cancel</button> }
                <button onClick={handleSaveRate} className={`${primaryButtonClasses} w-full`}>Save Rate</button>
              </div>
            </div>
          </div>
        )}

        {/* Log Location Modal */}
        {showLogLocationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl w-full max-w-md space-y-4">
              <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Log Location (Optional)</h3>
              <div className="space-y-2">
                <label className="flex items-center p-3 border rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer">
                  <input type="radio" name="locationMethod" value="auto" checked={logLocationMethod === 'auto'} onChange={() => setLogLocationMethod('auto')} className="form-radio text-blue-600 focus:ring-blue-500"/>
                  <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">Use My Current Location</span>
                </label>
                <label className="flex items-center p-3 border rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer">
                  <input type="radio" name="locationMethod" value="manual" checked={logLocationMethod === 'manual'} onChange={() => setLogLocationMethod('manual')} className="form-radio text-blue-600 focus:ring-blue-500"/>
                  <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">Enter City Manually</span>
                </label>
                {logLocationMethod === 'manual' && (
                  <div className="pl-8 pt-2">
                    <label htmlFor="logCityManual" className="sr-only">City</label>
                    <input id="logCityManual" type="text" placeholder="Enter city name" value={logCity} onChange={e => setLogCity(e.target.value)} className={inputClasses}/>
                  </div>
                )}
                <label className="flex items-center p-3 border rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer">
                  <input type="radio" name="locationMethod" value="skipped" checked={logLocationMethod === 'skipped'} onChange={() => setLogLocationMethod('skipped')} className="form-radio text-blue-600 focus:ring-blue-500"/>
                  <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">Skip Location</span>
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowLogLocationModal(false)} className={`${secondaryButtonClasses} w-full`}>Cancel</button>
                <button onClick={handleSubmitLog} disabled={isSubmittingLog} className={`${primaryButtonClasses} w-full`}>
                  {isSubmittingLog ? 'Submitting...' : 'Submit Log'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}

// Make sure you have a `getIdentity` function, e.g., in @/utils/identity.js
// Example:
// export const getIdentity = () => {
//   let username = localStorage.getItem('ptp_username');
//   let token = localStorage.getItem('ptp_token');
//   if (!username || !token) {
//     // Generate new identity
//     const base = Math.random().toString(36).substring(2, 8);
//     username = `PooUser${base}`;
//     token = Array.from({length: 3}, () => Math.random().toString(36).substring(2, 10)).join('-'); // More complex token
    
//     localStorage.setItem('ptp_username', username);
//     localStorage.setItem('ptp_token', token);
//     // Also store the whole identity object for convenience if needed elsewhere
//     localStorage.setItem('ptp_identity', JSON.stringify({username, token}));
//   }
//   return { username, token };
// };,,