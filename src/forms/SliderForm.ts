import type { SliderFieldDef } from "../types";

export class SliderForm {
  readonly type = "Slider" as const;

  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly min: number,
    public readonly max: number,
    public readonly step: number,
    public readonly options?: { required?: boolean }
  ) {}

  toField(): SliderFieldDef {
    return {
      type: "Slider",
      id: this.id,
      label: this.label,
      min: this.min,
      max: this.max,
      step: this.step,
      required: this.options?.required,
    };
  }
}
