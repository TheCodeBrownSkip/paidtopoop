﻿// src/pages/map.js
import Head from 'next/head';
import { useRouter } from 'next/router'; // useRouter might not be needed here unless you use query params
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';

// Import Leaflet icon assets
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Helper (if not already global or imported, define it if needed)
const formatDuration = (seconds) => {
  const numSeconds = Number(seconds);
  if (isNaN(numSeconds) || numSeconds === null || numSeconds < 0) return 'N/A';
  const minutes = Math.floor(numSeconds / 60);
  const remainingSeconds = numSeconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};


export default function MapPage() {
  // const router = useRouter(); // Only if you need query params for this page
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null); // Using a layer group for markers is good practice

  const [logs, setLogs] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState(''); // For API or map errors
  
  // State to control map container rendering for HMR stability
  const [canRenderMapDiv, setCanRenderMapDiv] = useState(false);

  // Fetch logs
  useEffect(() => {
    setLoadingData(true);
    setError('');
    fetch('/api/log')
      .then(r => {
        if (!r.ok) throw new Error(`Failed to fetch logs: ${r.status}`);
        return r.json();
      })
      .then(data => {
        setLogs(data || []);
      })
      .catch(err => {
        console.error('Failed to fetch logs for MapPage:', err);
        setError(err.message || "Could not load log data.");
        setLogs([]);
      })
      .finally(() => setLoadingData(false));
  }, []);

  // Effect to allow rendering the map div after initial mount/HMR cycle
  useEffect(() => {
    const timerId = setTimeout(() => {
      console.log("MapPage: Setting canRenderMapDiv to true");
      setCanRenderMapDiv(true);
    }, 100); // Small delay

    return () => clearTimeout(timerId);
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (!canRenderMapDiv || !mapContainerRef.current || mapInstanceRef.current) {
      if (mapInstanceRef.current) console.log("MapPage: Map instance already exists.");
      else if (!mapContainerRef.current && canRenderMapDiv) console.log("MapPage: mapContainerRef not set yet.");
      else if (!canRenderMapDiv) console.log("MapPage: Map container not ready to render.");
      return;
    }
    
    const container = mapContainerRef.current;
    if (container._leaflet_id) {
      console.warn("MapPage: _leaflet_id found on container before init. Aborting init this cycle.");
      return; 
    }

    let L_map; // Local L instance for this effect scope
    console.log('MapPage: Attempting to initialize Leaflet map on container:', container);
    (async () => {
      try {
        L_map = await import('leaflet');
        
        // Ensure icon paths are set correctly
        delete L_map.Icon.Default.prototype._getIconUrl;
        L_map.Icon.Default.mergeOptions({
          iconRetinaUrl: iconRetinaUrl.src,
          iconUrl: iconUrl.src,
          shadowUrl: shadowUrl.src,
        });

        mapInstanceRef.current = L_map.map(container).setView([20, 0], 2); // Default world view
        console.log('MapPage: L.map(container) called successfully.');

        L_map.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap contributors',
        }).addTo(mapInstanceRef.current);

        markersLayerRef.current = L_map.layerGroup().addTo(mapInstanceRef.current);
        console.log('MapPage: Leaflet map and markers layer fully initialized.');

      } catch (err) {
        console.error('MapPage: Error during Leaflet map initialization:', err);
        setError(err.message || "Could not initialize map display.");
        if (mapInstanceRef.current) { // Cleanup if partially initialized
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }
      }
    })();

    return () => {
      console.log('MapPage: Cleaning up map instance...');
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (markersLayerRef.current) {
        markersLayerRef.current = null; // Layer is removed with map, just nullify ref
      }
    };
  }, [canRenderMapDiv]); // Re-run if canRenderMapDiv changes

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || loadingData || error) {
      // Don't try to update markers if map isn't ready, data is loading, or there's an error
      return;
    }

    console.log("MapPage: Updating markers. Logs count:", logs.length);
    let L_markers;
    (async () => {
      try {
        L_markers = await import('leaflet'); // Leaflet should be cached by browser
        markersLayerRef.current.clearLayers();

        if (logs.length > 0) {
          logs.forEach(log => {
            if (log.lat !== null && log.lng !== null && typeof log.lat === 'number' && typeof log.lng === 'number') {
              const color = log.locationMethod === 'auto' ? '#2563EB' : '#0EA5E9'; // blue-600 : sky-500
              const circle = L_markers.circleMarker([log.lat, log.lng], {
                radius: 7,
                fillColor: color,
                color: '#FFF',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.8,
              });
              circle.bindPopup(
                `<div class="p-1 text-sm dark:text-gray-300">
                  <strong class="text-blue-600 dark:text-blue-400">${log.username||'Anonymous'}</strong><br/>
                  Duration: ${formatDuration(log.duration)}<br/>
                  Earned: $${Number(log.earnings || 0).toFixed(2)}<br/>
                  ${log.city?`City: ${log.city}<br/>`:''}
                  <small class="text-gray-500 dark:text-gray-400">Logged: ${new Date(log.timestamp).toLocaleDateString()}</small>
                </div>`
              );
              markersLayerRef.current.addLayer(circle);
            }
          });
          console.log(`MapPage: Added/updated ${markersLayerRef.current.getLayers().length} markers.`);
        } else {
            console.log("MapPage: No logs with coordinates to display.");
        }
      } catch (err) {
        console.error('MapPage: Error updating markers:', err);
        setError(err.message || "Error displaying markers.");
      }
    })();
  }, [logs, loadingData, error]); // Re-run if logs, loadingData, or error state change.

  // Effect to zoom to the latest log (optional, can be kept or removed for a general map)
  useEffect(() => {
    if (mapInstanceRef.current && !loadingData && logs && logs.length > 0 && !error) {
      const sortedLogsWithCoords = [...logs]
        .filter(log => typeof log.lat === 'number' && typeof log.lng === 'number')
        .sort((a, b) => b.timestamp - a.timestamp);

      if (sortedLogsWithCoords.length > 0) {
        const latestLog = sortedLogsWithCoords[0];
        const zoomLevel = 13; 
        console.log(`MapPage: Flying to latest log: ${latestLog.username || 'N/A'} at [${latestLog.lat}, ${latestLog.lng}]`);
        mapInstanceRef.current.flyTo([latestLog.lat, latestLog.lng], zoomLevel);
      } else {
        // If logs exist but none have coords, or if no logs, map stays at default view or last position
        console.log("MapPage: No specific log with coords to fly to, maintaining current view.");
         // mapInstanceRef.current.setView([20,0], 2); // Optionally reset to world view
      }
    }
  }, [logs, loadingData, error]);


  const backButtonClasses = "inline-flex items-center text-sm text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg px-4 py-2 text-center border border-blue-300 dark:bg-slate-700 dark:text-blue-300 dark:hover:bg-slate-600 dark:border-slate-500 dark:focus:ring-blue-800 transition-colors duration-150";
  const mapContainerDynamicHeightClass = "flex-grow min-h-[250px] sm:min-h-[350px]";

  return (
    <>
      <Head>
        <title>All Logs Map | Paid-to-Poo</title> {/* Updated title */}
        <meta name="description" content="View all logged breaks on a world map." />
        {/* Cache control headers from previous versions were good, keep them */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate, max-age=0" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-sky-100 dark:from-slate-900 dark:via-slate-800 dark:to-sky-900 flex items-center justify-center p-2 sm:p-4 md:p-6 transition-colors duration-300">
        <main className="bg-white dark:bg-slate-800 w-full max-w-5xl rounded-2xl shadow-2xl p-3 sm:p-4 md:p-6 flex flex-col h-[95vh] sm:h-[90vh] lg:h-[85vh] overflow-hidden">
          <header className="flex justify-between items-center mb-3 sm:mb-4">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">
              All Breaks Map {/* Updated title */}
            </h1>
            <Link href="/" className={backButtonClasses}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 sm:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Dashboard
            </Link>
          </header>

          {/* Display error message if any */}
          {error && (
            <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-200 dark:text-red-800" role="alert">
              <span className="font-medium">Error:</span> {error}
            </div>
          )}

          {/* Conditional rendering for map area based on canRenderMapDiv */}
          {!canRenderMapDiv && !error && ( // Show "Preparing" only if no error and not ready to render
             <div className={`flex-grow flex items-center justify-center text-blue-500 dark:text-blue-400 rounded-lg bg-gray-100 dark:bg-slate-700 shadow-inner ${mapContainerDynamicHeightClass}`}>
              Preparing map area...
            </div>
          )}
          
          {canRenderMapDiv && !error && ( // Render map container only when ready and no error
            <div
              ref={mapContainerRef}
              className={`relative w-full rounded-lg shadow-inner overflow-hidden bg-gray-200 dark:bg-slate-700 ${mapContainerDynamicHeightClass}`}
              aria-label="World map showing logged locations"
            >
              {loadingData && mapInstanceRef.current && ( // Overlay if map exists but data is loading
                  <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-800/50 z-10 rounded-lg">
                      <p className="text-blue-500 dark:text-blue-400 p-3 sm:p-4 bg-white/80 dark:bg-slate-700/80 rounded-md shadow-lg">Loading log data...</p>
                  </div>
              )}
              {(!mapInstanceRef.current && !loadingData) && ( // Placeholder if map not yet init but data isn't loading (or finished)
                 <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-slate-700 z-5 rounded-lg">
                    <p className="text-blue-500 dark:text-blue-400">Initializing map...</p>
                </div>
              )}
            </div>
          )}
          
          {!loadingData && !error && logs.length === 0 && canRenderMapDiv && (
             <div className={`flex-grow flex items-center justify-center text-gray-500 dark:text-gray-400 rounded-lg bg-gray-100 dark:bg-slate-700 shadow-inner ${mapContainerDynamicHeightClass}`}>
                No logs with location data found to display on the map.
            </div>
          )}


          <p className="text-xs text-center mt-3 sm:mt-4 text-gray-500 dark:text-gray-400 shrink-0">
            Click markers for details. Auto-located: <span className="font-semibold text-blue-600 dark:text-blue-400">blue</span>, Manual: <span className="font-semibold text-sky-500 dark:text-sky-400">sky blue</span>.
          </p>
        </main>
      </div>
    </>
  );
}