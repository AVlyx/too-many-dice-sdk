import type { MultiSelectFieldDef } from "../types";

export class MultiSelectForm {
  readonly type = "MultiSelect" as const;

  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly selectOptions: string[],
    public readonly options?: { required?: boolean }
  ) {}

  toField(): MultiSelectFieldDef {
    return {
      type: "MultiSelect",
      id: this.id,
      label: this.label,
      options: this.selectOptions,
      required: this.options?.required,
    };
  }
}
