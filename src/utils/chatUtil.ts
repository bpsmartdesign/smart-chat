import db from "../db";

export const readMessages = (): any[] => {
  const stmt = db.prepare("SELECT * FROM messages ORDER BY date DESC");
  return stmt.all();
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
};
export const getConversation = (
  sender_id: string,
  receiver_id: string
): any[] => {
  const conversation_id = [sender_id, receiver_id].sort().join("-");

  const stmt = db.prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ?
      AND (traveling_date IS NULL OR datetime(traveling_date, '+12 hours') > datetime('now'))
    ORDER BY date DESC
    LIMIT 100
  `);

  return stmt.all(conversation_id);
};
export const getUserConversations = (userId: string): any[] => {
  const stmt = db.prepare(`
    SELECT conversation_id, MAX(date) AS last_message_date, message
    FROM messages
    WHERE sender_id = ? OR receiver_id = ?
    GROUP BY conversation_id
    ORDER BY last_message_date DESC
  `);

  return stmt.all(userId, userId);
};
