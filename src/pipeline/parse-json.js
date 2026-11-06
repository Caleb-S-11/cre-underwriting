export function parseModelJson(response) {
  const block = response.content.find((b) => b.type === 'text');
  if (!block) {
    throw new Error(`Model returned no text (stop_reason: ${response.stop_reason})`);
  }
  const stripped = block.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(stripped);
  } catch {
    try {
      return JSON.parse(stripped.replace(/,(\s*[}\]])/g, '$1'));
    } catch (error) {
      throw new Error(`${error.message} (stop_reason: ${response.stop_reason})`);
    }
  }
}
