import Head from 'next/head';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import ThemeToggle from '../components/ThemeToggle';

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
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerClusterGroupRef = useRef(null);
  const leafletRef = useRef(null); // Store Leaflet instance

  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canRenderMapDiv, setCanRenderMapDiv] = useState(false);

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
    const timerId = setTimeout(() => {
      console.log("Setting canRenderMapDiv to true");
      setCanRenderMapDiv(true);
    }, 100);

    return () => clearTimeout(timerId);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!canRenderMapDiv || !mapContainerRef.current || mapInstanceRef.current) {
      if (mapInstanceRef.current) console.log("Map init skipped: Instance already exists.");
      else if (!mapContainerRef.current) console.log("Map init skipped: Container ref not yet set.");
      else if (!canRenderMapDiv) console.log("Map init skipped: CanRenderMapDiv is false.");
      return;
    }

    const container = mapContainerRef.current;

    if (container._leaflet_id) {
      console.warn("CRITICAL: _leaflet_id found on container before L.map(). Aborting init this cycle.");
      return;
    }

    console.log("Attempting to initialize Leaflet map...");
    let L;
    (async () => {
      try {
        // Import and initialize Leaflet first
        const leaflet = await import('leaflet');
        L = leaflet.default;
        leafletRef.current = L; // Store Leaflet instance for other effects

        // Set up default icon options
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: iconRetinaUrl.src,
          iconUrl: iconUrl.src,
          shadowUrl: shadowUrl.src,
        });

        // Initialize the map
        mapInstanceRef.current = L.map(container).setView([20, 0], 2);
        console.log("L.map() successful.");

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap contributors',
        }).addTo(mapInstanceRef.current);

        // Import and initialize MarkerCluster
        const markerCluster = await import('leaflet.markercluster');
        
        // Ensure MarkerCluster is properly initialized
        if (!L.MarkerClusterGroup) {
          markerCluster.default(L);
        }

        // Double check initialization
        if (typeof L.markerClusterGroup !== 'function') {
          throw new Error('MarkerCluster plugin not properly initialized');
        }

        // Create and add the marker cluster group
        markerClusterGroupRef.current = L.markerClusterGroup({
          chunkedLoading: true,
          maxClusterRadius: 50,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: true,
          zoomToBoundsOnClick: true
        });
        mapInstanceRef.current.addLayer(markerClusterGroupRef.current);
        console.log("MarkerClusterGroup initialized and added to map.");
      } catch (e) {
        console.error("Error initializing map or MarkerCluster:", e);
        setError(e.message || "Could not load the map display components.");
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      }
    })();

    return () => {
      console.log("Cleaning up map instance (useEffect for map init)...");
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        console.log("Map instance removed.");
      }
      if (markerClusterGroupRef.current) {
        markerClusterGroupRef.current = null;
      }
      leafletRef.current = null;
    };
  }, [canRenderMapDiv]);

  // Add markers to cluster group
  useEffect(() => {
    if (!mapInstanceRef.current || !markerClusterGroupRef.current || loading || error) {
      if (error) console.log("Skipping markers due to error state:", error);
      else if (loading) console.log("Skipping markers: Still loading data.");
      else console.log("Skipping markers: Map or cluster group not ready.");
      return;
    }

    console.log("Attempting to add markers. Log count:", allLogs.length);
    if (!leafletRef.current) {
      console.log("Skipping markers: Leaflet not initialized");
      return;
    }

    try {
      markerClusterGroupRef.current.clearLayers();
      console.log("Cleared previous markers from cluster group.");

      let addedCount = 0;
      if (allLogs.length > 0) {
        allLogs.forEach(log => {
          if (log.lat !== null && log.lng !== null && typeof log.lat === 'number' && typeof log.lng === 'number') {
            const marker = leafletRef.current.marker([log.lat, log.lng]);
            marker.bindPopup(`
              <div style="color: var(--card-foreground);">
                <strong style="color: var(--foreground);">${log.username || 'Anonymous'}</strong><br/>
                Duration: ${formatDuration(log.duration)}<br/>
                Earned: $${Number(log.earnings).toFixed(2)}<br/>
                ${log.city ? `City: ${log.city}<br/>` : ''}
                <small style="color: var(--foreground); opacity: 0.7;">Logged: ${new Date(log.timestamp).toLocaleString()}</small>
              </div>
            `);
            markerClusterGroupRef.current.addLayer(marker);
            addedCount++;
          }
        });
        console.log(`Added ${addedCount} markers to cluster.`);
      } else {
        console.log("No logs with coordinates to add to map.");
      }
    } catch (e) {
      console.error("Error adding markers to cluster:", e);
      setError("Error displaying log markers.");
    }
  }, [allLogs, loading, error]);

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
            <div>
              <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Global Poop Map</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                View all logged locations
              </p>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Link href="/" className={backButtonClasses}>Back to Dashboard</Link>
            </div>
          </header>

          {error ? (
            <div className="flex-grow flex items-center justify-center text-red-500 p-4 bg-red-100 dark:bg-red-900 dark:text-red-300 rounded-md">
              <p>Error: {error}</p>
            </div>
          ) : loading && !canRenderMapDiv ? (
            <div className="flex-grow flex items-center justify-center text-blue-600 dark:text-blue-400">
              <p>Loading map and log data...</p>
            </div>
          ) : !canRenderMapDiv ? (
            <div className="flex-grow flex items-center justify-center text-blue-600 dark:text-blue-400">
              <p>Preparing map area...</p>
            </div>
          ) : (
            <div
              ref={mapContainerRef}
              className="flex-grow rounded-lg shadow-inner overflow-hidden bg-gray-200 dark:bg-slate-700"
              style={{ minHeight: '400px' }}
            >
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