// Clase principal de la aplicación
class TacticalBoard {
  constructor() {
    this.canvasFondo = document.getElementById("canvasFondo");
    this.canvasDibujo = document.getElementById("canvasDibujo");
    this.canvasFichas = document.getElementById("canvasFichas");

    this.ctxFondo = this.canvasFondo.getContext("2d");
    this.ctxDibujo = this.canvasDibujo.getContext("2d");
    this.ctxFichas = this.canvasFichas.getContext("2d");

    this.mode = "select"; // 'select' o 'draw'
    this.players = [];
    this.ball = null;
    this.selectedPlayer = null;
    this.isDragging = false;
    this.dragOffset = null;
    this.drawMode = null;
    this.isDrawing = false;
    this.drawStart = null;
    this.drawings = [];

    // --- LÓGICA MULTIJUGADOR ---
    this.socket = io();

    this.init();
  }

  init() {
    this.setupCanvas();
    this.drawField();
    this.setupEventListeners(); // Configura los listeners locales
    this.setupSocketListeners(); // Configura los listeners del servidor
    this.setMode(this.mode, document.getElementById("modeSelect"));
    this.render();
  }

  setupCanvas() {
    const resize = () => {
      const container = this.canvasFondo.parentElement;
      const width = container.clientWidth;
      const height = container.clientHeight;

      [this.canvasFondo, this.canvasDibujo, this.canvasFichas].forEach(
        (canvas) => {
          canvas.width = width;
          canvas.height = height;
        }
      );

      this.drawField();
      this.redrawDrawings();
    };

    resize();
    window.addEventListener("resize", resize);
  }

  drawField() {
    // (Tu función drawField original va aquí, no necesita cambios)
    const ctx = this.ctxFondo;
    const width = this.canvasFondo.width;
    const height = this.canvasFondo.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#2d5a2d";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, width - 60, height - 60);
    ctx.beginPath();
    ctx.moveTo(width / 2, 30);
    ctx.lineTo(width / 2, height - 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 73, 0, Math.PI * 2);
    ctx.stroke();
    // ... (resto de tu código de dibujo del campo) ...
  }

  render() {
    this.ctxFichas.clearRect(
      0,
      0,
      this.canvasFichas.width,
      this.canvasFichas.height
    );

    // Dibujar jugadores
    this.players.forEach((player) => {
      this.ctxFichas.beginPath();
      this.ctxFichas.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
      this.ctxFichas.fillStyle = player.color;
      this.ctxFichas.fill();

      if (player === this.selectedPlayer) {
        this.ctxFichas.strokeStyle = "#ffeb3b";
        this.ctxFichas.lineWidth = 4;
      } else {
        this.ctxFichas.strokeStyle = "#fff";
        this.ctxFichas.lineWidth = 3;
      }
      this.ctxFichas.stroke();

      if (player.number) {
        this.ctxFichas.fillStyle = "#fff";
        this.ctxFichas.font = "bold 14px Arial";
        this.ctxFichas.textAlign = "center";
        this.ctxFichas.textBaseline = "middle";
        this.ctxFichas.fillText(player.number, player.x, player.y);
      }
    });

    // Dibujar pelota
    if (this.ball) {
      this.ctxFichas.beginPath();
      this.ctxFichas.arc(
        this.ball.x,
        this.ball.y,
        this.ball.radius,
        0,
        Math.PI * 2
      );
      this.ctxFichas.fillStyle = "#000";
      this.ctxFichas.fill();

      if (this.ball === this.selectedPlayer) {
        this.ctxFichas.strokeStyle = "#ffeb3b";
        this.ctxFichas.lineWidth = 4;
      } else {
        this.ctxFichas.strokeStyle = "#000";
        this.ctxFichas.lineWidth = 2;
      }
      this.ctxFichas.stroke();
    }

    requestAnimationFrame(() => this.render());
  }

