// src/pages/mapfocus.js
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';

// Import Leaflet icon assets
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Helper to format duration
const formatDuration = (seconds) => {
  if (isNaN(seconds) || seconds === null) return 'N/A';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

export default function MapFocusPage() {
  const router = useRouter();
  const { query } = router;

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [logDetails, setLogDetails] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (router.isReady) { // Ensure query params are available
      const { lat, lng, city, user, dur, earn, ts } = query;
      if ((lat && lng) || city) {
        setLogDetails({
          lat: lat ? parseFloat(lat) : null,
          lng: lng ? parseFloat(lng) : null,
          city: city ? decodeURIComponent(city) : null,
          username: user ? decodeURIComponent(user) : 'Anonymous',
          duration: dur ? parseInt(dur, 10) : 0,
          earnings: earn ? parseFloat(earn) : 0,
          timestamp: ts ? parseInt(ts, 10) : Date.now(),
        });
        setError('');
      } else {
        setError("Insufficient location data provided to display on map.");
        console.warn("MapFocusPage: Missing lat/lng or city in query params", query);
      }
    }
  }, [router.isReady, query]);

  useEffect(() => {
    if (!logDetails || !mapContainerRef.current || mapInstanceRef.current) return;

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

        const mapCenter = (logDetails.lat && logDetails.lng) ? [logDetails.lat, logDetails.lng] : [20, 0]; // Default if no lat/lng
        const initialZoom = (logDetails.lat && logDetails.lng) ? 13 : 2;

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
               Earned: $${Number(logDetails.earnings).toFixed(2)}<br/>
               ${logDetails.city ? `City: ${logDetails.city}<br/>` : ''}
               <small>Logged: ${new Date(logDetails.timestamp).toLocaleString()}</small>`
            ).openPopup();
        } else if (logDetails.city) {
          // If only city, we can't place a marker without geocoding.
          // Map will be centered generally. We can show city name in details.
          console.log("Displaying map for city (no precise coordinates):", logDetails.city);
        }

      } catch (e) {
        console.error("Error initializing map on MapFocusPage:", e);
        setError("Could not load the map.");
      }
    })();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [logDetails]); // Re-initialize map if logDetails change (e.g. direct navigation with new query)

  const backButtonClasses = "text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800 transition-colors duration-150 !w-auto";


  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-blue-50 dark:bg-slate-900">
        <p className="text-red-500 text-xl mb-4">{error}</p>
        <Link href="/" className={backButtonClasses}>Go to Dashboard</Link>
      </div>
    );
  }
  
  if (!logDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-blue-50 dark:bg-slate-900">
        <p className="text-blue-600 text-lg">Loading log details...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Map Focus: {logDetails.username}'s Break | Paid-to-Poo</title>
        <meta name="description" content={`Map view of a break logged by ${logDetails.username}`} />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-sky-100 dark:from-slate-900 dark:via-slate-800 dark:to-sky-900 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        <main className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl p-6 flex flex-col gap-4 h-[90vh]">
          <header className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-slate-700">
            <div>
                <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Break Location</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Entry from {new Date(logDetails.timestamp).toLocaleDateString()}
                </p>
            </div>
            <Link href="/" className={backButtonClasses}>Back to Dashboard</Link>
          </header>

          <div className="flex flex-col md:flex-row gap-4 flex-grow min-h-0"> {/* min-h-0 important for flex-grow in flex col */}
            <div className="md:w-1/3 space-y-2 text-sm text-gray-700 dark:text-gray-300 p-2 border rounded-md dark:border-slate-700 overflow-y-auto">
              <p><strong>User:</strong> {logDetails.username}</p>
              <p><strong>Duration:</strong> {formatDuration(logDetails.duration)}</p>
              <p><strong>Earned:</strong> ${Number(logDetails.earnings).toFixed(2)}</p>
              {logDetails.city && <p><strong>City:</strong> {logDetails.city}</p>}
              {!(logDetails.lat && logDetails.lng) && logDetails.city && 
                <p className="text-xs text-orange-500">(No precise coordinates, map shows general area or default view)</p>
              }
            </div>
            <div 
              ref={mapContainerRef} 
              className="md:w-2/3 flex-grow rounded-lg shadow-inner overflow-hidden bg-gray-200 dark:bg-slate-700 min-h-[300px]" // min-h for when stacked
            />
          </div>
        </main>
      </div>
    </>
  );
}