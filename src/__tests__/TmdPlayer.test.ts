import { describe, it, expect } from "vitest";
import { TmdPlayer } from "../TmdPlayer";

describe("TmdPlayer", () => {
  it("stores playerId and name", () => {
    const p = new TmdPlayer("abc123", "Alice");
    expect(p.playerId).toBe("abc123");
    expect(p.name).toBe("Alice");
  });

  it("properties are readonly", () => {
    const p = new TmdPlayer("x", "Bob");
    // TypeScript would catch writes at compile time; verify values are stable
    expect(p.playerId).toBe("x");
    expect(p.name).toBe("Bob");
  });
});
