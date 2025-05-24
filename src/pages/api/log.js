// src/pages/api/log.js
import { db } from "@/firebase/clientApp";
import { collection, addDoc, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  // POST /api/log — add a new entry
  if (req.method === "POST") {
    const e = req.body;
    console.log("Entry payload:", e);

    let city = null;

    // Try reverse-geocoding if coordinates are provided
    if (e.lat != null && e.lng != null) {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${e.lat}&lon=${e.lng}`;
        console.log("Reverse-geocoding URL:", url);

        const response = await fetch(url, {
          headers: {
            "User-Agent": "Paid-to-Poo-App/1.0",
            "Accept": "application/json"
          }
        });
        const data = await response.json();
        console.log("Nominatim response address:", data.address);

        const addr = data.address || {};
        // Pick the best available label
        city =
          addr.city_district ||
          addr.suburb ||
          addr.municipality ||
          addr.county ||
          null;

        // Fallback: use the second segment of display_name if still null
        if (!city && data.display_name) {
          const parts = data.display_name.split(",");
          if (parts.length > 1) city = parts[1].trim();
        }
      } catch (err) {
        console.error("Reverse-geocode error:", err);
      }
    }

    // Last-resort fallback: coordinates string
    if (!city && e.lat != null && e.lng != null) {
      city = `${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}`;
      console.log("Falling back to coords as city:", city);
    }

    // Persist to Firestore
    try {
      const docRef = await addDoc(collection(db, "pooLogs"), { ...e, city });
      console.log("Saved log with ID:", docRef.id, "city:", city);
      return res.status(200).json({ id: docRef.id, city });
    } catch (err) {
      console.error("Firestore error:", err);
      return res.status(500).end("Error saving log");
    }
  }

  // GET /api/log — return all entries
  if (req.method === "GET") {
    console.log("Handling GET /api/log");
    try {
      const snap = await getDocs(collection(db, "pooLogs"));
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      console.log(`Returning ${all.length} logs`);
      return res.status(200).json(all);
    } catch (err) {
      console.error("Firestore GET error:", err);
      return res.status(500).end("Error fetching logs");
    }
  }

  // Other methods not allowed
  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end("Method Not Allowed");
}
