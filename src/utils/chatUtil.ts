import db from "../db";

export const readMessages = (): any[] => {
  try {
    const stmt = db.prepare("SELECT * FROM messages ORDER BY date DESC");
    return stmt.all();
  } catch (error) {
    console.error("Error reading messages:", error);
    return []; // Retourne un tableau vide en cas d'erreur
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
    console.error("Error writing message:", error);
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
    console.error(
      `Error getting conversation for ${sender_id} and ${receiver_id}:`,
      error
    );
    return []; // Retourne un tableau vide en cas d'erreur
  }
};
export const getUserConversations = (userId: string): any[] => {
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
    console.error(`Error getting conversations for user ${userId}:`, error);
    return []; // Retourne un tableau vide en cas d'erreur
  }
};
