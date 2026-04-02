import type { DpadFieldDef, DpadDirectionConfig } from "../types";

export interface DpadFormOptions {
  required?: boolean;
  up?: DpadDirectionConfig;
  down?: DpadDirectionConfig;
  left?: DpadDirectionConfig;
  right?: DpadDirectionConfig;
}

export class DpadForm {
  readonly type = "Dpad" as const;

  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly options?: DpadFormOptions
  ) {}

  toField(): DpadFieldDef {
    return {
      type: "Dpad",
      id: this.id,
      label: this.label,
      required: this.options?.required,
      up: this.options?.up,
      down: this.options?.down,
      left: this.options?.left,
      right: this.options?.right,
    };
  }
}
