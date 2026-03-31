import type { PickerFieldDef } from "../types";

export class PickerForm {
  readonly type = "Picker" as const;

  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly pickerOptions: string[],
    public readonly options?: { required?: boolean }
  ) {}

  toField(): PickerFieldDef {
    return {
      type: "Picker",
      id: this.id,
      label: this.label,
      options: this.pickerOptions,
      required: this.options?.required,
    };
  }
}
