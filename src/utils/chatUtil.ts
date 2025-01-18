import db from "../db";

export const readMessages = (): any[] => {
  try {
    const stmt = db.prepare("SELECT * FROM messages ORDER BY date DESC");
    return stmt.all();
  } catch (error) {
    throw new Error("Failed to read messages.");
  }
};

export const writeMessage = ({
  sender_id,
  receiver_id,
  message,
  traveling_date,
}: {
  sender_id: string;
  receiver_id: string;
  message: string;
  traveling_date?: string;
}): void => {
  if (!sender_id || !receiver_id)
    throw new Error("Sender or receiver ID is missing.");
  if (sender_id === receiver_id)
    throw new Error("Sender and receiver cannot be the same.");
  if (message.length > 1000)
    throw new Error("Message exceeds the maximum length of 1000 characters.");

  try {
    const conversation_id = [sender_id, receiver_id].sort().join("-");
    const stmt = db.prepare(`
      INSERT INTO messages (sender_id, receiver_id, message, traveling_date, conversation_id)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      sender_id,
      receiver_id,
      message,
      traveling_date || null,
      conversation_id
    );
  } catch (error) {
    throw new Error("Failed to write message.");
  }
};

export const getConversation = (
  sender_id: string,
  receiver_id: string
): any[] => {
  try {
    const conversation_id = [sender_id, receiver_id].sort().join("-");
    const stmt = db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
        AND (traveling_date IS NULL OR datetime(traveling_date, '+12 hours') > datetime('now'))
      ORDER BY date DESC
      LIMIT 100
    `);

    return stmt.all(conversation_id);
  } catch (error) {
    throw new Error("Failed to get conversation.");
  }
};

export const getUserConversations = (userId: string): any[] => {
  if (!userId) throw new Error("User ID is required.");
  try {
    const stmt = db.prepare(`
      SELECT conversation_id, MAX(date) AS last_message_date, message
      FROM messages
      WHERE sender_id = ? OR receiver_id = ?
      GROUP BY conversation_id
      ORDER BY last_message_date DESC
    `);

    return stmt.all(userId, userId);
  } catch (error) {
    throw new Error("Failed to get user conversations.");
  }
};
