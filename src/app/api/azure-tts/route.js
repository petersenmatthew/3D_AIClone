export const runtime = 'nodejs'; // ensures Node.js environment

import { NextResponse } from 'next/server';
import * as speechSdk from 'microsoft-cognitiveservices-speech-sdk';

export async function POST(req) {
  try {
    const { text, voice } = await req.json();

    const azureKey = process.env.AZURE_SPEECH_KEY;
    const azureRegion = process.env.AZURE_SPEECH_REGION || 'eastus';

    if (!azureKey) {
      throw new Error('Azure key not configured on server.');
    }

    const speechConfig = speechSdk.SpeechConfig.fromSubscription(azureKey, azureRegion);
    speechConfig.speechSynthesisVoiceName = voice;
    speechConfig.speechSynthesisOutputFormat = speechSdk.SpeechSynthesisOutputFormat.Audio48Khz16BitMonoPcm;

    const synthesizer = new speechSdk.SpeechSynthesizer(speechConfig, null);

    const visemeData = [];
    const wordData = [];

    synthesizer.visemeReceived = (_, e) => visemeData.push({ audioOffset: e.audioOffset, visemeId: e.visemeId });
    synthesizer.wordBoundary = (_, e) => wordData.push({ audioOffset: e.audioOffset, duration: e.duration, text: e.text });

    const result = await new Promise((resolve, reject) =>
      synthesizer.speakTextAsync(text, resolve, reject)
    );

    synthesizer.close();

    // Convert the audio to a base64 string to safely send to client
    const base64Audio = Buffer.from(result.audioData).toString('base64');

    return NextResponse.json({
      audio: base64Audio,
      visemes: visemeData,
      words: wordData
    });
  } catch (err) {
    console.error('TTS API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
