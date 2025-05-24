// src/pages/api/log.js
import { db } from "@/firebase/clientApp"; // Ensure this path is correct
import { collection, addDoc, getDocs, query, orderBy, Timestamp, serverTimestamp } from "firebase/firestore";

export default async function handler(req, res) {
  // POST /api/log — add a new entry
  if (req.method === "POST") {
    const entryData = req.body;
    console.log("API received log payload:", entryData);

    // Destructure and prepare data for Firestore
    // The client should now be sending the city if auto-geocoded or manually entered
    const {
      username, token, duration, earnings, currentRate,
      timestamp, lat, lng, city, // city now comes from client
      locationMethod
    } = entryData;

    // Basic Validation
    if (!username || !token || typeof duration !== 'number' || typeof earnings !== 'number' || typeof currentRate !== 'number') {
      console.error("API Validation Error: Missing required fields", entryData);
      return res.status(400).json({ message: 'Missing or invalid required fields.' });
    }
    
    const dataToSave = {
      username,
      token,
      duration: Number(duration),
      earnings: Number(earnings),
      currentRate: Number(currentRate),
      timestamp: Timestamp.fromMillis(Number(timestamp || Date.now())), // Ensure timestamp is a Firestore Timestamp
      lat: lat !== null && !isNaN(Number(lat)) ? Number(lat) : null,
      lng: lng !== null && !isNaN(Number(lng)) ? Number(lng) : null,
      city: city || null, // Use city provided by client
      locationMethod,
      serverTimestamp: serverTimestamp(), // Good practice
    };

    try {
      console.time("firestore_write_log");
      const docRef = await addDoc(collection(db, "pooLogs"), dataToSave);
      console.timeEnd("firestore_write_log");
      console.log("Saved log with ID:", docRef.id, "Data:", dataToSave);
      
      // Return the data that was saved, including the new ID
      // Convert Firestore Timestamps back for the client if it expects milliseconds or ISO strings
      return res.status(201).json({ 
        id: docRef.id, 
        ...dataToSave,
        timestamp: dataToSave.timestamp.toMillis(),
        // serverTimestamp will be populated by Firestore on read if needed
      });
    } catch (err) {
      console.error("Firestore POST error:", err);
      return res.status(500).json({ message: "Error saving log", error: err.message });
    }
  }

  // GET /api/log — return all entries
  if (req.method === "GET") {
    console.log("Handling GET /api/log");
    try {
      console.time("firestore_read_logs");
      const logsCollectionRef = collection(db, "pooLogs");
      const q = query(logsCollectionRef, orderBy("timestamp", "desc")); // Order by user's timestamp
      const snapshot = await getDocs(q);
      console.timeEnd("firestore_read_logs");

      const all = snapshot.docs.map((d) => {
        const data = d.data();
        return { 
          id: d.id, 
          ...data,
          // Ensure timestamps are consistently returned as milliseconds
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : (data.timestamp ? new Date(data.timestamp).getTime() : null),
          serverTimestamp: data.serverTimestamp instanceof Timestamp ? data.serverTimestamp.toMillis() : undefined,
        };
      });
      console.log(`Returning ${all.length} logs`);
      return res.status(200).json(all);
    } catch (err) {
      console.error("Firestore GET error:", err);
      return res.status(500).json({ message: "Error fetching logs", error: err.message });
    }
  }

  // Other methods not allowed
  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end("Method Not Allowed");
}