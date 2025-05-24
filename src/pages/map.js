// src/pages/map.js
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';

import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

export default function MapPage() {
  const [logs, setLogs] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [canRenderMapContainer, setCanRenderMapContainer] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

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

  // Effect to enable rendering the map container
  useEffect(() => {
    const timer = setTimeout(() => {
      setCanRenderMapContainer(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (!canRenderMapContainer || !mapContainerRef.current || mapInstanceRef.current) {
      return;
    }
    
    let L;
    const container = mapContainerRef.current;

    console.log('Attempting to initialize Leaflet map on container:', container);
    (async () => {
      try {
        L = await import('leaflet');
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: iconRetinaUrl.src,
          iconUrl: iconUrl.src,
          shadowUrl: shadowUrl.src,
        });

        mapInstanceRef.current = L.map(container).setView([20, 0], 2); // Default view
        console.log('L.map(container) called successfully.');

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap contributors',
        }).addTo(mapInstanceRef.current);

        markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
        console.log('Leaflet map fully initialized and ready.');

      } catch (err) {
        console.error('Error during Leaflet map initialization:', err);
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }
        if (container && container._leaflet_id) {
            delete container._leaflet_id;
        }
      }
    })();

    return () => {
      console.log('Unmounting map component / cleaning up map instance...');
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (markersLayerRef.current) {
        markersLayerRef.current = null;
      }
      console.log("Map cleanup complete.");
    };
  }, [canRenderMapContainer]);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || loadingData) {
      return;
    }

    console.log("Updating markers. Logs count:", logs.length);
    (async () => {
      try {
        const L = await import('leaflet');
        markersLayerRef.current.clearLayers();

        if (logs.length > 0) {
          logs.forEach(log => {
            if (typeof log.lat === 'number' && typeof log.lng === 'number') {
              const color = log.locationMethod === 'auto' ? '#2563EB' : '#0EA5E9'; // blue-600 : sky-500
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
          console.log("Markers added/updated.");
        } else {
            console.log("No logs to display, markers cleared.");
        }
      } catch (err) {
        console.error('Error updating markers:', err);
      }
    })();
  }, [logs, loadingData]); // Re-run if logs or loadingData change.

  // Effect to zoom to the latest log
  useEffect(() => {
    if (mapInstanceRef.current && !loadingData && logs) {
      const sortedLogsWithCoords = [...logs]
        .filter(log => typeof log.lat === 'number' && typeof log.lng === 'number')
        .sort((a, b) => b.timestamp - a.timestamp); // Sort descending by timestamp

      if (sortedLogsWithCoords.length > 0) {
        const latestLog = sortedLogsWithCoords[0];
        const zoomLevel = 13; // Adjust as needed
        console.log(`Flying to latest log: ${latestLog.username || 'N/A'} at [${latestLog.lat}, ${latestLog.lng}]`);
        mapInstanceRef.current.flyTo([latestLog.lat, latestLog.lng], zoomLevel);
      } else if (logs.length > 0) {
        // Logs exist, but none have coordinates, fly to default overview
        console.log("Logs exist, but no coordinates found for the latest. Flying to default world view.");
        mapInstanceRef.current.flyTo([20,0], 2);
      }
      // If logs array is empty, the map remains at its initial view or last flown-to position.
      // The initial setView([20,0],2) handles the very first load with no logs.
    }
  }, [logs, loadingData]); // Rerun if logs or loadingData change


  // --- Tailwind Classes ---
  const backButtonClasses = "inline-flex items-center text-sm text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg px-4 py-2 text-center border border-blue-300 dark:bg-slate-700 dark:text-blue-300 dark:hover:bg-slate-600 dark:border-slate-500 dark:focus:ring-blue-800 transition-colors duration-150";
  
  // Map container will use flex-grow, so its height is determined by the parent <main> card.
  const mapContainerDynamicHeightClass = "flex-grow min-h-[250px] sm:min-h-[350px]"; // Min height to prevent collapse

  return (
    <>
      <Head>
        <title>Poo Map | Paid-to-Poo</title>
        <meta name="description" content="View all logged breaks on a world map." />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate, max-age=0" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <meta httpEquiv="Expires" content="Tue, 01 Jan 1980 1:00:00 GMT" />
      </Head>
      {/* Page Wrapper: Centers the main card */}
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-sky-100 dark:from-slate-900 dark:via-slate-800 dark:to-sky-900 flex items-center justify-center p-2 sm:p-4 md:p-6 transition-colors duration-300">
        {/* Main Card: Takes up large portion of viewport height */}
        <main className="bg-white dark:bg-slate-800 w-full max-w-5xl rounded-2xl shadow-2xl p-3 sm:p-4 md:p-6 flex flex-col h-[95vh] sm:h-[90vh] lg:h-[85vh] overflow-hidden">
          <header className="flex justify-between items-center mb-3 sm:mb-4">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">
              Global Poo Map
            </h1>
            <Link href="/" className={backButtonClasses}>
              {/* Added an SVG icon for the back button */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 sm:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Home
            </Link>
          </header>

          {/* Conditional rendering for map area */}
          {!canRenderMapContainer && (
             <div className={`flex-grow flex items-center justify-center text-blue-500 dark:text-blue-400 rounded-lg bg-gray-100 dark:bg-slate-700 shadow-inner ${mapContainerDynamicHeightClass}`}>
              Preparing map area...
            </div>
          )}
          
          {canRenderMapContainer && (
            // Map Div: Uses flex-grow to fill available space in the main card
            <div
              ref={mapContainerRef}
              className={`relative w-full rounded-lg shadow-inner overflow-hidden bg-gray-200 dark:bg-slate-700 ${mapContainerDynamicHeightClass}`}
              aria-label="World map showing logged locations"
            >
              {/* Loading overlay for data, if map is already rendered */}
              {loadingData && mapInstanceRef.current && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-800/50 z-10 rounded-lg">
                      <p className="text-blue-500 dark:text-blue-400 p-3 sm:p-4 bg-white/80 dark:bg-slate-700/80 rounded-md shadow-lg">Updating map data...</p>
                  </div>
              )}
              {/* Initial loading if map instance isn't ready yet (but container is rendered) */}
              {(!mapInstanceRef.current && !loadingData) && ( // Check !loadingData here too
                 <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-slate-700 z-5 rounded-lg">
                    <p className="text-blue-500 dark:text-blue-400">Initializing map...</p>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-center mt-3 sm:mt-4 text-gray-500 dark:text-gray-400 shrink-0"> {/* shrink-0 prevents footer from growing */}
            Click markers for details. Auto-located: <span className="font-semibold text-blue-600 dark:text-blue-400">blue</span>, Manual: <span className="font-semibold text-sky-500 dark:text-sky-400">sky blue</span>.
          </p>
        </main>
      </div>
    </>
  );
}