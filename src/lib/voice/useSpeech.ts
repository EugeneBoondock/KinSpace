/* eslint-disable @typescript-eslint/no-explicit-any */
// Browser-native voice for the Guide room — free, no paid TTS/STT.
//  - useSpeechInput: SpeechRecognition dictation into the composer.
//  - useSpeechOutput: speechSynthesis reads Guide replies aloud, voiced to match
//    the persona's gender.
// Both feature-detect and no-op gracefully where unsupported (e.g. Firefox STT).

import { useCallback, useEffect, useRef, useState } from 'react'

type SpeechWindow = Window & {
  SpeechRecognition?: any
  webkitSpeechRecognition?: any
}

export function useSpeechInput(onTranscript: (text: string) => void) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const callbackRef = useRef(onTranscript)

  useEffect(() => {
    callbackRef.current = onTranscript
  }, [onTranscript])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as SpeechWindow
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition))
    return () => {
      try {
        recognitionRef.current?.abort?.()
      } catch {
        // ignore
      }
    }
  }, [])

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop()
    } catch {
      // ignore
    }
    setListening(false)
  }, [])

  const start = useCallback(() => {
    if (typeof window === 'undefined') return
    const w = window as SpeechWindow
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) return
    try {
      const recognition = new Ctor()
      recognition.lang = 'en-US'
      recognition.interimResults = false
      recognition.continuous = false
      recognition.onresult = (event: any) => {
        const text = Array.from(event.results ?? [])
          .map((result: any) => result[0]?.transcript ?? '')
          .join(' ')
          .trim()
        if (text) callbackRef.current(text)
      }
      recognition.onend = () => setListening(false)
      recognition.onerror = () => setListening(false)
      recognitionRef.current = recognition
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }, [])

  return { supported, listening, start, stop }
}

export function useSpeechOutput() {
  const [supported, setSupported] = useState(false)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    setSupported(true)
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices()
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load)
      try {
        window.speechSynthesis.cancel()
      } catch {
        // ignore
      }
    }
  }, [])

  const speak = useCallback((text: string, gender?: 'she' | 'he' | 'they') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const clean = text
      .replace(/[*_#`>]/g, '')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .trim()
    if (!clean) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(clean)
    const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices()
    const english = voices.filter((voice) => voice.lang?.toLowerCase().startsWith('en'))
    const byName = (names: string[]) =>
      english.find((voice) => names.some((name) => voice.name.toLowerCase().includes(name)))
    let chosen: SpeechSynthesisVoice | undefined
    if (gender === 'he') chosen = byName(['male', 'daniel', 'alex', 'fred', 'rishi'])
    else if (gender === 'she') chosen = byName(['female', 'samantha', 'victoria', 'karen', 'moira', 'tessa'])
    chosen = chosen || english[0]
    if (chosen) utterance.voice = chosen
    utterance.rate = 0.96
    utterance.pitch = 1
    utterance.volume = 1
    window.speechSynthesis.speak(utterance)
  }, [])

  const cancel = useCallback(() => {
    try {
      window.speechSynthesis?.cancel()
    } catch {
      // ignore
    }
  }, [])

  return { supported, speak, cancel }
}
