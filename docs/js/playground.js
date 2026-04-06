import {
  TooManyDiceRoom,
  TmdPlayer,
  CheckboxForm,
  TextForm,
  PickerForm,
  MultiSelectForm,
  SliderForm,
  DpadForm,
} from "https://esm.sh/too-many-dice@0.1.7";

// ── State ──
let room = null;
let callbackHandle = null;

// ── Console ──
const consoleOutput = document.getElementById("console-output");

function log(message, type = "info") {
  const line = document.createElement("div");
  line.className = `console-line console-${type}`;
  const ts = new Date().toLocaleTimeString();
  const msgEl = document.createElement("span");
  msgEl.className = "console-msg";
  msgEl.textContent = message;
  line.innerHTML = `<span class="console-time">${ts}</span> `;
  line.appendChild(msgEl);
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function logJSON(data, type = "result") {
  const line = document.createElement("div");
  line.className = `console-line console-${type}`;
  const ts = new Date().toLocaleTimeString();
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(data, null, 2);
  line.innerHTML = `<span class="console-time">${ts}</span> `;
  line.appendChild(pre);
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

document.getElementById("btn-clear-console").addEventListener("click", () => {
  consoleOutput.innerHTML = "";
});

// ── Section toggling ──
document.querySelectorAll("[data-toggle]").forEach((header) => {
  header.addEventListener("click", () => {
    header.closest(".section-card").classList.toggle("collapsed");
  });
});

// ── Mobile hamburger ──
const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");
hamburger?.addEventListener("click", () => navLinks.classList.toggle("open"));

// ── Dice row helpers ──
const DIE_TYPES = ["d4", "d6", "d8", "d10", "d12", "d20"];

function createDiceRow(container) {
  const row = document.createElement("div");
  row.className = "dice-row";
  row.innerHTML = `
    <select class="die-type">
      ${DIE_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("")}
    </select>
    <input type="text" class="die-id" placeholder="ID (optional)">
    <button class="remove-btn" title="Remove">&times;</button>
  `;
  row.querySelector(".remove-btn").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

function getDiceConfig(container) {
  return Array.from(container.querySelectorAll(".dice-row")).map((row) => {
    const type = row.querySelector(".die-type").value;
    const id = row.querySelector(".die-id").value.trim();
    return id ? { id, type } : { type };
  });
}

// Init dice
document.getElementById("btn-add-init-die").addEventListener("click", () => {
  createDiceRow(document.getElementById("init-dice-rows"));
});

// Dice config section
document.getElementById("btn-add-die").addEventListener("click", () => {
  createDiceRow(document.getElementById("dice-rows"));
});

// ── Player dropdown sync ──
function updatePlayerDropdowns() {
  const players = room ? room.players : [];
  document.querySelectorAll(".player-select").forEach((select) => {
    const current = select.value;
    const firstOpt = select.querySelector("option");
    const defaultText = firstOpt ? firstOpt.textContent : "-- select --";
    select.innerHTML = `<option value="">${defaultText}</option>`;
    players.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.playerId;
      opt.textContent = `${p.name} (${p.playerId.slice(0, 8)}...)`;
      select.appendChild(opt);
    });
    if (current && players.some((p) => p.playerId === current)) {
      select.value = current;
    }
  });
  // Update player info
  const info = document.getElementById("player-info");
  if (room) {
    info.textContent = `Players connected: ${players.length}${room.playerLimit ? ` / ${room.playerLimit}` : ""}`;
  } else {
    info.textContent = "";
  }
}

function getSelectedPlayer(selectId) {
  const val = document.getElementById(selectId).value;
  if (!val || !room) return null;
  return room.players.find((p) => p.playerId === val) || null;
}

// ── Enable/disable sections ──
function setRoomSections(enabled) {
  const ids = [
    "section-dice",
    "section-roll",
    "section-control",
    "section-submit-form",
    "section-callback-form",
  ];
  ids.forEach((id) => {
    document.getElementById(id).classList.toggle("disabled", !enabled);
  });
  document.getElementById("btn-destroy-room").disabled = !enabled;
  document.getElementById("btn-create-room").disabled = enabled;
}

// ── Room Management ──
document.getElementById("btn-create-room").addEventListener("click", async () => {
  const host = document.getElementById("input-host").value.trim();
  const limitStr = document.getElementById("input-player-limit").value;
  const playerLimit = limitStr ? parseInt(limitStr, 10) : undefined;
  const diceConfig = getDiceConfig(document.getElementById("init-dice-rows"));

  log("Creating room...", "info");

  try {
    const opts = {
      callbacks: {
        onPlayerJoined: (player) => {
          log(`Player joined: ${player.name} (${player.playerId})`, "event");
          updatePlayerDropdowns();
        },
        onPlayerLeft: (player) => {
          log(`Player left: ${player.name} (${player.playerId})`, "event");
          updatePlayerDropdowns();
        },
        onResult: (results) => {
          log("Roll results:", "result");
          results.forEach((r) =>
            log(`  [${r.dieType}] "${r.diceId}" = ${r.value}`, "result")
          );
        },
        onFormSubmit: ({ formId, playerId, answers }) => {
          log(`Form submitted: ${formId} by ${playerId}`, "event");
          logJSON(answers);
        },
      },
    };
    if (playerLimit) opts.playerLimit = playerLimit;
    if (diceConfig.length > 0) opts.diceConfig = diceConfig;

    room = await TooManyDiceRoom.create(host || undefined, opts);

    log(`Room created! Code: ${room.roomCode}`, "success");
    document.getElementById("room-code-value").textContent = room.roomCode;
    document.getElementById("room-code-display").classList.add("visible");
    setRoomSections(true);
    updatePlayerDropdowns();
  } catch (err) {
    log(`Failed to create room: ${err.message}`, "error");
  }
});

document.getElementById("btn-destroy-room").addEventListener("click", async () => {
  if (!room) return;
  try {
    await room.destroy();
    log("Room destroyed.", "success");
  } catch (err) {
    log(`Error destroying room: ${err.message}`, "error");
  }
  room = null;
  callbackHandle = null;
  document.getElementById("room-code-display").classList.remove("visible");
  setRoomSections(false);
  updatePlayerDropdowns();
});

// ── Dice Config ──
document.getElementById("btn-update-dice").addEventListener("click", async () => {
  if (!room) return;
  const config = getDiceConfig(document.getElementById("dice-rows"));
  if (config.length === 0) {
    log("Add at least one die.", "error");
    return;
  }
  try {
    await room.setDice(config);
    log(`Dice updated: ${config.map((d) => d.type).join(", ")}`, "success");
  } catch (err) {
    log(`Error updating dice: ${err.message}`, "error");
  }
});

// ── Roll ──
document.getElementById("btn-roll").addEventListener("click", async () => {
  if (!room) return;
  const player = getSelectedPlayer("roll-player");
  log(`Rolling${player ? ` (player: ${player.name})` : ""}...`, "info");
  try {
    const results = await room.roll(player || undefined);
    log("Roll complete!", "success");
    results.forEach((r) =>
      log(`  [${r.dieType}] "${r.diceId}" = ${r.value}`, "result")
    );
  } catch (err) {
    log(`Roll failed: ${err.message}`, "error");
  }
});

document.getElementById("btn-wait-roll").addEventListener("click", async () => {
  if (!room) return;
  const player = getSelectedPlayer("roll-player");
  if (!player) {
    log("Select a player to wait for.", "error");
    return;
  }
  log(`Waiting for ${player.name} to roll...`, "info");
  try {
    const results = await room.waitForRoll(player);
    log("Roll received!", "success");
    results.forEach((r) =>
      log(`  [${r.dieType}] "${r.diceId}" = ${r.value}`, "result")
    );
  } catch (err) {
    log(`Wait for roll failed: ${err.message}`, "error");
  }
});

// ── Room Control ──
document.getElementById("btn-close-access").addEventListener("click", async () => {
  if (!room) return;
  try {
    await room.closeAccess();
    log("Room access closed.", "success");
  } catch (err) {
    log(`Error: ${err.message}`, "error");
  }
});

document.getElementById("btn-open-access").addEventListener("click", async () => {
  if (!room) return;
  try {
    await room.openAccess();
    log("Room access opened.", "success");
  } catch (err) {
    log(`Error: ${err.message}`, "error");
  }
});

document.getElementById("btn-disable-swipe").addEventListener("click", async () => {
  if (!room) return;
  try {
    await room.enableSwipeGestures(false);
    log("Swipe gestures disabled.", "success");
  } catch (err) {
    log(`Error: ${err.message}`, "error");
  }
});

document.getElementById("btn-enable-swipe").addEventListener("click", async () => {
  if (!room) return;
  try {
    await room.enableSwipeGestures(true);
    log("Swipe gestures enabled.", "success");
  } catch (err) {
    log(`Error: ${err.message}`, "error");
  }
});

// ── Field Builder ──
const FIELD_TYPES = ["Text", "Checkbox", "Picker", "MultiSelect", "Slider", "Dpad"];

function createFieldItem(container) {
  const item = document.createElement("div");
  item.className = "field-item";
  item.innerHTML = `
    <div class="field-item-header">
      <select class="field-type-select">
        ${FIELD_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("")}
      </select>
      <button class="remove-btn" title="Remove">&times;</button>
    </div>
    <div class="field-item-config">
      <div class="config-row">
        <label>ID</label>
        <input type="text" class="field-id" placeholder="e.g. name">
      </div>
      <div class="config-row">
        <label>Label</label>
        <input type="text" class="field-label" placeholder="e.g. Your Name">
      </div>
      <div class="config-row">
        <label>Required</label>
        <input type="checkbox" class="field-required">
      </div>
      <div class="config-row config-placeholder">
        <label>Placeholder</label>
        <input type="text" class="field-placeholder" placeholder="Placeholder text">
      </div>
      <div class="config-row config-options" style="display:none">
        <label>Options</label>
        <input type="text" class="field-options" placeholder="Comma separated">
      </div>
      <div class="config-row config-min" style="display:none">
        <label>Min</label>
        <input type="number" class="field-min" value="1">
      </div>
      <div class="config-row config-max" style="display:none">
        <label>Max</label>
        <input type="number" class="field-max" value="20">
      </div>
      <div class="config-row config-step" style="display:none">
        <label>Step</label>
        <input type="number" class="field-step" value="1">
      </div>
      <div class="config-row config-dpad" style="display:none">
        <label>Up</label>
        <select class="field-dpad-up">
          <option value="">default</option>
          <option value="enabled">enabled</option>
          <option value="disabled">disabled</option>
          <option value="hidden">hidden</option>
        </select>
      </div>
      <div class="config-row config-dpad" style="display:none">
        <label>Down</label>
        <select class="field-dpad-down">
          <option value="">default</option>
          <option value="enabled">enabled</option>
          <option value="disabled">disabled</option>
          <option value="hidden">hidden</option>
        </select>
      </div>
      <div class="config-row config-dpad" style="display:none">
        <label>Left</label>
        <select class="field-dpad-left">
          <option value="">default</option>
          <option value="enabled">enabled</option>
          <option value="disabled">disabled</option>
          <option value="hidden">hidden</option>
        </select>
      </div>
      <div class="config-row config-dpad" style="display:none">
        <label>Right</label>
        <select class="field-dpad-right">
          <option value="">default</option>
          <option value="enabled">enabled</option>
          <option value="disabled">disabled</option>
          <option value="hidden">hidden</option>
        </select>
      </div>
    </div>
  `;

  const typeSelect = item.querySelector(".field-type-select");
  const updateVisibility = () => {
    const t = typeSelect.value;
    item.querySelector(".config-placeholder").style.display = t === "Text" ? "flex" : "none";
    item.querySelector(".config-options").style.display =
      t === "Picker" || t === "MultiSelect" ? "flex" : "none";
    item.querySelector(".config-min").style.display = t === "Slider" ? "flex" : "none";
    item.querySelector(".config-max").style.display = t === "Slider" ? "flex" : "none";
    item.querySelector(".config-step").style.display = t === "Slider" ? "flex" : "none";
    item.querySelectorAll(".config-dpad").forEach((r) => (r.style.display = t === "Dpad" ? "flex" : "none"));
  };
  typeSelect.addEventListener("change", updateVisibility);
  updateVisibility();

  item.querySelector(".remove-btn").addEventListener("click", () => item.remove());
  container.appendChild(item);
}

function buildFormField(item) {
  const type = item.querySelector(".field-type-select").value;
  const id = item.querySelector(".field-id").value.trim() || "field";
  const label = item.querySelector(".field-label").value.trim() || "Label";
  const required = item.querySelector(".field-required").checked;

  switch (type) {
    case "Text": {
      const placeholder = item.querySelector(".field-placeholder").value.trim();
      const opts = {};
      if (required) opts.required = true;
      if (placeholder) opts.placeholder = placeholder;
      return new TextForm(id, label, Object.keys(opts).length ? opts : undefined);
    }
    case "Checkbox":
      return new CheckboxForm(id, label, required ? { required: true } : undefined);
    case "Picker": {
      const options = item
        .querySelector(".field-options")
        .value.split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return new PickerForm(id, label, options.length ? options : ["Option1"], required ? { required: true } : undefined);
    }
    case "MultiSelect": {
      const options = item
        .querySelector(".field-options")
        .value.split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return new MultiSelectForm(id, label, options.length ? options : ["Option1"], required ? { required: true } : undefined);
    }
    case "Slider": {
      const min = parseFloat(item.querySelector(".field-min").value) || 1;
      const max = parseFloat(item.querySelector(".field-max").value) || 20;
      const step = parseFloat(item.querySelector(".field-step").value) || 1;
      return new SliderForm(id, label, min, max, step, required ? { required: true } : undefined);
    }
    case "Dpad": {
      const opts = {};
      if (required) opts.required = true;
      const up = item.querySelector(".field-dpad-up")?.value;
      const down = item.querySelector(".field-dpad-down")?.value;
      const left = item.querySelector(".field-dpad-left")?.value;
      const right = item.querySelector(".field-dpad-right")?.value;
      if (up) opts.up = { visibility: up };
      if (down) opts.down = { visibility: down };
      if (left) opts.left = { visibility: left };
      if (right) opts.right = { visibility: right };
      return new DpadForm(id, label, Object.keys(opts).length ? opts : undefined);
    }
  }
}

// ── Submit Form Builder ──
document.getElementById("btn-sf-add-field").addEventListener("click", () => {
  createFieldItem(document.getElementById("sf-field-list"));
});

document.getElementById("btn-sf-send").addEventListener("click", async () => {
  if (!room) return;
  const player = getSelectedPlayer("sf-player");
  if (!player) {
    log("Select a target player.", "error");
    return;
  }
  const formId = document.getElementById("sf-form-id").value.trim() || "form-1";
  const submitLabel = document.getElementById("sf-submit-label").value.trim();
  const fieldItems = document.getElementById("sf-field-list").querySelectorAll(".field-item");
  if (fieldItems.length === 0) {
    log("Add at least one field.", "error");
    return;
  }

  if (!submitLabel) {
    log("Submit label is required.", "error");
    return;
  }

  const fields = Array.from(fieldItems).map(buildFormField);
  const group = {
    formId,
    targetPlayer: player,
    fields,
    submitButton: { label: submitLabel },
  };

  try {
    await room.sendSubmitForms([group]);
    log(`Submit form "${formId}" sent to ${player.name}`, "success");
  } catch (err) {
    log(`Error sending form: ${err.message}`, "error");
  }
});

document.getElementById("btn-sf-clear").addEventListener("click", async () => {
  if (!room) return;
  try {
    await room.clearSubmitForms();
    log("Submit forms cleared.", "success");
  } catch (err) {
    log(`Error clearing forms: ${err.message}`, "error");
  }
});

// ── Set Form Errors ──
document.getElementById("btn-sfe-send").addEventListener("click", async () => {
  if (!room) return;
  const formId = document.getElementById("sfe-form-id").value.trim();
  const player = getSelectedPlayer("sfe-player");
  const errorsText = document.getElementById("sfe-errors").value.trim();
  if (!formId || !player || !errorsText) {
    log("Fill in form ID, player, and errors.", "error");
    return;
  }
  const errors = errorsText.split("\n").filter(Boolean);
  try {
    await room.setFormErrors(formId, player, errors);
    log(`Form errors sent for "${formId}"`, "success");
  } catch (err) {
    log(`Error: ${err.message}`, "error");
  }
});

// ── Callback Form Builder ──
document.getElementById("btn-cf-add-field").addEventListener("click", () => {
  createFieldItem(document.getElementById("cf-field-list"));
});

document.getElementById("btn-cf-add-button").addEventListener("click", () => {
  const list = document.getElementById("cf-button-list");
  const item = document.createElement("div");
  item.className = "button-item";
  item.innerHTML = `
    <input type="text" class="cb-label" placeholder="Button label">
    <button class="remove-btn" title="Remove">&times;</button>
  `;
  item.querySelector(".remove-btn").addEventListener("click", () => item.remove());
  list.appendChild(item);
});

document.getElementById("btn-cf-send").addEventListener("click", async () => {
  if (!room) return;
  const player = getSelectedPlayer("cf-player");
  if (!player) {
    log("Select a target player.", "error");
    return;
  }

  const fieldItems = document.getElementById("cf-field-list").querySelectorAll(".field-item");
  const fields = Array.from(fieldItems).map((item) => {
    const field = buildFormField(item);
    const fieldId = item.querySelector(".field-id").value.trim() || "field";
    return {
      field,
      onChange: (value) => {
        log(`[Callback] Field "${fieldId}" changed: ${JSON.stringify(value)}`, "event");
      },
    };
  });

  const buttonItems = document.getElementById("cf-button-list").querySelectorAll(".button-item");
  const buttons = Array.from(buttonItems).map((item) => {
    const label = item.querySelector(".cb-label").value.trim() || "Button";
    return {
      label,
      onClick: (playerId) => {
        log(`[Callback] Button "${label}" clicked by ${playerId}`, "event");
      },
    };
  });

  try {
    const opts = { targetPlayer: player, fields };
    if (buttons.length > 0) opts.buttons = buttons;
    callbackHandle = await room.sendCallbackForm(opts);
    log(`Callback form sent to ${player.name} (formId: ${callbackHandle.formId})`, "success");
    document.getElementById("btn-cf-clear").disabled = false;
  } catch (err) {
    log(`Error sending callback form: ${err.message}`, "error");
  }
});

document.getElementById("btn-cf-clear").addEventListener("click", async () => {
  if (!callbackHandle) return;
  try {
    await callbackHandle.clear();
    log("Callback form cleared.", "success");
    callbackHandle = null;
    document.getElementById("btn-cf-clear").disabled = true;
  } catch (err) {
    log(`Error clearing callback form: ${err.message}`, "error");
  }
});
