import { describe, it, expect } from "vitest";
import { CheckboxForm } from "../forms/CheckboxForm";
import { TextForm } from "../forms/TextForm";
import { PickerForm } from "../forms/PickerForm";
import { MultiSelectForm } from "../forms/MultiSelectForm";
import { SliderForm } from "../forms/SliderForm";

describe("CheckboxForm", () => {
  it("serializes to field", () => {
    const f = new CheckboxForm("agree", "I agree");
    expect(f.toField()).toEqual({ type: "Checkbox", id: "agree", label: "I agree" });
  });

  it("includes required when set", () => {
    const f = new CheckboxForm("agree", "I agree", { required: true });
    expect(f.toField().required).toBe(true);
  });
});

describe("TextForm", () => {
  it("serializes to field", () => {
    const f = new TextForm("name", "Your name");
    expect(f.toField()).toMatchObject({ type: "TextAnswer", id: "name", label: "Your name" });
  });

  it("includes placeholder", () => {
    const f = new TextForm("name", "Your name", { placeholder: "Enter name..." });
    expect(f.toField().placeholder).toBe("Enter name...");
  });
});

describe("PickerForm", () => {
  it("serializes options", () => {
    const f = new PickerForm("color", "Pick a color", ["red", "blue"]);
    expect(f.toField()).toEqual({
      type: "Picker",
      id: "color",
      label: "Pick a color",
      options: ["red", "blue"],
    });
  });
});

describe("MultiSelectForm", () => {
  it("serializes options", () => {
    const f = new MultiSelectForm("toppings", "Choose toppings", ["cheese", "peppers"]);
    expect(f.toField()).toEqual({
      type: "MultiSelect",
      id: "toppings",
      label: "Choose toppings",
      options: ["cheese", "peppers"],
    });
  });
});

describe("SliderForm", () => {
  it("serializes min/max/step", () => {
    const f = new SliderForm("volume", "Volume", 0, 100, 5);
    expect(f.toField()).toEqual({
      type: "Slider",
      id: "volume",
      label: "Volume",
      min: 0,
      max: 100,
      step: 5,
    });
  });

  it("includes required when set", () => {
    const f = new SliderForm("volume", "Volume", 0, 10, 1, { required: true });
    expect(f.toField().required).toBe(true);
  });
});