  // --- Listeners Locales (Tus acciones) ---
  setupEventListeners() {
    // Modos
    document
      .getElementById("modeSelect")
      .addEventListener("click", (e) => this.setMode("select", e.target));
    document
      .getElementById("modeDraw")
      .addEventListener("click", (e) => this.setMode("draw", e.target));

    // Herramientas de dibujo
    document
      .getElementById("drawLine")
      .addEventListener("click", (e) => this.setDrawMode("line", e.target));
    document
      .getElementById("drawArrow")
      .addEventListener("click", (e) => this.setDrawMode("arrow", e.target));
    document
      .getElementById("drawFree")
      .addEventListener("click", (e) => this.setDrawMode("free", e.target));

    // Limpiar
    document.getElementById("clearDrawings").addEventListener("click", () => {
      this.clearDrawings(); // Limpia localmente
      this.socket.emit("limpiar-dibujos"); // Avisa al servidor
    });

    document.getElementById("clearAll").addEventListener("click", () => {
      // Pide al servidor que reinicie todo
      this.socket.emit("limpiar-pizarra-total");
    });

    // Eventos de mouse para mover
    this.canvasFichas.addEventListener("mousedown", (e) =>
      this.handleMouseDown(e)
    );
    this.canvasFichas.addEventListener("mousemove", (e) =>
      this.handleMouseMove(e)
    );
    this.canvasFichas.addEventListener("mouseup", (e) => this.handleMouseUp(e));
    this.canvasFichas.addEventListener("dblclick", (e) =>
      this.handleDoubleClick(e)
    );

    // Eventos de mouse para dibujar
    this.canvasDibujo.addEventListener("mousedown", (e) =>
      this.startDrawing(e)
    );
    this.canvasDibujo.addEventListener("mousemove", (e) => this.draw(e));
    this.canvasDibujo.addEventListener("mouseup", (e) => this.stopDrawing(e));
  }

  // --- Listeners del Servidor (Acciones de otros) ---
  setupSocketListeners() {
    // 1. Recibir el estado inicial al conectarse
    this.socket.on("estado-actual", (state) => {
      console.log("Recibido estado actual del servidor");
      this.players = state.players;
      this.ball = state.ball;
      this.drawings = state.drawings;
      this.redrawDrawings(); // Dibuja los dibujos recibidos
    });

    // 2. Alguien movió una ficha
    this.socket.on("alguien-movio-ficha", (data) => {
      let piece =
        data.id === "ball"
          ? this.ball
          : this.players.find((p) => p.id === data.id);

      if (piece) {
        piece.x = data.x;
        piece.y = data.y;
      }
    });

    // 3. Alguien hizo un dibujo
    this.socket.on("alguien-dibujo", (drawingData) => {
      this.drawings.push(drawingData);
      this.redrawDrawings(); // Redibuja todo con el nuevo trazo
    });

    // 4. Alguien limpió los dibujos
    this.socket.on("alguien-limpio-dibujos", () => {
      this.clearDrawings();
    });

    // 5. Alguien cambió un número
    this.socket.on("alguien-cambio-numero", (data) => {
      const player = this.players.find((p) => p.id === data.id);
      if (player) {
        player.number = data.number;
      }
    });
  }

  setMode(mode, btnElement) {
    this.mode = mode;
    document
      .querySelectorAll(".mode")
      .forEach((btn) => btn.classList.remove("active"));
    btnElement.classList.add("active");

    const drawTools = document.querySelector(".draw-tools");
    drawTools.style.display = mode === "draw" ? "block" : "none";

    this.canvasFichas.style.pointerEvents = mode === "select" ? "auto" : "none";
    this.canvasDibujo.style.pointerEvents = mode === "draw" ? "auto" : "none";
  }

  handleMouseDown(e) {
    if (this.mode !== "select") return;

    const rect = this.canvasFichas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let foundPlayer = null;

    if (
      this.ball &&
      this.isPointInCircle(x, y, this.ball.x, this.ball.y, this.ball.radius)
    ) {
      foundPlayer = this.ball;
    } else {
      for (let i = this.players.length - 1; i >= 0; i--) {
        const player = this.players[i];
        if (this.isPointInCircle(x, y, player.x, player.y, player.radius)) {
          foundPlayer = player;
          break;
        }
      }
    }

    this.selectedPlayer = foundPlayer;

    if (foundPlayer) {
      this.isDragging = true;
      this.dragOffset = {
        x: x - foundPlayer.x,
        y: y - foundPlayer.y,
      };
    }
  }

