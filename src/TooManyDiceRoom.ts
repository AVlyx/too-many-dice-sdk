import PartySocket from "partysocket";
import { TmdPlayer } from "./TmdPlayer";
import type {
  CreateRoomOptions,
  DiceConfig,
  DiceResult,
  TooManyDiceCallbacks,
} from "./types";
import type { TmdForm } from "./forms";

export interface SubmitFormGroup {
  formId: string;
  targetPlayer: TmdPlayer;
  fields: TmdForm[];
  submitButton: { label: string };
}

/** @deprecated Use SubmitFormGroup instead */
export type FormGroup = SubmitFormGroup;

export interface CallbackField {
  field: TmdForm;
  onChange: (value: unknown) => void;
}

export interface CallbackButton {
  label: string;
  onClick: (playerId: string) => void;
}

export interface CallbackFormOptions {
  targetPlayer: TmdPlayer;
  fields: CallbackField[];
  buttons?: CallbackButton[];
}

export interface CallbackFormHandle {
  formId: string;
  clear: () => Promise<void>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Safely parse a WebSocket message event. Returns null on parse failure. */
function parseMessage(event: MessageEvent): any | null {
  try {
    return JSON.parse(event.data);
  } catch {
    return null;
  }
}

function sendAndWait<T>(
  socket: PartySocket,
  msg: Record<string, any>,
  responseType: string,
  timeoutMs = 10000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.removeEventListener("message", handler);
      reject(new Error(`Timeout waiting for ${responseType}`));
    }, timeoutMs);

    function handler(event: MessageEvent) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === responseType) {
          clearTimeout(timer);
          socket.removeEventListener("message", handler);
          resolve(data as T);
        } else if (data.type === "error") {
          clearTimeout(timer);
          socket.removeEventListener("message", handler);
          reject(new Error(data.message));
        }
      } catch {
        // Ignore parse errors
      }
    }

    socket.addEventListener("message", handler);
    socket.send(JSON.stringify(msg));
  });
}

// ─── Room Class ─────────────────────────────────────────────────────────────

export class TooManyDiceRoom {
  readonly roomCode: string;
  readonly ownerToken: string | null;
  readonly playerLimit: number | null;

  private socket: PartySocket;
  private callbacks: TooManyDiceCallbacks;
  private destroyed = false;

  // ── Observable state ────────────────────────────────────────────────────
  private roomState: any = null;
  private roomHandler: ((event: MessageEvent) => void) | null = null;
  private resultHandler: ((event: MessageEvent) => void) | null = null;
  private formAnswerHandler: ((event: MessageEvent) => void) | null = null;
  private callbackFormHandler: ((event: MessageEvent) => void) | null = null;
  private seenAnswers = new Set<string>();
  private subscribedFormIds = new Set<string>();
  private callbackFieldHandlers = new Map<string, (value: unknown) => void>();
  private callbackButtonHandlers = new Map<
    string,
    (playerId: string) => void
  >();
  private callbackFormIds = new Set<string>();

  private constructor(
    socket: PartySocket,
    roomCode: string,
    ownerToken: string | null,
    playerLimit: number | null,
    callbacks: TooManyDiceCallbacks,
  ) {
    this.socket = socket;
    this.roomCode = roomCode;
    this.ownerToken = ownerToken;
    this.playerLimit = playerLimit;
    this.callbacks = callbacks;
  }

  // ─── Factory methods ─────────────────────────────────────────────────────────

