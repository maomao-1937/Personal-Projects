export function shouldSubmitPrompt(event: { key: string; shiftKey: boolean; repeat?: boolean; isComposing?: boolean; keyCode?: number }): boolean {
  return event.key === 'Enter' && !event.shiftKey && !event.repeat && !event.isComposing && event.keyCode !== 229;
}
