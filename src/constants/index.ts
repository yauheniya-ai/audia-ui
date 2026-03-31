import arxivLogo   from '../assets/arxiv.svg';
import systranLogo from '../assets/systran.svg';
import hexgradLogo from '../assets/hexgrad.webp';

// ─────────────────────────────────────────── Icon definitions

/** Discriminated union for iconify icons vs image assets. */
export type IconDef =
  | { kind: 'icon'; name: string; adaptive?: boolean }  // adaptive = respects isDark
  | { kind: 'img';  src: string;  alt: string };

// ─────────────────────────────────────────── LLM providers
// Expand this list as new backends are added.

export const PROVIDERS = ['Anthropic', 'OpenAI'] as const;
export type LLMProvider = (typeof PROVIDERS)[number];

export const PROVIDER_ICONS: Record<LLMProvider, IconDef> = {
  Anthropic: { kind: 'icon', name: 'logos:claude-icon' },
  OpenAI:    { kind: 'icon', name: 'simple-icons:openai', adaptive: true },
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
  'kokoro',     // local; pip install "audia[kokoro]"
  'openai',     // requires OpenAI API key
] as const;
export type TTSBackend = (typeof TTS_BACKENDS)[number];

// ─────────────────────────────────────────── Service / backend icon definitions

export const STT_ICON: IconDef = { kind: 'img', src: systranLogo, alt: 'Systran' };
export const ARXIV_ICON: IconDef = { kind: 'img', src: arxivLogo, alt: 'arXiv' };

export const TTS_BACKEND_ICONS: Record<TTSBackend, IconDef> = {
  'edge-tts': { kind: 'icon', name: 'logos:microsoft-icon' },
  'kokoro':   { kind: 'img',  src: hexgradLogo, alt: 'Kokoro' },
  'openai':   { kind: 'icon', name: 'simple-icons:openai', adaptive: true },
};

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

