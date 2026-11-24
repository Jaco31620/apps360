"use client";
import { Volume2, VolumeX } from "lucide-react";
import * as audio from "./audio";

/*
 * Volumes (signaux, voix) : réglages et séance. Un exemple est joué au relâcher.
 * Avec `onToggle` (séance), un haut-parleur en bout de ligne active ou coupe.
 */
export default function VolumeSliders({ settings, onSettings, onToggle }) {
  const row = (key, label, on, demo, toggle) => (on || onToggle) && (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="flex-1">{label}</span>
      <input type="range" min="0" max="100" step="5" value={settings[key]} disabled={!on} aria-label={label}
        className="w-40 min-w-0 h-10 accent-brand-navy disabled:opacity-40"
        onChange={(e) => onSettings({ [key]: Number(e.target.value) })}
        onPointerUp={() => { if (!on) return; audio.unlock(settings); demo(); }} onKeyUp={() => { audio.unlock(settings); demo(); }} />
      {onToggle && (
        <button type="button" aria-pressed={on} aria-label={`${toggle === "sound" ? "Sons" : "Voix"} : ${on ? "couper" : "activer"}`} onClick={() => onToggle(toggle, !on)}
          className={`w-11 h-11 shrink-0 rounded-full grid place-items-center ${on ? "bg-brand-navy text-white" : "bg-white/60 text-brand-navy"}`}>
          {on ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      )}
    </div>
  );
  return (
    <>
      {row("vol", onToggle ? "Sons" : "Volume des signaux", settings.sound !== "off", () => audio.signal("work"), "sound")}
      {row("volVoice", onToggle ? "Voix" : "Volume de la voix", settings.voice, () => audio.say("work"), "voice")}
    </>
  );
}
