'use client';
import React, { useState } from 'react';

const loveLanguages = [
  'Physical Touch',
  'Acts of Service',
  'Words of Affirmation',
  'Quality Time',
  'Receiving Gifts',
];

export default function DatingPage() {
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [whatINeed, setWhatINeed] = useState('');
  const [romanticPreferences, setRomanticPreferences] = useState('');
  const [dateMode, setDateMode] = useState(true);

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#111b22] p-6" style={{ fontFamily: 'Manrope, Noto Sans, sans-serif' }}>
      <div className="w-full max-w-2xl rounded-2xl bg-[#192734] shadow-2xl p-8 flex flex-col gap-8">
        <h1 className="text-4xl font-bold text-white text-center mb-2">Trauma-Bonding</h1>
        <p className="text-center text-lg text-gray-300 mb-4 italic">The Dating Wing of Mito — The Love Language of Survivors</p>
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Your Dating Profile</h2>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-300 mb-1">Love Languages</label>
              <div className="flex flex-wrap gap-2">
                {loveLanguages.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    className={`px-3 py-1 rounded-full border font-medium text-sm shadow-sm transition ${selectedLanguages.includes(lang) ? 'bg-blue-500 text-white' : 'bg-[#111b22] text-blue-300 border-blue-500'}`}
                    onClick={() => toggleLanguage(lang)}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-300 mb-1">&quot;What I Need&quot; in a Partner</label>
              <textarea
                className="w-full rounded-md border border-gray-700 p-2 focus:ring-blue-400 focus:border-blue-400 bg-[#111b22] text-white"
                rows={2}
                value={whatINeed}
                onChange={e => setWhatINeed(e.target.value)}
                placeholder="Patience with medical routines, understanding of fatigue, etc."
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-300 mb-1">Romantic Preferences</label>
              <input
                className="w-full rounded-md border border-gray-700 p-2 focus:ring-blue-400 focus:border-blue-400 bg-[#111b22] text-white"
                value={romanticPreferences}
                onChange={e => setRomanticPreferences(e.target.value)}
                placeholder="Orientation, gender identity, relationship style, etc."
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="dateMode"
                checked={dateMode}
                onChange={() => setDateMode(!dateMode)}
                className="h-4 w-4 text-blue-400 border-gray-700 rounded focus:ring-blue-400"
              />
              <label htmlFor="dateMode" className="text-sm text-gray-300">Date Mode (uncheck to pause dating and return to friendship-only mode)</label>
            </div>
          </div>
          <div className="bg-[#192734] rounded-xl p-4 shadow">
            <h3 className="text-xl font-bold text-white mb-2">Empathy-Based Matching</h3>
            <p className="text-gray-400">(Coming soon: Prioritize matches who share or understand your conditions, routines, or emotional needs.)</p>
          </div>
          <div className="bg-[#192734] rounded-xl p-4 shadow">
            <h3 className="text-xl font-bold text-white mb-2">Fatigue-Aware Suggestions</h3>
            <p className="text-gray-400">(Coming soon: 3–5 deep-match suggestions daily, gentle on the mind and thumb.)</p>
          </div>
          <div className="bg-[#192734] rounded-xl p-4 shadow">
            <h3 className="text-xl font-bold text-white mb-2">Icebreakers & Mini Games</h3>
            <ul className="list-disc list-inside text-gray-300">
              <li>Shared Trauma Cards: &quot;Ever had to cancel a date because your body said NO?&quot;</li>
              <li>Creative Prompts: &quot;If our pain levels were food, what would we be eating today?&quot;</li>
              <li>Mini Games: Co-journaling, 2-player quizzes, etc. (Coming soon)</li>
            </ul>
          </div>
          <div className="bg-[#192734] rounded-xl p-4 shadow">
            <h3 className="text-xl font-bold text-white mb-2">Date Planning Tools</h3>
            <ul className="list-disc list-inside text-gray-300">
              <li>Low-Energy Date Suggestions: Netflix together, gentle walks, etc.</li>
              <li>Accessibility Filter: Wheelchair-accessible, quiet, pet-friendly spots (Coming soon)</li>
            </ul>
          </div>
          <div className="bg-[#192734] rounded-xl p-4 shadow">
            <h3 className="text-xl font-bold text-white mb-2">Safety & Trust</h3>
            <ul className="list-disc list-inside text-gray-300">
              <li>Soft Unmatch, Health Disclosure Zones, Consent Badges (Coming soon)</li>
            </ul>
          </div>
          <div className="bg-[#192734] rounded-xl p-4 shadow">
            <h3 className="text-xl font-bold text-white mb-2">Success Stories</h3>
            <ul className="list-disc list-inside text-gray-300">
              <li>Love Notes Gallery: Inspiring messages from couples (Coming soon)</li>
              <li>Couple Journals: Optional microblogging (Coming soon)</li>
            </ul>
          </div>
        </section>
        <footer className="mt-8 text-center text-gray-500 text-xs">
          <div>“Because being seen is sexy.”</div>
          <div>“Swipe right on someone who gets why you always cancel plans.”</div>
        </footer>
      </div>
    </div>
  );
} 