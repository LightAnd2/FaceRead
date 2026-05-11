// ACRCloud proxy — calls /api/recognize (Vercel serverless function)
export async function recognizeSong(audioBlob) {
  const form = new FormData();
  form.append('audio', audioBlob, 'clip.webm');
  const res = await fetch('/api/recognize', { method: 'POST', body: form });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
