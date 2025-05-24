// src/pages/map.js
import { useEffect, useState, useRef, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';

import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

export default function MapPage() {
  const [logs, setLogs] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [canRenderMapContainer, setCanRenderMapContainer] = useState(false); // Controls rendering of the map div

  const mapContainerRef = useRef(null); // Ref for the map DOM element
  const mapInstanceRef = useRef(null); // Ref for the Leaflet map instance
  const markersLayerRef = useRef(null); // Ref for a LayerGroup to hold markers

  // Fetch logs
  useEffect(() => {
    setLoadingData(true);
    fetch('/api/log')
      .then(r => r.json())
      .then(data => {
        setLogs(data || []);
        setLoadingData(false);
      })
      .catch(err => {
        console.error('Failed to fetch logs:', err);
        setLogs([]);
        setLoadingData(false);
      });
  }, []);

  // Effect to enable rendering the map container (runs once)
  // This ensures the container div isn't even in the DOM until after the first mount/cleanup cycle of HMR
  useEffect(() => {
    // Allow rendering the map container after a very brief moment to ensure
    // any HMR-related DOM instability from a previous render has settled.
    const timer = setTimeout(() => {
        console.log("Setting canRenderMapContainer to true");
        setCanRenderMapContainer(true);
    }, 50); // 50ms delay, adjust if needed, or remove if not helping

    return () => clearTimeout(timer);
  }, []);


  // Initialize Leaflet map
  useEffect(() => {
    // Only proceed if the container div is allowed to render AND it has been rendered (ref is set)
    if (!canRenderMapContainer || !mapContainerRef.current) {
      if (!canRenderMapContainer) console.log("Map init deferred: canRenderMapContainer is false.");
      if (canRenderMapContainer && !mapContainerRef.current) console.log("Map init deferred: mapContainerRef.current is null (waiting for render).");
      return;
    }

    // If map instance already exists, do nothing.
    if (mapInstanceRef.current) {
      console.log("Map init skipped: mapInstanceRef.current already exists.");
      return;
    }
    
    let L; // To make it accessible in catch
    const container = mapContainerRef.current;

    // Aggressive check and clear before initializing
    if (container._leaflet_id) {
      console.warn('CRITICAL: _leaflet_id found on container BEFORE new L.map() call. This should ideally not happen if cleanup is working.');
      // If mapInstanceRef.current was somehow non-null and had a remove method:
      // if(mapInstanceRef.current && typeof mapInstanceRef.current.remove === 'function') mapInstanceRef.current.remove();
      // delete container._leaflet_id; // Try deleting it directly
      // container.innerHTML = ''; // Most aggressive clear
      // return; // After such a critical state, maybe better to not proceed and rely on next render cycle
    }

    console.log('Attempting to initialize Leaflet map on container:', container);

    (async () => {
      try {
        L = await import('leaflet');

        // Standard Leaflet icon setup
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: iconRetinaUrl.src,
          iconUrl: iconUrl.src,
          shadowUrl: shadowUrl.src,
        });

        mapInstanceRef.current = L.map(container).setView([20, 0], 2);
        console.log('L.map(container) called successfully.');

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap contributors',
        }).addTo(mapInstanceRef.current);

        markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
        console.log('Leaflet map fully initialized and ready.');

      } catch (err) {
        console.error('Error during Leaflet map initialization:', err);
        if (mapInstanceRef.current) { // If L.map succeeded but something else failed
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }
        // Potentially try to remove _leaflet_id if error implies it was set
        if (container && container._leaflet_id) {
            delete container._leaflet_id;
        }
      }
    })();

    // Cleanup function
    return () => {
      console.log('Unmounting map component / cleaning up map instance...');
      if (mapInstanceRef.current) {
        console.log('Calling mapInstance.remove()');
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        console.log('Map instance destroyed and ref nulled.');
      }
      // Explicitly clear the ref to the DOM node too, though React should handle it.
      // mapContainerRef.current = null; // Generally not needed as React manages refs to DOM nodes
      if (markersLayerRef.current) {
        markersLayerRef.current = null;
      }
      console.log("Map cleanup complete.");
    };
  }, [canRenderMapContainer]); // Re-run if canRenderMapContainer changes (which it should only once from false to true)


  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || loadingData) {
      if(loadingData) console.log("Marker update skipped: Data is loading.");
      else console.log("Marker update skipped: Map not ready.");
      return;
    }

    console.log("Updating markers. Logs count:", logs.length);
    (async () => {
      try {
        const L = await import('leaflet'); // L should be available from init, but defensive import
        markersLayerRef.current.clearLayers();

        if (logs.length > 0) {
          logs.forEach(log => {
            if (typeof log.lat === 'number' && typeof log.lng === 'number') {
              const color = log.locationMethod === 'auto' ? '#2563EB' : '#0EA5E9';
              const circle = L.circleMarker([log.lat, log.lng], {
                radius: 7,
                fillColor: color,
                color: '#FFF',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.8,
              });
              circle.bindPopup(`
                <div class="p-1 text-sm dark:text-gray-300">
                  <strong class="text-blue-600 dark:text-blue-400">${log.username||'Anonymous'}</strong><br/>
                  Duration: ${log.duration}s<br/>
                  Earned: $${Number(log.earnings).toFixed(2)}<br/>
                  ${log.city?`City: ${log.city}<br/>`:''}
                  <small class="text-gray-500 dark:text-gray-400">Logged: ${new Date(log.timestamp).toLocaleDateString()}</small>
                </div>
              `);
              markersLayerRef.current.addLayer(circle);
            }
          });
          console.log("Markers added.");
        } else {
            console.log("No logs to display, markers cleared.");
        }
      } catch (err) {
        console.error('Error updating markers:', err);
      }
    })();
  }, [logs, loadingData]); // Rerun only if logs or loadingData change. Map readiness is handled by the mapInstanceRef check.

  // CSS classes
  const backButtonClasses = "inline-flex items-center text-sm text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg px-4 py-2 text-center border border-blue-300 dark:bg-slate-700 dark:text-blue-300 dark:hover:bg-slate-600 dark:border-slate-500 dark:focus:ring-blue-800 transition-colors duration-150";
  const mapContainerBaseHeight = "h-[400px] sm:h-[500px] md:h-[calc(75vh-150px)] min-h-[300px]"; // Adjusted for potentially more padding/header

  return (
    <>
      <Head>
        <title>Poo Map | Paid-to-Poo</title>
        <meta name="description" content="View all logged breaks on a world map." />
        {/* The cache control headers are good for this specific problem */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate, max-age=0" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <meta httpEquiv="Expires" content="Tue, 01 Jan 1980 1:00:00 GMT" />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-sky-100 dark:from-slate-900 dark:via-slate-800 dark:to-sky-900 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 transition-colors duration-300">
        <main className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 overflow-hidden flex flex-col">
          <header className="flex justify-between items-center mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
              Global Poo Map
            </h1>
            <Link href="/" className={backButtonClasses}>
              Back to Home
            </Link>
          </header>

          {/* Conditional rendering for the map container area */}
          {!canRenderMapContainer && (
             <div className={`flex-grow flex items-center justify-center text-blue-500 dark:text-blue-400 rounded-lg bg-gray-100 dark:bg-slate-700 shadow-inner ${mapContainerBaseHeight}`}>
              Preparing map area...
            </div>
          )}
          
          {canRenderMapContainer && (
            <div
              ref={mapContainerRef} // Assign the ref to the div
              // Removed the key={containerKey} as conditional rendering is more direct
              className={`relative w-full rounded-lg shadow-inner overflow-hidden bg-gray-200 dark:bg-slate-700 ${mapContainerBaseHeight}`}
              aria-label="World map showing logged locations"
            >
              {/* Loading overlay specific to data, if map is already there */}
              {loadingData && mapInstanceRef.current && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-800/50 z-10 rounded-lg">
                      <p className="text-blue-500 dark:text-blue-400 p-4 bg-white/80 dark:bg-slate-700/80 rounded-md shadow-lg">Updating map data...</p>
                  </div>
              )}
              {/* Initial loading if map instance isn't ready yet (but container is rendered) */}
              {(!mapInstanceRef.current && !loadingData) && (
                 <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-slate-700 z-5 rounded-lg">
                    <p className="text-blue-500 dark:text-blue-400">Initializing map...</p>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-center mt-4 text-gray-500 dark:text-gray-400">
            Click markers for details. Auto-located: <span className="font-semibold text-blue-600 dark:text-blue-400">blue</span>, Manual: <span className="font-semibold text-sky-500 dark:text-sky-400">sky blue</span>.
          </p>
        </main>
      </div>
    </>
  );
}