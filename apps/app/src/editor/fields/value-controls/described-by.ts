/** `aria-describedby` from the ids that apply (none → undefined). */
export function describedBy(...ids: (string | false | null | undefined)[]): string | undefined {
  const list = ids.filter((id): id is string => typeof id === 'string' && id !== '');
  return list.length === 0 ? undefined : list.join(' ');
}
