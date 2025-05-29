// src/pages/map.js
import Head from 'next/head';
import { useRouter } from 'next/router'; // useRouter might not be needed here unless you use query params
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';
import ThemeToggle from '../components/ThemeToggle';

// Import Leaflet icon assets
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Helper functions
const formatDuration = (seconds) => {
  const numSeconds = Number(seconds);
  if (isNaN(numSeconds) || numSeconds === null || numSeconds < 0) return 'N/A';
  const minutes = Math.floor(numSeconds / 60);
  const remainingSeconds = numSeconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

const formatDate = (timestamp) => {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString();
};

export default function MapPage() {
  const router = useRouter();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null); // Using a layer group for markers is good practice

  const [logs, setLogs] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState(''); // For API or map errors
  
  // State to control map container rendering for HMR stability
  const [canRenderMapDiv, setCanRenderMapDiv] = useState(false);
  const [logDetails, setLogDetails] = useState(null);

  // Extract log details from query parameters
  useEffect(() => {
    if (!router.isReady) return;

    const { lat, lng, city, user, dur, earn, ts } = router.query;
    if (ts) {
      setLogDetails({
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        city: city || null,
        username: user || 'Anonymous',
        duration: dur ? parseInt(dur) : null,
        earnings: earn ? parseFloat(earn) : null,
        timestamp: parseInt(ts)
      });
    }
  }, [router.isReady, router.query]);

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
    if (!mapInstanceRef.current || !markersLayerRef.current || loadingData || error || !logDetails) {
      // Don't try to update markers if map isn't ready, data is loading, or there's an error
      return;
    }

    console.log("MapPage: Updating markers for specific log");
    let L_markers;
    (async () => {
      try {
        L_markers = await import('leaflet');
        markersLayerRef.current.clearLayers();

        if (logDetails.lat !== null && logDetails.lng !== null) {
          const color = '#2563EB'; // blue-600 for marker
          const circle = L_markers.circleMarker([logDetails.lat, logDetails.lng], {
            radius: 7,
            fillColor: color,
            color: '#FFF',
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.8,
          });
          circle.bindPopup(
            // Use CSS variables for text colors within the popup
            `<div style="color: var(--card-foreground); padding: 0.25rem; font-size: 0.875rem;">
              <strong style="color: var(--foreground);">${logDetails.username}</strong><br/>
              Duration: ${formatDuration(logDetails.duration)}<br/>
              Earned: $${Number(logDetails.earnings || 0).toFixed(2)}<br/>
              ${logDetails.city ? `City: ${logDetails.city}<br/>` : ''}
              <small style="color: var(--foreground); opacity: 0.7;">Logged: ${formatDate(logDetails.timestamp)}</small>
            </div>`
          );
          markersLayerRef.current.addLayer(circle);
          mapInstanceRef.current.setView([logDetails.lat, logDetails.lng], 13);
        } else if (logDetails.city) {
          console.log("MapPage: No precise coordinates available for this log");
        }
      } catch (err) {
        console.error('MapPage: Error updating markers:', err);
        setError(err.message || "Error displaying markers.");
      }
    })();
  }, [logDetails, loadingData, error]);

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
          <header className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-slate-700">
            <div>
              <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Break Location</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Entry from {logDetails?.timestamp ? formatDate(logDetails.timestamp) : 'N/A'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Link href="/" className={backButtonClasses}>Back to Dashboard</Link>
            </div>
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