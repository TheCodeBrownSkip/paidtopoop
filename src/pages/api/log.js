﻿// src/pages/api/log.js
import { db } from "@/firebase/clientApp"; // Using client SDK
import { 
    collection, addDoc, getDocs, query, orderBy, 
    Timestamp // Removed serverTimestamp from here as we won't use it for writing with client SDK
} from "firebase/firestore";

export default async function handler(req, res) {
  // POST /api/log — add a new entry
  if (req.method === "POST") {
    const entryData = req.body;
    console.log("API POST Request Body:", JSON.stringify(entryData, null, 2));

    const {
      username, token, duration, earnings, currentRate,
      timestamp, lat, lng, city, locationMethod
    } = entryData;

    // Robust Validation and Type Coercion
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
      timestamp: timestamp && !isNaN(Number(timestamp)) ? Timestamp.fromMillis(Number(timestamp)) : Timestamp.now(),
      lat: lat !== undefined && lat !== null && !isNaN(Number(lat)) ? Number(lat) : null,
      lng: lng !== undefined && lng !== null && !isNaN(Number(lng)) ? Number(lng) : null,
      city: city !== undefined && city !== null ? String(city) : null,
      locationMethod: locationMethod !== undefined && locationMethod !== null ? String(locationMethod) : 'unknown',
      // REMOVED: serverTimestamp: serverTimestamp(), 
      // We will rely on the client-provided 'timestamp' field.
    };

    // Remove any fields that are explicitly undefined
    for (const key in dataToSave) {
        if (dataToSave[key] === undefined) {
            dataToSave[key] = null; 
        }
    }
    console.log("Data prepared for Firestore:", JSON.stringify(dataToSave, null, 2));

    try {
      console.time("firestore_write_log");
      const docRef = await addDoc(collection(db, "pooLogs"), dataToSave);
      console.timeEnd("firestore_write_log");
      console.log("Saved log with ID:", docRef.id);
      
      // Prepare response data
      const responseData = {
        id: docRef.id,
        ...dataToSave,
        timestamp: dataToSave.timestamp.toMillis(), // Convert back for client consistency
      };
      // If serverTimestamp was part of dataToSave and set by Firestore, it would be complex to get it here immediately.
      // Since we removed it from saving, we don't need to worry about returning it "Pending".
      return res.status(201).json(responseData);
    } catch (err) {
      console.error("Firestore POST error:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
      return res.status(500).json({ message: "Error saving log", errorName: err.name, errorCode: err.code, errorMessage: err.message });
    }
  }

  // GET /api/log — return all entries
  if (req.method === "GET") {
    console.log("Handling GET /api/log");
    try {
      console.time("firestore_read_logs");
      const logsCollectionRef = collection(db, "pooLogs");
      const q = query(logsCollectionRef, orderBy("timestamp", "desc")); 
      const snapshot = await getDocs(q);
      console.timeEnd("firestore_read_logs");

      const all = snapshot.docs.map((d) => {
        const data = d.data();
        let clientTimestamp = null;
        if (data.timestamp instanceof Timestamp) {
            clientTimestamp = data.timestamp.toMillis();
        } else if (data.timestamp && data.timestamp._seconds !== undefined) {
            clientTimestamp = data.timestamp.toMillis();
        } else if (data.timestamp) {
            clientTimestamp = new Date(data.timestamp).getTime();
            if (isNaN(clientTimestamp)) clientTimestamp = null;
        }

        // If your old data had serverTimestamp, you might still want to process it for GET
        let clientServerTimestamp = undefined;
        if (data.serverTimestamp instanceof Timestamp) { // Check if it exists from previous writes
            clientServerTimestamp = data.serverTimestamp.toMillis();
        }

        return { 
          id: d.id, 
          ...data,
          timestamp: clientTimestamp,
          serverTimestamp: clientServerTimestamp, // Will be undefined if not present
        };
      });
      console.log(`Returning ${all.length} logs`);
      return res.status(200).json(all);
    } catch (err) {
      console.error("Firestore GET error:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
      return res.status(500).json({ message: "Error fetching logs", errorName: err.name, errorCode: err.code, errorMessage: err.message });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end("Method Not Allowed");
}