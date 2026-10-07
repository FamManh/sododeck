/** What a spy on `downloadBlob` (the editor's default save) was given: name, text and media type. */
export async function savedFile(
  spy: { mock: { calls: readonly (readonly unknown[])[] } },
  index = -1,
): Promise<{ name: string; text: string; type: string }> {
  const call = spy.mock.calls.at(index);
  if (call === undefined) throw new Error('nothing was saved');
  const [name, blob] = call as [string, Blob];
  return { name, text: await blob.text(), type: blob.type };
}
