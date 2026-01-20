const https = require('https');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

// --- KONFIGURATION ---
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "wg-app-388eb.firebaseapp.com",
  projectId: "wg-app-388eb",
  storageBucket: "wg-app-388eb.firebasestorage.app",
  messagingSenderId: "146563504520",
  appId: "1:146563504520:web:b4c23cd2f09f88788a423d"
};

// Initialisierung
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Robuste Sende-Funktion mit Standard 'https' Modul
function sendTelegram(text) {
  return new Promise((resolve, reject) => {
    if (!TG_TOKEN || !TG_CHAT_ID) {
      console.log("Telegram Token fehlt - überspringe Senden.");
      resolve(); 
      return;
    }

    const data = JSON.stringify({
      chat_id: TG_CHAT_ID,
      text: text,
      parse_mode: 'Markdown'
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TG_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log("Nachricht gesendet:", text);
        resolve();
      } else {
        console.error(`Telegram Fehler Status: ${res.statusCode}`);
        resolve(); // Wir wollen nicht, dass der Bot abstürzt, nur weil Telegram zickt
      }
    });

    req.on('error', (error) => {
      console.error("Netzwerkfehler:", error);
      resolve(); // Auch hier: weitermachen
    });

    req.write(data);
    req.end();
  });
}

async function checkTasks() {
  try {
    console.log("Starte Prüfung (V5 Independent - HTTPS)...");
    
    const docRef = doc(db, 'wg_app', 'wg_app_v5_independent');
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.log("Datenbank nicht gefunden.");
      process.exit(0);
    }

    const data = docSnap.data();
    const rooms = data.rooms;

    if (!rooms) {
      console.log("Keine Räume gefunden.");
      process.exit(0);
    }

    for (const [roomKey, roomData] of Object.entries(rooms)) {
      const assignee = roomData.assignee;
      const lastCleaned = roomData.lastCleaned.toDate();
      
      const now = new Date();
      const diffTime = Math.abs(now - lastCleaned);
      const daysPassed = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      const roomName = (roomKey === "Kueche" || roomKey === "Küche") ? "Die Küche" : "Das Bad";

      console.log(`${roomName}: ${daysPassed} Tage (Zuständig: ${assignee})`);

      // ALARM LOGIK
      if (daysPassed === 4) {
        await sendTelegram(`⚠️ *Erinnerung für ${assignee}*\n\n${roomName} ist seit 4 Tagen ungeputzt.`);
      }
      if (daysPassed === 7) {
        await sendTelegram(`🚨 *DEADLINE für ${assignee}*\n\n${roomName} muss HEUTE geputzt werden!`);
      }
      if (daysPassed > 7) {
        await sendTelegram(`🔥 *ÜBERFÄLLIG: ${assignee}*\n\n${roomName} ist seit ${daysPassed} Tagen dreckig!`);
      }
    }
    
    console.log("Fertig.");
    process.exit(0);

  } catch (error) {
    console.error("Kritischer Fehler im Bot:", error);
    process.exit(1);
  }
}

checkTasks();
