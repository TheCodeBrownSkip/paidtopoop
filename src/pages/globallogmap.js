// src/pages/globallogmap.js
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const formatDuration = (seconds) => {
  if (isNaN(seconds) || seconds === null) return 'N/A';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

export default function GlobalLogMapPage() {
  const router = useRouter();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerClusterGroupRef = useRef(null);

  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canRenderMapDiv, setCanRenderMapDiv] = useState(false); // Controls map div rendering

  // Fetch logs
  useEffect(() => {
    setLoading(true);
    fetch('/api/log') 
      .then(r => {
        if (!r.ok) throw new Error(`Failed to fetch logs: ${r.status}`);
        return r.json();
      })
      .then(data => {
        setAllLogs(data || []);
        setError('');
      })
      .catch(err => {
        console.error("Error fetching logs for global map:", err);
        setError(err.message || "Could not load log data.");
        setAllLogs([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Effect to allow rendering the map div after initial mount/HMR cycle
  useEffect(() => {
    // This timeout gives a moment for any previous HMR instance's cleanup to complete
    // before we attempt to render the div that Leaflet will attach to.
    const timerId = setTimeout(() => {
      console.log("Setting canRenderMapDiv to true");
      setCanRenderMapDiv(true);
    }, 100); // Increased delay slightly for HMR stability

    return () => clearTimeout(timerId);
  }, []);


  // Initialize map
  useEffect(() => {
    // Conditions to proceed:
    // 1. canRenderMapDiv must be true (div is allowed to be in DOM)
    // 2. mapContainerRef.current must exist (div has actually rendered)
    // 3. mapInstanceRef.current must be null (no existing map instance)
    if (!canRenderMapDiv || !mapContainerRef.current || mapInstanceRef.current) {
      if (mapInstanceRef.current) console.log("Map init skipped: Instance already exists.");
      else if (!mapContainerRef.current) console.log("Map init skipped: Container ref not yet set.");
      else if (!canRenderMapDiv) console.log("Map init skipped: CanRenderMapDiv is false.");
      return;
    }
    
    const container = mapContainerRef.current;

    // Defensive check for Leaflet's internal ID before attempting to initialize
    if (container._leaflet_id) {
      console.warn("CRITICAL: _leaflet_id found on container before L.map(). Aborting init this cycle.", container);
      // This state indicates a problem with cleanup or HMR.
      // A hard refresh (Ctrl+F5) might be needed if this persists.
      // We abort to prevent the "already initialized" error.
      // The component might re-render, and hopefully, the container will be clean then.
      return; 
    }

    console.log("Attempting to initialize Leaflet map...");
    let L; 
    (async () => {
      try {
        L = await import('leaflet');
        await import('leaflet.markercluster/dist/leaflet.markercluster.js'); 

        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: iconRetinaUrl.src,
          iconUrl: iconUrl.src,
          shadowUrl: shadowUrl.src,
        });

        mapInstanceRef.current = L.map(container).setView([20, 0], 2);
        console.log("L.map() successful.");

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap contributors',
        }).addTo(mapInstanceRef.current);

        if (typeof L.markerClusterGroup === 'function') {
            markerClusterGroupRef.current = L.markerClusterGroup();
            mapInstanceRef.current.addLayer(markerClusterGroupRef.current);
            console.log("MarkerClusterGroup initialized and added to map.");
        } else {
            console.error("L.markerClusterGroup is not a function after import!");
            setError("Failed to load map clustering feature.");
            // Clean up map if clustering failed, as it's critical here
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        }
      } catch (e) {
        console.error("Error initializing map or MarkerCluster:", e);
        setError(e.message || "Could not load the map display components.");
        // Ensure map instance is nulled if init failed
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }
      }
    })();

    // Cleanup function: This is critical for HMR
    return () => {
      console.log("Cleaning up map instance (useEffect for map init)...");
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove(); // Leaflet's own cleanup
        mapInstanceRef.current = null;   // Clear our ref
        console.log("Map instance removed.");
      }
      if (markerClusterGroupRef.current) {
        // markerClusterGroup is a Layer, removed when map is removed, or can be removed from map.
        // Nullifying ref is sufficient as it's tied to mapInstance.
        markerClusterGroupRef.current = null;
      }
    };
  }, [canRenderMapDiv]); // Re-run this effect if canRenderMapDiv changes (from false to true)

  // Add markers to cluster group
  useEffect(() => {
    if (!mapInstanceRef.current || !markerClusterGroupRef.current || loading || error) {
      if (error) console.log("Skipping markers due to error state:", error);
      else if (loading) console.log("Skipping markers: Still loading data.");
      else console.log("Skipping markers: Map or cluster group not ready.");
      return;
    }
    
    console.log("Attempting to add markers. Log count:", allLogs.length);
    let L_markers; 
    (async () => {
        try {
            L_markers = await import('leaflet');
            markerClusterGroupRef.current.clearLayers(); 
            console.log("Cleared previous markers from cluster group.");

            let addedCount = 0;
            if (allLogs.length > 0) {
                allLogs.forEach(log => {
                    if (log.lat !== null && log.lng !== null && typeof log.lat === 'number' && typeof log.lng === 'number') {
                        const marker = L_markers.marker([log.lat, log.lng]); 
                        marker.bindPopup(
                            `<b>${log.username || 'Anonymous'}</b><br/>
                            Duration: ${formatDuration(log.duration)}<br/>
                            Earned: $${Number(log.earnings).toFixed(2)}<br/>
                            ${log.city ? `City: ${log.city}<br/>` : ''}
                            <small>Logged: ${new Date(log.timestamp).toLocaleString()}</small>`
                        );
                        markerClusterGroupRef.current.addLayer(marker);
                        addedCount++;
                    }
                });
                console.log(`Added ${addedCount} markers to cluster.`);
            } else {
                console.log("No logs with coordinates to add to map.");
            }
        } catch(e) {
            console.error("Error adding markers to cluster:", e);
            setError("Error displaying log markers.");
        }
    })();
  }, [allLogs, loading, error]); // Dependencies


  const backButtonClasses = "text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800 transition-colors duration-150 !w-auto";

  return (
    <>
      <Head>
        <title>Global Log Map | Paid-to-Poo</title>
        <meta name="description" content="View all logged breaks on a world map." />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-sky-100 dark:from-slate-900 dark:via-slate-800 dark:to-sky-900 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        <main className="bg-white dark:bg-slate-800 w-full max-w-6xl rounded-2xl shadow-2xl p-6 flex flex-col gap-4 h-[90vh]">
          <header className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-slate-700">
            <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Global Breaks Map</h1>
            <Link href="/" className={backButtonClasses}>Back to Dashboard</Link>
          </header>

          {/* Conditional rendering for loading/error states OR the map container */}
          {error ? (
            <div className="flex-grow flex items-center justify-center text-red-500 p-4 bg-red-100 dark:bg-red-900 dark:text-red-300 rounded-md">
              <p>Error: {error}</p>
            </div>
          ) : loading && !canRenderMapDiv ? ( // Show general loading if map div isn't even ready to be shown
            <div className="flex-grow flex items-center justify-center text-blue-600 dark:text-blue-400">
              <p>Loading map and log data...</p>
            </div>
          ) : !canRenderMapDiv ? ( // If not loading, but div isn't ready (should be brief due to timeout)
            <div className="flex-grow flex items-center justify-center text-blue-600 dark:text-blue-400">
              <p>Preparing map area...</p>
            </div>
          ) : (
            // Only render the map div if canRenderMapDiv is true
            <div 
              ref={mapContainerRef} 
              className="flex-grow rounded-lg shadow-inner overflow-hidden bg-gray-200 dark:bg-slate-700" // flex-grow is key here
              style={{ minHeight: '400px' }} // Ensure it has a minimum height
            >
              {/* Overlay for data loading if map is initialized but data is still fetching */}
              {loading && mapInstanceRef.current && (
                 <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-800/50 z-10 rounded-lg">
                    <p className="text-blue-600 dark:text-blue-400 p-4 bg-white/80 dark:bg-slate-700/80 rounded-md shadow-lg">Loading log data...</p>
                </div>
              )}
            </div>
          )}
           {!loading && !error && allLogs.length === 0 && (
             <p className="text-center text-gray-500 dark:text-gray-400 py-4">No logs with location data found to display on the map.</p>
           )}
        </main>
      </div>
    </>
  );
}