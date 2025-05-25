// src/pages/globallogmap.js

// ... (imports and other code) ...

export default function GlobalLogMapPage() {
  // ... (state variables, including isMapReady = useState(false) ) ...

  // Initialize map
  useEffect(() => {
    // If map already exists, or if the container div isn't in the DOM yet, bail.
    if (mapInstanceRef.current || !mapContainerRef.current) {
      if (!mapContainerRef.current) {
        console.log("GlobalMap: mapContainerRef.current is null. Waiting for it to render.");
      }
      return;
    }
    
    const container = mapContainerRef.current;
    if (container._leaflet_id) {
      console.warn("GlobalMap: _leaflet_id found on container. Aborting redundant init.");
      return; 
    }

    console.log("GlobalMap: Attempting to initialize Leaflet map...");
    let L_instance; // Local L for this scope
    (async () => {
      try {
        L_instance = await import('leaflet');
        LRef.current = L_instance; // Store for other effects
        await import('leaflet.markercluster/dist/leaflet.markercluster.js'); 

        delete L_instance.Icon.Default.prototype._getIconUrl;
        L_instance.Icon.Default.mergeOptions({
          iconRetinaUrl: iconRetinaUrl.src,
          iconUrl: iconUrl.src,
          shadowUrl: shadowUrl.src,
        });

        // Final check right before creating map
        if (!mapContainerRef.current || mapContainerRef.current._leaflet_id || mapInstanceRef.current) {
            console.warn("GlobalMap: Pre-L.map() check failed. Aborting.");
            return;
        }
        
        mapInstanceRef.current = L_instance.map(container).setView([20, 0], 2);
        console.log("GlobalMap: L.map() successful.");

        L_instance.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap contributors',
        }).addTo(mapInstanceRef.current);

        if (typeof L_instance.markerClusterGroup === 'function') {
            markerClusterGroupRef.current = L_instance.markerClusterGroup();
            mapInstanceRef.current.addLayer(markerClusterGroupRef.current);
            console.log("GlobalMap: MarkerClusterGroup initialized and added.");
            setIsMapReady(true); // Map is fully ready
        } else {
            throw new Error("L.markerClusterGroup is not a function after import!");
        }
      } catch (e) {
        console.error("GlobalMap: Error during map initialization:", e);
        setError(e.message || "Could not load map components.");
        if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
        setIsMapReady(false); // Explicitly set to false on error
      }
    })();

    return () => {
      console.log("GlobalMap: Cleaning up map instance...");
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
      if (markerClusterGroupRef.current) { markerClusterGroupRef.current = null; }
      LRef.current = null;
      setIsMapReady(false); // Reset on unmount
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount, internal checks handle readiness of container.

  // ... (rest of the component, including marker adding useEffect that depends on isMapReady)

  // In the return statement, the map div ref={mapContainerRef} should now always be rendered (though possibly invisible)
  // ...
  return (
    <>
      <Head> {/* ... */} </Head>
      <div className="min-h-screen ...">
        <main className="bg-white ...">
          <header> {/* ... */} </header>

          {/* Status Messages and Map Container */}
          {pageStatus === "ERROR" && (
            <div className={`flex-grow ...`}> <p>Error: {error}</p> </div>
          )}

          {/* Always render the map container div if no error, to ensure ref is set. Visibility controlled by CSS or overlays. */}
          {pageStatus !== "ERROR" && (
            <div 
              ref={mapContainerRef} 
              className={`
                relative rounded-lg shadow-inner overflow-hidden bg-gray-200 dark:bg-slate-700 
                ${mapDivHeightClass} 
                ${!isMapReady && pageStatus !== "DATA_LOADED_MAP_INITIALIZING" ? 'opacity-0 pointer-events-none' : 'opacity-100'} 
              `} // Use opacity for hiding to keep layout
              aria-label="World map"
            >
              {/* Loading overlays */}
              {(pageStatus === "LOADING_ALL" || pageStatus === "PREPARING" || pageStatus === "DATA_LOADED_MAP_INITIALIZING") && (
                <div className="absolute inset-0 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <p>
                    {pageStatus === "LOADING_ALL" ? "Loading map and log data..." : 
                     pageStatus === "DATA_LOADED_MAP_INITIALIZING" ? "Initializing map display..." : 
                     "Preparing map area..."}
                  </p>
                </div>
              )}
              {pageStatus === "MAP_READY_LOADING_DATA" && (
                 <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-800/50 z-10 rounded-lg">
                    <p>Loading log data for markers...</p>
                </div>
              )}
            </div>
          )}
          
          {pageStatus === "NO_LOGS_TO_DISPLAY" && ( /* ... */ )}
           
          <p className="text-xs text-center mt-2 ...">Markers are clustered...</p>
        </main>
      </div>
    </>
  );
},,,,,