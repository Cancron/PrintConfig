import { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { Input } from '../ui/Input';
import { createDefaultEditorRules } from '../../lib/storage';
import type { EditorRules, Product } from '../../types';

interface Props {
  product: Product;
  onSave: (product: Product) => void;
}

type BooleanRule = {
  key: keyof Pick<
    EditorRules,
    | 'allowImageUpload'
    | 'allowCustomSize'
    | 'allowAddText'
    | 'allowClipart'
    | 'allowBackgroundColor'
    | 'allowBackgroundImage'
    | 'allowCrop'
    | 'allowRotate'
    | 'allowDeleteObjects'
    | 'allowLayersPanel'
    | 'requirePlaceholdersFilled'
  >;
  label: string;
  description: string;
  comingSoon?: boolean;
};

type NumberRule = {
  key: keyof Pick<EditorRules, 'maxImageCount' | 'maxTextCount' | 'minimumDpiWarning' | 'minimumDpiBlock'>;
  label: string;
  description: string;
};

const booleanRules: BooleanRule[] = [
  {
    key: 'allowImageUpload',
    label: 'Allow image upload',
    description: 'Customers can upload their own photos or artwork into the editor.',
  },
  {
    key: 'allowCustomSize',
    label: 'Allow custom size',
    description: 'Customers can use ratio-derived dimensions such as 12 x 16.5 instead of selecting only an exact configured variant size.',
  },
  {
    key: 'allowAddText',
    comingSoon: true,
    label: 'Allow add text',
    description: 'Customers can add new text boxes beyond any text already in the design.',
  },
  {
    key: 'allowClipart',
    comingSoon: true,
    label: 'Allow clipart',
    description: 'Customers can insert clipart or stock graphic elements from your library.',
  },
  {
    key: 'allowBackgroundColor',
    comingSoon: true,
    label: 'Allow background color',
    description: 'Customers can change the design background to a solid color.',
  },
  {
    key: 'allowBackgroundImage',
    comingSoon: true,
    label: 'Allow background image',
    description: 'Customers can place an uploaded or library image behind the design content.',
  },
  {
    key: 'allowCrop',
    label: 'Allow crop',
    description: 'Customers can crop images to control which part appears in the print area.',
  },
  {
    key: 'allowRotate',
    label: 'Allow rotate',
    description: 'Customers can rotate images, text, and other editable objects.',
  },
  {
    key: 'allowDeleteObjects',
    comingSoon: true,
    label: 'Allow delete objects',
    description: 'Customers can remove editable items from the design.',
  },
  {
    key: 'allowLayersPanel',
    comingSoon: true,
    label: 'Allow layers panel',
    description: 'Customers can open a layers panel to reorder and select overlapping objects.',
  },
  {
    key: 'requirePlaceholdersFilled',
    label: 'Require all placeholders filled before checkout',
    description: 'Customers must complete every required image or text placeholder before ordering.',
  },
];

const numberRules: NumberRule[] = [
  {
    key: 'maxImageCount',
    label: 'Maximum image count',
    description: 'Limits how many images a customer can add to one design.',
  },
  {
    key: 'maxTextCount',
    label: 'Maximum text count',
    description: 'Limits how many text boxes a customer can add to one design.',
  },
  {
    key: 'minimumDpiWarning',
    label: 'Minimum DPI warning',
    description: 'Shows a quality warning when an image drops below this DPI, but still allows checkout.',
  },
  {
    key: 'minimumDpiBlock',
    label: 'Minimum DPI block',
    description: 'Blocks checkout when an image drops below this DPI.',
  },
];

export function EditorRulesTab({ product, onSave }: Props) {
  const [rules, setRules] = useState<EditorRules>(() => ({
    ...createDefaultEditorRules(),
    ...product.editorRules,
  }));
  const [saved, setSaved] = useState(false);

  const errors = useMemo(() => validateRules(rules), [rules]);
  const isValid = Object.keys(errors).length === 0;

  function updateBoolean(key: BooleanRule['key'], value: boolean) {
    setRules((prev) => ({ ...prev, [key]: value }));
  }

  function updateNumber(key: NumberRule['key'], value: string) {
    setRules((prev) => ({ ...prev, [key]: value === '' ? 0 : Number(value) }));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSave({ ...product, editorRules: rules });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 pb-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900">Editor Rules</h2>
        <p className="mt-1 text-sm text-gray-500">
          Control which design tools customers can use when customizing this product.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {booleanRules.map((rule) => (
          <RuleSwitch
            key={rule.key}
            label={rule.label}
            description={rule.description}
            comingSoon={rule.comingSoon}
            checked={rules[rule.key]}
            onChange={(checked) => updateBoolean(rule.key, checked)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {numberRules.map((rule) => (
          <div key={rule.key} className="rounded-lg bg-gray-50 p-4 ring-1 ring-gray-200">
            <Input
              label={rule.label}
              type="number"
              min="0"
              step="1"
              value={rules[rule.key]}
              onChange={(event) => updateNumber(rule.key, event.target.value)}
              error={errors[rule.key]}
            />
            <p className="mt-2 text-sm text-gray-500">{rule.description}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!isValid}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Save className="h-4 w-4" />
          Save Rules
        </button>
        {saved && <span className="text-sm font-medium text-emerald-600">Saved!</span>}
      </div>
    </form>
  );
}

function RuleSwitch({
  label,
  description,
  checked,
  comingSoon,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  comingSoon?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-lg bg-gray-50 p-4 ring-1 ring-gray-200 transition-colors hover:bg-gray-100">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-600"
      />
      <span>
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900"><span>{label}</span>{comingSoon && <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">Coming soon</span>}</span>
        <span className="mt-1 block text-sm text-gray-500">{description}</span>
      </span>
    </label>
  );
}

function validateRules(rules: EditorRules): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!Number.isFinite(rules.maxImageCount) || rules.maxImageCount < 0) {
    errors.maxImageCount = 'Maximum image count must be zero or greater.';
  }
  if (!Number.isFinite(rules.maxTextCount) || rules.maxTextCount < 0) {
    errors.maxTextCount = 'Maximum text count must be zero or greater.';
  }
  if (!Number.isFinite(rules.minimumDpiWarning) || rules.minimumDpiWarning < 0) {
    errors.minimumDpiWarning = 'Minimum DPI warning must be zero or greater.';
  }
  if (!Number.isFinite(rules.minimumDpiBlock) || rules.minimumDpiBlock < 0) {
    errors.minimumDpiBlock = 'Minimum DPI block must be zero or greater.';
  }
  if (
    Number.isFinite(rules.minimumDpiWarning) &&
    Number.isFinite(rules.minimumDpiBlock) &&
    rules.minimumDpiBlock > rules.minimumDpiWarning
  ) {
    errors.minimumDpiBlock = 'Block DPI should be less than or equal to warning DPI.';
  }

  return errors;
}
