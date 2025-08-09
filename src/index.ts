import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";

import {
  writeMessage,
  getConversation,
  getUserConversations,
  markMessagesAsDelivered,
  markMessagesAsRead,
  getUnreadCount,
  setTypingStatus,
  getTypingStatus,
  getConversationMetadata,
  readMessages,
} from "./utils/chatUtil";

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Track authenticated users
const userSockets: Record<string, string> = {};
const userPresence: Record<string, boolean> = {};

// Middleware to handle authentication
io.use((socket: Socket & { user_id?: string }, next) => {
  const user_id = socket.handshake.auth.user_id;
  if (!user_id) return next(new Error("Authentication error"));

  // Associate user ID with socket
  socket.user_id = user_id;
  userSockets[user_id] = socket.id;
  userPresence[user_id] = true;
  next();
});

io.on("connection", (socket: Socket & { user_id?: string }) => {
  if (!socket.user_id) return socket.disconnect(true);
  const user_id = socket.user_id;

  console.log(`User connected: ${user_id}`);
  socket.join(`user_${user_id}`);

  // Notify user of pending messages on connect
  socket.on("initialize", async () => {
    try {
      // Get all undelivered messages
      const undeliveredMessages = readMessages().filter(
        (msg) => msg.receiver_id === user_id && !msg.delivered
      );

      // Send undelivered messages and mark as delivered
      if (undeliveredMessages.length) {
        socket.emit("offline_messages", undeliveredMessages);
        markMessagesAsDelivered(undeliveredMessages.map((msg) => msg.id));
      }

      // Send total unread count
      const totalUnread = getUnreadCount(user_id);
      socket.emit("unread_count_total", totalUnread);

      // Send conversation list
      const conversations = getUserConversations(user_id);
      socket.emit("conversation_list", conversations);

      // Broadcast presence
      io.emit("presence_update", {
        user_id,
        online: true,
      });
    } catch (error: any) {
      socket.emit("error", { message: error.message });
    }
  });

  // Join conversation room
  socket.on("join_chat", ({ receiver_id }) => {
    try {
      if (!receiver_id) throw new Error("Receiver ID missing");

      const conversation_id = [user_id, receiver_id].sort().join("-");
      socket.join(conversation_id);

      // Send conversation history
      const conversation = getConversation(user_id, receiver_id);
      socket.emit("chat_history", conversation);

      // Send metadata (unread count, etc)
      const metadata = getConversationMetadata(conversation_id, user_id);
      socket.emit("conversation_metadata", metadata);

      // Send typing status if active
      const typingStatus = getTypingStatus(conversation_id);
      typingStatus.forEach((status) => {
        if (status.user_id !== user_id) {
          socket.emit("user_typing", {
            user_id: status.user_id,
            is_typing: status.is_typing,
          });
        }
      });
    } catch (error: any) {
      socket.emit("error", { message: error.message });
    }
  });

  // Get user conversations
  socket.on("get_conversations", () => {
    try {
      const conversations = getUserConversations(user_id);
      socket.emit("conversation_list", conversations);
    } catch (error: any) {
      socket.emit("error", { message: error.message });
    }
  });

  // Send message
  socket.on(
    "send_message",
    async ({ receiver_id, journey_id, message, traveling_date }) => {
      try {
        if (!receiver_id || !message) throw new Error("Invalid data");

        // Write to database
        const newMessage = writeMessage({
          sender_id: user_id,
          receiver_id,
          journey_id,
          message,
          traveling_date,
        });

        const conversation_id = [user_id, receiver_id].sort().join("-");

        // Emit to conversation room
        io.to(conversation_id).emit("receive_message", newMessage);

        // Update conversation lists for both participants
        const senderConvos = getUserConversations(user_id);
        const receiverConvos = getUserConversations(receiver_id);

        io.to(`user_${user_id}`).emit("conversation_list", senderConvos);
        io.to(`user_${receiver_id}`).emit("conversation_list", receiverConvos);

        // Real-time delivery receipt
        if (userSockets[receiver_id]) {
          markMessagesAsDelivered([newMessage.id]);
          io.to(conversation_id).emit("message_delivered", {
            messageId: newMessage.id,
            timestamp: new Date(),
          });
        }
      } catch (error: any) {
        socket.emit("error", { message: error.message });
      }
    }
  );

  // Typing indicator
  socket.on("typing", ({ receiver_id, is_typing }) => {
    try {
      if (!receiver_id) throw new Error("Receiver ID missing");

      const conversation_id = [user_id, receiver_id].sort().join("-");
      setTypingStatus(conversation_id, user_id, is_typing);

      socket.to(conversation_id).emit("user_typing", {
        user_id,
        is_typing,
      });
    } catch (error: any) {
      socket.emit("error", { message: error.message });
    }
  });

  // Mark messages as read
  socket.on("mark_read", ({ messageIds, receiver_id }) => {
    try {
      if (!messageIds.length) return;

      markMessagesAsRead(messageIds, user_id);
      const conversation_id = [user_id, receiver_id].sort().join("-");

      // Notify sender
      io.to(conversation_id).emit("messages_read", {
        messageIds,
        reader_id: user_id,
      });

      // Update metadata
      const metadata = getConversationMetadata(conversation_id, user_id);
      socket.emit("conversation_metadata", metadata);
    } catch (error: any) {
      socket.emit("error", { message: error.message });
    }
  });

  // Get unread counts
  socket.on("get_unread_counts", () => {
    try {
      // Total unread count
      const totalUnread = getUnreadCount(user_id);
      socket.emit("unread_count_total", totalUnread);

      // Unread counts per conversation
      const conversations = getUserConversations(user_id);
      conversations.forEach((convo) => {
        const conversationUnread = getUnreadCount(
          user_id,
          convo.conversation_id
        );
        socket.emit("conversation_unread_count", {
          conversation_id: convo.conversation_id,
          count: conversationUnread,
        });
      });
    } catch (error: any) {
      socket.emit("error", { message: error.message });
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${user_id}`);
    userPresence[user_id] = false;
    delete userSockets[user_id];

    // Broadcast presence
    io.emit("presence_update", {
      user_id,
      online: false,
    });
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
