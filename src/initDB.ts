import db from "./db";

// Initialisation de la base de données
const initDB = () => {
  console.log("Initialisation de la base de données...");

  // Création de la table `messages` si elle n'existe pas
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      journey_id TEXT NOT NULL,
      message TEXT NOT NULL,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      traveling_date DATETIME,
      conversation_id TEXT NOT NULL
    )
  `);

  console.log("Tables initialisées avec succès !");
};

// Exécute l'initialisation
initDB();
