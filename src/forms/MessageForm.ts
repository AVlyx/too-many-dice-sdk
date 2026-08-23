import type { MessageFieldDef } from "../types";

export interface MessageFormOptions {
  color?: string;
}

/**
 * Display-only text shown inside a form. Carries no value: it is never
 * submitted and cannot be required.
 */
export class MessageForm {
  readonly type = "Message" as const;

  constructor(
    public readonly id: string,
    public readonly text: string,
    public readonly options?: MessageFormOptions
  ) {}

  toField(): MessageFieldDef {
    return {
      type: "Message",
      id: this.id,
      text: this.text,
      color: this.options?.color,
    };
  }
}
