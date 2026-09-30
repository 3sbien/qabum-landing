export function buildAgreementVersionCode(input: {
  family: string;
  counterparty: string;
  year: number;
  month: number;
  major: number;
  minor: number;
}): string {
  const family = sanitizeCode(input.family);
  const counterparty = sanitizeCode(input.counterparty);
  const month = String(input.month).padStart(2, '0');

  if (input.year < 2000 || input.year > 9999) throw new Error('Invalid year');
  if (input.month < 1 || input.month > 12) throw new Error('Invalid month');
  if (input.major < 0 || input.minor < 0) throw new Error('Invalid version');

  return `${family}-${counterparty}-${input.year}-${month}-v${input.major}.${input.minor}`;
}

function sanitizeCode(value: string): string {
  const sanitized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!sanitized) throw new Error('Version code segment cannot be empty');
  return sanitized;
}

export const STEVE_INITIAL_VERSION_CODE = buildAgreementVersionCode({
  family: 'OPS',
  counterparty: 'STEVE',
  year: 2026,
  month: 10,
  major: 1,
  minor: 0,
});
