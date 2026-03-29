export const PROVIDERS = ['Anthropic', 'Cohere', 'Google', 'Mistral', 'OpenAI']

export const PROVIDER_ICONS: Record<string, string> = {
  Anthropic: 'material-icon-theme:claude',
  Cohere: 'src/assets/cohere-color.svg',
  Google: 'material-icon-theme:gemini-ai',
  Mistral: 'src/assets/m-rainbow.svg',
  OpenAI: 'logos:openai-icon',
}

export const PROVIDER_MODELS: Record<string, string[]> = {
  Anthropic: [
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
  ],
  Cohere: [
    'command-a-03-2025',
    'command-r7b-12-2024',
    'command-r-08-2024',
    'command-r-plus-08-2024',
  ],
  Google: [
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ],
  Mistral: [
    'mistral-large-latest',
    'mistral-medium-latest',
    'mistral-small-latest',
  ],
  OpenAI: [
    'gpt-5.4',
    'gpt-5.4-mini',
    'gpt-5.4-nano',
  ],
};

