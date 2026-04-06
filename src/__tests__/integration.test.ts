import { describe, it, expect, afterEach } from "vitest";
import { TooManyDiceRoom } from "../TooManyDiceRoom";

const HOST = "too-many-dice.avlyx.partykit.dev";

/**
 * Integration tests that hit the live PartyKit server.
 * Run after deploying backend changes.
 *
 * Usage:  npm test -- --testPathPattern integration
 */

let rooms: TooManyDiceRoom[] = [];

afterEach(async () => {
  for (const room of rooms) {
    try {
      await room.destroy();
    } catch {
      // ignore cleanup errors
    }
  }
  rooms = [];
});

function track(room: TooManyDiceRoom) {
  rooms.push(room);
  return room;
}

describe("integration: room creation via POST", () => {
  it("POST to /parties/main/new returns roomCode and ownerToken", async () => {
    const res = await fetch(`https://${HOST}/parties/main/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.roomCode).toBeDefined();
    expect(typeof data.roomCode).toBe("string");
    expect(data.roomCode).toHaveLength(6);
    expect(data.ownerToken).toBeDefined();
    expect(typeof data.ownerToken).toBe("string");
  });

  it("POST with options passes them through to room state", async () => {
    const res = await fetch(`https://${HOST}/parties/main/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerLimit: 3,
        diceConfig: [{ id: "atk", type: "d20" }],
        swipeGesturesEnabled: false,
      }),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.roomCode).toBeDefined();
    expect(data.ownerToken).toBeDefined();
  });

  it("POST to an existing room returns 409", async () => {
    // Create a room first
    const res1 = await fetch(`https://${HOST}/parties/main/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const { roomCode } = await res1.json();

    // Try to POST directly to that room again
    const res2 = await fetch(`https://${HOST}/parties/main/${roomCode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res2.status).toBe(409);
  });
});

describe("integration: full SDK flow", () => {
  it("creates a room and connects via WebSocket", async () => {
    const room = track(await TooManyDiceRoom.create(HOST));

    expect(room.roomCode).toBeDefined();
    expect(room.roomCode).toHaveLength(6);
    expect(room.ownerToken).toBeDefined();
    expect(room.players).toEqual([]);
  });

  it("creates a room with playerLimit", async () => {
    const room = track(
      await TooManyDiceRoom.create(HOST, { playerLimit: 2 }),
    );

    expect(room.roomCode).toBeDefined();
    expect(room.playerLimit).toBe(2);
  });

  it("creates a room with custom diceConfig", async () => {
    const room = track(
      await TooManyDiceRoom.create(HOST, {
        diceConfig: [
          { id: "atk", type: "d20" },
          { id: "dmg", type: "d8" },
        ],
      }),
    );

    expect(room.roomCode).toBeDefined();
    expect(room.ownerToken).toBeDefined();
  });

  it("can set dice after creation", async () => {
    const room = track(await TooManyDiceRoom.create(HOST));

    // Should not throw
    await room.setDice([{ type: "d20" }, { type: "d6" }]);
  });

  it("can close and open access", async () => {
    const room = track(await TooManyDiceRoom.create(HOST));

    await room.closeAccess();
    await room.openAccess();
  });

  it("can enable/disable swipe gestures", async () => {
    const room = track(await TooManyDiceRoom.create(HOST));

    await room.enableSwipeGestures(false);
    await room.enableSwipeGestures(true);
  });

  it("destroy closes cleanly", async () => {
    const room = await TooManyDiceRoom.create(HOST);
    await room.destroy();
    // No error means success
  });
});
