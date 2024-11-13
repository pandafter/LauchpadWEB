class LaunchpadEmulator {
  constructor() {
    this.midiInput = null;
    this.midiOutput = null;
    this.pads = new Map();
    this.selectedPad = null;
    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    this.activeAudioSources = new Map();

    this.keyToPadMap = {
      q: "0-0",
      w: "0-1",
      e: "0-2",
      r: "0-3",
      t: "0-4",
      y: "0-5",
      u: "0-6",
      i: "0-7",

      a: "1-0",
      s: "1-1",
      d: "1-2",
      f: "1-3",
      g: "1-4",
      h: "1-5",
      j: "1-6",
      k: "1-7",

      z: "2-0",
      x: "2-1",
      c: "2-2",
      v: "2-3",
      b: "2-4",
      n: "2-5",
      m: "2-6",
      ",": "2-7",

      1: "7-5",
      2: "7-6",
      3: "7-7",
      4: "6-5",
      5: "6-6",
      6: "6-7",
      7: "5-5",
      8: "5-6",
      9: "5-7",
    };

    this.init();
  }

  init() {
    this.createGrid();
    this.setupEventListeners();
    this.setupMIDI();
    this.setupContextMenu();
  }

  createGrid() {
    const grid = document.getElementById("launchpadGrid");

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const pad = document.createElement("div");
        pad.className = "pad";
        pad.id = `${row}-${col}`; // Asignar ID basado en la posición
        pad.style.backgroundColor = "#333";

        const statusIcon = document.createElement("div");
        statusIcon.className = "pad-status";
        pad.appendChild(statusIcon);

        const padId = `${row}-${col}`;
        this.pads.set(padId, {
          element: pad,
          color: "#333",
          audioBuffer: null,
          isPlaying: false,
          statusIcon,
          imageBuffer: null,
          hasImage: false,
        });

        pad.addEventListener("click", () => this.handlePadClick(padId));
        pad.addEventListener("contextmenu", (e) =>
          this.showContextMenu(e, padId)
        );
        grid.appendChild(pad);
      }
    }
  }

  setupContextMenu() {
    document.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("click", () => {
      const menu = document.querySelector(".context-menu");
      if (menu) menu.remove();
    });
  }

  showContextMenu(event, padId) {
    event.preventDefault();

    const existingMenu = document.querySelector(".context-menu");
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement("div");
    menu.className = "context-menu";

    // Crear el menú con sus items primero
    const pad = this.pads.get(padId);
    const items = [
      { text: "Cargar Audio", action: () => this.loadAudioFile(padId) },
      { text: "Cambiar Color", action: () => this.showColorPicker(padId) },
      { text: "Cambiar Imagen", action: () => this.loadImageFile(padId) },
    ];

    // Si hay un sonido cargado, mostramos su información
    if (pad.soundInfo) {
      items.unshift({
        text: `Sonido: ${pad.soundInfo.name}`,
        action: () => {},
        className: "info",
      });
    }

    // Agregar opción de eliminar audio solo si hay un audio cargado
    if (pad.audioBuffer) {
      items.push({
        text: "Eliminar Audio",
        action: () => this.removeAudio(padId),
        className: "danger text-danger",
      });
    }

    // Agregar opción de eliminar imagen si hay una imagen
    if (pad.hasImage) {
      items.push({
        text: "Eliminar Imagen",
        action: () => this.removeImage(padId),
        className: "danger text-danger",
      });
    }

    items.forEach((item) => {
      const menuItem = document.createElement("div");
      menuItem.className =
        "context-menu-item" + (item.className ? " " + item.className : "");
      menuItem.textContent = item.text;
      menuItem.onclick = () => {
        item.action();
        menu.remove();
      };
      menu.appendChild(menuItem);
    });

    // Agregar el menú al DOM temporalmente para obtener sus dimensiones
    document.body.appendChild(menu);

    // Obtener las dimensiones del menú y la ventana
    const menuRect = menu.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Calcular la posición óptima
    let xPos = event.clientX;
    let yPos = event.clientY;

    // Ajustar horizontalmente si el menú se sale de la ventana
    if (xPos + menuRect.width > windowWidth) {
      xPos = windowWidth - menuRect.width - 10; // 10px de margen
    }

    // Ajustar verticalmente si el menú se sale de la ventana
    if (yPos + menuRect.height > windowHeight) {
      yPos = windowHeight - menuRect.height - 10; // 10px de margen
    }

    // Asegurar que el menú no aparezca fuera de la pantalla por la izquierda o arriba
    xPos = Math.max(10, xPos);
    yPos = Math.max(10, yPos);

    // Aplicar la posición final
    menu.style.left = `${xPos}px`;
    menu.style.top = `${yPos}px`;
  }
  showColorPicker(padId) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const modal = document.createElement("div");
    modal.className = "color-picker-modal";

    const colorPicker = document.createElement("input");
    colorPicker.type = "color";
    colorPicker.value = this.pads.get(padId).color;

    const applyButton = document.createElement("button");
    const resetButton = document.createElement("button");
    applyButton.textContent = "Aplicar";
    applyButton.onclick = () => {
      this.setPadColor(padId, colorPicker.value);
      overlay.remove();
    };

    resetButton.textContent = "Reiniciar";
    resetButton.onclick = () => {
      this.setPadColor(padId, "#333");
      overlay.remove();
    };

    modal.appendChild(colorPicker);
    modal.appendChild(applyButton);
    modal.appendChild(resetButton);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  async setupMIDI() {
    try {
      if (navigator.requestMIDIAccess) {
        const midiAccess = await navigator.requestMIDIAccess();
        document.getElementById("connectMIDI").addEventListener("click", () => {
          this.connectToLaunchpad(midiAccess);
        });
      }
    } catch (error) {
      console.error("Error al acceder a MIDI:", error);
      document.getElementById("midiStatus").textContent =
        "Error: MIDI no soportado";
    }
  }

  connectToLaunchpad(midiAccess) {
    for (const input of midiAccess.inputs.values()) {
      if (input.name.includes("Launchpad")) {
        this.midiInput = input;
        this.midiInput.onmidimessage = (message) =>
          this.handleMIDIMessage(message);
        document.getElementById("midiStatus").textContent =
          "Estado MIDI: Conectado a " + input.name;
        break;
      }
    }

    for (const output of midiAccess.outputs.values()) {
      if (output.name.includes("Launchpad")) {
        this.midiOutput = output;
        break;
      }
    }
  }

  handleMIDIMessage(message) {
    const [status, note, velocity] = message.data;

    if (status === 144) {
      // Note On
      const row = Math.floor(note / 16);
      const col = note % 16;
      const padId = `${row}-${col}`;

      if (this.pads.has(padId)) {
        this.triggerPad(padId);
      }
    }
  }

  setupEventListeners() {
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        this.stopAllAudio();
      }

      const padId = this.keyToPadMap[e.key.toLocaleLowerCase()];
      if (padId) {
        e.preventDefault();
        this.triggerPad(padId);
      }
    });
  }

  handlePadClick(padId) {
    this.selectedPad = padId;
    this.triggerPad(padId);
  }

  triggerPad(padId) {
    const pad = this.pads.get(padId);

    if (pad.audioBuffer) {
      if (pad.isPlaying) {
        this.stopAudio(padId);
      } else {
        this.playAudio(padId);
      }
    }

    const originalColor = pad.color;
    pad.element.style.backgroundColor = "#fff";
    setTimeout(() => {
      pad.element.style.backgroundColor = originalColor;
    }, 100);
  }

  removeAudio(padId) {
    const pad = this.pads.get(padId);

    // Detener el audio si está sonando
    if (pad.isPlaying) {
      this.stopAudio(padId);
    }

    // Limpiar el buffer y resetear el estado
    pad.audioBuffer = null;
    pad.element.style.border = "2px solid #333";
    pad.statusIcon.textContent = "";
  }

  removeImage(padId) {
    const padElement = document.getElementById(padId);
    const pad = this.pads.get(padId);

    // Remove the image element
    const imageElement = padElement.querySelector("img.pad-image");
    if (imageElement) {
      // Revoke the object URL to free up memory
      if (pad.imageBuffer) {
        URL.revokeObjectURL(pad.imageBuffer);
      }

      imageElement.remove();

      // Reset pad state
      pad.hasImage = false;
      pad.imageBuffer = null;
    }
  }

  async loadAudioFile(padId) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*";

    input.onchange = async (e) => {
      const file = e.target.files[0];
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      const pad = this.pads.get(padId);
      pad.audioBuffer = audioBuffer;
      pad.element.style.border = "2px solid #4CAF50";
    };

    input.click();
  }

  async loadImageFile(padId) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async (event) => {
      const file = event.target.files[0];

      if (file) {
        const imageUrl = URL.createObjectURL(file);
        const padElement = document.getElementById(padId);
        const pad = this.pads.get(padId);

        if (padElement) {
          let imageElement = padElement.querySelector("img");
          if (!imageElement) {
            imageElement = document.createElement("img");
            padElement.appendChild(imageElement);
          }
          imageElement.src = imageUrl;
          imageElement.style.width = "100%";
          imageElement.style.height = "100%";
          imageElement.classList.add("pad-image"); // Add class for easier selection

          // Update pad state
          pad.hasImage = true;
          pad.imageBuffer = imageUrl;
        }
      }
    };

    input.click();
  }

  setPadColor(padId, color) {
    const pad = this.pads.get(padId);
    pad.color = color;
    pad.element.style.backgroundColor = color;

    if (this.midiOutput) {
      const [row, col] = padId.split("-").map(Number);
      const note = row * 16 + col;
      const [r, g, b] = this.hexToRgb(color);
      const velocity = Math.floor((((r + g + b) / 3) * 127) / 255);
      this.midiOutput.send([144, note, velocity]);
    }
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16),
        ]
      : [0, 0, 0];
  }

  playAudio(padId) {
    const pad = this.pads.get(padId);
    if (pad.isPlaying) {
      this.stopAudio(padId);
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = pad.audioBuffer;
    source.connect(this.audioContext.destination);
    source.start();

    pad.isPlaying = true;
    pad.statusIcon.textContent = "⏸";

    source.onended = () => {
      pad.isPlaying = false;
      pad.statusIcon.textContent = "";
      this.activeAudioSources.delete(padId);
    };

    this.activeAudioSources.set(padId, source);
  }

  stopAudio(padId) {
    const source = this.activeAudioSources.get(padId);
    const pad = this.pads.get(padId);

    if (source) {
      source.stop();
      this.activeAudioSources.delete(padId);
    }

    pad.isPlaying = false;
    pad.statusIcon.textContent = "⏸";
  }

  stopAllAudio() {
    for (const [padId] of this.activeAudioSources) {
      this.stopAudio(padId);
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new LaunchpadEmulator();
});

// Animación en espiral
function spiralAnimation() {
  const gridSize = 8; // Tamaño de la cuadrícula
  const animationColor = "#4caf50"; // Color para la animación
  const originalColor = "#333"; // Color original
  const delay = 100; // Tiempo en ms entre cambios de cada pad
  let spiralOrder = [];

  // Calcular el orden en espiral de los pads
  let left = 0,
    right = gridSize - 1,
    top = 0,
    bottom = gridSize - 1;
  while (left <= right && top <= bottom) {
    for (let i = left; i <= right; i++) spiralOrder.push(`${top}-${i}`);
    top++;
    for (let i = top; i <= bottom; i++) spiralOrder.push(`${i}-${right}`);
    right--;
    for (let i = right; i >= left; i--) spiralOrder.push(`${bottom}-${i}`);
    bottom--;
    for (let i = bottom; i >= top; i--) spiralOrder.push(`${i}-${left}`);
    left++;
  }

  // Aplicar la animación en espiral
  spiralOrder.forEach((padId, index) => {
    setTimeout(() => {
      const pad = document.getElementById(padId);
      if (pad) {
        pad.style.backgroundColor = animationColor;
        setTimeout(() => {
          pad.style.backgroundColor = originalColor;
        }, delay * 2); // Apagar después de un tiempo
      }
    }, index * delay);
  });
}

// Llamar a la animación al cargar la página
window.onload = function () {
  spiralAnimation();
};
