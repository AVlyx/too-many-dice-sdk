import type { TextAnswerFieldDef } from "../types";

export class TextForm {
  readonly type = "TextAnswer" as const;

  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly options?: { placeholder?: string; required?: boolean }
  ) {}

  toField(): TextAnswerFieldDef {
    return {
      type: "TextAnswer",
      id: this.id,
      label: this.label,
      placeholder: this.options?.placeholder,
      required: this.options?.required,
    };
  }
}
