import { describe, it, expect, vi, beforeEach } from "vitest";
import { TooManyDiceRoom } from "../TooManyDiceRoom";
import { TmdPlayer } from "../TmdPlayer";
import { CheckboxForm } from "../forms/CheckboxForm";
import type { TooManyDiceCallbacks } from "../types";

// ─── Mock PartySocket ────────────────────────────────────────────────────────

type MessageHandler = (event: { data: string }) => void;

interface MockSocket {
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  readyState: number;
  _handlers: Map<string, Set<MessageHandler>>;
  _triggerMessage: (data: any) => void;
  _triggerOpen: () => void;
}

function makeMockSocket(): MockSocket {
  const handlers = new Map<string, Set<MessageHandler>>();

  const socket: MockSocket = {
    send: vi.fn(),
    close: vi.fn(),
    readyState: 0, // CONNECTING initially
    addEventListener: vi.fn((type: string, handler: any) => {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler);
    }),
    removeEventListener: vi.fn((type: string, handler: any) => {
      handlers.get(type)?.delete(handler);
    }),
    _handlers: handlers,
    _triggerMessage(data: any) {
      const event = { data: JSON.stringify(data) };
      for (const handler of handlers.get("message") ?? []) {
        handler(event);
      }
    },
    _triggerOpen() {
      socket.readyState = 1; // OPEN
      for (const handler of handlers.get("open") ?? []) {
        (handler as any)({});
      }
    },
  };
  return socket;
}

// Mock partysocket module
let mockSocket: MockSocket;

vi.mock("partysocket", () => ({
  default: vi.fn(),
}));

import PartySocket from "partysocket";

