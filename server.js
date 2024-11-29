const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { exec } = require("child_process");
const { SerialPort, ReadlineParser } = require("serialport");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let activePort = null;

io.on("connection", (socket) => {
  console.log("User connected");

  socket.on("listPorts", async () => {
    try {
      const ports = await SerialPort.list();
      socket.emit("ports", ports);
    } catch (err) {
      console.error("Error listing ports:", err);
      socket.emit("output", "Error listing ports.");
    }
  });

  socket.on("compile", (code) => {
    const filePath = "./sketch/sketch.ino";
    fs.writeFileSync(filePath, code);
    exec("arduino-cli compile --fqbn arduino:avr:uno ./sketch", (err, stdout, stderr) => {
      if (err) socket.emit("output", `Compile Error: ${stderr}`);
      else socket.emit("output", stdout);
    });
  });

  socket.on("upload", ({ code, port, board }) => {
    const filePath = "./sketch/sketch.ino";
    fs.writeFileSync(filePath, code);
    exec(`arduino-cli upload -p ${port} --fqbn ${board} ./sketch`, (err, stdout, stderr) => {
      if (err) socket.emit("output", `Upload Error: ${stderr}`);
      else socket.emit("output", stdout);
    });
  });

  socket.on("startSerial", ({ port, baudRate }) => {
    if (activePort) activePort.close();
    activePort = new SerialPort({ path: port, baudRate: parseInt(baudRate) });
    const parser = activePort.pipe(new ReadlineParser({ delimiter: "\r\n" }));

    parser.on("data", (data) => socket.emit("serialData", data));
    activePort.on("error", (err) => socket.emit("output", `Serial Error: ${err.message}`));
  });

  socket.on("stopSerial", () => {
    if (activePort) activePort.close();
    activePort = null;
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
    if (activePort) activePort.close();
    activePort = null;
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
