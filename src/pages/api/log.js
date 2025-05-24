// src/pages/api/log.js
// ... imports ...

export default async function handler(req, res) {
  if (req.method === "POST") {
    const entryData = req.body;
    // ... (your existing validation and data prep) ...

    const dataToSave = {
      username: String(username),
      token: String(token),
      duration: Number(duration),
      earnings: Number(earnings),
      currentRate: Number(currentRate),
      timestamp: timestamp && !isNaN(Number(timestamp)) ? Timestamp.fromMillis(Number(timestamp)) : Timestamp.now(),
      lat: lat !== undefined && lat !== null && !isNaN(Number(lat)) ? Number(lat) : null,
      lng: lng !== undefined && lng !== null && !isNaN(Number(lng)) ? Number(lng) : null,
      city: city !== undefined && city !== null ? String(city) : null,
      locationMethod: locationMethod !== undefined && locationMethod !== null ? String(locationMethod) : 'unknown',
      // ---- TEMPORARILY COMMENT OUT serverTimestamp ----
      // serverTimestamp: serverTimestamp(), 
    };

    // Remove undefined fields
    for (const key in dataToSave) {
        if (dataToSave[key] === undefined) {
            dataToSave[key] = null; 
        }
    }
    console.log("Data prepared for Firestore (serverTimestamp OMITTED for test):", JSON.stringify(dataToSave, null, 2));

    try {
      console.time("firestore_write_log_no_serverTS");
      const docRef = await addDoc(collection(db, "pooLogs"), dataToSave);
      console.timeEnd("firestore_write_log_no_serverTS");
      // ... rest of your success response ...
    } catch (err) { /* ... error handling ... */ }
  }
  // ... GET handler ...
}