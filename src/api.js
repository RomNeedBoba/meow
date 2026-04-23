const BACKEND = "https://ttsapi.khtts.me";

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
    let audioUrl = data.stage4_audio_url;

    // Convert relative path to absolute URL
    if (!/^https?:\/\//i.test(audioUrl)) {
      audioUrl = `${BACKEND}${audioUrl.startsWith("/") ? "" : "/"}${audioUrl}`;
    }

    console.log("Fetching audio from:", audioUrl);

    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      const errText = await audioRes.text().catch(() => "");
      throw new Error(`Audio fetch failed: ${audioRes.status} ${errText}`);
    }

    const blob = await audioRes.blob();

    return {
      ...data,
      audioBlobUrl: URL.createObjectURL(blob),
    };
  }

  throw new Error("No audio URL in response.");
}
