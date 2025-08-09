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
  } catch (error: any) {
    throw new Error(`Failed to read messages: ${error.message}`);
  }
};
/**
 * Writes a message to the database and returns the created message.
 *
 * @author BIYA Paul <bpsmartdesign@hotmail.com>
 *
 * @param {Object} params - Message parameters
 * @returns {any} The created message object
 * @throws {Error} For validation or database errors
 */
export const writeMessage = ({
  sender_id,
  receiver_id,
  journey_id,
  message,
  traveling_date,
}: {
  sender_id: string;
  receiver_id: string;
  journey_id: string;
  message: string;
  traveling_date?: string;
}): any => {
  if (!sender_id || !receiver_id)
    throw new Error("Sender or receiver ID is missing.");
  if (sender_id === receiver_id)
    throw new Error("Sender and receiver cannot be the same.");
  if (!journey_id) throw new Error("Journey ID is required.");
  if (message.length > 1000)
    throw new Error("Message exceeds maximum length of 1000 characters.");
  if (!message.trim()) throw new Error("Message cannot be empty.");

  try {
    const conversation_id = [sender_id, receiver_id].sort().join("-");
    const now = new Date().toISOString();

    // Format traveling_date if provided
    let formattedTravelingDate = null;
    if (traveling_date) {
      const dateObj = new Date(traveling_date);
      if (isNaN(dateObj.getTime()))
        throw new Error("Invalid traveling date format.");
      formattedTravelingDate = dateObj.toISOString();
    }

    // Insert message with status flags
    const stmt = db.prepare(`
      INSERT INTO messages (
        sender_id, 
        receiver_id, 
        journey_id, 
        message, 
        traveling_date, 
        conversation_id,
        read,
        delivered
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    const newMessage = stmt.get(
      sender_id,
      receiver_id,
      journey_id,
      message,
      formattedTravelingDate,
      conversation_id,
      0, // read = false
      0 // delivered = false
    );

    // Update unread count for conversation
    updateUnreadCount(conversation_id, receiver_id);

    return newMessage;
  } catch (error: any) {
    throw new Error(`Failed to write message: ${error.message}`);
  }
};
/**
 * Retrieves conversation between two users with proper date filtering
 *
 * @author BIYA Paul <bpsmartdesign@hotmail.com>
 *
 * @param {string} sender_id - Sender ID
 * @param {string} receiver_id - Receiver ID
 * @returns {any[]} Conversation messages
 * @throws {Error} For database errors
 */
export const getConversation = (
  sender_id: string,
  receiver_id: string
): any[] => {
  try {
    const conversation_id = [sender_id, receiver_id].sort().join("-");
    const stmt = db.prepare(`
      SELECT * 
      FROM messages
      WHERE conversation_id = ?
        AND (traveling_date IS NULL OR datetime(traveling_date, '+12 hours') > datetime('now'))
      ORDER BY date ASC
      LIMIT 100
    `);

    return stmt.all(conversation_id);
  } catch (error: any) {
    throw new Error(`Failed to get conversation: ${error.message}`);
  }
};
/**
 * Retrieves user conversations with last message details
 *
 * @author BIYA Paul <bpsmartdesign@hotmail.com>
 *
 * @param {string} userId - User ID
 * @returns {any[]} List of conversations
 * @throws {Error} For invalid input or database errors
 */
export const getUserConversations = (userId: string): any[] => {
  if (!userId) throw new Error("User ID is required.");

  try {
    const stmt = db.prepare(`
      WITH ranked_messages AS (
        SELECT *,
               ROW_NUMBER() OVER (
                 PARTITION BY conversation_id 
                 ORDER BY date DESC
               ) AS rn
        FROM messages
        WHERE sender_id = ? OR receiver_id = ?
      )
      SELECT m.*, 
             (SELECT COUNT(*) 
              FROM messages 
              WHERE conversation_id = m.conversation_id 
                AND receiver_id = ? 
                AND read = 0) AS unread_count
      FROM ranked_messages m
      WHERE rn = 1
      ORDER BY m.date DESC
    `);

    return stmt.all(userId, userId, userId);
  } catch (error: any) {
    throw new Error(`Failed to get user conversations: ${error.message}`);
  }
};
/**
 * Marks messages as read
 *
 * @author BIYA Paul <bpsmartdesign@hotmail.com>
 *
 * @param {number[]} messageIds - Array of message IDs
 * @param {string} userId - User ID marking as read
 * @throws {Error} For database errors
 */
export const markMessagesAsRead = (
  messageIds: number[],
  userId: string
): void => {
  if (!messageIds.length) return;

  try {
    const placeholders = messageIds.map(() => "?").join(",");
    const query = `
      UPDATE messages
      SET read = 1
      WHERE id IN (${placeholders})
        AND receiver_id = ?
    `;

    const stmt = db.prepare(query);
    stmt.run(...[...messageIds, userId]);

    // Update unread counts for affected conversations
    updateConversationUnreadCounts(messageIds);
  } catch (error: any) {
    throw new Error(`Failed to mark messages as read: ${error.message}`);
  }
};
/**
 * Marks messages as delivered
 *
 * @author BIYA Paul <bpsmartdesign@hotmail.com>
 *
 * @param {number[]} messageIds - Array of message IDs
 * @throws {Error} For database errors
 */
export const markMessagesAsDelivered = (messageIds: number[]): void => {
  if (!messageIds.length) return;

  try {
    const placeholders = messageIds.map(() => "?").join(",");
    const query = `
      UPDATE messages
      SET delivered = 1
      WHERE id IN (${placeholders})
    `;

    const stmt = db.prepare(query);
    stmt.run(...messageIds);
  } catch (error: any) {
    throw new Error(`Failed to mark messages as delivered: ${error.message}`);
  }
};
/**
 * Gets unread message count for a user
 *
 * @author BIYA Paul <bpsmartdesign@hotmail.com>
 *
 * @param {string} userId - User ID
 * @param {string} [conversationId] - Optional conversation ID
 * @returns {number} Unread message count
 * @throws {Error} For database errors
 */
export const getUnreadCount = (
  userId: string,
  conversationId?: string
): number => {
  try {
    let query = `
      SELECT COUNT(*) as count
      FROM messages
      WHERE receiver_id = ? 
        AND read = 0
    `;

    const params: any[] = [userId];

    if (conversationId) {
      query += " AND conversation_id = ?";
      params.push(conversationId);
    }

    const stmt = db.prepare(query);
    const result: any = stmt.get(...params);
    return result.count || 0;
  } catch (error: any) {
    throw new Error(`Failed to get unread count: ${error.message}`);
  }
};
/**
 * Updates unread count for a conversation
 *
 * @author BIYA Paul <bpsmartdesign@hotmail.com>
 *
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID
 */
const updateUnreadCount = (conversationId: string, userId: string): void => {
  try {
    const stmt = db.prepare(`
      UPDATE conversations_metadata
      SET unread_count = unread_count + 1,
          last_updated = CURRENT_TIMESTAMP
      WHERE conversation_id = ? AND user_id = ?
    `);

    stmt.run(conversationId, userId);
  } catch (error) {
    // Metadata table might not exist yet - safe to ignore
  }
};
/**
 * Updates unread counts for conversations after messages are read
 *
 * @author BIYA Paul <bpsmartdesign@hotmail.com>
 * @param {number[]} messageIds - Array of message IDs
 */
const updateConversationUnreadCounts = (messageIds: number[]): void => {
  try {
    const placeholders = messageIds.map(() => "?").join(",");

    const updateStmt = db.prepare(`
      UPDATE conversations_metadata
      SET unread_count = (
        SELECT COUNT(*) 
        FROM messages 
        WHERE conversation_id = conversations_metadata.conversation_id
          AND receiver_id = conversations_metadata.user_id
          AND read = 0
      )
      WHERE conversation_id IN (
        SELECT DISTINCT conversation_id
        FROM messages
        WHERE id IN (${placeholders})
      )
    `);

    updateStmt.run(...messageIds);
  } catch (error) {
    // Metadata table might not exist yet - safe to ignore
  }
};
/**
 * Gets conversation metadata including unread count
 *
 * @author BIYA Paul <bpsmartdesign@hotmail.com>
 *
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID
 * @returns {any} Conversation metadata
 */
export const getConversationMetadata = (
  conversationId: string,
  userId: string
): any => {
  try {
    const stmt = db.prepare(`
      SELECT * 
      FROM conversations_metadata
      WHERE conversation_id = ? AND user_id = ?
    `);

    return stmt.get(conversationId, userId);
  } catch (error: any) {
    throw new Error(`Failed to get conversation metadata: ${error.message}`);
  }
};
/**
 * Records typing indicator status
 *
 * @author BIYA Paul <bpsmartdesign@hotmail.com>
 *
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID
 * @param {boolean} isTyping - Typing status
 */
export const setTypingStatus = (
  conversationId: string,
  userId: string,
  isTyping: boolean
): void => {
  try {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO typing_indicators (
        conversation_id, 
        user_id, 
        is_typing,
        last_updated
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(conversation_id, user_id) 
      DO UPDATE SET 
        is_typing = excluded.is_typing,
        last_updated = excluded.last_updated
    `);

    stmt.run(conversationId, userId, isTyping ? 1 : 0, now);
  } catch (error: any) {
    console.error(`Failed to set typing status: ${error.message}`);
  }
};
/**
 * Gets typing status for a conversation
 *
 * @author BIYA Paul <bpsmartdesign@hotmail.com>
 *
 * @param {string} conversationId - Conversation ID
 * @returns {any[]} List of typing users
 */
export const getTypingStatus = (conversationId: string): any[] => {
  try {
    const stmt = db.prepare(`
      SELECT user_id, is_typing
      FROM typing_indicators
      WHERE conversation_id = ?
        AND last_updated > datetime('now', '-5 seconds')
        AND is_typing = 1
    `);

    return stmt.all(conversationId);
  } catch (error: any) {
    console.error(`Failed to get typing status: ${error.message}`);
    return [];
  }
};
