// Server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { exec } = require("child_process");
const { SerialPort, ReadlineParser } = require("serialport");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let activePort = null; // Track the active serial port
let activeParser = null;

io.on("connection", (socket) => {
  console.log("A user connected");

  /**
   * List available serial ports
   */
  socket.on("listPorts", async () => {
    try {
      const ports = await SerialPort.list();
      socket.emit("ports", ports);
    } catch (error) {
      console.error("Error listing ports:", error);
      socket.emit("output", "Error listing ports.");
    }
  });

  /**
   * Compile Arduino code
   */
  socket.on("compile", (code) => {
    const filePath = "./sketch/sketch.ino";
    require("fs").writeFileSync(filePath, code);

    exec("arduino-cli compile --fqbn arduino:avr:uno ./sketch", (err, stdout, stderr) => {
      if (err) {
        socket.emit("output", `Error: ${stderr}`);
      } else {
        socket.emit("output", stdout);
      }
    });
  });

  /**
   * Upload the code to Arduino
   */
  socket.on("upload", ({ code, port, board }) => {
    const filePath = "./sketch/sketch.ino";
    require("fs").writeFileSync(filePath, code);

    exec(`arduino-cli upload -p ${port} --fqbn ${board} ./sketch`, (err, stdout, stderr) => {
      if (err) {
        socket.emit("output", `Error: ${stderr}`);
      } else {
        socket.emit("output", stdout);
      }
    });
  });

  /**
   * Start Serial Monitor
   */
  socket.on("startSerial", ({ port, baudRate }) => {
    if (!port) {
      socket.emit("output", "Error: No port selected.");
      return;
    }

    if (activePort) {
      socket.emit("output", "Serial Monitor is already connected.");
      return;
    }

    try {
      activePort = new SerialPort({ path: port, baudRate: parseInt(baudRate) });
      activeParser = activePort.pipe(new ReadlineParser({ delimiter: "\r\n" }));

      activePort.on("open", () => {
        console.log(`Serial Port ${port} opened at ${baudRate} baud.`);
        socket.emit("output", `Serial Monitor connected at ${baudRate} baud.\n`);
      });

      activeParser.on("data", (data) => {
        console.log("Serial Data:", data);
        socket.emit("serialData", data);
      });

      activePort.on("error", (err) => {
        console.error("Serial Port Error:", err.message);
        socket.emit("output", `Serial Port Error: ${err.message}`);
        stopSerialMonitor(socket);
      });

      activePort.on("close", () => {
        console.log("Serial Port closed.");
        socket.emit("output", "Serial Monitor disconnected.");
      });
    } catch (error) {
      console.error("Error opening Serial Port:", error.message);
      socket.emit("output", `Error opening Serial Port: ${error.message}`);
    }
  });

  /**
   * Stop Serial Monitor
   */
  socket.on("stopSerial", () => {
    stopSerialMonitor(socket);
  });

  /**
   * Handle disconnection
   */
  socket.on("disconnect", () => {
    console.log("A user disconnected");
    stopSerialMonitor(socket);
  });

  /**
   * Stop Serial Monitor Helper
   */
  const stopSerialMonitor = (socket) => {
    if (activePort) {
      try {
        activePort.close((err) => {
          if (err) {
            console.error("Error closing Serial Port:", err.message);
            socket.emit("output", `Error closing Serial Port: ${err.message}`);
          } else {
            console.log("Serial Port closed.");
            socket.emit("output", "Serial Monitor disconnected.");
          }
        });
      } catch (error) {
        console.error("Error during Serial Port cleanup:", error.message);
      } finally {
        activePort = null;
        activeParser = null;
      }
    } else {
      socket.emit("output", "No Serial Monitor to disconnect.");
    }
  };
});

// Start the server
server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
