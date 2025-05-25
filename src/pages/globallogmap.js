// src/pages/globallogmap.js
import Head from 'next/head';
import { useEffect, useState, useRef } from 'react'; // Ensure all hooks are imported
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const formatDuration = (seconds) => {
  if (isNaN(Number(seconds)) || seconds === null) return 'N/A';
  const numSeconds = Number(seconds);
  const minutes = Math.floor(numSeconds / 60);
  const remainingSeconds = numSeconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

export default function GlobalLogMapPage() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerClusterGroupRef = useRef(null);
  const LRef = useRef(null); 

  const [allLogs, setAllLogs] = useState([]);
  const [loadingData, setLoadingData] = useState(true); // Using this for data loading
  const [error, setError] = useState('');
  const [isMapReady, setIsMapReady] = useState(false); // For map initialization readiness

  // Fetch logs
  useEffect(() => {
    setLoadingData(true);
    setError('');
    fetch('/api/log') 
      .then(r => {
        if (!r.ok) throw new Error(`Failed to fetch logs: ${r.status} ${r.statusText}`);
        return r.json();
      })
      .then(data => {
        setAllLogs(data || []);
      })
      .catch(err => {
        console.error("Error fetching logs for global map:", err);
        setError(err.message || "Could not load log data.");
        setAllLogs([]);
      })
      .finally(() => setLoadingData(false));
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current || isMapReady) {
      if (mapInstanceRef.current) console.log("GlobalMap: Map instance already exists or map is already ready.");
      return;
    }
    
    const container = mapContainerRef.current;
    if (container._leaflet_id) {
      console.warn("GlobalMap: _leaflet_id found on container BEFORE init. Aborting.");
      return; 
    }

    console.log("GlobalMap: Attempting to initialize Leaflet map...");
    (async () => {
      try {
        const L = await import('leaflet');
        LRef.current = L; 
        await import('leaflet.markercluster/dist/leaflet.markercluster.js'); 

        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: iconRetinaUrl.src,
          iconUrl: iconUrl.src,
          shadowUrl: shadowUrl.src,
        });

        if (!mapContainerRef.current || mapInstanceRef.current || mapContainerRef.current._leaflet_id) {
            console.warn("GlobalMap: Conditions for map init changed before L.map() call. Aborting.");
            return;
        }

        mapInstanceRef.current = L.map(mapContainerRef.current).setView([20, 0], 2);
        console.log("GlobalMap: L.map() successful.");

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap contributors',
        }).addTo(mapInstanceRef.current);

        if (typeof L.markerClusterGroup === 'function') {
            markerClusterGroupRef.current = L.markerClusterGroup();
            mapInstanceRef.current.addLayer(markerClusterGroupRef.current);
            console.log("GlobalMap: MarkerClusterGroup initialized and added to map.");
            setIsMapReady(true); 
        } else {
            console.error("GlobalMap: L.markerClusterGroup is not a function after import!");
            setError("Failed to load map clustering feature.");
            if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
        }
      } catch (e) {
        console.error("GlobalMap: Error initializing map or MarkerCluster:", e);
        setError(e.message || "Could not load map components.");
        if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
      }
    })();

    return () => {
      console.log("GlobalMap: Cleaning up map instance...");
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
      if (markerClusterGroupRef.current) { markerClusterGroupRef.current = null; }
      LRef.current = null;
      setIsMapReady(false); 
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs once on mount to attempt setup. isMapReady controls further marker logic.

  // Add markers to cluster group
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current || !markerClusterGroupRef.current || loadingData || error || !LRef.current) {
      return;
    }
    
    const L = LRef.current; 
    console.log("GlobalMap: Attempting to add markers. Log count:", allLogs.length);
    
    markerClusterGroupRef.current.clearLayers(); 
    console.log("GlobalMap: Cleared previous markers from cluster group.");

    let addedCount = 0;
    if (allLogs.length > 0) {
        allLogs.forEach(log => {
            if (log.lat !== null && log.lng !== null && typeof log.lat === 'number' && typeof log.lng === 'number') {
                const marker = L.marker([log.lat, log.lng]); 
                marker.bindPopup(
                    `<b>${log.username || 'Anonymous'}</b><br/>
                    Duration: ${formatDuration(log.duration)}<br/>
                    Earned: $${Number(log.earnings || 0).toFixed(2)}<br/>
                    ${log.city ? `City: ${log.city}<br/>` : ''}
                    <small>Logged: ${new Date(log.timestamp).toLocaleString()}</small>`
                );
                markerClusterGroupRef.current.addLayer(marker);
                addedCount++;
            }
        });
        console.log(`GlobalMap: Added ${addedCount} markers to cluster.`);
    } else {
        console.log("GlobalMap: No logs with coordinates to add to map.");
    }
  }, [allLogs, loadingData, error, isMapReady]); 

  const backButtonClasses = "text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800 transition-colors duration-150 !w-auto";
  const mapDivHeightClass = "flex-grow min-h-[400px]";

  // Determine overall page status for rendering
  const pageStatus = (() => {
    if (loadingData && !isMapReady) return "LOADING_ALL"; // Data and map not ready
    if (loadingData && isMapReady) return "MAP_READY_LOADING_DATA"; // Map ready, data loading
    if (error) return "ERROR";
    if (!loadingData && !isMapReady && mapContainerRef.current) return "DATA_LOADED_MAP_INITIALIZING";
    if (!loadingData && isMapReady && allLogs.length === 0) return "NO_LOGS_TO_DISPLAY";
    if (!loadingData && isMapReady) return "READY";
    return "PREPARING"; // Default before mapContainerRef is available
  })();

  return (
    <>
      <Head>
        <title>Global Log Map | Paid-to-Poo</title>
        <meta name="description" content="View all logged breaks on a world map." />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate, max-age=0" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-sky-100 dark:from-slate-900 dark:via-slate-800 dark:to-sky-900 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        <main className="bg-white dark:bg-slate-800 w-full max-w-6xl rounded-2xl shadow-2xl p-6 flex flex-col gap-4 h-[90vh]">
          <header className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-slate-700">
            <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Global Breaks Map</h1>
            <Link href="/" className={backButtonClasses}>Back to Dashboard</Link>
          </header>

          {pageStatus === "ERROR" && (
            <div className={`flex-grow flex items-center justify-center text-red-500 p-4 bg-red-100 dark:bg-red-900 dark:text-red-300 rounded-md ${mapDivHeightClass}`}>
              <p>Error: {error}</p>
            </div>
          )}

          {(pageStatus === "LOADING_ALL" || pageStatus === "PREPARING" || pageStatus === "DATA_LOADED_MAP_INITIALIZING") && (
            <div className={`flex-grow flex items-center justify-center text-blue-600 dark:text-blue-400 rounded-lg bg-gray-100 dark:bg-slate-700 shadow-inner ${mapDivHeightClass}`}>
              <p>
                {pageStatus === "LOADING_ALL" ? "Loading map and log data..." : 
                 pageStatus === "DATA_LOADED_MAP_INITIALIZING" ? "Initializing map display..." : 
                 "Preparing map area..."}
              </p>
            </div>
          )}
          
          {/* Map container is rendered if not erroring or in initial loading phases */}
          {pageStatus !== "ERROR" && pageStatus !== "LOADING_ALL" && pageStatus !== "PREPARING" && pageStatus !== "DATA_LOADED_MAP_INITIALIZING" && (
             <div 
              ref={mapContainerRef} 
              className={`relative rounded-lg shadow-inner overflow-hidden bg-gray-200 dark:bg-slate-700 ${mapDivHeightClass} ${!isMapReady ? 'invisible' : 'visible'}`} // Use invisible to keep in layout flow
            >
              {/* Overlay for data loading if map IS ready but data still loading for markers */}
              {pageStatus === "MAP_READY_LOADING_DATA" && (
                 <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-800/50 z-10 rounded-lg">
                    <p className="text-blue-600 dark:text-blue-400 p-4 bg-white/80 dark:bg-slate-700/80 rounded-md shadow-lg">Loading log data for markers...</p>
                </div>
              )}
            </div>
          )}

           {pageStatus === "NO_LOGS_TO_DISPLAY" && (
             <div className={`flex-grow flex items-center justify-center text-gray-500 dark:text-gray-400 rounded-lg bg-gray-100 dark:bg-slate-700 shadow-inner ${mapDivHeightClass}`}>
                No logs with location data found to display on the map.
             </div>
           )}
           
          <p className="text-xs text-center mt-2 text-gray-500 dark:text-gray-400 shrink-0">
            Markers are clustered. Zoom in to see individual logs.
          </p>
        </main>
      </div>
    </>
  );
}