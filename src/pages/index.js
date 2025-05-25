// src/pages/index.js (DashboardPage)
import Head from 'next/head';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getIdentity, clearIdentity, storeIdentity, generateAndStoreIdentity } from '@/utils/identity';
import { useRouter } from 'next/router';

const formatDuration = (seconds) => {
  const numSeconds = Number(seconds);
  if (isNaN(numSeconds) || numSeconds === null || numSeconds < 0) return 'N/A';
  const minutes = Math.floor(numSeconds / 60);
  const remainingSeconds = numSeconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

function obfuscateLocation(latitude, longitude, maxOffsetMeters = 500) {
  const earthRadiusMeters = 6378137;
  const latOffsetDegrees = (Math.random() * 2 - 1) * (maxOffsetMeters / earthRadiusMeters) * (180 / Math.PI);
  const lngOffsetDegrees = (Math.random() * 2 - 1) * (maxOffsetMeters / earthRadiusMeters) * (180 / Math.PI) / Math.cos(latitude * Math.PI / 180);
  return {
    lat: latitude + latOffsetDegrees,
    lng: longitude + lngOffsetDegrees,
  };
}

export default function DashboardPage() {
  const router = useRouter();
  
  const [identity, setIdentity] = useState({ username: '', token: '' });
  const [rate, setRate] = useState(null);
  
  const [allLogs, setAllLogs] = useState([]);
  const [userLogs, setUserLogs] = useState([]);
  const [loadingState, setLoadingState] = useState({ initial: true, logs: false, recovery: false, geocoding: false });

  const INITIAL_DISPLAY_LIMIT = 5;
  const [displayLimit, setDisplayLimit] = useState(INITIAL_DISPLAY_LIMIT);

  const [timing, setTiming] = useState(false);
  const [start, setStart] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [currentFactIndex, setCurrentFactIndex] = useState(0);

  const pooFacts = [
    "The average person spends about 92 days of their life on the toilet!",
    "Most people poop between 3 times a day and 3 times a week - that's normal!",
    "Humans aren't the only ones who get paid to poo - some animals get treats for their deposits!",
    "The word 'poop' comes from the Middle English word 'poupen' or 'popen', meaning to make a gulping sound.",
    "The average poop weighs around 1/4 pound. That's a lot of business!",
    "Some people actually experience 'shy bowel' - difficulty pooping in public restrooms.",
    "Ancient Romans used to poop together in public toilets and chat while doing their business!",
    "Your body position while pooping matters - squatting is actually more natural than sitting!",
    "The fastest poop ever recorded traveled at 6.1 meters per second. Talk about a speed demon!",
    "Astronauts' poop floats in space - they need special toilets with suction!",
  ];

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

  const fetchAndProcessAllLogs = useCallback(async (currentIdentityPassed = identity) => {
    const currentProcessingIdentity = currentIdentityPassed.username ? currentIdentityPassed : identity;
    setLoadingState(prev => ({ ...prev, logs: true }));
    try {
      const response = await fetch('/api/log'); 
      if (!response.ok) throw new Error('Failed to fetch logs');
      const fetchedLogs = await response.json() || [];
      setAllLogs(fetchedLogs); 

      if (currentProcessingIdentity.username && currentProcessingIdentity.token) {
        const filtered = fetchedLogs.filter(log => log.username === currentProcessingIdentity.username && log.token === currentProcessingIdentity.token);
        const sortedUserLogs = filtered.sort((a, b) => b.timestamp - a.timestamp);
        setUserLogs(sortedUserLogs);
        setDisplayLimit(INITIAL_DISPLAY_LIMIT);
        const lastLocatedUserPoop = sortedUserLogs.find(log => log.city && log.city.trim() !== '');
        setLastUserLocationCity(lastLocatedUserPoop ? lastLocatedUserPoop.city : null);
      } else { 
        setUserLogs([]); setLastUserLocationCity(null);
      }

      if (fetchedLogs.length > 0) {
        const sortedGlobal = [...fetchedLogs].filter(l => typeof l.duration === 'number').sort((a, b) => b.duration - a.duration);
        setGlobalTopPoops(sortedGlobal.slice(0, 10));
        const cityForLocalLead = currentProcessingIdentity.username && lastUserLocationCity ? lastUserLocationCity : (fetchedLogs.find(l => l.city)?.city); 
        if (cityForLocalLead) {
          const filteredLocal = fetchedLogs.filter(l => typeof l.duration === 'number' && l.city && l.city.toLowerCase() === cityForLocalLead.toLowerCase());
          setLocalTopPoops(filteredLocal.sort((a, b) => b.duration - a.duration).slice(0, 10));
        } else { setLocalTopPoops([]); }
      } else { setGlobalTopPoops([]); setLocalTopPoops([]); }
    } catch (error) {
      console.error("Error fetching/processing logs:", error);
      setAllLogs([]); setUserLogs([]); setGlobalTopPoops([]); setLocalTopPoops([]);
    } finally {
      setLoadingState(prev => ({ ...prev, logs: false }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity.username, identity.token, lastUserLocationCity]); // Dependencies for useCallback

  useEffect(() => {
    const id = getIdentity(); 
    setIdentity(id); 
    setLoadingState(prev => ({ ...prev, initial: false }));
  }, []); 
  
  useEffect(() => {
    if (loadingState.initial) return; 
    const processIdentityData = async () => {
        if (identity.username && identity.token) {
            const tokenRateKey = `latestRate_${identity.token}`;
            const userRateKey = `rate_${identity.username}`; 
            let rateToSet = null;
            const latestRateString = localStorage.getItem(tokenRateKey);
            if (latestRateString) { try { const rE = JSON.parse(latestRateString); if (rE && typeof rE.rate === 'number') rateToSet = rE.rate; } catch (e) {} }
            else { const oURS = localStorage.getItem(userRateKey); if (oURS) { try { rateToSet = JSON.parse(oURS); if (rateToSet !== null) localStorage.setItem(tokenRateKey, JSON.stringify({ rate: rateToSet, timestamp: Date.now() })); } catch (e) {} }}
            setRate(rateToSet); 
            await fetchAndProcessAllLogs(identity); 
        } else { 
            setRate(null); setUserLogs([]); setLastUserLocationCity(null);
            if (allLogs.length === 0 && !loadingState.logs) { await fetchAndProcessAllLogs(identity); }
        }
    };
    processIdentityData();
  }, [identity, loadingState.initial, fetchAndProcessAllLogs]); 

  useEffect(() => {
    if (!timing) return;
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
      // Change fact every 30 seconds
      if (Math.floor((Date.now() - start) / 1000) % 30 === 0) {
        setCurrentFactIndex(prev => (prev + 1) % pooFacts.length);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [timing, start, pooFacts.length]);

  const handleSaveRate = () => { 
    if (!tempAmt || isNaN(Number(tempAmt))) { alert("Please enter a valid salary amount."); return; }
    const finalRate = unit === 'annual' ? Number(tempAmt) / 2080 : Number(tempAmt);
    let currentId = identity;
    if (!currentId.username) { currentId = generateAndStoreIdentity(); setIdentity(currentId); }
    if (currentId.username && currentId.token) {
        localStorage.setItem(`rate_${currentId.username}`, JSON.stringify(finalRate));
        localStorage.setItem(`latestRate_${currentId.token}`, JSON.stringify({ rate: finalRate, timestamp: Date.now() }));
    } else { console.error("Could not obtain identity to save rate."); alert("Error: User identity missing."); return; }
    setRate(finalRate); setTempAmt(''); setShowRateModal(false);
  };

  const handleStartTimer = () => { 
    let currentId = identity;
    if (!currentId.username) { currentId = generateAndStoreIdentity(); setIdentity(currentId); }
    if (rate === null) { setShowRateModal(true); alert("Please set your salary/rate first!"); return; }
    setElapsed(0); setTiming(true); setStart(Date.now());
  };

  const handleStopTimerAndPrepareLog = () => { setTiming(false); setShowLogLocationModal(true); setLogLocationMethod('auto'); setLogCity(''); };

// In src/pages/index.js (DashboardPage.js)

  const handleSubmitLog = async () => { 
    if (rate === null || elapsed <= 0) { 
        alert("Log error: Rate not set or timer not run."); 
        setShowLogLocationModal(false); 
        return; 
    }
    if (!identity.username || !identity.token) { 
        alert("Log error: User not identified."); 
        setShowLogLocationModal(false); 
        return;
    }

    setIsSubmittingLog(true); // Set submitting true at the very beginning
    if (logLocationMethod === 'auto') {
        setLoadingState(prev => ({ ...prev, geocoding: true }));
    }

    const calculatedEarnings = ((rate * elapsed) / 3600).toFixed(2);
    let logDataPayload = { 
      username: identity.username, 
      token: identity.token, 
      duration: elapsed, 
      earnings: Number(calculatedEarnings), 
      currentRate: rate, 
      timestamp: Date.now(), 
      lat: null, 
      lng: null, 
      city: null, 
      locationMethod: '' 
    };
    let locationDetermined = false;

    if (logLocationMethod === 'auto') { 
        if (navigator.geolocation) {
            try { 
                const position = await new Promise((resolve, reject) => 
                    navigator.geolocation.getCurrentPosition(resolve, reject, {timeout:10000, enableHighAccuracy: true})
                );
                const obfuscated = obfuscateLocation(position.coords.latitude, position.coords.longitude);
                logDataPayload.lat = obfuscated.lat; 
                logDataPayload.lng = obfuscated.lng; 
                logDataPayload.locationMethod = 'auto_obfuscated';
                
                let fetchedCity = null;
                try { 
                    const userAgent = `${identity.username || 'PooAppUser'}-PaidToPooApp/1.0`;
                    const geoResp = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.coords.latitude}&lon=${position.coords.longitude}`, 
                        {headers: {'User-Agent': userAgent }}
                    ); 
                    if (geoResp.ok) { 
                        const geoData = await geoResp.json(); 
                        fetchedCity = geoData.address?.city || geoData.address?.town || geoData.address?.village || geoData.address?.suburb || geoData.address?.city_district || null;
                    } else {
                        console.warn("Client-side Nominatim failed:", geoResp.status);
                    }
                } catch(e){
                    console.warn("Client-side Nominatim error:", e);
                }
                logDataPayload.city = fetchedCity;
                locationDetermined = true;
            } catch (geoError) { 
                alert(`Geolocation failed: ${geoError.message}. Enter city manually.`); 
                setLogLocationMethod('manual'); // Switch to manual
                // DO NOT return yet, let user correct in modal or cancel
                // Reset loading states here as we are stopping this attempt
                setLoadingState(prev => ({ ...prev, geocoding: false }));
                setIsSubmittingLog(false); // Allow user to try again or cancel
                return; // Exit the function, modal stays open for user to adjust
            }
        } else { 
            alert("Geolocation is not supported. Enter city manually."); 
            setLogLocationMethod('manual'); // Switch to manual
            setLoadingState(prev => ({ ...prev, geocoding: false }));
            setIsSubmittingLog(false);
            return; // Exit the function
        }
    } else if (logLocationMethod === 'manual') { 
        if (!logCity.trim()) { 
            alert("Please enter a city name.");
            setIsSubmittingLog(false); // Reset before returning
            // setLoadingState geocoding is already false or will be set in finally
            return; 
        }
        logDataPayload.city = logCity.trim(); 
        logDataPayload.locationMethod = 'manual'; 
        locationDetermined = true;
    }
    
    // Ensure geocoding loading state is false before API call,
    // unless it was already handled in an error path above.
    setLoadingState(prev => ({ ...prev, geocoding: false }));

    if (!locationDetermined) { 
        alert("Location could not be determined. Please try again or enter manually.");
        setIsSubmittingLog(false); // Reset before returning
        return; 
    }

    try { 
        // isSubmittingLog is already true
        const resp = await fetch('/api/log', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(logDataPayload) 
        });
        if (!resp.ok) { 
            const eT = await resp.text(); 
            throw new Error(`HTTP error! ${resp.status} - ${eT}`);
        }
        const newLogAPI = await resp.json();
        
        await fetchAndProcessAllLogs(identity); 
        setShowLogLocationModal(false); 
        setElapsed(0); 
        
        const navData = newLogAPI && newLogAPI.timestamp ? newLogAPI : logDataPayload;
        router.push(
            `/mapfocus?lat=${navData.lat ?? ''}&lng=${navData.lng ?? ''}&city=${encodeURIComponent(navData.city || '')}&user=${encodeURIComponent(navData.username)}&dur=${navData.duration}&earn=${navData.earnings}&ts=${navData.timestamp}`
        );
    } catch (err) { 
        console.error("API log submission error:", err); 
        alert(`Failed to submit log: ${err.message}`); 
        // isSubmittingLog will be reset in finally
    } finally { 
        setIsSubmittingLog(false); 
        setLoadingState(prev => ({ ...prev, geocoding: false })); // Ensure geocoding is off
    }
  };

  const handleLogItemClick = (log) => { router.push(`/mapfocus?lat=${log.lat??''}&lng=${log.lng??''}&city=${encodeURIComponent(log.city||'')}&user=${encodeURIComponent(log.username)}&dur=${log.duration}&earn=${log.earnings}&ts=${log.timestamp}`); };
  const handleShowAllLogs = () => { setDisplayLimit(userLogs.length); };
  const handleLogout = () => { if(identity.username) localStorage.removeItem(`rate_${identity.username}`); clearIdentity(); setIdentity({ username:'',token:''}); setRate(null); setUserLogs([]); setLastUserLocationCity(null); };
  const handleRecoverAccount = async () => { 
    if (!recoveryCodeInput.trim()) { setRecoveryError('Enter recovery code.'); return; }
    setRecoveryError(''); setLoadingState(p => ({ ...p, recovery:true, logs:true }));
    let currentLogs = allLogs;
    if (currentLogs.length === 0 && !loadingState.logs) { try { const r = await fetch('/api/log'); if(!r.ok) throw new Error("Fetch fail"); currentLogs = await r.json()||[]; setAllLogs(currentLogs); } catch(e){ setRecoveryError("Data fetch error."); setLoadingState(p=>({...p,recovery:false,logs:false})); return;}}
    const userTokenLogs = currentLogs.filter(l => l.token === recoveryCodeInput.trim());
    if (userTokenLogs.length > 0) {
      userTokenLogs.sort((a,b)=>b.timestamp-a.timestamp); const latestLog = userTokenLogs[0];
      const recId = {username:latestLog.username, token:latestLog.token}; storeIdentity(recId); setIdentity(recId);
      setShowRecoveryModal(false); setRecoveryCodeInput('');
    } else { setRecoveryError('Invalid code or no logs for this code.'); }
    setLoadingState(p => ({ ...p, recovery:false, logs:false }));
  };

  const primaryButtonClasses = "text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800 transition-colors duration-150";
  const accentButtonClasses = "text-white bg-green-500 hover:bg-green-600 focus:ring-4 focus:outline-none focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-green-500 dark:hover:bg-green-600 dark:focus:ring-green-700 transition-colors duration-150";
  const errorButtonClasses = "text-white bg-red-600 hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-800 transition-colors duration-150";
  const secondaryButtonClasses = "text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center border border-blue-300 dark:bg-slate-700 dark:text-blue-300 dark:hover:bg-slate-600 dark:border-slate-500 dark:focus:ring-blue-800 transition-colors duration-150";
  const inputClasses = "block w-full px-4 py-3 text-gray-800 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:border-slate-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 transition-colors duration-150";
  const selectClasses = `${inputClasses}`;

  // --- FILLED IN: Leaderboard Item Component ---
  const LeaderboardItem = ({ log, rank }) => (
    <li className="flex justify-between items-center text-sm p-2 border-b border-gray-200 dark:border-slate-700 last:border-b-0">
        <span className="flex items-center">
            <span className="font-semibold w-6 text-center mr-2 text-blue-600 dark:text-blue-500">{rank}.</span>
            <span className="truncate w-28 sm:w-32 md:w-40 text-gray-700 dark:text-gray-400" title={log.username || 'Anonymous'}>{log.username || 'Anonymous'}</span>
        </span>
        <div className="flex flex-col items-end sm:flex-row sm:items-center sm:gap-3">
            <span className="font-mono text-xs sm:text-sm text-gray-700 dark:text-gray-600">{formatDuration(log.duration || 0)}</span>
            <span className="font-semibold text-xs sm:text-sm text-green-500 dark:text-green-600">${Number(log.earnings || 0).toFixed(2)}</span>
        </div>
    </li>
  );

  if (loadingState.initial) { 
    return <div className="min-h-screen flex items-center justify-center bg-blue-50 dark:bg-slate-900"><p className="text-blue-600">Loading Dashboard...</p></div>;
  }

  return (
    <>
      <Head><title>Poo Dashboard | Paid-to-Poo</title></Head>
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-sky-100 dark:from-slate-900 dark:via-slate-800 dark:to-sky-900 p-4 sm:p-6 md:p-8">
        <main className="container mx-auto max-w-6xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col gap-8">
          
          {/* Header Section */}
          <section className="pb-6 border-b border-gray-200 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    {identity.username ? (
                        <>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Welcome back,</p>
                            <h1 className="text-4xl sm:text-5xl font-bold text-blue-600 dark:text-blue-400 -mt-1">
                                {identity.username}
                            </h1>
                        </>
                    ) : (
                        <h1 className="text-3xl sm:text-4xl font-bold text-blue-600 dark:text-blue-400">
                            Poo Dashboard
                        </h1>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    {identity.username && (
                        <button onClick={handleLogout} className={`${secondaryButtonClasses} !w-full sm:!w-auto whitespace-nowrap`}>Log Out</button>
                    )}
                    {!identity.username && (
                         <button onClick={() => { setShowRecoveryModal(true); setRecoveryError(''); }} className={`${primaryButtonClasses} !w-full sm:!w-auto whitespace-nowrap`}>Use Recovery Code</button>
                    )}
                    {identity.username && (
                        <Link href="/globallogmap" className={`${secondaryButtonClasses} !w-full sm:!w-auto text-center whitespace-nowrap`}>View Global Map</Link>
                    )}
                </div>
            </div>
            {identity.username && (
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <p>
                  <span className="font-semibold">Your Rate:</span> {rate !== null ? `$${Number(rate).toFixed(2)}/hr` : 'Not set'} 
                  <button onClick={() => setShowRateModal(true)} className="ml-2 text-blue-500 hover:underline text-xs font-medium">(Set/Change)</button>
                </p>
                <div>
                    <span className="font-semibold">Recovery Code:</span> 
                    <strong className="ml-1 select-all bg-blue-100 dark:bg-slate-700 p-1 rounded font-mono text-blue-700 dark:text-blue-300">
                        {identity.token}
                    </strong>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Keep this code safe! Use it to access your history if you change devices or clear browser data.
                    </p>
                </div>
              </div>
            )}
            {!identity.username && !showRateModal && !showRecoveryModal && (
                <div className="mt-6 text-center p-6 bg-blue-50 dark:bg-slate-750 rounded-xl shadow">
                    <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300 mb-3">
                        Welcome to Paid-to-Poo!
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-500 mb-4">
                        Ready to see how much you earn on your breaks? Click below to set your salary rate and get started.
                        A unique username and a recovery code will be generated for you.
                        <br />
                        <span className="block mt-2">
                            Returning user? Click "Use Recovery Code" above.
                        </span>
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button 
                            onClick={() => { 
                                let currentId = identity;
                                if (!currentId.username) { 
                                    currentId = generateAndStoreIdentity(); 
                                    setIdentity(currentId); 
                                }
                                setShowRateModal(true); 
                            }} 
                            className={`${primaryButtonClasses} !w-full sm:!w-auto`}
                        >
                            Set Rate & Begin Tracking
                        </button>
                    </div>
                </div>
            )}
          </section>

          {identity.username && (
            <section className="text-center p-6 bg-blue-50 dark:bg-slate-750 rounded-xl shadow-md">
                <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300 mb-6">Track New Break</h2>
                
                {/* Timer Circle */}
                <div className="relative w-48 h-48 mx-auto mb-6">
                    {/* Progress Ring */}
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                        <circle
                            className="text-blue-100 dark:text-slate-700"
                            strokeWidth="8"
                            stroke="currentColor"
                            fill="transparent"
                            r="88"
                            cx="96"
                            cy="96"
                        />
                        {timing && (
                            <circle
                                className="text-blue-500 dark:text-blue-400 transition-all duration-1000"
                                strokeWidth="8"
                                stroke="currentColor"
                                fill="transparent"
                                r="88"
                                cx="96"
                                cy="96"
                                strokeDasharray="553"
                                strokeDashoffset={553 - ((elapsed % 300) / 300) * 553}
                            />
                        )}
                    </svg>
                    
                    {/* Timer Display */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <div className="text-5xl font-mono text-blue-600 dark:text-blue-400 tabular-nums">
                                {`${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`}
                            </div>
                            {rate !== null && timing && (
                                <div className="text-lg text-gray-700 dark:text-gray-200 mt-2">
                                    <span className="font-bold text-green-600 dark:text-green-400">${((rate * elapsed) / 3600).toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Random Facts */}
                <div className="text-center mb-6 h-16">
                    <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                        {timing ? `Did you know? ${pooFacts[currentFactIndex]}` : "Ready to make some money while you do your business?"}
                    </p>
                </div>

                {/* Control Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {!timing ? (
                        <button
                            onClick={handleStartTimer}
                            className={`${accentButtonClasses} py-3 text-lg flex-1 !w-full sm:!w-auto rounded-full transition-transform hover:scale-105`}
                        >
                            Start Break
                        </button>
                    ) : (
                        <button
                            onClick={handleStopTimerAndPrepareLog}
                            className={`${errorButtonClasses} py-3 text-lg flex-1 !w-full sm:!w-auto rounded-full transition-transform hover:scale-105`}
                        >
                            Finish Break
                        </button>
                    )}
                </div>
                {rate === null && identity.username && !showRateModal && (
                    <p className="text-xs text-red-500 mt-4 text-center">Please set your rate to calculate earnings.</p>
                )}
            </section>
          )}
          
          {identity.username && (
            <section>
                <h2 className="text-2xl font-semibold text-blue-700 dark:text-blue-300 mb-4">Your Recent Breaks</h2>
                {loadingState.logs && userLogs.length === 0 && <p className="text-gray-500 dark:text-gray-500">Loading your breaks...</p>}
                {!loadingState.logs && userLogs.length === 0 && (<p className="text-gray-500 dark:text-gray-500">You haven't logged any breaks yet.</p>)}
                {!loadingState.logs && userLogs.length > 0 && (
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
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
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

          {(allLogs.length > 0 || loadingState.logs) && (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 dark:bg-slate-750 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400 mb-3 border-b pb-2 dark:border-slate-600">
                    Local Top 10 {lastUserLocationCity ? `(Near ${lastUserLocationCity})` : "(Log Poop w/ City)"}
                </h3>
                {loadingState.logs && localTopPoops.length === 0 ? <p className="text-xs text-gray-500 dark:text-gray-500">Loading...</p> :
                localTopPoops.length > 0 ? (
                    <ul className="space-y-1 max-h-80 overflow-y-auto pr-1">
                    {localTopPoops.map((log, index) => <LeaderboardItem key={`local-${index}-${log.timestamp}`} log={log} rank={index + 1} />)}
                    </ul>
                ) : ( <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{lastUserLocationCity ? "No other poops here." : "Log poop with city for local stats."}</p> )}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-slate-750 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400 mb-3 border-b pb-2 dark:border-slate-600">
                    Global Top 10 Poopers
                </h3>
                {loadingState.logs && globalTopPoops.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Loading...</p> :
                globalTopPoops.length > 0 ? (
                    <ul className="space-y-1 max-h-80 overflow-y-auto pr-1">
                    {globalTopPoops.map((log, index) => <LeaderboardItem key={`global-${index}-${log.timestamp}`} log={log} rank={index + 1} />)}
                    </ul>
                ) : ( <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Be the first global record setter!</p> )}
                </div>
            </section>
          )}
        </main>

        {/* Rate Setting Modal */}
        {showRateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl w-full max-w-md space-y-4">
              <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Set Your Salary/Rate</h3>
              <p className="text-sm text-gray-600 dark:text-gray-500">
                {rate !== null && identity.username ? "Update your current rate." : "Enter your salary to calculate earnings during breaks."}
              </p>
              <div><input id="modalSalary" type="number" placeholder="Salary Amount" value={tempAmt} onChange={e => setTempAmt(e.target.value)} className={inputClasses}/></div>
              <div>
                <select id="modalUnit" value={unit} onChange={e => setUnit(e.target.value)} className={selectClasses}>
                  <option value="hourly">Hourly Rate</option><option value="annual">Annual Salary</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">{unit === 'annual' ? 'Annual converted to hourly.' : 'Direct hourly rate.'}</p>
              </div>
              <div className="flex gap-3">
                {(rate !== null || identity.username) && <button onClick={() => setShowRateModal(false)} className={`${secondaryButtonClasses} !w-full`}>Cancel</button> }
                <button onClick={handleSaveRate} className={`${primaryButtonClasses} !w-full`}>Save Rate</button>
              </div>
            </div>
          </div>
        )}

        {/* Log Location Modal */}
        {showLogLocationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl w-full max-w-md space-y-4">
              <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Log Location</h3>
              <p className="text-sm text-gray-600 dark:text-gray-500">Location is required. If auto-detect fails, enter city manually.</p>
              <div className="space-y-2">
                <label className="flex items-center p-3 border rounded-lg cursor-pointer dark:border-slate-600"><input type="radio" name="locationMethod" value="auto" checked={logLocationMethod === 'auto'} onChange={() => setLogLocationMethod('auto')} className="form-radio text-blue-600"/> <span className="ml-3 text-gray-700 dark:text-gray-400">Use Current Location</span></label>
                <label className="flex items-center p-3 border rounded-lg cursor-pointer dark:border-slate-600"><input type="radio" name="locationMethod" value="manual" checked={logLocationMethod === 'manual'} onChange={() => setLogLocationMethod('manual')} className="form-radio text-blue-600"/> <span className="ml-3 text-gray-700 dark:text-gray-400">Enter City Manually</span></label>
                {logLocationMethod === 'manual' && (<input id="logCityManual" type="text" placeholder="Enter city" value={logCity} onChange={e => setLogCity(e.target.value)} className={`${inputClasses} ml-8 mt-1 text-sm`}/>)}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowLogLocationModal(false)} className={`${secondaryButtonClasses} !w-full`}>Cancel</button>
                <button onClick={handleSubmitLog} disabled={isSubmittingLog || loadingState.geocoding} className={`${primaryButtonClasses} !w-full`}>
                    {isSubmittingLog ? (loadingState.geocoding ? 'Getting Location...' : 'Submitting...') : 'Submit Log'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recovery Modal */}
        {showRecoveryModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl w-full max-w-md space-y-4">
                    <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Recover Account</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-500">Enter recovery code to restore session.</p>
                    <div><input id="recoveryCode" type="text" placeholder="Recovery code" value={recoveryCodeInput} onChange={e => setRecoveryCodeInput(e.target.value)} className={inputClasses}/></div>
                    {recoveryError && <p className="text-xs text-red-500">{recoveryError}</p>}
                    <div className="flex gap-3">
                        <button onClick={() => {setShowRecoveryModal(false); setRecoveryError('');}} className={`${secondaryButtonClasses} !w-full`}>Cancel</button>
                        <button onClick={handleRecoverAccount} disabled={loadingState.recovery || loadingState.logs} className={`${primaryButtonClasses} !w-full`}>
                            {loadingState.recovery || loadingState.logs ? 'Verifying...' : 'Recover'} 
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </>
  );
}