import express from "express";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { createServer } from "http";

// TypeScript Interface for Message
interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  date: string;
}

// Initialize Express and create an HTTP server
const app = express();
const server = createServer(app);
const io = new SocketIOServer(server);

const PORT = 3000;
const DB_FILE = path.join(__dirname, "../db/cpx_chat.json");

// Initialize the "DB" (JSON file) if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

// Utility functions to interact with the JSON "database"
const readMessages = (): Message[] => {
  const data = fs.readFileSync(DB_FILE, "utf-8");
  return JSON.parse(data);
};
const writeMessages = (messages: Message[]): void => {
  fs.writeFileSync(DB_FILE, JSON.stringify(messages, null, 2));
};
const getConversation = (sender_id: string, receiver_id: string): Message[] => {
  const messages = readMessages();
  return messages
    .filter(
      (msg) =>
        (msg.sender_id === sender_id && msg.receiver_id === receiver_id) ||
        (msg.sender_id === receiver_id && msg.receiver_id === sender_id)
    )
    .slice(-50); // Limit to last 50 messages
};
const storeMessage = (message: Message): void => {
  let messages = readMessages();
  messages.push(message);

  // Keep the last 50 messages between sender and receiver
  const filteredMessages = messages.filter(
    (msg) =>
      (msg.sender_id === message.sender_id &&
        msg.receiver_id === message.receiver_id) ||
      (msg.sender_id === message.receiver_id &&
        msg.receiver_id === message.sender_id)
  );

  if (filteredMessages.length > 50) {
    messages = messages.filter(
      (msg) =>
        !filteredMessages.includes(msg) ||
        filteredMessages.indexOf(msg) >= filteredMessages.length - 50
    );
  }

  writeMessages(messages);
};
const getUserConversations = (userId: string): Message[] => {
  const messages = readMessages();
  const uniqueConversations = new Map<string, Message>(); // Map to store the most recent conversation per user

  messages.forEach((msg) => {
    // Determine the other participant in the conversation
    const otherUserId =
      msg.sender_id === userId ? msg.receiver_id : msg.sender_id;

    // Always overwrite to keep the most recent message for this user
    uniqueConversations.set(otherUserId, msg);
  });

  // Return the values from the map, which will be the most recent messages per unique conversation
  return Array.from(uniqueConversations.values());
};

// Serve static files (HTML/Client-side JS)
app.use(express.static(path.join(__dirname, "../public")));

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  socket.on("join_chat", ({ sender_id, receiver_id }) => {
    console.log(`${sender_id} joined chat with ${receiver_id}`);

    // Send chat history between these two users
    const conversation = getConversation(sender_id, receiver_id);
    socket.emit("chat_history", conversation);
  }); // Listen for a user joining a chat
  socket.on("get_conversations", (user_id: string) => {
    const conversationList = getUserConversations(user_id);
    socket.emit("conversation_list", conversationList);
  }); // Retrieve user conversation
  socket.on("send_message", ({ sender_id, receiver_id, message }) => {
    const newMessage: Message = {
      id: uuidv4(),
      sender_id,
      receiver_id,
      message,
      date: new Date().toISOString(),
    };

    // Store the message in the JSON "database"
    storeMessage(newMessage);

    // Emit the message to both sender and receiver
    io.emit("receive_message", newMessage);
  }); // Handle message sending
  socket.on("typing", ({ sender_id, receiver_id, is_typing }) => {
    // Notify the receiver that the sender is typing
    io.emit("user_typing", { sender_id, receiver_id, is_typing });
  }); // Handle typing indicator

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

// Start the server
app.get('/home', (req, res) => {
  res.status(200).json('Welcome, your app is working well');
})

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
