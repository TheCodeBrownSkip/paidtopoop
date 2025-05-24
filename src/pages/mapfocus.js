// src/pages/mapfocus.js
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';

import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const formatDuration = (seconds) => {
  const numSeconds = Number(seconds); // Ensure it's a number
  if (isNaN(numSeconds) || numSeconds === null || numSeconds < 0) return 'N/A';
  const minutes = Math.floor(numSeconds / 60);
  const remainingSeconds = numSeconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

const formatEarnings = (earnings) => {
    const numEarnings = Number(earnings);
    if (isNaN(numEarnings) || numEarnings === null) return 'N/A';
    return `$${numEarnings.toFixed(2)}`;
}

const formatDate = (timestamp) => {
    const numTimestamp = Number(timestamp);
    if (isNaN(numTimestamp) || numTimestamp === null || numTimestamp <= 0) return 'Invalid Date';
    return new Date(numTimestamp).toLocaleString();
}


export default function MapFocusPage() {
  const router = useRouter();
  const { query } = router;

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [logDetails, setLogDetails] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (router.isReady) {
      console.log("MapFocusPage received query:", query);
      const { lat, lng, city, user, dur, earn, ts } = query;

      // More robust parsing
      const parsedLat = lat !== undefined && lat !== null && lat !== '' ? parseFloat(lat) : null;
      const parsedLng = lng !== undefined && lng !== null && lng !== '' ? parseFloat(lng) : null;
      const parsedCity = city ? decodeURIComponent(city) : null;
      const parsedUser = user ? decodeURIComponent(user) : 'Anonymous';
      const parsedDuration = dur !== undefined && dur !== null ? parseInt(dur, 10) : null;
      const parsedEarnings = earn !== undefined && earn !== null ? parseFloat(earn) : null;
      const parsedTimestamp = ts !== undefined && ts !== null ? parseInt(ts, 10) : null;

      if ((parsedLat !== null && parsedLng !== null) || parsedCity) {
        if (parsedUser && parsedDuration !== null && parsedEarnings !== null && parsedTimestamp !== null) {
            setLogDetails({
                lat: isNaN(parsedLat) ? null : parsedLat,
                lng: isNaN(parsedLng) ? null : parsedLng,
                city: parsedCity,
                username: parsedUser,
                duration: isNaN(parsedDuration) ? 0 : parsedDuration,
                earnings: isNaN(parsedEarnings) ? 0 : parsedEarnings,
                timestamp: isNaN(parsedTimestamp) ? Date.now() : parsedTimestamp,
            });
            setError('');
        } else {
            setError("Core log details (user, duration, earnings, timestamp) are missing or invalid in the URL.");
            console.warn("MapFocusPage: Missing core log details", query);
        }
      } else {
        setError("Insufficient location data (lat/lng or city) provided in the URL.");
        console.warn("MapFocusPage: Missing lat/lng or city in query params", query);
      }
    }
  }, [router.isReady, query]);

  useEffect(() => {
    if (!logDetails || !mapContainerRef.current || mapInstanceRef.current) {
      if (mapInstanceRef.current && logDetails) console.log("Map already initialized or log details not ready to update map markers.");
      return;
    }

    let L;
    (async () => {
      try {
        L = await import('leaflet');
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: iconRetinaUrl.src,
          iconUrl: iconUrl.src,
          shadowUrl: shadowUrl.src,
        });

        const mapCenter = (logDetails.lat && logDetails.lng) ? [logDetails.lat, logDetails.lng] : [20, 0];
        const initialZoom = (logDetails.lat && logDetails.lng) ? 13 : 2;

        console.log("Initializing map on MapFocusPage with center:", mapCenter, "zoom:", initialZoom);
        mapInstanceRef.current = L.map(mapContainerRef.current).setView(mapCenter, initialZoom);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap contributors',
        }).addTo(mapInstanceRef.current);

        if (logDetails.lat && logDetails.lng) {
          L.marker([logDetails.lat, logDetails.lng]).addTo(mapInstanceRef.current)
            .bindPopup(
              `<b>${logDetails.username}</b><br/>
               Duration: ${formatDuration(logDetails.duration)}<br/>
               Earned: ${formatEarnings(logDetails.earnings)}<br/>
               ${logDetails.city ? `City: ${logDetails.city}<br/>` : ''}
               <small>Logged: ${formatDate(logDetails.timestamp)}</small>`
            ).openPopup();
        } else if (logDetails.city) {
          console.log("Displaying map for city (no precise coordinates):", logDetails.city);
        }

      } catch (e) {
        console.error("Error initializing map on MapFocusPage:", e);
        setError("Could not load the map.");
      }
    })();

    return () => {
      if (mapInstanceRef.current) {
        console.log("Removing map instance from MapFocusPage.");
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [logDetails]);

  const backButtonClasses = "text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800 transition-colors duration-150 !w-auto";

  if (!router.isReady || (!logDetails && !error)) { // Show loading if router not ready OR (logDetails not set AND no error yet)
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-blue-50 dark:bg-slate-900">
        <p className="text-blue-600 text-lg">Loading log details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-blue-50 dark:bg-slate-900">
        <p className="text-red-500 text-xl mb-4">{error}</p>
        <Link href="/" className={backButtonClasses}>Go to Dashboard</Link>
      </div>
    );
  }
  
  // This check is now less likely to be hit if the above loading is correct
  // if (!logDetails) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center p-4 bg-blue-50 dark:bg-slate-900">
  //       <p className="text-blue-600 text-lg">Preparing map...</p>
  //     </div>
  //   );
  // }


  return (
    <>
      <Head>
        <title>Map Focus: {logDetails?.username || 'Log'}'s Break | Paid-to-Poo</title>
        <meta name="description" content={`Map view of a break logged by ${logDetails?.username || 'User'}`} />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-sky-100 dark:from-slate-900 dark:via-slate-800 dark:to-sky-900 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        <main className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl p-6 flex flex-col gap-4 h-[90vh]">
          <header className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-slate-700">
            <div>
                <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Break Location</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Entry from {formatDate(logDetails.timestamp)}
                </p>
            </div>
            <Link href="/" className={backButtonClasses}>Back to Dashboard</Link>
          </header>

          <div className="flex flex-col md:flex-row gap-4 flex-grow min-h-0">
            <div className="md:w-1/3 space-y-2 text-sm text-gray-700 dark:text-gray-300 p-3 border rounded-md dark:border-slate-700 bg-slate-50 dark:bg-slate-750 overflow-y-auto">
              <p><strong>User:</strong> {logDetails.username}</p>
              <p><strong>Duration:</strong> {formatDuration(logDetails.duration)}</p>
              <p><strong>Earned:</strong> {formatEarnings(logDetails.earnings)}</p>
              {logDetails.city && <p><strong>City:</strong> {logDetails.city}</p>}
              {!(logDetails.lat && logDetails.lng) && logDetails.city && 
                <p className="text-xs text-orange-500">(No precise coordinates, map shows general area or default view)</p>
              }
               {!(logDetails.lat && logDetails.lng) && !logDetails.city && 
                <p className="text-xs text-orange-500">(No location information available)</p>
              }
            </div>
            <div 
              ref={mapContainerRef} 
              className="md:w-2/3 flex-grow rounded-lg shadow-inner overflow-hidden bg-gray-200 dark:bg-slate-700 min-h-[300px]"
            />
          </div>
        </main>
      </div>
    </>
  );
}