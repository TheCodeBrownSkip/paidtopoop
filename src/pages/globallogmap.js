// src/pages/globallogmap.js
import Head from 'next/head';
import { useEffect, useState, useRef } from 'react';
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
  const LRef = useRef(null); // To store the 'L' object once imported

  const [allLogs, setAllLogs] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  
  // New state to explicitly track full map readiness (Leaflet + MarkerCluster)
  const [isMapFullyReady, setIsMapFullyReady] = useState(false); 
  // State to control if the map container div is allowed to be in the DOM
  const [canRenderMapContainerDOM, setCanRenderMapContainerDOM] = useState(false);


  // Fetch logs
  useEffect(() => {
    setLoadingData(true); setError('');
    fetch('/api/log') 
      .then(r => { if (!r.ok) throw new Error(`Fetch logs failed: ${r.status}`); return r.json(); })
      .then(data => setAllLogs(data || []))
      .catch(err => { console.error("Error fetching logs:", err); setError(err.message); setAllLogs([]); })
      .finally(() => setLoadingData(false));
  }, []);

  // Allow DOM rendering of map container after a delay (HMR safety)
  useEffect(() => {
    const timerId = setTimeout(() => {
      console.log("GlobalMap: Setting canRenderMapContainerDOM to true");
      setCanRenderMapContainerDOM(true);
    }, 250); // Increased delay for better initialization
    return () => clearTimeout(timerId);
  }, []);

  // Initialize map (Leaflet and MarkerCluster)
  useEffect(() => {
    // Only run if the container div is allowed in DOM AND actually rendered AND no map instance yet
    if (!canRenderMapContainerDOM || !mapContainerRef.current || mapInstanceRef.current) {
      if (mapInstanceRef.current) console.log("GlobalMap: Map init skipped - instance exists.");
      else if (!mapContainerRef.current && canRenderMapContainerDOM) console.log("GlobalMap: Map init deferred - container ref not set.");
      else if (!canRenderMapContainerDOM) console.log("GlobalMap: Map init deferred - DOM rendering not allowed yet.");
      return;
    }
    
    const container = mapContainerRef.current;
    if (container._leaflet_id) {
      console.warn("GlobalMap: _leaflet_id found on container. Aborting redundant init.");
      return; 
    }

    console.log("GlobalMap: Attempting map initialization...");
    let mapWasInitialized = false; // To track if L.map() was called for cleanup

    (async () => {
      try {
        const L = await import('leaflet');
        LRef.current = L; // Store L for other effects
        await import('leaflet.markercluster/dist/leaflet.markercluster.js'); 

        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: iconRetinaUrl.src, iconUrl: iconUrl.src, shadowUrl: shadowUrl.src,
        });

        // Final check before creating the map instance
        if (!mapContainerRef.current || mapContainerRef.current._leaflet_id || mapInstanceRef.current) {
            console.warn("GlobalMap: Conditions changed just before L.map(). Aborting.");
            return;
        }

        mapInstanceRef.current = L.map(container).setView([20, 0], 2);
        mapWasInitialized = true;
        console.log("GlobalMap: L.map() successful.");

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18, attribution: '© OSM',
        }).addTo(mapInstanceRef.current);

        // Initialize marker cluster group after ensuring the library is loaded
        try {
            if (!L.markerClusterGroup) {
                throw new Error("MarkerClusterGroup not available");
            }
            markerClusterGroupRef.current = L.markerClusterGroup();
            mapInstanceRef.current.addLayer(markerClusterGroupRef.current);
            console.log("GlobalMap: MarkerClusterGroup initialized and added. Map is fully ready.");
            setIsMapFullyReady(true); // Signal full readiness
        } catch (clusterError) {
            console.error("GlobalMap: Failed to initialize marker cluster:", clusterError);
            throw clusterError; // Re-throw to be caught by outer try-catch
        }
      } catch (e) {
        console.error("GlobalMap: Error initializing map/MarkerCluster:", e);
        setError(e.message || "Could not load map components.");
        if (mapWasInitialized && mapInstanceRef.current) { mapInstanceRef.current.remove(); } // Only remove if L.map was called
        mapInstanceRef.current = null;
        setIsMapFullyReady(false); // Explicitly set to false on error
      }
    })();

    return () => {
      console.log("GlobalMap: Cleaning up map instance (init effect)...");
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
      if (markerClusterGroupRef.current) { markerClusterGroupRef.current = null; }
      LRef.current = null;
      setIsMapFullyReady(false);
    };
  }, [canRenderMapContainerDOM]); // This effect depends on the DOM container being allowed

  // Add markers to cluster group
  useEffect(() => {
    // Only run if map is fully ready, L is available, data not loading, and no error
    if (!isMapFullyReady || !mapInstanceRef.current || !markerClusterGroupRef.current || !LRef.current || loadingData || error) {
      return;
    }
    
    const L = LRef.current; 
    console.log("GlobalMap: Updating markers. Log count:", allLogs.length);
    
    markerClusterGroupRef.current.clearLayers(); 
    let addedCount = 0;
    if (allLogs.length > 0) {
        allLogs.forEach(log => {
            if (log.lat !== null && log.lng !== null && typeof log.lat === 'number' && typeof log.lng === 'number') {
                const marker = L.marker([log.lat, log.lng]); 
                marker.bindPopup( /* ... popup content ... */ );
                markerClusterGroupRef.current.addLayer(marker);
                addedCount++;
            }
        });
        console.log(`GlobalMap: Added ${addedCount} markers.`);
    } else {
        console.log("GlobalMap: No logs with coordinates.");
    }
  }, [allLogs, loadingData, error, isMapFullyReady]); // Depends on map readiness

  const backButtonClasses = "text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800 transition-colors duration-150 !w-auto";
  const mapDivHeightClass = "flex-grow min-h-[400px]";

  let statusMessage = "Preparing map area...";
  if (error) statusMessage = `Error: ${error}`;
  else if (loadingData && !isMapFullyReady) statusMessage = "Loading map and log data...";
  else if (loadingData && isMapFullyReady) statusMessage = "Loading log data for markers...";
  else if (!loadingData && !isMapFullyReady && canRenderMapContainerDOM && mapContainerRef.current) statusMessage = "Initializing map display...";
  else if (!loadingData && isMapFullyReady && allLogs.length === 0) statusMessage = "No logs with location data found.";


  return (
    <>
      <Head><title>Global Log Map | Paid-to-Poo</title><meta name="description" content="View all logged breaks on a world map." /></Head>
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-sky-100 dark:from-slate-900 dark:via-slate-800 dark:to-sky-900 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        <main className="bg-white dark:bg-slate-800 w-full max-w-6xl rounded-2xl shadow-2xl p-6 flex flex-col gap-4 h-[90vh]">
          <header className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-slate-700">
            <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Global Breaks Map</h1>
            <Link href="/" className={backButtonClasses}>Back to Dashboard</Link>
          </header>

          {/* Conditional rendering for the map area or status messages */}
          {(!isMapFullyReady || loadingData || error || (allLogs.length === 0 && !loadingData)) && !error && (
            <div className={`flex-grow flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-700 shadow-inner ${mapDivHeightClass} ${error ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
              <p>{statusMessage}</p>
            </div>
          )}
          
          {/* Map container: Rendered if canRenderMapContainerDOM is true, visibility handled by parent logic */}
          {/* This div is primarily for Leaflet to attach to. Its content (overlays) is less critical if it's hidden. */}
          {canRenderMapContainerDOM && (
             <div 
              ref={mapContainerRef} 
              className={`
                relative rounded-lg shadow-inner overflow-hidden bg-gray-200 dark:bg-slate-700 
                ${mapDivHeightClass} 
                ${isMapFullyReady && !loadingData && !error ? 'block' : 'hidden'}
              `} // Only 'block' if truly ready to show map with markers
            >
              {/* Overlay for data loading if map IS ready but data still loading for markers (this scenario is less likely with current statusMessage) */}
              {isMapFullyReady && loadingData && !error && (
                 <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-800/50 z-10 rounded-lg">
                    <p className="text-blue-600 dark:text-blue-400 p-4 bg-white/80 dark:bg-slate-700/80 rounded-md shadow-lg">{statusMessage}</p>
                </div>
              )}
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