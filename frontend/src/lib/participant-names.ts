export function splitParticipantNames(value: string): string[] {
  return [...new Set(
    value
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  )];
}
