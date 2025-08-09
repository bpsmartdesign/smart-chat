import db from "./db";

const initDB = () => {
  console.log("Initializing database...");

  try {
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        journey_id TEXT NOT NULL,
        message TEXT NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        traveling_date DATETIME,
        conversation_id TEXT NOT NULL,
        read BOOLEAN DEFAULT 0,
        delivered BOOLEAN DEFAULT 0
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations_metadata (
        conversation_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        unread_count INTEGER DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (conversation_id, user_id)
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conversation ON messages (conversation_id);
      CREATE INDEX IF NOT EXISTS idx_message_date ON messages (date DESC);
      CREATE INDEX IF NOT EXISTS idx_user_conversations ON messages (sender_id, receiver_id);
      CREATE INDEX IF NOT EXISTS idx_read_status ON messages (conversation_id, read);
      CREATE INDEX IF NOT EXISTS idx_journey_messages ON messages (journey_id);
      CREATE INDEX IF NOT EXISTS idx_message_delivery ON messages (delivered, read);
      
      CREATE INDEX IF NOT EXISTS idx_metadata_user ON conversations_metadata (user_id);
      CREATE INDEX IF NOT EXISTS idx_metadata_conversation ON conversations_metadata (conversation_id);
      CREATE INDEX IF NOT EXISTS idx_metadata_unread ON conversations_metadata (unread_count DESC);
    `);

    const messagesColumns = db.pragma("table_info(messages)") as unknown as any;
    const hasReadColumn = messagesColumns.some(
      (col: any) => col.name === "read"
    );
    const hasDeliveredColumn = messagesColumns.some(
      (col: any) => col.name === "delivered"
    );

    if (!hasReadColumn) {
      db.exec("ALTER TABLE messages ADD COLUMN read BOOLEAN DEFAULT 0");
      console.log("Added 'read' column to messages table");
    }

    if (!hasDeliveredColumn) {
      db.exec("ALTER TABLE messages ADD COLUMN delivered BOOLEAN DEFAULT 0");
      console.log("Added 'delivered' column to messages table");
    }

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_conversation_metadata
      AFTER INSERT ON messages
      BEGIN
        INSERT OR IGNORE INTO conversations_metadata (conversation_id, user_id, unread_count)
        VALUES (NEW.conversation_id, NEW.sender_id, 0);
        
        INSERT OR IGNORE INTO conversations_metadata (conversation_id, user_id, unread_count)
        VALUES (NEW.conversation_id, NEW.receiver_id, 0);
        
        UPDATE conversations_metadata
        SET unread_count = unread_count + 1,
            last_updated = CURRENT_TIMESTAMP
        WHERE conversation_id = NEW.conversation_id
          AND user_id = NEW.receiver_id;
      END;
    `);
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_read_status
      AFTER UPDATE OF read ON messages
      WHEN NEW.read = 1 AND OLD.read = 0
      BEGIN
        UPDATE conversations_metadata
        SET unread_count = unread_count - 1,
            last_updated = CURRENT_TIMESTAMP
        WHERE conversation_id = NEW.conversation_id
          AND user_id = NEW.receiver_id;
      END;
    `);

    db.exec(`
      CREATE VIEW IF NOT EXISTS active_conversations AS
      SELECT 
        conversation_id,
        MAX(date) AS last_message_date,
        COUNT(*) AS message_count,
        SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) AS total_unread_count
      FROM messages
      GROUP BY conversation_id;
    `);

    console.log("Database initialized successfully!");
  } catch (error: any) {
    console.error("Database initialization failed:", error.message);
    throw error;
  }
};

initDB();
export default initDB;
