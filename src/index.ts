import { Message, User, UserShort } from "./../types.d";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server);

let users: UserShort[] = [];

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  socket.on("join", (userData: UserShort) => {
    users.push({ ...userData, id: socket.id });
    io.emit("users", users);
  });

  socket.on("sendMessage", (messageData: Message) => {
    io.emit("receiveMessage", messageData);
  });

  socket.on("disconnect", () => {
    users = users.filter((user) => user.id !== socket.id);
    io.emit("users", users);
    console.log("A user disconnected", socket.id);
  });
});

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
