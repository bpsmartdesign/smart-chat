import express from "express";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { createServer } from "http";
import { Message, Notification } from "./types.d";
import {
  CHAT_DB,
  getConversation,
  getUserConversations,
  storeMessage,
} from "./utils/chatUtil";
import {
  NOTIF_DB,
  getUserNotifications,
  storeNotification,
} from "./utils/notificationUtil";

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server);

const PORT = 3000;

if (!fs.existsSync(CHAT_DB)) fs.writeFileSync(CHAT_DB, JSON.stringify([]));
if (!fs.existsSync(NOTIF_DB)) fs.writeFileSync(NOTIF_DB, JSON.stringify([]));

app.use(express.static(path.join(__dirname, "../public")));
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  // #region chat
  socket.on("join_chat", ({ sender_id, receiver_id }) => {
    const conversation = getConversation(sender_id, receiver_id);
    socket.emit("chat_history", conversation);
  });
  socket.on("get_conversations", (user_id: string) => {
    const conversationList = getUserConversations(user_id);
    socket.emit("conversation_list", conversationList);
  });
  socket.on(
    "send_message",
    ({ sender_id, receiver_id, message, traveling_date }) => {
      const newMessage: Message = {
        id: uuidv4(),
        sender_id,
        receiver_id,
        message,
        date: new Date().toISOString(),
        traveling_date,
      };

      storeMessage(newMessage);
      io.emit("receive_message", newMessage);
    }
  );
  socket.on("typing", ({ sender_id, receiver_id, is_typing }) => {
    io.emit("user_typing", { sender_id, receiver_id, is_typing });
  });
  //#endregion

  // #region notification
  socket.on("register_user", (userId: string) => {
    console.log(`Registering user to room: ${userId}`);
    socket.join(userId);
  });
  socket.on("get_notifications", (user_id: string) => {
    const notificationList = getUserNotifications(user_id);
    socket.emit("notification_list", notificationList);
  });
  socket.on("send_notification", ({ title, target_user_id, txt }) => {
    const newNotification: Notification = {
      id: uuidv4(),
      target: "new_msg",
      target_user_id,
      title,
      txt,
      date: new Date().toISOString(),
    };

    storeNotification(newNotification);
    io.to(target_user_id).emit("receive_notification", newNotification);
  });
  //#endregion

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

// Start the server
app.get("/home", (req, res) => {
  res.status(200).json("Welcome, your app is working well");
});
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
