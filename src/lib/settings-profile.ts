export type HealthTagField = 'conditions' | 'comorbidities' | 'medications' | 'access_needs'
export type BooleanProfileField = 'hide_conditions_on_profile'

type TagPatchResult = {
  values: string[]
  patch: Record<HealthTagField, string[]>
}

type BooleanPatchResult = {
  value: boolean
  patch: Record<BooleanProfileField, boolean>
}

export function buildTagAddPatch(
  field: HealthTagField,
  currentValues: string[],
  rawValue: string,
): TagPatchResult | null {
  const trimmed = rawValue.trim()
  if (!trimmed || currentValues.includes(trimmed)) return null

  const values = [...currentValues, trimmed]
  return { values, patch: { [field]: values } as Record<HealthTagField, string[]> }
}

export function buildTagRemovePatch(
  field: HealthTagField,
  currentValues: string[],
  index: number,
): TagPatchResult | null {
  if (index < 0 || index >= currentValues.length) return null

  const values = currentValues.filter((_, currentIndex) => currentIndex !== index)
  return { values, patch: { [field]: values } as Record<HealthTagField, string[]> }
}

export function buildBooleanProfilePatch(
  field: BooleanProfileField,
  currentValue: boolean,
): BooleanPatchResult {
  const value = !currentValue
  return { value, patch: { [field]: value } as Record<BooleanProfileField, boolean> }
}
