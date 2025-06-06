"use client";

import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../../supabaseClient";

const TherapistPage: React.FC = () => {
  type UserProfile = {
  id: string;
  email: string;
  user_metadata?: {
    avatar_url?: string;
    full_name?: string;
  };
};
const [user, setUser] = useState<UserProfile | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text: "Hello there! How are you feeling today?",
      avatar:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuB8kV35Vwdu32Dk_5IOhDC-Pu_CyYJzwLpOkv04tqPCPp2KPqFUVghClpuC6pYTjnBQiUe3tD7pL3yvBfyfeV2WEfo5n869R-RkHe0mgmlsSYiElVmCOblpTcz1iaihXLaTOYTVRtem5p6-mFrOAy1lRtfQ-93xoTEJ5Og2EUtpn-NCRMs0aX0i2GrClIjHhQxpO3wUzJgxauOEtab-t03As6erjuDl4JKgTczf5paOazqNJjIWeeUyy79fzqx32dxj0xsno2iqE1VB",
      name: "AI Therapist",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser({
          id: user.id,
          email: user.email || '',
          user_metadata: {
            avatar_url: user.user_metadata?.avatar_url,
            full_name: user.user_metadata?.full_name,
          },
        });
      } else {
        setUser(null);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        sender: "user",
        text: input,
        avatar:
          user?.user_metadata?.avatar_url ||
          "https://lh3.googleusercontent.com/aida-public/AB6AXuDZa3PEqEeDLnM5bfJbckxL-uUBB084CYI7QLQoi9nLVqw5TC_fhCbpXMgAEELAJagYHYyPcH_0ChBxjOeZus4gtqwpGdIR01HOvwY4yEEmc_a11PgBDv5tt4xGgG8wdoioyiIK0aU5emn0cL0xPdomuP5u-qbFkAcFVv5HDXJ0L3GDm-6y-91slHf_OsruKomtBA2OM_HlkULftnrCu38EKDIQS3MOMoDXD4zIs8iFhsreCM1Y6dFXgx_tOo6LHcUpxqF9jsVaGt7W",
        name: user?.user_metadata?.full_name || user?.email || "You",
      },
    ]);
    setInput("");
    setLoading(true);
    // Here you would call your AI backend
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "I'm here for you. Could you tell me more?",
          avatar:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuB8kV35Vwdu32Dk_5IOhDC-Pu_CyYJzwLpOkv04tqPCPp2KPqFUVghClpuC6pYTjnBQiUe3tD7pL3yvBfyfeV2WEfo5n869R-RkHe0mgmlsSYiElVmCOblpTcz1iaihXLaTOYTVRtem5p6-mFrOAy1lRtfQ-93xoTEJ5Og2EUtpn-NCRMs0aX0i2GrClIjHhQxpO3wUzJgxauOEtab-t03As6erjuDl4JKgTczf5paOazqNJjIWeeUyy79fzqx32dxj0xsno2iqE1VB",
          name: "AI Therapist",
        },
      ]);
      setLoading(false);
    }, 1200);
  };

  // Quick prompts
  const quickPrompts = [
    "I'm feeling anxious",
    "I need advice",
  ];

  return (
    <div className="relative flex size-full min-h-screen flex-col bg-brand-background dark group/design-root overflow-x-hidden" style={{ fontFamily: 'Plus Jakarta Sans, Noto Sans, sans-serif' }}>
      <div className="layout-container flex h-full grow flex-col">
        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-brand-accent3 border-opacity-50 px-10 py-3">
          <div className="flex items-center gap-4 text-brand-primary">
            <div className="size-4">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" clipRule="evenodd" d="M39.475 21.6262C40.358 21.4363 40.6863 21.5589 40.7581 21.5934C40.7876 21.655 40.8547 21.857 40.8082 22.3336C40.7408 23.0255 40.4502 24.0046 39.8572 25.2301C38.6799 27.6631 36.5085 30.6631 33.5858 33.5858C30.6631 36.5085 27.6632 38.6799 25.2301 39.8572C24.0046 40.4502 23.0255 40.7407 22.3336 40.8082C21.8571 40.8547 21.6551 40.7875 21.5934 40.7581C21.5589 40.6863 21.4363 40.358 21.6262 39.475C21.8562 38.4054 22.4689 36.9657 23.5038 35.2817C24.7575 33.2417 26.5497 30.9744 28.7621 28.762C30.9744 26.5497 33.2417 24.7574 35.2817 23.5037C36.9657 22.4689 38.4054 21.8562 39.475 21.6262ZM4.41189 29.2403L18.7597 43.5881C19.8813 44.7097 21.4027 44.9179 22.7217 44.7893C24.0585 44.659 25.5148 44.1631 26.9723 43.4579C29.9052 42.0387 33.2618 39.5667 36.4142 36.4142C39.5667 33.2618 42.0387 29.9052 43.4579 26.9723C44.1631 25.5148 44.659 24.0585 44.7893 22.7217C44.9179 21.4027 44.7097 19.8813 43.5881 18.7597L29.2403 4.41187C27.8527 3.02428 25.8765 3.02573 24.2861 3.36776C22.6081 3.72863 20.7334 4.58419 18.8396 5.74801C16.4978 7.18716 13.9881 9.18353 11.5858 11.5858C9.18354 13.988 7.18717 16.4978 5.74802 18.8396C4.58421 20.7334 3.72865 22.6081 3.36778 24.2861C3.02574 25.8765 3.02429 27.8527 4.41189 29.2403Z" fill="currentColor"></path></svg>
            </div>
            <h2 className="text-brand-primary text-lg font-bold leading-tight tracking-[-0.015em]">the Gathering</h2>
          </div>
          <div className="flex flex-1 justify-end gap-8">
            <div className="flex items-center gap-9">
              <a className="text-brand-text-secondary text-sm font-medium leading-normal" href="#">Home</a>
              <a className="text-brand-text-secondary text-sm font-medium leading-normal" href="#">Conditions</a>
              <a className="text-brand-text-secondary text-sm font-medium leading-normal" href="#">Groups</a>
              <a className="text-brand-text-secondary text-sm font-medium leading-normal" href="#">Events</a>
              <a className="text-brand-text-secondary text-sm font-medium leading-normal" href="#">Resources</a>
            </div>
            <button className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 bg-brand-accent2 text-brand-text-on-accent gap-2 text-sm font-bold leading-normal tracking-[0.015em] min-w-0 px-2.5"><div className="text-brand-text-on-accent" data-icon="Bell" data-size="20px" data-weight="regular"><svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" fill="currentColor" viewBox="0 0 256 256"><path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z"></path></svg></div></button>
            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" style={{ backgroundImage: `url(${user?.user_metadata?.avatar_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuAUC_ME9gM9SGwtdtfj0GacwnnoSIqU07f68_F2_p-QRNcCzRfD4hJW46p76KODId-lRUrlEgvYA0P1agVqB9LrzG8-Gxxio6JtnoCWLv4JMnluW7GfX_QWBW1cc7Ntyj2BgEY9i0w_j3ydUr9YqASbulU-Bc-VzAikPjKD47eMv-NbVO8WPLl_OgXaqOs2qNh11O2Cm5ggSaT0Tt7EbRdc0OLv5lAqtmBpXjsJrHVPd_NcM6E4XnyjbpQtX9GaSyVT5uQAoIsKFt6x'})` }}></div>
          </div>
        </header>
        <div className="px-40 flex flex-1 justify-center py-5">
          <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
            <h2 className="text-brand-text-primary tracking-light text-[28px] font-bold leading-tight px-4 text-center pb-3 pt-5">AI Therapist</h2>
            <p className="text-brand-text-secondary text-base font-normal leading-normal pb-3 pt-1 px-4 text-center">
              Welcome to your AI-powered therapy session. I&apos;m here to listen and support you. Feel free to share what&apos;s on your mind or choose a quick prompt below.
            </p>
            <div className="flex flex-col gap-2">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex items-end gap-3 p-4 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                  {msg.sender === 'ai' && (
                    <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-10 shrink-0" style={{ backgroundImage: `url(${msg.avatar})` }}></div>
                  )}
                  <div className={`flex flex-1 flex-col gap-1 items-${msg.sender === 'user' ? 'end' : 'start'}`}> 
                    <p className="text-brand-text-secondary text-[13px] font-normal leading-normal max-w-[360px] {msg.sender === 'user' ? 'text-right' : ''}">{msg.name}</p>
                    <p className={`text-base font-normal leading-normal flex max-w-[360px] rounded-xl px-4 py-3 ${msg.sender === 'user' ? 'bg-brand-accent1 text-brand-text-on-accent' : 'bg-brand-accent3 bg-opacity-30 text-brand-text-primary'}`}>
                      {msg.text}
                    </p>
                  </div>
                  {msg.sender === 'user' && (
                    <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-10 shrink-0" style={{ backgroundImage: `url(${msg.avatar})` }}></div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex justify-center">
              <div className="flex flex-1 gap-3 flex-wrap px-4 py-3 max-w-[480px] justify-center">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 bg-brand-primary text-brand-text-on-primary text-sm font-bold leading-normal tracking-[0.015em] grow"
                    onClick={() => setInput(prompt)}
                  >
                    <span className="truncate">{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
            <form onSubmit={handleSend} className="flex items-center px-4 py-3 gap-3 @container">
              <label className="flex flex-col min-w-40 h-12 flex-1">
                <div className="flex w-full flex-1 items-stretch rounded-xl h-full">
                  <input
                    placeholder="Type your message..."
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-brand-text-primary focus:outline-0 focus:ring-0 border-none bg-brand-accent3 bg-opacity-20 focus:border-none h-full placeholder:text-brand-text-secondary placeholder-opacity-70 px-4 rounded-r-none border-r-0 pr-2 text-base font-normal leading-normal"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    disabled={loading}
                  />
                  <div className="flex border-none bg-brand-accent3 bg-opacity-20 items-center justify-center pr-4 rounded-r-xl border-l-0 !pr-2">
                    <div className="flex items-center gap-4 justify-end">
                      <div className="flex items-center gap-1">
                        <button type="button" className="flex items-center justify-center p-1.5" disabled>
                          <div className="text-brand-text-secondary" data-icon="Image" data-size="20px" data-weight="regular">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" fill="currentColor" viewBox="0 0 256 256"><path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V158.75l-26.07-26.06a16,16,0,0,0-22.63,0l-20,20-44-44a16,16,0,0,0-22.62,0L40,149.37V56ZM40,172l52-52,80,80H40Zm176,28H194.63l-36-36,20-20L216,181.38V200ZM144,100a12,12,0,1,1,12,12A12,12,0,0,1,144,100Z"></path></svg>
                          </div>
                        </button>
                        <button type="button" className="flex items-center justify-center p-1.5" disabled>
                          <div className="text-brand-text-secondary" data-icon="Microphone" data-size="20px" data-weight="regular">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" fill="currentColor" viewBox="0 0 256 256"><path d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V232a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z"></path></svg>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </label>
              <button type="submit" className="ml-2 px-6 py-2 bg-brand-accent1 text-brand-text-on-accent font-bold rounded-full hover:opacity-90 transition" disabled={loading || !input.trim()}>{loading ? 'Sending...' : 'Send'}</button>
            </form>
            <div className="flex justify-center">
              <div className="flex flex-1 gap-3 flex-wrap px-4 py-3 max-w-[480px] justify-center">
                <button className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 bg-transparent text-brand-accent1 text-sm font-bold leading-normal tracking-[0.015em] grow" disabled>
                  <span className="truncate">End Session</span>
                </button>
                <button className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 bg-transparent text-brand-accent1 text-sm font-bold leading-normal tracking-[0.015em] grow" disabled>
                  <span className="truncate">Help/Resources</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TherapistPage;
