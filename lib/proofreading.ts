export type ProofLanguage = 'pt-BR' | 'en-US';
export type ProofIssue = { original: string; suggestions: string[]; reason: string; kind: 'orthography' | 'grammar' };

export function normalizeProofIssues(value: unknown, text: string): ProofIssue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const issue = item as Record<string, unknown>;
    if (typeof issue.original !== 'string' || !issue.original.trim() || issue.original.length > 120 || !text.includes(issue.original) || text.indexOf(issue.original) !== text.lastIndexOf(issue.original)) return [];
    const suggestions = Array.isArray(issue.suggestions) ? issue.suggestions.filter((choice): choice is string => typeof choice === 'string' && Boolean(choice.trim()) && choice.length <= 120 && choice !== issue.original).slice(0, 3) : [];
    if (!suggestions.length) return [];
    return [{ original: issue.original, suggestions, reason: typeof issue.reason === 'string' ? issue.reason.slice(0, 240) : '', kind: issue.kind === 'grammar' ? 'grammar' as const : 'orthography' as const }];
  }).slice(0, 6);
}
