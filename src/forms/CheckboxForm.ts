import type { CheckboxFieldDef } from "../types";

export class CheckboxForm {
  readonly type = "Checkbox" as const;

  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly options?: { required?: boolean }
  ) {}

  toField(): CheckboxFieldDef {
    return { type: "Checkbox", id: this.id, label: this.label, required: this.options?.required };
  }
}
