// ─────────────────────────────────────────── LLM providers
// Only providers that are implemented in the backend (openai, anthropic).
// Expand this list as new backends are added.

export const PROVIDERS = ['Anthropic', 'OpenAI'] as const;
export type LLMProvider = (typeof PROVIDERS)[number];

export const PROVIDER_ICONS: Record<LLMProvider, string> = {
  Anthropic: 'logos:claude-icon',
  OpenAI: 'logos:openai-icon',
  // ArXiv: use frontend/src/assets/arxiv.svg
  // edge-tts: 'logos:microsoft-icon'
  // kokoro: use frontend/src/assets/hexgrad.webp
  // faster whisper -> frontend/src/assets/systran.svg
};

export const PROVIDER_MODELS: Record<LLMProvider, string[]> = {
  Anthropic: [
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
  ],
  OpenAI: [
    'gpt-5.4',
    'gpt-5.4-mini',
    'gpt-5.4-nano',
  ],
};

// ─────────────────────────────────────────── STT models (faster-whisper)

export const STT_MODELS = [
  'whisper-large-v3',
  'whisper-medium',
  'whisper-small',
  'whisper-base',
  'whisper-tiny',
] as const;

// ─────────────────────────────────────────── TTS backends

export const TTS_BACKENDS = [
  'edge-tts',   // free, no API key required
  'kokoro',     // local; pip install audia[kokoro]
  'openai',     // requires OpenAI API key
] as const;
export type TTSBackend = (typeof TTS_BACKENDS)[number];

export const TTS_VOICES: Record<TTSBackend, string[]> = {
  'edge-tts': [
    'en-US-AriaNeural',
    'en-US-GuyNeural',
    'en-GB-SoniaNeural',
    'en-GB-RyanNeural',
    'en-AU-NatashaNeural',
  ],
  'kokoro': [
    'af_heart',
    'af_sky',
    'am_adam',
    'am_michael',
    'bf_emma',
    'bm_george',
  ],
  'openai': [
    'alloy',
    'echo',
    'nova',
    'shimmer',
    'fable',
    'onyx',
  ],
};

