const socket = io();

// Initialize the code editor
require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.0/min/vs" } });
require(["vs/editor/editor.main"], function () {
  const editor = monaco.editor.create(document.getElementById("editor"), {
    value: "// Write your Arduino code here...",
    language: "cpp",
    theme: "vs-dark",
  });

  // Compile button functionality
  document.getElementById("compile-btn").addEventListener("click", () => {
    const code = editor.getValue();
    socket.emit("compile", code);
  });

  // Upload button functionality
  document.getElementById("upload-btn").addEventListener("click", () => {
    const code = editor.getValue();
    const port = document.getElementById("port-select").value;
    const board = document.getElementById("board-select").value;
    if (!port || !board) {
      alert("Please select a port and a board!");
      return;
    }
    socket.emit("upload", { code, port, board });
  });

  // Populate ports dropdown
  socket.emit("listPorts");
  socket.on("ports", (ports) => {
    const portSelect = document.getElementById("port-select");
    portSelect.innerHTML = `<option value="">Select Port</option>`; // Reset options
    ports.forEach((port) => {
      const option = document.createElement("option");
      option.value = port.path;
      option.text = port.path;
      portSelect.appendChild(option);
    });
  });

  // Display output
  socket.on("output", (data) => {
    const terminal = document.getElementById("terminal-output");
    terminal.textContent += data + "\n";
    terminal.scrollTop = terminal.scrollHeight;
  });
});
