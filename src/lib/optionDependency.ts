import type { DependencyCondition, DependencyRule, ProductOptionGroup } from '../types';

/**
 * Evaluates a single dependency rule against selected option values.
 * Returns true if the rule is satisfied.
 */
function evaluateDependencyRule(
  rule: DependencyRule,
  selectedValues: Record<string, string>
): boolean {
  const selectedValue = selectedValues[rule.dependsOnGroupCode];

  // If the parent group has no selection, the dependency is not satisfied
  if (selectedValue === undefined || selectedValue === '') {
    return false;
  }

  switch (rule.condition) {
    case 'equals':
      return selectedValue === rule.allowedValues[0];
    case 'not_equals':
      return selectedValue !== rule.allowedValues[0];
    case 'in':
      return rule.allowedValues.includes(selectedValue);
    case 'not_in':
      return !rule.allowedValues.includes(selectedValue);
    default:
      return false;
  }
}

/**
 * Evaluates visibility for all option groups based on selected values.
 * Returns a map of groupCode -> isVisible.
 *
 * Rules:
 * - If no dependency rules, group is always visible
 * - If dependency rules exist, ALL must pass (AND logic)
 * - Missing parent value = group hidden
 */
export function evaluateOptionGroupVisibility(
  groups: ProductOptionGroup[],
  selectedValues: Record<string, string>
): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  for (const group of groups) {
    // If no dependency rules, group is always visible
    if (!group.dependencyRules || group.dependencyRules.length === 0) {
      result[group.code] = true;
      continue;
    }

    // All rules must pass (AND logic)
    const isVisible = group.dependencyRules.every((rule) =>
      evaluateDependencyRule(rule, selectedValues)
    );
    result[group.code] = isVisible;
  }

  return result;
}

/**
 * Gets the list of visible option groups based on current selections.
 * Also computes which groups should have their selections cleared due to becoming hidden.
 */
export function getVisibleOptionGroups(
  groups: ProductOptionGroup[],
  selectedValues: Record<string, string>
): {
  visibleGroups: ProductOptionGroup[];
  hiddenGroupCodes: string[];
  valuesToClear: Record<string, string>;
} {
  const visibility = evaluateOptionGroupVisibility(groups, selectedValues);
  const visibleGroups: ProductOptionGroup[] = [];
  const hiddenGroupCodes: string[] = [];
  const valuesToClear: Record<string, string> = {};

  for (const group of groups) {
    if (visibility[group.code]) {
      visibleGroups.push(group);
    } else {
      hiddenGroupCodes.push(group.code);
      // If this group had a selected value, it should be cleared
      if (selectedValues[group.code]) {
        valuesToClear[group.code] = '';
      }
    }
  }

  return { visibleGroups, hiddenGroupCodes, valuesToClear };
}

/**
 * Gets default selected values for all visible groups.
 * Used to initialize selections.
 */
export function getDefaultSelectedValues(
  groups: ProductOptionGroup[]
): Record<string, string> {
  const defaults: Record<string, string> = {};

  for (const group of groups) {
    // Find default value or first active value
    const defaultValue = group.values.find((v) => v.isDefault && v.isActive);
    const firstActive = group.values.find((v) => v.isActive);

    if (defaultValue) {
      defaults[group.code] = defaultValue.value;
    } else if (firstActive) {
      defaults[group.code] = firstActive.value;
    }
  }

  return defaults;
}

/**
 * Computes visibility preview text for admin UI.
 * Returns human-readable description of when a group will be visible.
 */
export function getVisibilityPreviewText(
  group: ProductOptionGroup,
  allGroups: ProductOptionGroup[]
): string {
  if (!group.dependencyRules || group.dependencyRules.length === 0) {
    return 'Always visible';
  }

  const conditions: string[] = [];

  for (const rule of group.dependencyRules) {
    const targetGroup = allGroups.find((g) => g.code === rule.dependsOnGroupCode);
    const groupName = targetGroup?.name ?? rule.dependsOnGroupCode;
    const valuesText = rule.allowedValues.join(', ');

    switch (rule.condition) {
      case 'equals':
        conditions.push(`${groupName} is ${valuesText}`);
        break;
      case 'not_equals':
        conditions.push(`${groupName} is not ${valuesText}`);
        break;
      case 'in':
        conditions.push(`${groupName} is one of [${valuesText}]`);
        break;
      case 'not_in':
        conditions.push(`${groupName} is not [${valuesText}]`);
        break;
    }
  }

  if (conditions.length === 0) return 'Always visible';
  if (conditions.length === 1) return conditions[0];
  return conditions.join(' AND ');
}

/**
 * Formats a condition for display in admin UI.
 */
export function formatCondition(condition: DependencyCondition): string {
  switch (condition) {
    case 'equals':
      return 'equals';
    case 'not_equals':
      return 'not equals';
    case 'in':
      return 'in list';
    case 'not_in':
      return 'not in list';
  }
}
