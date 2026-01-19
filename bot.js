const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const axios = require('axios');

// --- KONFIGURATION ---
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "wg-app-388eb.firebaseapp.com",
  projectId: "wg-app-388eb",
  storageBucket: "wg-app-388eb.firebasestorage.app",
  messagingSenderId: "146563504520",
  appId: "1:146563504520:web:b4c23cd2f09f88788a423d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(text) {
  try {
    await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      chat_id: TG_CHAT_ID,
      text: text,
      parse_mode: 'Markdown'
    });
    console.log("Nachricht gesendet:", text);
  } catch (error) {
    console.error("Telegram Error:", error.message);
  }
}

async function checkTasks() {
  console.log("Starte Prüfung (Version V5 Independent)...");
  
  // WICHTIG: Neue Collection abrufen
  const docRef = doc(db, 'wg_app', 'wg_app_v5_independent');
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    console.log("Keine Datenbank gefunden (wg_app_v5_independent).");
    return;
  }

  const data = docSnap.data();
  const rooms = data.rooms; // Bad, Kueche

  // Wir prüfen jeden Raum einzeln
  for (const [roomKey, roomData] of Object.entries(rooms)) {
    const assignee = roomData.assignee; // Wer ist dran?
    const lastCleaned = roomData.lastCleaned.toDate(); // Wann zuletzt?
    
    // Tage berechnen
    const now = new Date();
    const diffTime = Math.abs(now - lastCleaned);
    const daysPassed = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    const roomName = (roomKey === "Kueche") ? "Die Küche" : "Das Bad";

    console.log(`${roomName}: Zuletzt vor ${daysPassed} Tagen von ??? geputzt. Jetzt ist ${assignee} dran.`);

    // --- ALARM LOGIK ---
    
    // Tag 4: Warnung
    if (daysPassed === 4) {
      await sendTelegram(`⚠️ *Erinnerung für ${assignee}*\n\n${roomName} ist seit 4 Tagen ungeputzt. Zeit aktiv zu werden!`);
    }

    // Tag 7: Deadline
    if (daysPassed === 7) {
      await sendTelegram(`🚨 *DEADLINE für ${assignee}*\n\n${roomName} muss HEUTE geputzt werden! Ab morgen gibt es Minuspunkte.`);
    }

    // Tag 8+: Täglicher Terror
    if (daysPassed > 7) {
      const minusPoints = (daysPassed - 7) * 5; // Ungefähre Rechnung zur Abschreckung
      await sendTelegram(`🔥 *ÜBERFÄLLIG: ${assignee}*\n\n${roomName} ist seit ${daysPassed} Tagen dreckig!\nMach sauber!`);
    }
  }
}

checkTasks();