beforeEach(() => {
  vi.restoreAllMocks();
  mockSocket = makeMockSocket();
  vi.mocked(PartySocket).mockImplementation(function () {
    // Auto-trigger open on next tick to simulate connection
    setTimeout(() => mockSocket._triggerOpen(), 0);
    return mockSocket as any;
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function makeOwnerRoom(
  callbacks: TooManyDiceCallbacks = {},
): Promise<TooManyDiceRoom> {
  // Mock fetch to handle the POST room creation
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ roomCode: "ABC123", ownerToken: "tok_xyz" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  return TooManyDiceRoom.create("too-many-dice.avlyx.partykit.dev", { callbacks });
}

function triggerRoomUpdate(data: any) {
  mockSocket._triggerMessage({ type: "roomState", data });
}

function rawRoom(
  players: Array<{ userId: string; name: string }> = [],
  state: string = "waiting",
) {
  return { players, state, diceConfig: [] };
}

// ─── create() ────────────────────────────────────────────────────────────────

describe("TooManyDiceRoom.create()", () => {
  it("calls createApiRoom and sets roomCode + ownerToken", async () => {
    const room = await makeOwnerRoom();
    expect(room.roomCode).toBe("ABC123");
    expect(room.ownerToken).toBe("tok_xyz");
    expect(room.playerLimit).toBeNull();
  });

  it("passes playerLimit and diceConfig to the creation POST", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ roomCode: "XYZ", ownerToken: "tok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await TooManyDiceRoom.create("too-many-dice.avlyx.partykit.dev", {
      playerLimit: 4,
      diceConfig: [{ id: "d1", type: "d6" }],
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse((init as any).body as string);
    expect(body.playerLimit).toBe(4);
    expect(body.diceConfig).toEqual([{ id: "d1", type: "d6" }]);
  });
});

// ─── players ─────────────────────────────────────────────────────────────────

describe("players", () => {
  it("starts empty", async () => {
    const room = await makeOwnerRoom();
    expect(room.players).toEqual([]);
  });

  it("updates from room subscription", async () => {
    const room = await makeOwnerRoom();
    triggerRoomUpdate(
      rawRoom([
        { userId: "user_1", name: "Alice" },
        { userId: "user_2", name: "Bob" },
      ]),
    );
    expect(room.players).toHaveLength(2);
    expect(room.players[0]).toBeInstanceOf(TmdPlayer);
  });
});

// ─── callbacks: onPlayerJoined / onPlayerLeft ───────────────────────────────

describe("onPlayerJoined / onPlayerLeft callbacks", () => {
  it("fires onPlayerJoined when a new player appears", async () => {
    const joined = vi.fn();
    await makeOwnerRoom({ onPlayerJoined: joined });

    triggerRoomUpdate(rawRoom([{ userId: "user_1", name: "Alice" }]));
    expect(joined).toHaveBeenCalledOnce();
    expect(joined.mock.calls[0][0].name).toBe("Alice");
  });

  it("fires onPlayerLeft when a player disappears", async () => {
    const left = vi.fn();
    await makeOwnerRoom({ onPlayerLeft: left });

    triggerRoomUpdate(rawRoom([{ userId: "user_1", name: "Alice" }]));
    triggerRoomUpdate(rawRoom([]));
    expect(left).toHaveBeenCalledOnce();
    expect(left.mock.calls[0][0].name).toBe("Alice");
  });

  it("does not fire for players that stay", async () => {
    const joined = vi.fn();
    await makeOwnerRoom({ onPlayerJoined: joined });

    triggerRoomUpdate(rawRoom([{ userId: "user_1", name: "Alice" }]));
    triggerRoomUpdate(
      rawRoom([
        { userId: "user_1", name: "Alice" },
        { userId: "user_2", name: "Bob" },
      ]),
    );
    // joined fires twice: once for Alice, once for Bob
    expect(joined).toHaveBeenCalledTimes(2);
  });
});

// ─── callbacks: onResult ─────────────────────────────────────────────────────

describe("onResult callback", () => {
  it("fires when state transitions from rolling to settled", async () => {
    const onResult = vi.fn();
    await makeOwnerRoom({ onResult });

    const results = [{ diceId: "d1", value: 4, dieType: "d6" }];
    mockSocket._triggerMessage({ type: "reportResults", results });
    expect(onResult).toHaveBeenCalledOnce();
    expect(onResult.mock.calls[0][0]).toEqual(results);
  });

  it("does not fire on settled roomState (only on reportResults)", async () => {
    const onResult = vi.fn();
    await makeOwnerRoom({ onResult });

    triggerRoomUpdate({
      players: [],
      state: "settled",
      diceConfig: [],
    });
    expect(onResult).not.toHaveBeenCalled();
  });
});

// ─── owner-only mutations ─────────────────────────────────────────────────────

describe("owner-only mutations", () => {
  it("setDice sends sdk:updateDiceConfig", async () => {
    const room = await makeOwnerRoom();
    mockSocket.send.mockClear();
    await room.setDice([{ type: "d6" }]);
    const sent = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(sent.type).toBe("sdk:updateDiceConfig");
    expect(sent.diceConfig).toEqual([{ type: "d6" }]);
    expect(sent.ownerToken).toBe("tok_xyz");
  });

  it("closeAccess() sends sdk:closeRoom", async () => {
    const room = await makeOwnerRoom();
    mockSocket.send.mockClear();
    await room.closeAccess();
    const sent = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(sent.type).toBe("sdk:closeRoom");
    expect(sent.ownerToken).toBe("tok_xyz");
  });
});

// ─── roll() ───────────────────────────────────────────────────────────────────

describe("roll()", () => {
  it("sends sdk:triggerRoll and resolves on reportResults", async () => {
    const room = await makeOwnerRoom();
    // Add a player so roll() has a delegate
    triggerRoomUpdate(rawRoom([{ userId: "user_1", name: "Alice" }]));
    mockSocket.send.mockClear();

    const rollPromise = room.roll();
    // Verify sdk:triggerRoll was sent
    const sent = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(sent.type).toBe("sdk:triggerRoll");
    expect(sent.ownerToken).toBe("tok_xyz");

    // Simulate server sending reportResults
    const results = [{ diceId: "d1", value: 5, dieType: "d6" }];
    mockSocket._triggerMessage({ type: "reportResults", results });
    const resolved = await rollPromise;
    expect(resolved).toEqual(results);
  });

  it("sends sdk:triggerRoll with specific player", async () => {
    const room = await makeOwnerRoom();
    mockSocket.send.mockClear();

    const rollPromise = room.roll(new TmdPlayer("user_1", "Alice"));
    const sent = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(sent.userId).toBe("user_1");

    // Resolve the promise
    mockSocket._triggerMessage({ type: "reportResults", results: [] });
    await rollPromise;
  });
});

// ─── forms ────────────────────────────────────────────────────────────────────

describe("sendSubmitForms()", () => {
  it("serializes form fields and sends sdk:sendForms", async () => {
    const room = await makeOwnerRoom();
    mockSocket.send.mockClear();

    await room.sendSubmitForms([
      {
        formId: "form_1",
        targetPlayer: new TmdPlayer("user_1", "Alice"),
        fields: [new CheckboxForm("agree", "I agree")],
        submitButton: { label: "Submit" },
      },
    ]);

    const sent = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(sent.type).toBe("sdk:sendForms");
    expect(sent.ownerToken).toBe("tok_xyz");
    expect(sent.forms).toEqual([
      {
        formId: "form_1",
        targetPlayerId: "user_1",
        fields: [{ type: "Checkbox", id: "agree", label: "I agree" }],
        submitButton: { label: "Submit" },
      },
    ]);
  });
});

// ─── destroy() ────────────────────────────────────────────────────────────────

describe("destroy()", () => {
  it("closes the socket", async () => {
    const room = await makeOwnerRoom();
    mockSocket.send.mockClear();
    await room.destroy();
    expect(mockSocket.send).not.toHaveBeenCalled();
    expect(mockSocket.close).toHaveBeenCalled();
  });

  it("is idempotent — second call does nothing", async () => {
    const room = await makeOwnerRoom();
    await room.destroy();
    await room.destroy();
    expect(mockSocket.close).toHaveBeenCalledOnce();
  });
});

// ─── openAccess() ─────────────────────────────────────────────────────────────

describe("openAccess()", () => {
  it("sends sdk:openRoom with ownerToken", async () => {
    const room = await makeOwnerRoom();
    mockSocket.send.mockClear();
    await room.openAccess();
    const sent = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(sent.type).toBe("sdk:openRoom");
    expect(sent.ownerToken).toBe("tok_xyz");
  });
});

// ─── enableSwipeGestures() ────────────────────────────────────────────────────

describe("enableSwipeGestures()", () => {
  it("sends sdk:enableSwipeGestures with ownerToken", async () => {
    const room = await makeOwnerRoom();
    mockSocket.send.mockClear();
    await room.enableSwipeGestures(false);
    const sent = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(sent.type).toBe("sdk:enableSwipeGestures");
    expect(sent.ownerToken).toBe("tok_xyz");
    expect(sent.enabled).toBe(false);
  });
});

// ─── clearForms() ─────────────────────────────────────────────────────────────

describe("clearSubmitForms()", () => {
  it("sends sdk:clearForms", async () => {
    const room = await makeOwnerRoom();
    mockSocket.send.mockClear();
    await room.clearSubmitForms();
    const sent = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(sent.type).toBe("sdk:clearForms");
    expect(sent.ownerToken).toBe("tok_xyz");
  });
});

// ─── setFormErrors() ──────────────────────────────────────────────────────────

describe("setFormErrors()", () => {
  it("sends sdk:setFormErrors with correct args", async () => {
    const room = await makeOwnerRoom();
    mockSocket.send.mockClear();
    const player = new TmdPlayer("user_1", "Alice");
    await room.setFormErrors("form_1", player, ["Field is required"]);
    const sent = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(sent.type).toBe("sdk:setFormErrors");
    expect(sent.ownerToken).toBe("tok_xyz");
    expect(sent.formId).toBe("form_1");
    expect(sent.playerId).toBe("user_1");
    expect(sent.errors).toEqual(["Field is required"]);
  });
});
