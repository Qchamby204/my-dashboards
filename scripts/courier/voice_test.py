"""
Audition narrator voices before committing to one.

    OPENAI_API_KEY=... python scripts/courier/voice_test.py cedar marin onyx ash
    ELEVENLABS_API_KEY=... TTS_PROVIDER=elevenlabs python scripts/courier/voice_test.py VOICE_ID ...

OpenAI voices: alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, shimmer, verse, marin, cedar.

Renders the same sample paragraph in each voice with the Courier's current settings and writes
out/voice-test/<voice_id>.mp3. Costs about 600 characters of quota per voice. Set
ELEVENLABS_STABILITY, ELEVENLABS_STYLE, or ELEVENLABS_MODEL in the environment to test
different settings without editing build.py.
"""
import os, sys
from pathlib import Path
import requests

SAMPLE = ("The Bank of Canada held its policy rate at 2.75 percent this morning, the third straight "
          "hold, and the statement dropped the line about being prepared to ease further. The Globe "
          "reads that as a pause with a bias to stay put. Two year Canada yields rose six basis points "
          "on the news. For your incorporated clients, nothing changes today, but the passive income "
          "conversation gets a little easier when GIC rates stop falling. Now, the Jets. Winnipeg "
          "opens camp on the eighteenth, and Scheifele says the shoulder is fine.")

out = Path("out/voice-test"); out.mkdir(parents=True, exist_ok=True)
settings = {
    "stability": float(os.environ.get("ELEVENLABS_STABILITY") or 0.45),
    "similarity_boost": 0.8,
    "style": float(os.environ.get("ELEVENLABS_STYLE") or 0.35),
}
model = os.environ.get("ELEVENLABS_MODEL") or "eleven_multilingual_v2"
provider = os.environ.get("TTS_PROVIDER") or "openai"
for vid in sys.argv[1:]:
    if provider == "openai":
        r = requests.post("https://api.openai.com/v1/audio/speech",
                          headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
                          json={"model": os.environ.get("OPENAI_TTS_MODEL") or "gpt-4o-mini-tts", "voice": vid,
                                "input": SAMPLE, "response_format": "mp3",
                                "instructions": os.environ.get("OPENAI_TTS_INSTRUCTIONS") or
                                "Warm, unhurried, natural; vary pace and pitch like a person; slow on numbers."},
                          timeout=120)
        r.raise_for_status()
        (out / f"{vid}.mp3").write_bytes(r.content)
        print("wrote", out / f"{vid}.mp3")
        continue
    r = requests.post(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}",
                      params={"output_format": "mp3_44100_64"},
                      headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"]},
                      json={"text": SAMPLE, "model_id": model, "voice_settings": settings}, timeout=120)
    r.raise_for_status()
    (out / f"{vid}.mp3").write_bytes(r.content)
    print("wrote", out / f"{vid}.mp3")
