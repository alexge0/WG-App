import admin from 'firebase-admin';
import fetch from 'node-fetch';

// 1. Verbindung herstellen
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 2. Hilfsfunktion: Nachricht senden
async function sendTelegram(message) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
  });
}

// 3. Hauptlogik
async function checkTasks() {
  const docRef = db.collection('wg_app').doc('state_v3');
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    console.log('Keine Daten gefunden');
    return;
  }

  const data = docSnap.data();
  const users = [
    { id: 'me', name: 'Alex', data: data.users.me },
    { id: 'him', name: 'Fred', data: data.users.him }
  ];

  const now = new Date();

  for (const user of users) {
    const lastCleaned = user.data.lastCleaned.toDate();
    const diffTime = now - lastCleaned;
    const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // LOGIK: WANN SOLL ER NERVEN?
    
    // Tag 4 (Erste Warnung)
    if (daysPassed === 4) {
      await sendTelegram(`⚠️ *Erinnerung für ${user.name}*\nDie Zeit läuft! Du musst noch: ${user.data.currentTask}.\nNoch 3 Tage für volle Punkte.`);
    }

    // Tag 7 (Deadline)
    if (daysPassed === 7) {
      await sendTelegram(`🚨 *HEUTE FÄLLIG: ${user.name}*\nBeweg dich! Aufgabe: ${user.data.currentTask}. Ab morgen gibt es Minuspunkte!`);
    }

    // Tag 8+ (Terror-Modus - Jeden Tag)
    if (daysPassed > 7) {
       // Wir berechnen die aktuellen Minuspunkte
       const penalty = (daysPassed - 7) * 5; 
       await sendTelegram(`🔥 *ÜBERFÄLLIG: ${user.name}*\nDas ist Tag ${daysPassed}! Du verlierst gerade massiv Punkte (-${penalty} bisher).\nMach sofort: ${user.data.currentTask}!`);
    }
  }
}

checkTasks().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
