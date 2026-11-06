export function parseModelJson(response) {
  const block = response.content.find((b) => b.type === 'text');
  if (!block) {
    throw new Error(`Model returned no text (stop_reason: ${response.stop_reason})`);
  }
  const stripped = block.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(stripped);
}
