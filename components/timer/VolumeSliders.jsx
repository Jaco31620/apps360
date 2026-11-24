"use client";
import * as audio from "./audio";

/* Volumes (signaux, voix) : réglages et séance. Un exemple est joué au relâcher. */
export default function VolumeSliders({ settings, onSettings }) {
  const row = (key, label, demo) => (
    <label className="flex items-center justify-between gap-3 py-2">
      <span>{label}</span>
      <input type="range" min="0" max="100" step="5" value={settings[key]} className="w-40 h-10 accent-brand-navy"
        onChange={(e) => onSettings({ [key]: Number(e.target.value) })}
        onPointerUp={() => { audio.unlock(settings); demo(); }} onKeyUp={() => { audio.unlock(settings); demo(); }} />
    </label>
  );
  return (
    <>
      {settings.sound !== "off" && row("vol", "Volume des signaux", () => audio.signal("work"))}
      {settings.voice && row("volVoice", "Volume de la voix", () => audio.say("work"))}
    </>
  );
}
