import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { v4 as uuidv4 } from "uuid";
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
  /**
   * 1. Rejoindre une conversation
   */
  socket.on("join_chat", ({ sender_id, receiver_id }) => {
    try {
      const conversation_id = [sender_id, receiver_id].sort().join("-");
      socket.join(conversation_id);
      const conversation = getConversation(sender_id, receiver_id);
      socket.emit("chat_history", conversation);
    } catch (error) {
      console.error("Error in join_chat:", error);
      socket.emit("error", { message: "Failed to join chat." });
    }
  });

  /**
   * 2. Récupérer les conversations d’un utilisateur
   */
  socket.on("get_conversations", (user_id) => {
    try {
      const conversations = getUserConversations(user_id);
      socket.emit("conversation_list", conversations);
    } catch (error) {
      console.error("Error in get_conversations:", error);
      socket.emit("error", { message: "Failed to get conversations." });
    }
  });

  /**
   * 3. Envoyer un message
   */
  socket.on(
    "send_message",
    ({ sender_id, receiver_id, message, traveling_date }) => {
      try {
        const conversation_id = [sender_id, receiver_id].sort().join("-");
        const newMessage = {
          sender_id,
          receiver_id,
          message,
          traveling_date,
        };

        // Enregistrer le message dans la base
        writeMessage(newMessage);
        // Envoyer le message uniquement aux utilisateurs dans la room
        io.to(conversation_id).emit("receive_message", newMessage);
      } catch (error) {
        console.error("Error in send_message:", error);
        socket.emit("error", { message: "Failed to send message." });
      }
    }
  );

  /**
   * 4. Indicateur "typing"
   */
  socket.on("typing", ({ sender_id, receiver_id, is_typing }) => {
    try {
      const conversation_id = [sender_id, receiver_id].sort().join("-");

      socket.to(conversation_id).emit("user_typing", {
        sender_id,
        receiver_id,
        is_typing,
      });
    } catch (error) {
      console.error("Error in typing:", error);
      socket.emit("error", { message: "Failed to notify typing status." });
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