  static async create(
    partykitHost: string = "too-many-dice.avlyx.partykit.dev",
    options?: CreateRoomOptions,
  ): Promise<TooManyDiceRoom> {
    const protocol = partykitHost.includes("localhost") ? "http" : "https";
    const res = await fetch(`${protocol}://${partykitHost}/parties/main/new`, {
      method: "POST",
    });
    const { roomCode } = await res.json();
    const socket = new PartySocket({
      host: partykitHost,
      room: roomCode,
    });

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
        resolve();
      };
      const onError = (e: Event) => {
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
        reject(new Error("Failed to connect"));
      };
      if (socket.readyState === WebSocket.OPEN) {
        resolve();
      } else {
        socket.addEventListener("open", onOpen);
        socket.addEventListener("error", onError);
      }
    });

    const result = await sendAndWait<{
      type: string;
      roomCode: string;
      ownerToken: string;
    }>(
      socket,
      {
        type: "sdk:createApiRoom",
        playerLimit: options?.playerLimit,
        diceConfig: options?.diceConfig,
        swipeGesturesEnabled: options?.swipeGesturesEnabled,
      },
      "apiCreated",
    );

    const room = new TooManyDiceRoom(
      socket,
      result.roomCode,
      result.ownerToken,
      options?.playerLimit ?? null,
      options?.callbacks ?? {},
    );
    room.start();
    return room;
  }

  // ─── Observable lifecycle ──────────────────────────────────────────────────

  private start(): void {
    if (this.roomHandler) return;

    this.roomHandler = (event: MessageEvent) => {
      const msg = parseMessage(event);
      if (!msg || msg.type !== "roomState") return;

      const prev = this.roomState;
      const next = msg.data ?? null;
      this.roomState = next;

      if (!next) return;

      // ── Player join / leave detection ───────────────────────────
      if (next.players) {
        const oldIds = new Set((prev?.players ?? []).map((p: any) => p.userId));
        const newIds = new Set(next.players.map((p: any) => p.userId));

        for (const p of next.players) {
          if (!oldIds.has(p.userId)) {
            this.callbacks.onPlayerJoined?.(new TmdPlayer(p.userId, p.name));
          }
        }
        if (prev?.players) {
          for (const p of prev.players) {
            if (!newIds.has(p.userId)) {
              this.callbacks.onPlayerLeft?.(new TmdPlayer(p.userId, p.name));
            }
          }
        }
      }
    };

    this.resultHandler = (event: MessageEvent) => {
      const msg = parseMessage(event);
      if (!msg) return;
      if (msg.type === "reportResults") {
        this.callbacks.onResult?.(msg.results);
      }
    };

    this.socket.addEventListener("message", this.roomHandler);
    this.socket.addEventListener("message", this.resultHandler);
  }

  private stop(): void {
    if (this.roomHandler) {
      this.socket.removeEventListener("message", this.roomHandler);
      this.roomHandler = null;
    }
    if (this.resultHandler) {
      this.socket.removeEventListener("message", this.resultHandler);
      this.resultHandler = null;
    }
    if (this.formAnswerHandler) {
      this.socket.removeEventListener("message", this.formAnswerHandler);
      this.formAnswerHandler = null;
    }
    if (this.callbackFormHandler) {
      this.socket.removeEventListener("message", this.callbackFormHandler);
      this.callbackFormHandler = null;
    }
    this.subscribedFormIds.clear();
    this.callbackFormIds.clear();
    this.callbackFieldHandlers.clear();
    this.callbackButtonHandlers.clear();
  }

  // ─── Players ─────────────────────────────────────────────────────────────────

  get players(): readonly TmdPlayer[] {
    if (!this.roomState?.players) return [];
    return (
      this.roomState.players as Array<{ userId: string; name: string }>
    ).map((p) => new TmdPlayer(p.userId, p.name));
  }

  // ─── Dice ────────────────────────────────────────────────────────────────────

  async setDice(diceConfig: DiceConfig[]): Promise<void> {
    this.requireOwner();
    this.socket.send(
      JSON.stringify({
        type: "sdk:updateDiceConfig",
        ownerToken: this.ownerToken,
        diceConfig,
      }),
    );
  }

  // ─── Roll ────────────────────────────────────────────────────────────────────

  async roll(player?: TmdPlayer): Promise<DiceResult[]> {
    if (this.ownerToken) {
      // Pick a physics delegate: explicit player or first connected
      const delegate = player ?? this.players[0];
      if (!delegate) {
        throw new Error("No players available to delegate physics");
      }

      // Register listener BEFORE sending so we don't miss the rolling state
      return new Promise((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          this.socket.removeEventListener("message", handler);
          this.socket.removeEventListener("close", onClose);
        };

        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("Timeout waiting for roll to complete"));
        }, 30000);

        const onClose = () => {
          cleanup();
          reject(new Error("Socket closed while waiting for roll"));
        };

        const handler = (event: MessageEvent) => {
          const msg = parseMessage(event);
          if (!msg) return;

          if (msg.type === "error") {
            cleanup();
            reject(new Error(msg.message));
            return;
          }

          if (msg.type === "reportResults") {
            cleanup();
            resolve(msg.results ?? []);
          }
        };

        this.socket.addEventListener("message", handler);
        this.socket.addEventListener("close", onClose);

        this.socket.send(
          JSON.stringify({
            type: "sdk:triggerRoll",
            ownerToken: this.ownerToken,
            userId: delegate.playerId,
          }),
        );
      });
    }
    return [];
  }

  async waitForRoll(
    player: TmdPlayer,
    timeoutMs = 120000,
  ): Promise<DiceResult[]> {
    this.requireOwner();

    this.socket.send(
      JSON.stringify({
        type: "sdk:waitForRoll",
        ownerToken: this.ownerToken,
        playerId: player.playerId,
      }),
    );

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.socket.removeEventListener("message", handler);
        this.socket.removeEventListener("close", onClose);
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout waiting for player to roll"));
      }, timeoutMs);

      const onClose = () => {
        cleanup();
        reject(new Error("Socket closed while waiting for roll"));
      };

      const handler = (event: MessageEvent) => {
        const msg = parseMessage(event);
        if (!msg) return;

        if (msg.type === "reportResults") {
          cleanup();
          resolve(msg.results ?? []);
        } else if (msg.type === "error") {
          cleanup();
          reject(new Error(msg.message));
        }
      };

      this.socket.addEventListener("message", handler);
      this.socket.addEventListener("close", onClose);
    });
  }

  // ─── Room control ─────────────────────────────────────────────────────────────

  async closeAccess(): Promise<void> {
    this.requireOwner();
    this.socket.send(
      JSON.stringify({
        type: "sdk:closeRoom",
        ownerToken: this.ownerToken,
      }),
    );
  }

  async openAccess(): Promise<void> {
    this.requireOwner();
    this.socket.send(
      JSON.stringify({
        type: "sdk:openRoom",
        ownerToken: this.ownerToken,
      }),
    );
  }

  async enableSwipeGestures(enabled: boolean): Promise<void> {
    this.requireOwner();
    this.socket.send(
      JSON.stringify({
        type: "sdk:enableSwipeGestures",
        ownerToken: this.ownerToken,
        enabled,
      }),
    );
  }

  // ─── Forms ───────────────────────────────────────────────────────────────────

  async sendSubmitForms(groups: SubmitFormGroup[]): Promise<void> {
    this.requireOwner();
    const serialized = groups.map((g) => ({
      formId: g.formId,
      targetPlayerId: g.targetPlayer.playerId,
      fields: g.fields.map((f) => f.toField()),
      submitButton: g.submitButton,
    }));

    this.socket.send(
      JSON.stringify({
        type: "sdk:sendForms",
        ownerToken: this.ownerToken,
        forms: serialized,
      }),
    );

    for (const g of groups) {
      // Clear seen answers so resent forms can receive fresh submissions
      for (const key of this.seenAnswers) {
        if (key.startsWith(`${g.formId}:`)) this.seenAnswers.delete(key);
      }
      this.subscribedFormIds.add(g.formId);
    }

    // Set up a single form answer listener if not already active
    if (!this.formAnswerHandler) {
      this.formAnswerHandler = (event: MessageEvent) => {
        const msg = parseMessage(event);
        if (!msg) return;

        // The server broadcasts formErrors type when a form answer is submitted
        // We need to listen for form answer submissions — the server doesn't
        // have a separate "formAnswer" message type in the current protocol.
        // For SDK form answers, we rely on the server echoing back via a
        // dedicated message. Let's handle it here.
        if (
          msg.type === "formAnswer" &&
          this.subscribedFormIds.has(msg.formId)
        ) {
          this.handleFormAnswer(msg.formId, msg.playerId, msg.answers);
        }
      };
      this.socket.addEventListener("message", this.formAnswerHandler);
    }
  }

  async clearSubmitForms(): Promise<void> {
    this.requireOwner();
    this.socket.send(
      JSON.stringify({
        type: "sdk:clearForms",
        ownerToken: this.ownerToken,
      }),
    );
    if (this.formAnswerHandler) {
      this.socket.removeEventListener("message", this.formAnswerHandler);
      this.formAnswerHandler = null;
    }
    this.subscribedFormIds.clear();
    this.seenAnswers.clear();
  }

  // ─── Callback Forms ──────────────────────────────────────────────────────

  async sendCallbackForm(
    options: CallbackFormOptions,
  ): Promise<CallbackFormHandle> {
    this.requireOwner();

    const formId =
      "cb_" + Math.random().toString(36).slice(2) + Date.now().toString(36);

    // Register field callbacks
    for (const cf of options.fields) {
      this.callbackFieldHandlers.set(
        `${formId}:${cf.field.toField().id}`,
        cf.onChange,
      );
    }

    // Register button callbacks
    const buttons = (options.buttons ?? []).map((btn, i) => {
      const buttonId = `btn_${i}`;
      this.callbackButtonHandlers.set(`${formId}:${buttonId}`, btn.onClick);
      return { id: buttonId, label: btn.label };
    });

    this.callbackFormIds.add(formId);

    // Send form definition via existing mechanism
    const serialized = {
      formId,
      targetPlayerId: options.targetPlayer.playerId,
      fields: options.fields.map((cf) => cf.field.toField()),
      formType: "callback" as const,
      buttons,
    };

    this.socket.send(
      JSON.stringify({
        type: "sdk:sendForms",
        ownerToken: this.ownerToken,
        forms: [serialized],
      }),
    );

    // Set up callback form listener if not already active
    this.ensureCallbackFormListener();

    const handle: CallbackFormHandle = {
      formId,
      clear: async () => {
        this.requireOwner();
        this.socket.send(
          JSON.stringify({
            type: "sdk:clearCallbackForm",
            ownerToken: this.ownerToken,
            formId,
          }),
        );
        // Clean up local state
        this.callbackFormIds.delete(formId);
        for (const key of [...this.callbackFieldHandlers.keys()]) {
          if (key.startsWith(`${formId}:`))
            this.callbackFieldHandlers.delete(key);
        }
        for (const key of [...this.callbackButtonHandlers.keys()]) {
          if (key.startsWith(`${formId}:`))
            this.callbackButtonHandlers.delete(key);
        }
        if (this.callbackFormIds.size === 0 && this.callbackFormHandler) {
          this.socket.removeEventListener("message", this.callbackFormHandler);
          this.callbackFormHandler = null;
        }
      },
    };

    return handle;
  }

  private ensureCallbackFormListener(): void {
    if (this.callbackFormHandler) return;

    this.callbackFormHandler = (event: MessageEvent) => {
      const msg = parseMessage(event);
      if (!msg) return;

      if (
        msg.type === "callbackFormFieldChange" &&
        this.callbackFormIds.has(msg.formId)
      ) {
        const key = `${msg.formId}:${msg.fieldId}`;
        this.callbackFieldHandlers.get(key)?.(msg.value);
      }

      if (
        msg.type === "callbackFormButtonClick" &&
        this.callbackFormIds.has(msg.formId)
      ) {
        const key = `${msg.formId}:${msg.buttonId}`;
        this.callbackButtonHandlers.get(key)?.(msg.playerId);
      }
    };

    this.socket.addEventListener("message", this.callbackFormHandler);
  }

  async setFormErrors(
    formId: string,
    player: TmdPlayer,
    errors: string[],
  ): Promise<void> {
    this.requireOwner();
    this.socket.send(
      JSON.stringify({
        type: "sdk:setFormErrors",
        ownerToken: this.ownerToken,
        formId,
        playerId: player.playerId,
        errors,
      }),
    );
  }

  // ─── Teardown ─────────────────────────────────────────────────────────────────

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;

    this.stop();

    this.socket.close();
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private handleFormAnswer(
    formId: string,
    playerId: string,
    answers: any,
  ): void {
    const key = `${formId}:${playerId}`;
    if (this.seenAnswers.has(key)) return;
    this.seenAnswers.add(key);
    this.callbacks.onFormSubmit?.({
      formId,
      playerId,
      answers,
    });
  }

  private requireOwner(): void {
    if (!this.ownerToken) {
      throw new Error(
        "This operation requires room ownership (use TooManyDiceRoom.create)",
      );
    }
  }
}
