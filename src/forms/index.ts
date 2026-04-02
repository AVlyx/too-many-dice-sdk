export { CheckboxForm } from "./CheckboxForm";
export { TextForm } from "./TextForm";
export { PickerForm } from "./PickerForm";
export { MultiSelectForm } from "./MultiSelectForm";
export { SliderForm } from "./SliderForm";
export { DpadForm } from "./DpadForm";

import type { CheckboxForm } from "./CheckboxForm";
import type { TextForm } from "./TextForm";
import type { PickerForm } from "./PickerForm";
import type { MultiSelectForm } from "./MultiSelectForm";
import type { SliderForm } from "./SliderForm";
import type { DpadForm } from "./DpadForm";

export type TmdForm = CheckboxForm | TextForm | PickerForm | MultiSelectForm | SliderForm | DpadForm;
