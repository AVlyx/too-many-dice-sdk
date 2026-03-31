# too-many-dice SDK

TypeScript SDK for integrating TooManyDices into your online game. Control a shared dice-rolling room from your game server: manage players, configure dice, trigger rolls, and push interactive UI forms to players.

## Installation

```bash
npm install too-many-dice
```

## Quick Start

```ts
import { TooManyDicesRoom } from "too-many-dice";

// 1. Create a room on your game server
const room = await TooManyDicesRoom.create("myapp.partykit.dev", {
  playerLimit: 4,
  diceConfig: [{ type: "d6" }, { type: "d6" }],
  callbacks: {
    onPlayerJoined: (player) => console.log(`${player.name} joined`),
    onPlayerLeft: (player) => console.log(`${player.name} left`),
    onResult: (results) => console.log("Roll results:", results),
  },
});

console.log("Room code:", room.roomCode); // Share this with players

// 2. Players open the TooManyDices app and enter the room code.

// 3. Trigger a roll once players are connected
const results = await room.roll();
console.log(results); // [{ diceId: "0", value: 4, dieType: "d6" }, { diceId: "1", value: 2, dieType: "d6" }]

// 4. Clean up
await room.destroy();
```

---

## Concepts

### Room Lifecycle

```
create() → share roomCode → players join via app → orchestrate gameplay → destroy()
```

Once created, the room is open for players to join using the `roomCode`. Use `closeAccess()` to stop new players from joining while the game is in progress, and `openAccess()` to re-open it.

---

## API Reference

### `TooManyDicesRoom`

#### `TooManyDicesRoom.create(host, options?)`

Creates a new room. Returns a `TooManyDicesRoom` with full owner privileges.

```ts
const room = await TooManyDicesRoom.create("myapp.partykit.dev", {
  playerLimit: 4,
  diceConfig: [{ id: "atk", type: "d20" }],
  callbacks: { onPlayerJoined, onPlayerLeft, onResult, onFormSubmit },
});
```

**Options (`CreateRoomOptions`):**

