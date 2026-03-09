const BACKEND = "https://copying-organizer-regional-induction.trycloudflare.com";

export async function apiTts(req) {
  const res = await fetch(`${BACKEND}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: req.text }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`TTS failed: ${res.status} ${errText}`);
  }

  const data = await res.json();

  if (data.stage4_audio_url) {
    // Extract just the /audio/xxx.wav path
    let audioPath;
    try {
      const parsed = new URL(data.stage4_audio_url);
      audioPath = parsed.pathname;
    } catch {
      audioPath = data.stage4_audio_url;
    }

    console.log("Fetching audio from:", audioPath);

    // This goes through Vite proxy → Python server (port 8000)
    const audioRes = await fetch(audioPath);
    if (!audioRes.ok) {
      throw new Error(`Audio fetch failed: ${audioRes.status}`);
    }

    const blob = await audioRes.blob();
    console.log("Audio blob size:", blob.size, "type:", blob.type);

    return {
      ...data,
      audioBlobUrl: URL.createObjectURL(blob),
    };
  }

  throw new Error("No audio URL in response.");
}
