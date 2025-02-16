import db from "../db";

/**
 * Reads all messages from the database, ordered by date in descending order.
 *
 * @author BIYA Paul <bpsmartdesign@hotmail.com>
 *
 * @returns {any[]} An array of messages.
 * @throws {Error} If there is an issue reading messages from the database.
 */
export const readMessages = (): any[] => {
  try {
    const stmt = db.prepare("SELECT * FROM messages ORDER BY date DESC");
    return stmt.all();
  } catch (error) {
    throw new Error("Failed to read messages.");
  }
};

/**
 * Writes a message to the database.
 *
 * @author BIYA Paul <bpsmartdesign@hotmail.com>
 *
 * @param {Object} params - The parameters for writing a message.
 * @param {string} params.sender_id - The ID of the sender.
 * @param {string} params.receiver_id - The ID of the receiver.
 * @param {string} params.message - The message content.
 * @param {string} [params.traveling_date] - The optional traveling date of the message
 *
 * @throws {Error} If sender or receiver ID is missing, if sender and receiver are the same,
 *                 if the message exceeds the maximum length, or if there is an issue writing the message to the database.
 */
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

/**
 * Retrieves the conversation between two users.
 *
 * @author BIYA Paul <bpsmartdesign@hotmail.com>
 *
 * @param {string} sender_id - The ID of the sender.
 * @param {string} receiver_id - The ID of the receiver.
 *
 * @returns {any[]} An array of messages in the conversation.
 * @throws {Error} If there is an issue retrieving the conversation from the database.
 */
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
      LIMIT 100
    `);

    return stmt.all(conversation_id);
  } catch (error) {
    throw new Error("Failed to get conversation.");
  }
};

/**
 * Retrieves all conversations for a given user, ordered by the date of the last message in each conversation.
 *
 * @author BIYA Paul <bpsmartdesign@hotmail.com>
 *
 * @param {string} userId - The ID of the user.
 *
 * @returns {any[]} An array of conversations, each containing the conversation ID, the date of the last message, and the last message content.
 * @throws {Error} If the user ID is missing or if there is an issue retrieving the conversations from the database.
 */
export const getUserConversations = (userId: string): any[] => {
  if (!userId) throw new Error("User ID is required.");

  try {
    const stmt = db.prepare(`
      SELECT m1.conversation_id, 
             m1.sender_id, 
             m1.receiver_id, 
             m1.date AS last_message_date, 
             m1.message
      FROM messages m1
      WHERE (m1.sender_id = ? OR m1.receiver_id = ?)
        AND m1.date = (
          SELECT MAX(m2.date) 
          FROM messages m2 
          WHERE m2.conversation_id = m1.conversation_id
        )
      ORDER BY last_message_date DESC
    `);

    return stmt.all(userId, userId);
  } catch (error) {
    throw new Error("Failed to get user conversations.");
  }
};
