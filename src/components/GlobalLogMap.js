import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';

const formatDuration = (seconds) => {
  if (isNaN(Number(seconds)) || seconds === null) return 'N/A';
  const numSeconds = Number(seconds);
  const minutes = Math.floor(numSeconds / 60);
  const remainingSeconds = numSeconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};


export default function GlobalLogMap() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerClusterGroupRef = useRef(null);
  const LRef = useRef(null);

  const [allLogs, setAllLogs] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [isMapFullyReady, setIsMapFullyReady] = useState(false);
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
    }, 250);
    return () => clearTimeout(timerId);
  }, []);

  // Initialize map (Leaflet and MarkerCluster)
  useEffect(() => {
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
    let mapWasInitialized = false;

    (async () => {
      try {
        if (typeof window === 'undefined' || !window.L) {
          console.log("GlobalMap: Skipping initialization - Leaflet not available");
          return;
        }

        const L = window.L;
        LRef.current = L;

        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });

        if (!mapContainerRef.current || mapContainerRef.current._leaflet_id || mapInstanceRef.current) {
          console.warn("GlobalMap: Conditions changed just before L.map(). Aborting.");
          return;
        }

        mapInstanceRef.current = L.map(container, {
          center: [20, 0],
          zoom: 2,
          minZoom: 2,
          worldCopyJump: true
        });
        mapWasInitialized = true;
        console.log("GlobalMap: L.map() successful.");

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap contributors',
          crossOrigin: true
        }).addTo(mapInstanceRef.current);

        // Force a resize after initialization
        setTimeout(() => {
          mapInstanceRef.current.invalidateSize();
        }, 100);

        await new Promise(resolve => setTimeout(resolve, 100));

        if (typeof L.markerClusterGroup !== 'function') {
          console.error('MarkerClusterGroup not available after plugin initialization');
          throw new Error('Failed to initialize marker cluster plugin');
        }

        markerClusterGroupRef.current = L.markerClusterGroup({
          maxClusterRadius: 50,
          spiderfyOnMaxZoom: true
        });
        mapInstanceRef.current.addLayer(markerClusterGroupRef.current);
        console.log("GlobalMap: MarkerClusterGroup initialized and added. Map is fully ready.");
        setIsMapFullyReady(true);
      } catch (e) {
        console.error("GlobalMap: Error initializing map/MarkerCluster:", e);
        setError(e.message || "Could not load map components.");
        if (mapWasInitialized && mapInstanceRef.current) { mapInstanceRef.current.remove(); }
        mapInstanceRef.current = null;
        setIsMapFullyReady(false);
      }
    })();

    return () => {
      console.log("GlobalMap: Cleaning up map instance (init effect)...");
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
      if (markerClusterGroupRef.current) { markerClusterGroupRef.current = null; }
      LRef.current = null;
      setIsMapFullyReady(false);
    };
  }, [canRenderMapContainerDOM]);

  // Add markers to cluster group
  useEffect(() => {
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
          marker.bindPopup(`
            <div class="text-sm">
              <p class="font-semibold mb-1">${new Date(log.timestamp).toLocaleString()}</p>
              ${log.duration ? `<p>Duration: ${formatDuration(log.duration)}</p>` : ''}
              ${log.notes ? `<p class="mt-1 italic">${log.notes}</p>` : ''}
            </div>
          `);
          markerClusterGroupRef.current.addLayer(marker);
          addedCount++;
        }
      });
      console.log(`GlobalMap: Added ${addedCount} markers.`);
    } else {
      console.log("GlobalMap: No logs with coordinates.");
    }
  }, [allLogs, loadingData, error, isMapFullyReady]);

  const mapDivHeightClass = "flex-grow min-h-[400px]";

  let statusMessage = "Preparing map area...";
  if (error) statusMessage = `Error: ${error}`;
  else if (loadingData && !isMapFullyReady) statusMessage = "Loading map and log data...";
  else if (loadingData && isMapFullyReady) statusMessage = "Loading log data for markers...";
  else if (!loadingData && !isMapFullyReady && canRenderMapContainerDOM && mapContainerRef.current) statusMessage = "Initializing map display...";
  else if (!loadingData && isMapFullyReady && allLogs.length === 0) statusMessage = "No logs with location data found.";

  return (
    <>
      {(!isMapFullyReady || loadingData || error || (allLogs.length === 0 && !loadingData)) && !error && (
        <div className={`flex-grow flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-700 shadow-inner ${mapDivHeightClass} ${error ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
          <p>{statusMessage}</p>
        </div>
      )}

      {canRenderMapContainerDOM && (
        <div
          ref={mapContainerRef}
          className={`
            relative rounded-lg shadow-inner overflow-hidden bg-gray-200 dark:bg-slate-700
            ${mapDivHeightClass}
            ${isMapFullyReady && !loadingData && !error ? 'block' : 'hidden'}
          `}
          style={{ height: '500px', width: '100%' }}
        >
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
    </>
  );
}

// Add script loader component
export function MapScripts() {
  return (
    <Head>
      <script
        src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"
        integrity="sha512-XQoYMqMTK8LvdxXYG3nZ448hOEQiglfqkJs1NOQV44cWnUrBc8PkAOcXy20w0vlaXaVUearIOBhiXZ5V3ynxwA=="
        crossOrigin=""
      />
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"
        integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A=="
        crossOrigin=""
      />
      <script
        src="https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js"
        crossOrigin=""
      />
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css"
        crossOrigin=""
      />
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css"
        crossOrigin=""
      />
    </Head>
  );
}