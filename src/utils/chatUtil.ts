import fs from "fs";
import path from "path";
import { Message } from "../types";

export const DB_FILE = path.join(__dirname, "./../../db/cpx_chat.json");
export const readMessages = (): Message[] => {
  const data = fs.readFileSync(DB_FILE, "utf-8");
  return JSON.parse(data);
};
export const writeMessages = (messages: Message[]): void => {
  fs.writeFileSync(DB_FILE, JSON.stringify(messages, null, 2));
};
export const getConversation = (
  sender_id: string,
  receiver_id: string
): Message[] => {
  const messages = readMessages();
  return messages
    .filter(
      (msg) =>
        (msg.sender_id === sender_id && msg.receiver_id === receiver_id) ||
        (msg.sender_id === receiver_id && msg.receiver_id === sender_id)
    )
    .slice(-50); // Limit to last 50 messages
};
export const storeMessage = (message: Message): void => {
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
export const getUserConversations = (userId: string): Message[] => {
  const messages = readMessages();
  const userMessages = messages.filter(
    (msg) => msg.sender_id === userId || msg.receiver_id === userId
  );
  const uniqueConversations = new Map<string, Message>();

  userMessages.forEach((msg) => {
    const otherUserId =
      msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
    uniqueConversations.set(otherUserId, msg);
  });

  return Array.from(uniqueConversations.values());
};
