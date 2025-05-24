import { db } from "@/firebase/clientApp";
import { doc, setDoc } from "firebase/firestore";
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { token, username, rate } = req.body;
  if (!token || !username || !rate) return res.status(400).end("Missing");
  await setDoc(doc(db, "profiles", token), { username, rate });
  res.status(200).json({ success: true });
}
