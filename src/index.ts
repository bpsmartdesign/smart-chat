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
  getConversationMetadata,
  readMessages,
} from "./utils/chatUtil";

interface CustomSocket extends Socket {
  user_id?: string;
}

interface TypingStatus {
  user_id: string;
  is_typing: boolean;
  timestamp: number;
}

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const userSockets: Record<string, string> = {};
const userPresence: Record<string, boolean> = {};
const typingStatusMap = new Map<string, TypingStatus>();

io.use((socket: CustomSocket, next) => {
  const user_id = socket.handshake.auth.user_id;
  if (!user_id) return next(new Error("Authentication error"));

  socket.user_id = user_id;
  userSockets[user_id] = socket.id;
  userPresence[user_id] = true;
  next();
});

const handleTypingStatus = (socket: CustomSocket, conversation_id: string) => {
  const status = typingStatusMap.get(conversation_id);
  if (status && status.user_id !== socket.user_id) {
    socket.emit("user_typing", {
      user_id: status.user_id,
      is_typing: status.is_typing,
      conversation_id,
    });
  }
};

io.on("connection", (socket: CustomSocket) => {
  if (!socket.user_id) return socket.disconnect(true);
  const user_id = socket.user_id;

  socket.join(`user_${user_id}`);

  socket.on("initialize", async () => {
    try {
      const undeliveredMessages = readMessages().filter(
        (msg) => msg.receiver_id === user_id && !msg.delivered
      );

      if (undeliveredMessages.length) {
        socket.emit("offline_messages", undeliveredMessages);
        markMessagesAsDelivered(undeliveredMessages.map((msg) => msg.id));
      }

      socket.emit("unread_count_total", getUnreadCount(user_id));
      socket.emit("conversation_list", getUserConversations(user_id));
      io.emit("presence_update", { user_id, online: true });
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  socket.on("join_chat", ({ receiver_id }) => {
    if (!receiver_id)
      return socket.emit("error", { message: "Receiver ID missing" });

    const conversation_id = [user_id, receiver_id].sort().join("-");
    socket.join(conversation_id);

    socket.emit("chat_history", getConversation(user_id, receiver_id));
    socket.emit(
      "conversation_metadata",
      getConversationMetadata(conversation_id, user_id)
    );
    handleTypingStatus(socket, conversation_id);
  });

  socket.on("get_conversations", () => {
    try {
      socket.emit("conversation_list", getUserConversations(user_id));
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  socket.on(
    "send_message",
    ({ receiver_id, journey_id, message, traveling_date }) => {
      if (!receiver_id || !message)
        return socket.emit("error", { message: "Invalid data" });

      try {
        const newMessage = writeMessage({
          sender_id: user_id,
          receiver_id,
          journey_id,
          message,
          traveling_date,
        });

        const conversation_id = [user_id, receiver_id].sort().join("-");
        io.to(conversation_id).emit("receive_message", newMessage);

        io.to(`user_${user_id}`).emit(
          "conversation_list",
          getUserConversations(user_id)
        );
        io.to(`user_${receiver_id}`).emit(
          "conversation_list",
          getUserConversations(receiver_id)
        );

        if (userSockets[receiver_id]) {
          markMessagesAsDelivered([newMessage.id]);
          io.to(conversation_id).emit("message_delivered", {
            messageId: newMessage.id,
          });
        }
      } catch (error) {
        socket.emit("error", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  socket.on("typing", ({ receiver_id, is_typing }) => {
    if (!receiver_id || typeof is_typing !== "boolean") {
      return socket.emit("error", { message: "Invalid typing data" });
    }

    const conversation_id = [user_id, receiver_id].sort().join("-");
    typingStatusMap.set(conversation_id, {
      user_id,
      is_typing,
      timestamp: Date.now(),
    });

    socket.to(conversation_id).emit("user_typing", {
      user_id,
      is_typing,
      conversation_id,
    });

    if (is_typing) {
      setTimeout(() => {
        const currentStatus = typingStatusMap.get(conversation_id);
        if (currentStatus?.user_id === user_id) {
          typingStatusMap.delete(conversation_id);
          socket.to(conversation_id).emit("user_typing", {
            user_id,
            is_typing: false,
            conversation_id,
          });
        }
      }, 3000);
    }
  });

  socket.on("mark_read", ({ messageIds, receiver_id }) => {
    if (!messageIds?.length) return;

    try {
      markMessagesAsRead(messageIds, user_id);
      const conversation_id = [user_id, receiver_id].sort().join("-");
      io.to(conversation_id).emit("messages_read", { messageIds });
      socket.emit(
        "conversation_metadata",
        getConversationMetadata(conversation_id, user_id)
      );
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  socket.on("get_unread_counts", () => {
    try {
      socket.emit("unread_count_total", getUnreadCount(user_id));
      getUserConversations(user_id).forEach((convo) => {
        socket.emit("conversation_unread_count", {
          conversation_id: convo.conversation_id,
          count: getUnreadCount(user_id, convo.conversation_id),
        });
      });
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  socket.on("disconnect", () => {
    userPresence[user_id] = false;
    delete userSockets[user_id];
    io.emit("presence_update", { user_id, online: false });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
