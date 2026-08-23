export type DieType = "d4" | "d6" | "d8" | "d10" | "d12" | "d20";

export interface DiceConfig {
  id?: string;
  type: DieType;
}

export interface DiceResult {
  diceId: string;
  value: number;
  dieType: DieType;
}

export type TooManyDiceCallbacks = {
  onPlayerJoined?: (player: import("./TmdPlayer").TmdPlayer) => void;
  onPlayerLeft?: (player: import("./TmdPlayer").TmdPlayer) => void;
  onResult?: (results: DiceResult[]) => void;
  onFormSubmit?: (data: {
    formId: string;
    playerId: string;
    answers: Record<string, unknown>;
  }) => void;
  /**
   * Fired when a player taps "Settings" in the room's overflow menu. The
   * button only exists when this callback is supplied at room creation.
   */
  settingsCallback?: (player: import("./TmdPlayer").TmdPlayer) => void;
};

export interface CreateRoomOptions {
  diceConfig?: DiceConfig[];
  playerLimit?: number;
  swipeGesturesEnabled?: boolean;
  callbacks?: TooManyDiceCallbacks;
}

// ─── Form field definitions ───────────────────────────────────────────────────

export interface FormFieldBase {
  id: string;
  label: string;
  required?: boolean;
}

export interface TextAnswerFieldDef extends FormFieldBase {
  type: "TextAnswer";
  placeholder?: string;
}

export interface PickerFieldDef extends FormFieldBase {
  type: "Picker";
  options: string[];
}

export interface MultiSelectFieldDef extends FormFieldBase {
  type: "MultiSelect";
  options: string[];
}

export interface CheckboxFieldDef extends FormFieldBase {
  type: "Checkbox";
}

export interface SliderFieldDef extends FormFieldBase {
  type: "Slider";
  min: number;
  max: number;
  step: number;
}

export type DpadVisibility = "enabled" | "disabled" | "hidden";

export interface DpadDirectionConfig {
  visibility?: DpadVisibility;
}

export interface DpadFieldDef extends FormFieldBase {
  type: "Dpad";
  up?: DpadDirectionConfig;
  down?: DpadDirectionConfig;
  left?: DpadDirectionConfig;
  right?: DpadDirectionConfig;
}

/** Display-only text. Has no value and never appears in submitted answers. */
export interface MessageFieldDef {
  type: "Message";
  id: string;
  text: string;
  color?: string;
}

export type FormFieldDef =
  | TextAnswerFieldDef
  | PickerFieldDef
  | MultiSelectFieldDef
  | CheckboxFieldDef
  | SliderFieldDef
  | DpadFieldDef
  | MessageFieldDef;

// ─── Utility ─────────────────────────────────────────────────────────────────

export type UnsubscribeFn = () => void;