| Field                  | Type                    | Description                                                    |
| ---------------------- | ----------------------- | -------------------------------------------------------------- |
| `playerLimit`          | `number`                | Max number of players allowed to join                          |
| `diceConfig`           | `DiceConfig[]`          | Initial dice configuration                                     |
| `swipeGesturesEnabled` | `boolean`               | Allow players to swipe-throw individual dice (default: `true`) |
| `callbacks`            | `TooManyDicesCallbacks` | Event handlers (see [Callbacks](#callbacks))                   |

**Returns:** `Promise<TooManyDicesRoom>`

#### Properties

| Property      | Type                   | Description                               |
| ------------- | ---------------------- | ----------------------------------------- |
| `roomCode`    | `string`               | The code players enter in the app to join |
| `playerLimit` | `number \| null`       | Max players (null if not set)             |
| `players`     | `readonly TmdPlayer[]` | Currently connected players               |

---

#### Dice

##### `room.setDices(diceConfig)`

Reconfigure the dice at any time during a session.

```ts
await room.setDices([
  { id: "strength", type: "d20" },
  { id: "bonus", type: "d4" },
]);
```

**`DiceConfig`:**

| Field  | Type                                              | Description                                    |
| ------ | ------------------------------------------------- | ---------------------------------------------- |
| `type` | `"d4" \| "d6" \| "d8" \| "d10" \| "d12" \| "d20"` | Die type                                       |
| `id`   | `string`                                          | Optional identifier (returned in roll results) |

---

#### Rolling

##### `room.roll(player?)`

Triggers a roll. Delegates 3D physics simulation to `player` (or the first connected player if omitted). Resolves with the results once the dice settle.

```ts
// First available player handles the physics
const results = await room.roll();

// Specific player handles the physics
const results = await room.roll(room.players[0]);
```

**Returns:** `Promise<DiceResult[]>`

Each `DiceResult` contains:

| Field     | Type      | Description                                                      |
| --------- | --------- | ---------------------------------------------------------------- |
| `diceId`  | `string`  | The die's ID                                                     |
| `value`   | `number`  | The rolled value                                                 |
| `dieType` | `DieType` | The die type (`"d4"`, `"d6"`, `"d8"`, `"d10"`, `"d12"`, `"d20"`) |

Throws if no players are connected, or times out after 30 seconds.

---

##### `room.waitForRoll(player)`

Waits for a specific player to manually roll (shake or tap in the app). The player initiates the roll themselves.

```ts
const results = await room.waitForRoll(room.players[0]);
```

**Returns:** `Promise<DiceResult[]>`

---

#### Room Control

##### `room.closeAccess()`

Prevents new players from joining. Existing players stay connected.

```ts
await room.closeAccess();
```

##### `room.openAccess()`

Re-opens the room to new players after a `closeAccess()`.

```ts
await room.openAccess();
```

##### `room.enableSwipeGestures(enabled)`

Controls whether players can swipe-throw individual dice. When disabled, players can only roll via the Roll button (or SDK-triggered rolls).

```ts
await room.enableSwipeGestures(false); // disable swipe
await room.enableSwipeGestures(true); // re-enable swipe
```

##### `room.destroy()`

Disconnects the WebSocket and cleans up all listeners. Call this when your game session ends. Safe to call multiple times.

```ts
await room.destroy();
```

---

#### Callbacks

Pass callbacks in `CreateRoomOptions`:

```ts
const room = await TooManyDicesRoom.create(host, {
  callbacks: {
    onPlayerJoined(player) {
      console.log(`${player.name} (${player.playerId}) joined`);
    },
    onPlayerLeft(player) {
      console.log(`${player.name} left`);
    },
    onResult(results) {
      // results: DiceResult[] — each has diceId, value, and dieType
      for (const r of results) {
        console.log(`Die ${r.diceId} (${r.dieType}): ${r.value}`);
      }
    },
    onFormSubmit({ formId, playerId, answers }) {
      console.log(`Player ${playerId} submitted form ${formId}:`, answers);
    },
  },
});
```

| Callback         | Signature                                       | Description                         |
| ---------------- | ----------------------------------------------- | ----------------------------------- |
| `onPlayerJoined` | `(player: TmdPlayer) => void`                   | Fired when a player connects        |
| `onPlayerLeft`   | `(player: TmdPlayer) => void`                   | Fired when a player disconnects     |
| `onResult`       | `(results: DiceResult[]) => void`               | Fired when dice settle after a roll |
| `onFormSubmit`   | `(data: { formId, playerId, answers }) => void` | Fired when a player submits a form  |

---

### `TmdPlayer`

Represents a connected player.

| Property   | Type     | Description                       |
| ---------- | -------- | --------------------------------- |
| `playerId` | `string` | Unique identifier for this player |
| `name`     | `string` | Display name chosen by the player |

---

## Forms

Forms are UI overlays pushed to a player's screen in the TooManyDices app. There are two form modes:

| Mode               | API                  | Use case                                              |
| ------------------ | -------------------- | ----------------------------------------------------- |
| **Submit forms**   | `sendSubmitForms()`  | Collect structured input; player taps a submit button |
| **Callback forms** | `sendCallbackForm()` | React to live field changes and custom buttons        |

A player can only have one form active at a time.

---

### Submit Forms

Send one or more forms and receive results via the `onFormSubmit` callback.

```ts
import { TextForm, PickerForm, CheckboxForm } from "too-many-dice";

await room.sendSubmitForms([
  {
    formId: "character-setup",
    targetPlayer: room.players[0],
    fields: [
      new TextForm("name", "Character name", {
        placeholder: "Enter name",
        required: true,
      }),
      new PickerForm("class", "Class", ["Warrior", "Mage", "Rogue"]),
      new CheckboxForm("veteran", "Veteran player?"),
    ],
    submitButton: { label: "Confirm" },
  },
]);

// Results arrive via callbacks.onFormSubmit
// answers: { name: "Elara", class: "Mage", veteran: true }
```

To dismiss all forms:

```ts
await room.clearSubmitForms();
```

To show validation errors to a player:

```ts
await room.setFormErrors("character-setup", room.players[0], [
  "Name must be at least 3 characters",
]);
```

**`SubmitFormGroup`:**

| Field          | Type                | Description                                                         |
| -------------- | ------------------- | ------------------------------------------------------------------- |
| `formId`       | `string`            | Unique identifier for this form                                     |
| `targetPlayer` | `TmdPlayer`         | The player who sees this form                                       |
| `fields`       | `TmdForm[]`         | Array of form field instances                                       |
| `submitButton` | `{ label: string }` | The submit button shown to the player |

---

### Callback Forms

React to individual field changes and button clicks in real time.

```ts
import { SliderForm, MultiSelectForm } from "too-many-dice";

let currentStrength = 10;
let selectedPerks: unknown = [];

const handle = await room.sendCallbackForm({
  targetPlayer: room.players[0],
  fields: [
    {
      field: new SliderForm("str", "Strength", 1, 20, 1),
      onChange: (value) => {
        currentStrength = value as number;
      },
    },
    {
      field: new MultiSelectForm("perks", "Perks", [
        "Shield",
        "Haste",
        "Berserk",
      ]),
      onChange: (value) => {
        selectedPerks = value;
      },
    },
  ],
  buttons: [
    {
      label: "Confirm Build",
      onClick: (playerId) => {
        console.log(
          `${playerId} confirmed: str=${currentStrength}, perks=${selectedPerks}`,
        );
        handle.clear();
      },
    },
  ],
});

// Dismiss manually at any time:
await handle.clear();
```

**`CallbackFormOptions`:**

| Field          | Type               | Description                     |
| -------------- | ------------------ | ------------------------------- |
| `targetPlayer` | `TmdPlayer`        | The player who sees this form   |
| `fields`       | `CallbackField[]`  | Fields with `onChange` handlers |
| `buttons`      | `CallbackButton[]` | Optional action buttons         |

**`CallbackFormHandle`:**

| Member    | Type                  | Description                               |
| --------- | --------------------- | ----------------------------------------- |
| `formId`  | `string`              | Auto-generated ID for this form           |
| `clear()` | `() => Promise<void>` | Dismiss the form and remove all listeners |

---

### Form Field Types

All form fields take `(id, label, ...args, options?)`.

#### `CheckboxForm`

A single boolean toggle.

```ts
new CheckboxForm("agree", "I agree to the rules");
new CheckboxForm("agree", "I agree to the rules", { required: true });
```

Submit value: `boolean`

---

#### `TextForm`

A free-text input field.

```ts
new TextForm("username", "Your name");
new TextForm("username", "Your name", {
  placeholder: "e.g. Gandalf",
  required: true,
});
```

Submit value: `string`

---

#### `PickerForm`

A single-selection dropdown or wheel picker.

```ts
new PickerForm("difficulty", "Difficulty", ["Easy", "Normal", "Hard"]);
new PickerForm("difficulty", "Difficulty", ["Easy", "Normal", "Hard"], {
  required: true,
});
```

Submit value: `string` (one of the provided options)

---

#### `MultiSelectForm`

Multiple selectable options.

```ts
new MultiSelectForm("skills", "Choose skills", ["Fireball", "Shield", "Haste"]);
new MultiSelectForm(
  "skills",
  "Choose skills",
  ["Fireball", "Shield", "Haste"],
  { required: true },
);
```

Submit value: `string[]`

---

#### `SliderForm`

A numeric range slider.

```ts
// (id, label, min, max, step, options?)
new SliderForm("hp", "Hit Points", 1, 100, 5);
new SliderForm("hp", "Hit Points", 1, 100, 5, { required: true });
```

Submit value: `number`

---

## Complete Example: Turn-Based Game

```ts
import {
  TooManyDicesRoom,
  TextForm,
  PickerForm,
  SliderForm,
} from "too-many-dice";

const HOST = "myapp.partykit.dev";

async function runGame() {
  const characters = new Map<string, Record<string, unknown>>();

  const room = await TooManyDicesRoom.create(HOST, {
    playerLimit: 2,
    callbacks: {
      onPlayerJoined: (p) =>
        console.log(`${p.name} joined (${room.players.length}/2)`),
      onFormSubmit: ({ playerId, answers }) => {
        characters.set(playerId, answers);
      },
    },
  });

  console.log("Share this code with players:", room.roomCode);

  // Wait for 2 players
  await new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      if (room.players.length === 2) {
        clearInterval(interval);
        resolve();
      }
    }, 500);
  });

  await room.closeAccess(); // Lock the room

  // Send each player a character setup form
  await room.sendSubmitForms(
    room.players.map((p) => ({
      formId: `char-${p.playerId}`,
      targetPlayer: p,
      fields: [
        new TextForm("name", "Character name", { required: true }),
        new PickerForm("class", "Class", ["Warrior", "Mage", "Rogue"]),
        new SliderForm("level", "Starting level", 1, 10, 1),
      ],
      submitButton: { label: "Ready!" },
    })),
  );

  // Wait for both players to submit
  await new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      if (characters.size === 2) {
        clearInterval(interval);
        resolve();
      }
    }, 200);
  });
  await room.clearSubmitForms();

  // Play turns
  await room.setDices([{ id: "atk", type: "d20" }]);

  for (const player of room.players) {
    console.log(`\n${player.name}'s turn — rolling d20...`);
    const results = await room.roll(player);
    console.log("Result:", results);
  }

  await room.destroy();
}

runGame().catch(console.error);
```

---

## TypeScript Types

```ts
import type {
  DiceConfig,
  DiceResult,
  DieType,
  TooManyDicesCallbacks,
  CreateRoomOptions,
  SubmitFormGroup,
  CallbackField,
  CallbackButton,
  CallbackFormOptions,
  CallbackFormHandle,
  TmdForm,
} from "too-many-dice";
```

---

## Hosts

| Environment       | Host                          |
| ----------------- | ----------------------------- |
| Local development | `"localhost:1999"`            |
| Production        | Your PartyKit deployment host |

The SDK automatically uses `http://` for localhost and `https://` for all other hosts.
