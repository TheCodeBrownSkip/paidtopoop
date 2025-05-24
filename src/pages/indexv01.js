// src/pages/index.js (DashboardPage)
import Head from 'next/head';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getIdentity, clearIdentity, storeIdentity } from '@/utils/identity';
import { useRouter } from 'next/router';

const formatDuration = (seconds) => {
  const numSeconds = Number(seconds);
  if (isNaN(numSeconds) || numSeconds === null || numSeconds < 0) return 'N/A';
  const minutes = Math.floor(numSeconds / 60);
  const remainingSeconds = numSeconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

export default function DashboardPage() {
  const router = useRouter();
  
  const [identity, setIdentity] = useState({ username: '', token: '' });
  const [rate, setRate] = useState(null);
  
  const [allLogs, setAllLogs] = useState([]);
  const [userLogs, setUserLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true); 
  const [isInitialLoading, setIsInitialLoading] = useState(true); 

  const INITIAL_DISPLAY_LIMIT = 5;
  const [displayLimit, setDisplayLimit] = useState(INITIAL_DISPLAY_LIMIT);

  const [timing, setTiming] = useState(false);
  const [start, setStart] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const [showRateModal, setShowRateModal] = useState(false);
  const [tempAmt, setTempAmt] = useState('');
  const [unit, setUnit] = useState('hourly');

  const [showLogLocationModal, setShowLogLocationModal] = useState(false);
  const [logLocationMethod, setLogLocationMethod] = useState('auto'); 
  const [logCity, setLogCity] = useState('');
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);

  const [globalTopPoops, setGlobalTopPoops] = useState([]);
  const [localTopPoops, setLocalTopPoops] = useState([]);
  const [lastUserLocationCity, setLastUserLocationCity] = useState(null);

  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [recoveryError, setRecoveryError] = useState('');

  useEffect(() => {
    console.log("Initial identity/rate useEffect running (client-side)");
    const id = getIdentity(); 
    setIdentity(id);

    if (id.username && id.token) {
      const savedRate = localStorage.getItem(`rate_${id.username}`); 
      if (savedRate) {
        setRate(JSON.parse(savedRate));
      }
    }
    setIsInitialLoading(false); 
  }, []); 
  
  useEffect(() => {
    if (identity.username && identity.token) {
      console.log("Identity confirmed, fetching user data:", identity.username);
      fetchAllLogsAndProcess(); 
    } else if (!isInitialLoading) { 
      console.log("No identity, clearing user-specific data.");
      setRate(null);
      setUserLogs([]);
      setLastUserLocationCity(null);
    }
  }, [identity, isInitialLoading]); 


  const fetchAllLogsAndProcess = async () => {
    setLoadingLogs(true); 
    try {
      const response = await fetch('/api/log'); 
      if (!response.ok) throw new Error('Failed to fetch logs');
      const fetchedLogs = await response.json() || [];
      setAllLogs(fetchedLogs);

      if (identity.username) {
        const filteredUserLogs = fetchedLogs.filter(log => log.username === identity.username);
        const sortedUserLogs = filteredUserLogs.sort((a, b) => b.timestamp - a.timestamp);
        setUserLogs(sortedUserLogs);
        setDisplayLimit(INITIAL_DISPLAY_LIMIT);

        const lastLocatedUserPoop = sortedUserLogs.find(log => log.city && log.city.trim() !== '');
        setLastUserLocationCity(lastLocatedUserPoop ? lastLocatedUserPoop.city : null);
      } else {
        setUserLogs([]);
        setLastUserLocationCity(null);
      }
    } catch (error) {
      console.error("Error fetching or processing logs:", error);
      setAllLogs([]); 
      setUserLogs([]); 
    } finally {
      setLoadingLogs(false);
    }
  };
  
  useEffect(() => {
    // Fetch all logs once if not already fetched, for leaderboards.
    // fetchAllLogsAndProcess itself checks identity for user-specific parts.
    if (allLogs.length === 0 && !loadingLogs) { // Added !loadingLogs to prevent multiple initial fetches
        console.log("Fetching all logs for leaderboards (initial or if empty)...");
        fetchAllLogsAndProcess();
    }
  }, [allLogs.length, loadingLogs]); // Runs when allLogs.length or loadingLogs change


  useEffect(() => { 
    if (allLogs.length > 0) {
      const sortedGlobal = [...allLogs].filter(log => typeof log.duration === 'number').sort((a, b) => b.duration - a.duration);
      setGlobalTopPoops(sortedGlobal.slice(0, 10));
      if (lastUserLocationCity) {
        const filteredLocal = allLogs.filter(log => typeof log.duration === 'number' && log.city && log.city.toLowerCase() === lastUserLocationCity.toLowerCase());
        const sortedLocal = filteredLocal.sort((a, b) => b.duration - a.duration);
        setLocalTopPoops(sortedLocal.slice(0, 10));
      } else { setLocalTopPoops([]); }
    } else { setGlobalTopPoops([]); setLocalTopPoops([]); }
  }, [allLogs, lastUserLocationCity]);

  useEffect(() => { 
    if (!timing) return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [timing, start]);

  const handleSaveRate = () => { 
    if (!tempAmt || isNaN(Number(tempAmt))) { alert("Please enter a valid salary amount."); return; }
    const finalRate = unit === 'annual' ? Number(tempAmt) / 2080 : Number(tempAmt);
    if (identity.username) {
        localStorage.setItem(`rate_${identity.username}`, JSON.stringify(finalRate));
    } else { 
        localStorage.setItem('rate', JSON.stringify(finalRate)); // Fallback for non-identified user (less likely now)
    }
    setRate(finalRate);
    setTempAmt(''); 
    setShowRateModal(false);
  };
  const handleStartTimer = () => { 
    if (!rate) { setShowRateModal(true); alert("Please set your salary/rate first!"); return; }
    setElapsed(0);
    setTiming(true);
    setStart(Date.now());
  };
  const handleStopTimerAndPrepareLog = () => { 
    setTiming(false); 
    setShowLogLocationModal(true);
    setLogLocationMethod('auto'); 
    setLogCity('');
  };
  const handleSubmitLog = async () => { 
    if (!rate || elapsed <= 0) { alert("Cannot submit log: Rate not set or timer not run."); setShowLogLocationModal(false); return; }
    setIsSubmittingLog(true);
    const calculatedEarnings = ((rate * elapsed) / 3600).toFixed(2);
    let logDataForNavigation = { 
      username: identity.username, token: identity.token, duration: elapsed, earnings: Number(calculatedEarnings),
      timestamp: Date.now(), lat: null, lng: null, city: null, locationMethod: '',
    };
    let locationDetermined = false;
    if (logLocationMethod === 'auto') { 
        if (navigator.geolocation) {
            try { 
                const position = await new Promise((resolve, reject) => 
                    navigator.geolocation.getCurrentPosition(resolve, reject, {timeout:10000, enableHighAccuracy: true})
                );
                logDataForNavigation.lat = position.coords.latitude;
                logDataForNavigation.lng = position.coords.longitude;
                logDataForNavigation.locationMethod = 'auto';
                locationDetermined = true;
            } catch (geoError) { 
                alert(`Geolocation failed: ${geoError.message}. Please enter city manually.`);
                setLogLocationMethod('manual'); setIsSubmittingLog(false); return; 
            }
        } else { 
            alert("Geolocation is not supported. Please enter city manually.");
            setLogLocationMethod('manual'); setIsSubmittingLog(false); return;
        }
    } else if (logLocationMethod === 'manual') { 
        if (!logCity.trim()) { alert("Please enter a city name."); setIsSubmittingLog(false); return; }
        logDataForNavigation.city = logCity.trim();
        logDataForNavigation.locationMethod = 'manual';
        locationDetermined = true;
    }
    if (!locationDetermined) { alert("Location not determined."); setIsSubmittingLog(false); return; }
    try { 
        const response = await fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logDataForNavigation) });
        if (!response.ok) { const errorText = await response.text(); throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);}
        // const apiResponseData = await response.json(); 
        
        fetchAllLogsAndProcess();
        setShowLogLocationModal(false); setElapsed(0);
        router.push( 
            `/mapfocus?lat=${logDataForNavigation.lat ?? ''}&lng=${logDataForNavigation.lng ?? ''}&city=${encodeURIComponent(logDataForNavigation.city || '')}&user=${encodeURIComponent(logDataForNavigation.username)}&dur=${logDataForNavigation.duration}&earn=${logDataForNavigation.earnings}&ts=${logDataForNavigation.timestamp}`
        );
    } catch (error) { console.error("Failed to submit log:", error); alert(`Failed to submit log: ${error.message}.`);
    } finally { setIsSubmittingLog(false); }
  };
  const handleLogItemClick = (log) => { 
    router.push(
        `/mapfocus?lat=${log.lat ?? ''}&lng=${log.lng ?? ''}&city=${encodeURIComponent(log.city || '')}&user=${encodeURIComponent(log.username)}&dur=${log.duration}&earn=${log.earnings}&ts=${log.timestamp}`
    );
  };
  const handleShowAllLogs = () => { 
    setDisplayLimit(userLogs.length);
  };
  const handleLogout = () => { 
    clearIdentity(); 
    if(identity.username) { localStorage.removeItem(`rate_${identity.username}`); }
    setIdentity({ username: '', token: '' }); 
    setRate(null); setUserLogs([]); 
    // router.push('/'); // Stay on page, UI will update to logged-out state
  };
  const handleRecoverAccount = async () => { 
    if (!recoveryCodeInput.trim()) { setRecoveryError('Please enter a recovery code.'); return; }
    setRecoveryError(''); setLoadingLogs(true); // Use loadingLogs for visual feedback during recovery attempt
    
    let logsToSearch = allLogs;
    if (allLogs.length === 0) { // If allLogs isn't populated yet, fetch them now
        try {
            const response = await fetch('/api/log');
            if (!response.ok) throw new Error("Could not fetch logs for recovery check");
            logsToSearch = await response.json() || [];
            setAllLogs(logsToSearch); // Update allLogs state as well
        } catch (e) {
            setRecoveryError("Error fetching data for recovery. Try again.");
            setLoadingLogs(false);
            return;
        }
    }

    const foundLogWithToken = logsToSearch.find(log => log.token === recoveryCodeInput.trim());
    if (foundLogWithToken && foundLogWithToken.username) {
      const recoveredIdentity = { username: foundLogWithToken.username, token: foundLogWithToken.token };
      storeIdentity(recoveredIdentity); 
      setIdentity(recoveredIdentity); // This will trigger the useEffect to load user's rate and logs
      setShowRecoveryModal(false); setRecoveryCodeInput('');
    } else { setRecoveryError('Invalid recovery code or no user found.'); }
    setLoadingLogs(false);
  };

  // --- Tailwind Classes ---
  const primaryButtonClasses = "text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800 transition-colors duration-150";
  const accentButtonClasses = "text-white bg-sky-500 hover:bg-sky-600 focus:ring-4 focus:outline-none focus:ring-sky-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-sky-400 dark:hover:bg-sky-500 dark:focus:ring-sky-700 transition-colors duration-150";
  const errorButtonClasses = "text-white bg-red-600 hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-800 transition-colors duration-150";
  const secondaryButtonClasses = "text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center border border-blue-300 dark:bg-slate-700 dark:text-blue-300 dark:hover:bg-slate-600 dark:border-slate-500 dark:focus:ring-blue-800 transition-colors duration-150";
  const inputClasses = "block w-full px-4 py-3 text-gray-800 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:border-slate-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 transition-colors duration-150";
  const selectClasses = `${inputClasses}`;

  // --- FILLED IN: Leaderboard Item Component ---
  const LeaderboardItem = ({ log, rank }) => (
    <li className="flex justify-between items-center text-sm p-2 border-b border-gray-200 dark:border-slate-700 last:border-b-0">
        <span className="flex items-center">
            <span className="font-semibold w-6 text-center mr-2 text-blue-600 dark:text-blue-400">{rank}.</span>
            <span className="truncate w-28 sm:w-32 md:w-40" title={log.username || 'Anonymous'}>{log.username || 'Anonymous'}</span>
        </span>
        <div className="flex flex-col items-end sm:flex-row sm:items-center sm:gap-3">
            <span className="font-mono text-xs sm:text-sm text-gray-700 dark:text-gray-300">{formatDuration(log.duration || 0)}</span>
            <span className="font-semibold text-xs sm:text-sm text-green-500 dark:text-green-400">${Number(log.earnings || 0).toFixed(2)}</span>
        </div>
    </li>
  );

  if (isInitialLoading) { 
    return <div className="min-h-screen flex items-center justify-center bg-blue-50 dark:bg-slate-900"><p className="text-blue-600">Loading Dashboard...</p></div>;
  }

  return (
    <>
      <Head><title>Poo Dashboard | Paid-to-Poo</title></Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-sky-100 dark:from-slate-900 dark:via-slate-800 dark:to-sky-900 p-4 sm:p-6 md:p-8">
        <main className="container mx-auto max-w-6xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col gap-8">
          
          {/* Header Section */}
          <section className="pb-6 border-b border-gray-200 dark:border-slate-700">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-blue-600 dark:text-blue-400">Poo Dashboard</h1>
                    {identity.username ? (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            Welcome, <span className="font-semibold">{identity.username}</span>!
                        </p>
                    ) : (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            Start a new session or recover your account.
                        </p>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
                    {identity.username && (
                        <button onClick={handleLogout} className={`${secondaryButtonClasses} !w-auto whitespace-nowrap`}>Log Out</button>
                    )}
                    {!identity.username && (
                         <button onClick={() => { setShowRecoveryModal(true); setRecoveryError(''); }} className={`${primaryButtonClasses} !w-auto whitespace-nowrap`}>Recover Account</button>
                    )}
                    <Link href="/globallogmap" className={`${secondaryButtonClasses} whitespace-nowrap !w-auto`}>View Global Map</Link>
                </div>
            </div>
            {identity.username && (
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                <p>Your Recovery Code: <strong className="select-all bg-blue-50 dark:bg-slate-700 p-1 rounded">{identity.token}</strong></p>
                <p className="mt-1">Current Rate: {rate ? `$${Number(rate).toFixed(2)}/hr` : 'Not set'} 
                  <button onClick={() => setShowRateModal(true)} className="ml-2 text-blue-500 hover:underline text-xs">(Set/Change)</button>
                </p>
              </div>
            )}
          </section>

          {/* Timer Section - only show if user is "logged in" */}
          {identity.username && (
            <section className="text-center p-6 bg-blue-50 dark:bg-slate-750 rounded-xl shadow-md">
                <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300 mb-4">Track New Break</h2>
                <div className="text-5xl sm:text-6xl font-mono text-blue-600 dark:text-blue-400 tabular-nums mb-3">
                {`${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`}
                </div>
                {rate && timing && (
                <div className="text-lg text-gray-700 dark:text-gray-200 mb-4">
                    Earned: <span className="font-bold text-blue-700 dark:text-blue-300">${((rate * elapsed) / 3600).toFixed(2)}</span>
                </div>
                )}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {!timing ? (
                    <button onClick={handleStartTimer} className={`${accentButtonClasses.replace('bg-sky-500 hover:bg-sky-600', 'bg-green-500 hover:bg-green-600 focus:ring-green-300 dark:bg-green-500 dark:hover:bg-green-600 dark:focus:ring-green-700')} py-3 text-lg flex-1 !w-full sm:!w-auto`}>Start</button>
                ) : (
                    <button onClick={handleStopTimerAndPrepareLog} className={`${errorButtonClasses} py-3 text-lg flex-1 !w-full sm:!w-auto`}>Stop & Log</button>
                )}
                </div>
                {!rate && identity.username && !showRateModal && <p className="text-xs text-red-500 mt-2">Please set your rate to calculate earnings.</p>}
            </section>
          )}
          
          {/* If no identity, show a prominent message or a simplified view */}
          {!identity.username && !showRecoveryModal && (
            <section className="text-center p-8 bg-blue-50 dark:bg-slate-750 rounded-xl shadow-md">
                <h2 className="text-2xl font-semibold text-blue-700 dark:text-blue-300 mb-4">Get Started</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    A new identity will be generated if you set a rate. Or, use your recovery code.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button 
                        onClick={() => { 
                            if (!identity.username) { 
                                const newId = getIdentity(); 
                                setIdentity(newId); 
                            }
                            setShowRateModal(true); 
                        }} 
                        className={`${primaryButtonClasses} !w-full sm:!w-auto`}
                    >
                        Set Rate & Start Fresh
                    </button>
                    <button onClick={() => { setShowRecoveryModal(true); setRecoveryError(''); }} className={`${secondaryButtonClasses} !w-full sm:!w-auto`}>Use Recovery Code</button>
                </div>
            </section>
          )}

          {/* User's Recent Breaks Section - only show if user is "logged in" */}
          {identity.username && (
            <section>
                <h2 className="text-2xl font-semibold text-blue-700 dark:text-blue-300 mb-4">Your Recent Breaks</h2>
                {loadingLogs && userLogs.length === 0 && <p className="text-gray-500 dark:text-gray-400">Loading your breaks...</p>}
                {!loadingLogs && userLogs.length === 0 && (<p className="text-gray-500 dark:text-gray-400">You haven't logged any breaks yet.</p>)}
                {!loadingLogs && userLogs.length > 0 && (
                <ul className={`space-y-3 pr-2 ${displayLimit < userLogs.length ? 'max-h-96 overflow-y-auto' : ''}`}>
                    {userLogs.slice(0, displayLimit).map(log => (
                    <li key={log.timestamp + log.duration + log.username} onClick={() => handleLogItemClick(log)}
                        className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-750 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-sm">
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
                    {userLogs.length > displayLimit && (
                        <li className="text-center mt-4">
                            <button onClick={handleShowAllLogs} className="text-blue-500 hover:underline text-sm font-medium">
                                View all {userLogs.length} breaks...
                            </button>
                        </li>
                    )}
                </ul>
                )}
            </section>
          )}

          {/* Top Poops Leaderboard Section */}
          {(allLogs.length > 0 || loadingLogs) && (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 dark:bg-slate-750 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-3 border-b pb-2 dark:border-slate-600">
                    Local Top 10 {lastUserLocationCity ? `(Near ${lastUserLocationCity})` : "(Log Poop w/ City)"}
                </h3>
                {loadingLogs && localTopPoops.length === 0 ? <p className="text-xs text-gray-500 dark:text-gray-400">Loading...</p> : 
                localTopPoops.length > 0 ? (
                    <ul className="space-y-1 max-h-80 overflow-y-auto pr-1">
                    {localTopPoops.map((log, index) => <LeaderboardItem key={`local-${index}-${log.timestamp}`} log={log} rank={index + 1} />)}
                    </ul>
                ) : ( <p className="text-xs text-gray-500 dark:text-gray-400">{lastUserLocationCity ? "No other poops here." : "Log poop with city for local stats."}</p> )}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-slate-750 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-3 border-b pb-2 dark:border-slate-600">
                    Global Top 10 Poopers
                </h3>
                {loadingLogs && globalTopPoops.length === 0 ? <p className="text-xs text-gray-500 dark:text-gray-400">Loading...</p> :
                globalTopPoops.length > 0 ? (
                    <ul className="space-y-1 max-h-80 overflow-y-auto pr-1">
                    {globalTopPoops.map((log, index) => <LeaderboardItem key={`global-${index}-${log.timestamp}`} log={log} rank={index + 1} />)}
                    </ul>
                ) : ( <p className="text-xs text-gray-500 dark:text-gray-400">Be the first global record setter!</p> )}
                </div>
            </section>
          )}
        </main>

        {/* --- MODALS (Rate Setting, Log Location, Recovery) --- */}
        {/* These are now correctly filled in with their respective JSX from the previous version */}
        {showRateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl w-full max-w-md space-y-4">
              <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Set Your Salary/Rate</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {rate && identity.username ? "Update your current rate." : "Enter your salary to calculate earnings during breaks."}
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
                {(rate || identity.username) && <button onClick={() => setShowRateModal(false)} className={`${secondaryButtonClasses} !w-full`}>Cancel</button> }
                <button onClick={handleSaveRate} className={`${primaryButtonClasses} !w-full`}>Save Rate</button>
              </div>
            </div>
          </div>
        )}

        {showLogLocationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl w-full max-w-md space-y-4">
              <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Log Location</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Location is required. If auto-detect fails, please enter city manually.</p>
              <div className="space-y-2">
                <label className="flex items-center p-3 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer">
                  <input type="radio" name="locationMethod" value="auto" checked={logLocationMethod === 'auto'} onChange={() => setLogLocationMethod('auto')} className="form-radio text-blue-600 focus:ring-blue-500"/>
                  <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">Use My Current Location</span>
                </label>
                <label className="flex items-center p-3 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer">
                  <input type="radio" name="locationMethod" value="manual" checked={logLocationMethod === 'manual'} onChange={() => setLogLocationMethod('manual')} className="form-radio text-blue-600 focus:ring-blue-500"/>
                  <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">Enter City Manually</span>
                </label>
                {logLocationMethod === 'manual' && (
                  <div className="pl-8 pt-2"> 
                    <label htmlFor="logCityManual" className="sr-only">City</label>
                    <input id="logCityManual" type="text" placeholder="Enter city name" value={logCity} onChange={e => setLogCity(e.target.value)} className={`${inputClasses} text-sm`}/>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowLogLocationModal(false)} className={`${secondaryButtonClasses} !w-full`}>Cancel</button>
                <button onClick={handleSubmitLog} disabled={isSubmittingLog} className={`${primaryButtonClasses} !w-full`}>
                  {isSubmittingLog ? 'Submitting...' : 'Submit Log'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showRecoveryModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl w-full max-w-md space-y-4">
                    <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Recover Account</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Enter your recovery code to restore your session.
                    </p>
                    <div>
                        <label htmlFor="recoveryCode" className="sr-only">Recovery Code</label>
                        <input 
                            id="recoveryCode" 
                            type="text" 
                            placeholder="Enter recovery code" 
                            value={recoveryCodeInput} 
                            onChange={e => setRecoveryCodeInput(e.target.value)} 
                            className={inputClasses}
                        />
                    </div>
                    {recoveryError && <p className="text-xs text-red-500">{recoveryError}</p>}
                    <div className="flex gap-3">
                        <button onClick={() => {setShowRecoveryModal(false); setRecoveryError('');}} className={`${secondaryButtonClasses} !w-full`}>Cancel</button>
                        <button onClick={handleRecoverAccount} disabled={loadingLogs} className={`${primaryButtonClasses} !w-full`}>
                            {loadingLogs ? 'Verifying...' : 'Recover'}
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </>
  );
}