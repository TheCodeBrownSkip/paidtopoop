// src/pages/api/log.js
import { db } from "@/firebase/clientApp"; // Using client SDK
import { 
    collection, addDoc, getDocs, query, orderBy, 
    Timestamp, serverTimestamp, where // Added 'where' for potential future use
} from "firebase/firestore";

export default async function handler(req, res) {
  // POST /api/log — add a new entry
  if (req.method === "POST") {
    const entryData = req.body;
    console.log("API POST Request Body:", JSON.stringify(entryData, null, 2)); // Log the exact payload

    const {
      username, token, duration, earnings, currentRate,
      timestamp, lat, lng, city, locationMethod
    } = entryData;

    // --- Robust Validation and Type Coercion ---
    if (!username || typeof username !== 'string' ||
        !token || typeof token !== 'string' ||
        duration === undefined || duration === null || isNaN(Number(duration)) ||
        earnings === undefined || earnings === null || isNaN(Number(earnings)) ||
        currentRate === undefined || currentRate === null || isNaN(Number(currentRate))) {
      console.error("API POST Validation Error: Missing or invalid core fields", entryData);
      return res.status(400).json({ message: 'Missing or invalid required fields (username, token, duration, earnings, currentRate).' });
    }

    const dataToSave = {
      username: String(username),
      token: String(token),
      duration: Number(duration),
      earnings: Number(earnings),
      currentRate: Number(currentRate),
      // Ensure timestamp is valid before converting
      timestamp: timestamp && !isNaN(Number(timestamp)) ? Timestamp.fromMillis(Number(timestamp)) : Timestamp.now(), // Fallback to now() if invalid
      // Ensure lat/lng are numbers or null
      lat: lat !== undefined && lat !== null && !isNaN(Number(lat)) ? Number(lat) : null,
      lng: lng !== undefined && lng !== null && !isNaN(Number(lng)) ? Number(lng) : null,
      // Ensure city is string or null
      city: city !== undefined && city !== null ? String(city) : null,
      // Ensure locationMethod is string or a default
      locationMethod: locationMethod !== undefined && locationMethod !== null ? String(locationMethod) : 'unknown',
      serverTimestamp: serverTimestamp(),
    };

    // --- Remove any fields that are explicitly undefined ---
    // Firestore doesn't like undefined values.
    for (const key in dataToSave) {
        if (dataToSave[key] === undefined) {
            // Firestore treats missing fields and null fields differently.
            // Decide if you want to store null or omit the field.
            // For simplicity, let's convert undefined to null, though omitting is also an option.
            dataToSave[key] = null; 
        }
    }
    console.log("Data prepared for Firestore:", JSON.stringify(dataToSave, null, 2));


    try {
      console.time("firestore_write_log");
      const docRef = await addDoc(collection(db, "pooLogs"), dataToSave);
      console.timeEnd("firestore_write_log");
      console.log("Saved log with ID:", docRef.id);
      
      // Prepare response data (convert Timestamps back)
      const responseData = {
        id: docRef.id,
        ...dataToSave,
        timestamp: dataToSave.timestamp.toMillis(), // Convert back for client
        serverTimestamp: "Pending" // serverTimestamp is set by server, won't be available immediately here
      };
      return res.status(201).json(responseData);
    } catch (err) {
      console.error("Firestore POST error:", JSON.stringify(err, Object.getOwnPropertyNames(err))); // Log full error
      return res.status(500).json({ message: "Error saving log", errorName: err.name, errorCode: err.code, errorMessage: err.message });
    }
  }

  // GET /api/log — return all entries
  if (req.method === "GET") {
    console.log("Handling GET /api/log");
    try {
      console.time("firestore_read_logs");
      const logsCollectionRef = collection(db, "pooLogs");
      // Ensure timestamp field used for ordering exists and is a valid Timestamp in your documents
      const q = query(logsCollectionRef, orderBy("timestamp", "desc")); 
      const snapshot = await getDocs(q);
      console.timeEnd("firestore_read_logs");

      const all = snapshot.docs.map((d) => {
        const data = d.data();
        // Be careful with timestamp conversion here, ensure data.timestamp is a Firestore Timestamp object
        let clientTimestamp = null;
        if (data.timestamp instanceof Timestamp) {
            clientTimestamp = data.timestamp.toMillis();
        } else if (data.timestamp && data.timestamp._seconds !== undefined) { // Handle older SDK Timestamp format
            clientTimestamp = data.timestamp.toMillis();
        } else if (data.timestamp) { // Fallback if it's already a number or string date
            clientTimestamp = new Date(data.timestamp).getTime();
            if (isNaN(clientTimestamp)) clientTimestamp = null; // Invalid date string
        }

        let clientServerTimestamp = undefined;
        if (data.serverTimestamp instanceof Timestamp) {
            clientServerTimestamp = data.serverTimestamp.toMillis();
        }


        return { 
          id: d.id, 
          ...data,
          timestamp: clientTimestamp,
          serverTimestamp: clientServerTimestamp,
        };
      });
      console.log(`Returning ${all.length} logs`);
      return res.status(200).json(all);
    } catch (err) {
      console.error("Firestore GET error:", JSON.stringify(err, Object.getOwnPropertyNames(err))); // Log full error
      return res.status(500).json({ message: "Error fetching logs", errorName: err.name, errorCode: err.code, errorMessage: err.message });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end("Method Not Allowed");
}