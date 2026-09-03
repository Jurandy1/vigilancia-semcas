export function isOtherOptionLabel(label: string): boolean {
  const normalized = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");

  return /^outr[oa]s?\b/.test(normalized);
}

export function findOtherOption(options?: string[]): string | undefined {
  return options?.find(isOtherOptionLabel);
}

export function getOtherDraftKey(questionId: string): string {
  return `${questionId}__other_text`;
}
