/*
  Groq Transcription Service
  --------------------------
  This lightweight helper wraps Groq's Whisper transcription endpoint so the rest of the
  application can obtain highly-accurate text from recorded audio without touching the
  existing voice command logic.

  Usage example:
  ```ts
  import { transcribeAudio } from '@/services/groqTranscriptionService';

  const text = await transcribeAudio(audioBlob);
  ```

  The function expects a `Blob` or `File` (e.g. from `MediaRecorder` or a file input).
  It returns only the recognised text, abstracting away Groq's full verbose JSON.

  IMPORTANT:  Set the environment variable `VITE_GROQ_API_KEY` with your Groq key.
  This ensures we never hard-code secrets in the repository.
*/

const GROQ_API_KEY = (import.meta as any).env?.VITE_GROQ_API_KEY as string | undefined;
const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

/**
 * Check if Groq transcription is available (API key is configured)
 */
export function isGroqTranscriptionAvailable(): boolean {
  return !!GROQ_API_KEY && GROQ_API_KEY.trim().length > 0;
}

/**
 * Get setup instructions for Groq transcription
 */
export function getGroqTranscriptionSetupInstructions(): string {
  if (isGroqTranscriptionAvailable()) {
    return 'Groq transcription is properly configured and ready to use.';
  }
  
  return `To enable Groq audio transcription:
1. Get a free API key from https://groq.com/
2. Add VITE_GROQ_API_KEY to your environment variables
3. Restart your development server

Example: VITE_GROQ_API_KEY=your_groq_api_key_here`;
}

/**
 * Transcribe an audio file using Groq Whisper.
 *
 * @param file A `Blob` or `File` containing the audio (e.g. .m4a, .mp3, .wav).
 * @returns The transcribed text.
 * @throws Error when the API key is missing or the request fails.
 */
export async function transcribeAudio(file: Blob | File): Promise<string> {
  if (!isGroqTranscriptionAvailable()) {
    const setupInstructions = getGroqTranscriptionSetupInstructions();
    throw new Error(`Groq API key not configured.\n\n${setupInstructions}`);
  }

  // Build multipart/form-data body
  const formData = new FormData();
  const filename = file instanceof File ? file.name : 'audio.m4a';

  formData.append('file', file, filename);
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'verbose_json');

  const response = await fetch(GROQ_TRANSCRIPTION_URL, {
    method: 'POST',
    headers: {
      // DO NOT set the Content-Type header for multipart requests –
      // the browser will add the correct boundary automatically.
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Groq transcription error: ${response.status} – ${response.statusText}`);
  }

  // The verbose JSON format mirrors OpenAI’s Whisper response structure.
  type GroqVerboseResponse = {
    text?: string;
    segments?: { id: number; seek: number; start: number; end: number; text: string }[];
    language?: string;
    duration?: number;
  };

  const data: GroqVerboseResponse = await response.json();

  // Fallbacks – some implementations wrap text in "text" or within a first segment.
  const transcribed = data.text || data.segments?.map((s) => s.text).join(' ') || '';

  if (!transcribed) {
    throw new Error('Groq transcription succeeded but returned empty text.');
  }

  return transcribed.trim();
} 