  handleMouseMove(e) {
    if (this.mode !== "select" || !this.isDragging || !this.selectedPlayer)
      return;

    const rect = this.canvasFichas.getBoundingClientRect();
    const x = e.clientX - rect.left - this.dragOffset.x;
    const y = e.clientY - rect.top - this.dragOffset.y;

    // Mover localmente (para feedback instantáneo)
    this.selectedPlayer.x = Math.max(
      35,
      Math.min(x, this.canvasFondo.width - 35)
    );
    this.selectedPlayer.y = Math.max(
      35,
      Math.min(y, this.canvasFondo.height - 35)
    );

    // *No* avisar al servidor en cada pixel. Eso es demasiado.
    // Lo haremos en el MouseUp.
  }

  handleMouseUp(e) {
    if (this.mode !== "select" || !this.isDragging) return;
    this.isDragging = false;

    // ¡AHORA SÍ! Avisa al servidor de la posición final
    if (this.selectedPlayer) {
      this.socket.emit("ficha-movida", {
        id: this.selectedPlayer.id,
        x: this.selectedPlayer.x,
        y: this.selectedPlayer.y,
      });
    }
  }

  handleDoubleClick(e) {
    if (
      this.mode !== "select" ||
      !this.selectedPlayer ||
      this.selectedPlayer.id === "ball"
    )
      return;

    const number = prompt("Número del jugador:");
    if (number) {
      this.selectedPlayer.number = number;
      // Avisar al servidor
      this.socket.emit("numero-cambiado", {
        id: this.selectedPlayer.id,
        number: number,
      });
    }
  }

  isPointInCircle(px, py, cx, cy, radius) {
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= radius * radius;
  }

  setDrawMode(mode, btnElement) {
    this.drawMode = mode;
    document
      .querySelectorAll(".tool")
      .forEach((btn) => btn.classList.remove("active"));
    btnElement.classList.add("active");
  }

  startDrawing(e) {
    if (!this.drawMode || this.mode !== "draw") return;

    this.isDrawing = true;
    const rect = this.canvasDibujo.getBoundingClientRect();
    this.drawStart = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    if (this.drawMode === "free") {
      this.currentPath = [this.drawStart];
    }
  }

  draw(e) {
    // (Esta función es igual a tu original, dibuja la previsualización)
    if (!this.isDrawing || !this.drawMode || this.mode !== "draw") return;
    const rect = this.canvasDibujo.getBoundingClientRect();
    const current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    this.redrawDrawings();
    this.ctxDibujo.strokeStyle = "#ffff00";
    this.ctxDibujo.lineWidth = 3;
    this.ctxDibujo.lineCap = "round";
    if (this.drawMode === "free") {
      this.currentPath.push(current);
      this.ctxDibujo.beginPath();
      this.ctxDibujo.moveTo(this.currentPath[0].x, this.currentPath[0].y);
      for (let i = 1; i < this.currentPath.length; i++) {
        this.ctxDibujo.lineTo(this.currentPath[i].x, this.currentPath[i].y);
      }
      this.ctxDibujo.stroke();
    } else if (this.drawMode === "line" || this.drawMode === "arrow") {
      // ... (resto de tu código de dibujo de línea/flecha) ...
    }
  }

  stopDrawing(e) {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    const rect = this.canvasDibujo.getBoundingClientRect();
    const endPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    const drawing = {
      type: this.drawMode,
      start: this.drawStart,
      end: this.drawMode !== "free" ? endPos : null,
      data: this.drawMode === "free" ? [...this.currentPath] : null,
    };

    // Añadir localmente
    this.drawings.push(drawing);
    // Avisar al servidor
    this.socket.emit("dibujo-nuevo", drawing);

    this.redrawDrawings();
  }

  redrawDrawings() {
    // (Esta función es igual a tu original, redibuja `this.drawings`)
    this.ctxDibujo.clearRect(
      0,
      0,
      this.canvasDibujo.width,
      this.canvasDibujo.height
    );
    this.ctxDibujo.strokeStyle = "#ffff00";
    this.ctxDibujo.lineWidth = 3;
    this.ctxDibujo.lineCap = "round";
    this.drawings.forEach((drawing) => {
      // ... (resto de tu lógica de redibujado) ...
    });
  }

  clearDrawings() {
    this.drawings = [];
    this.ctxDibujo.clearRect(
      0,
      0,
      this.canvasDibujo.width,
      this.canvasDibujo.height
    );
  }
}

// Inicializar la aplicación
document.addEventListener("DOMContentLoaded", () => {
  new TacticalBoard();
});
