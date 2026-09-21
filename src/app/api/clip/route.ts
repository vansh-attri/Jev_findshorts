import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { choice, noul, TypeSafeClient } from '@typesafe-ai/sdk';

export const runtime = 'edge';

const CHUNK_DURATION = 60 * 1000;
const CHUNK_STRIDE = 10 * 1000;

function chunkTranscript(transcript: any[]) {
  const chunks: { startTime: number, endTime: number, text: string }[] = [];
  if (transcript.length === 0) return chunks;
  const maxTime = transcript[transcript.length - 1].offset + transcript[transcript.length - 1].duration;
  
  for (let startTime = 0; startTime < maxTime; startTime += CHUNK_STRIDE) {
    const endTime = startTime + CHUNK_DURATION;
    const itemsInWindow = transcript.filter(item => {
      const itemStart = item.offset;
      const itemEnd = item.offset + item.duration;
      return (itemStart < endTime && itemEnd > startTime);
    });
    
    if (itemsInWindow.length > 0) {
      chunks.push({
        startTime,
        endTime,
        text: itemsInWindow.map(i => i.text).join(' '),
      });
    }
  }
  return chunks;
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // 1. Fetch transcript (force English if possible)
    let transcript;
    try {
      transcript = await YoutubeTranscript.fetchTranscript(url, { lang: 'en' });
    } catch (e: any) {
      return NextResponse.json({ error: `Failed to fetch transcript: ${e.message}` }, { status: 400 });
    }

    // 2. Chunk transcript
    const chunks = chunkTranscript(transcript);

    const client = new TypeSafeClient();
    // Process all chunks, but in batches of 5 to avoid 503 errors and speed up processing
    const evaluations = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.all(batch.map(async (chunk) => {
        try {
          const response = await client.systemOne({
            state: chunk.text,
            questions: {
              is_standalone: noul('Does this snippet make sense independently without needing prior context?'),
              has_hook: noul('Does the start of the snippet contain an attention-grabbing hook?'),
              virality_potential: choice('How high is the virality potential of this snippet as a short-form video?', {
                High: 'High virality potential',
                Medium: 'Medium virality potential',
                Low: 'Low virality potential'
              }),
              content_type: choice('Categorize the type of content in this snippet.', {
                Educational: 'Educational content',
                Funny: 'Funny or comedic content',
                Storytime: 'Story or narrative content',
                Other: 'Other types of content'
              })
            }
          });
          
          const evaluation = {
            answers: {
              is_standalone: response.answers.is_standalone.noul > 0.5,
              has_hook: response.answers.has_hook.noul > 0.5,
              virality_potential: response.answers.virality_potential.choice,
              content_type: response.answers.content_type.choice
            }
          };

          return { ...chunk, evaluation };
        } catch (err: any) {
          console.error('Evaluation failed for chunk', err.message);
          return { ...chunk, evaluation: null, error: err.message };
        }
      }));

      evaluations.push(...batchResults);
    }

    return NextResponse.json({ chunks: evaluations });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
