// src/pages/map.js
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';

// Import Leaflet icon assets for Webpack to handle
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

export default function MapPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  // Fetch logs
  useEffect(() => {
    setLoading(true);
    fetch('/api/log')
      .then(r => r.json())
      .then(data => {
        setLogs(data || []);
        setLoading(false);
      })
      .catch(error => {
        console.error("Failed to fetch logs:", error);
        setLogs([]);
        setLoading(false);
      });
  }, []);

  // Initialize map
  useEffect(() => {
    let L; // Declare L outside to be accessible in cleanup

    const initMap = async () => {
      if (mapContainerRef.current && !mapContainerRef.current._leaflet_id && !mapInstanceRef.current) {
        try {
          L = await import('leaflet');

          // Fix for default Leaflet icon paths
          delete L.Icon.Default.prototype._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: iconRetinaUrl.src,
            iconUrl: iconUrl.src,
            shadowUrl: shadowUrl.src,
          });

          // Log before initializing
          console.log("Initializing Leaflet map on container:", mapContainerRef.current);
          
          mapInstanceRef.current = L.map(mapContainerRef.current).setView([20, 0], 2);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }).addTo(mapInstanceRef.current);

          markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
          console.log("Map initialized successfully.");

        } catch (error) {
          console.error("Failed to load Leaflet or initialize map:", error);
        }
      } else if (mapContainerRef.current && mapContainerRef.current._leaflet_id) {
        console.warn("Map container already has _leaflet_id. Skipping initialization.", mapContainerRef.current);
      } else if (mapInstanceRef.current) {
        console.warn("Map instance ref already set. Skipping initialization.");
      }
    };

    initMap();

    return () => {
      console.log("Cleaning up map...");
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        console.log("Map instance removed.");
      }
      if (markersLayerRef.current) {
        markersLayerRef.current = null; // Just nullify, layers are removed with map
      }
      // It's tricky to reliably remove _leaflet_id as Leaflet manages it internally.
      // The .remove() method should handle the necessary cleanup.
      // if (mapContainerRef.current && mapContainerRef.current._leaflet_id) {
      //   delete mapContainerRef.current._leaflet_id;
      //   console.log("_leaflet_id removed from container (attempted).");
      // }
    };
  }, []); // Empty dependency array should mean it runs once on mount, cleans on unmount.

  // Add/Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) {
      return;
    }
    
    if (!loading || logs.length > 0) {
      (async () => {
        try {
          const L = await import('leaflet');
          markersLayerRef.current.clearLayers();

          logs.forEach(log => {
            if (typeof log.lat === 'number' && typeof log.lng === 'number') {
              const markerColor = log.locationMethod === 'auto' ? '#2563EB' : '#0EA5E9';
              const marker = L.circleMarker([log.lat, log.lng], {
                radius: 7,
                fillColor: markerColor,
                color: '#FFFFFF',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.8,
              });
              const popupContent = `
                <div class="p-1 text-sm text-gray-700 dark:text-gray-300">
                  <strong class="block text-base text-blue-600 dark:text-blue-400">${log.username || 'Anonymous'}</strong>
                  Duration: ${log.duration}s<br/>
                  Earned: $${Number(log.earnings).toFixed(2)}<br/>
                  ${log.city ? `City: ${log.city}` : ''}
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Logged: ${new Date(log.timestamp).toLocaleDateString()}</p>
                </div>
              `;
              marker.bindPopup(popupContent);
              markersLayerRef.current.addLayer(marker);
            }
          });
        } catch (error) {
          console.error("Error updating markers:", error);
        }
      })();
    } else if (markersLayerRef.current && logs.length === 0 && !loading) {
        markersLayerRef.current.clearLayers();
    }
  }, [logs, loading]);

  const backButtonClasses = "inline-flex items-center text-sm text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg px-4 py-2 text-center border border-blue-300 dark:bg-slate-700 dark:text-blue-300 dark:hover:bg-slate-600 dark:border-slate-500 dark:focus:ring-blue-800 transition-colors duration-150";

  return (
    <>
      <Head>
        <title>Poo Map | Paid-to-Poo</title>
        <meta name="description" content="View all logged breaks on a world map." />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-sky-100 dark:from-slate-900 dark:via-slate-800 dark:to-sky-900 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 transition-colors duration-300">
        <main className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
              Global Poo Map
            </h1>
            <Link href="/" className={backButtonClasses}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Home
            </Link>
          </div>
          
          {loading && !mapInstanceRef.current && (
             <div className="flex-grow flex items-center justify-center h-[400px] sm:h-[500px] md:h-[calc(75vh-120px)] min-h-[300px] text-blue-500 dark:text-blue-400 rounded-lg bg-gray-100 dark:bg-slate-700 shadow-inner">
              Initializing Map & Loading Data...
            </div>
          )}
          
          <div
            ref={mapContainerRef}
            className={`relative w-full rounded-lg shadow-inner overflow-hidden bg-gray-200 dark:bg-slate-700
                       ${(loading && !mapInstanceRef.current) ? 'hidden' : 'block'} 
                       h-[400px] sm:h-[500px] md:h-[calc(75vh-120px)] min-h-[300px]`}
            aria-label="World map showing logged locations"
            id="leaflet-map-container" // Explicit ID for debugging if needed
          >
            {loading && mapInstanceRef.current && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-800/50 z-10 rounded-lg">
                    <p className="text-blue-500 dark:text-blue-400 p-4 bg-white/80 dark:bg-slate-700/80 rounded-md shadow-lg">Updating map data...</p>
                </div>
            )}
          </div>

          <p className="text-xs text-center mt-4 text-gray-500 dark:text-gray-400">
            Click on markers to see details. Auto-located entries are <span className="font-semibold text-blue-600 dark:text-blue-400">blue</span>, manually entered cities are <span className="font-semibold text-sky-500 dark:text-sky-400">sky blue</span>.
          </p>
        </main>
      </div>
    </>
  );
}