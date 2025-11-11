const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path"); // <-- AÑADE ESTA LÍNEA

const app = express();
app.use(cors());

// --- LÍNEA CLAVE ---
// Sirve todos los archivos que estén en la carpeta "public"
app.use(express.static(path.join(__dirname, "public")));
// --------------------

const server = http.createServer(app);
const io = new Server(server, {
  /* ... tu config de cors ... */
});
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
