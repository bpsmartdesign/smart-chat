import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import {
  writeMessage,
  getConversation,
  getUserConversations,
} from "./utils/chatUtil";

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server);

const PORT = 3000;

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  /**
   * 1. Rejoindre une conversation
   */
  socket.on("join_chat", ({ sender_id, receiver_id }) => {
    try {
      if (!sender_id || !receiver_id) {
        throw new Error("Sender or receiver ID is missing.");
      }

      const conversation_id = [sender_id, receiver_id].sort().join("-");
      socket.join(conversation_id);

      const conversation = getConversation(sender_id, receiver_id);
      socket.emit("chat_history", conversation);
    } catch (error: any) {
      socket.emit("error", { message: error.message });
    }
  });

  /**
   * 2. Récupérer les conversations d’un utilisateur
   */
  socket.on("get_conversations", (user_id) => {
    try {
      if (!user_id) {
        throw new Error("User ID is missing.");
      }

      const conversations = getUserConversations(user_id);
      socket.emit("conversation_list", conversations);
    } catch (error: any) {
      socket.emit("error", { message: error.message });
    }
  });

  /**
   * 3. Envoyer un message
   */
  socket.on(
    "send_message",
    ({ sender_id, receiver_id, message, traveling_date }) => {
      try {
        if (!sender_id || !receiver_id || !message) {
          throw new Error("Invalid data provided.");
        }

        const conversation_id = [sender_id, receiver_id].sort().join("-");
        const newMessage = {
          sender_id,
          receiver_id,
          message,
          traveling_date,
        };

        // Enregistrer le message
        writeMessage(newMessage);

        // Envoyer le message aux participants
        io.to(conversation_id).emit("receive_message", newMessage);
      } catch (error: any) {
        socket.emit("error", { message: error.message });
      }
    }
  );

  /**
   * 4. Indicateur "typing"
   */
  socket.on("typing", ({ sender_id, receiver_id, is_typing }) => {
    try {
      if (!sender_id || !receiver_id) {
        throw new Error("Sender or receiver ID is missing.");
      }

      const conversation_id = [sender_id, receiver_id].sort().join("-");

      socket.to(conversation_id).emit("user_typing", {
        sender_id,
        receiver_id,
        is_typing,
      });
    } catch (error: any) {
      socket.emit("error", { message: error.message });
    }
  });

  /**
   * 5. Déconnexion d’un utilisateur
   */
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Démarrer le serveur
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
