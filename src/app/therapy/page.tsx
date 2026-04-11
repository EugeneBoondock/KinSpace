'use client';

import { useState, useRef, useEffect } from 'react';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/lib/AuthContext';

type Tab = 'ai-chat' | 'my-team';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

const quickPrompts = [
  { text: "I'm feeling anxious", icon: 'ri-emotion-unhappy-line' },
  { text: 'Help me cope', icon: 'ri-hand-heart-line' },
  { text: 'I need someone to talk to', icon: 'ri-chat-heart-line' },
  { text: 'Breathing exercises', icon: 'ri-lungs-line' },
];

const aiResponses: Record<string, string> = {
  "I'm feeling anxious":
    "I hear you, and I want you to know that what you're feeling is valid. Anxiety can feel overwhelming, but you've taken an important step by reaching out. Let's work through this together. Can you tell me more about what's triggering your anxiety right now? Sometimes naming what we feel can help us regain a sense of control.",
  'Help me cope':
    "I'm glad you're looking for ways to cope. That takes real strength. Here are a few techniques that might help right now:\n\n1. Ground yourself: Name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, and 1 you can taste.\n\n2. Progressive muscle relaxation: Tense and release each muscle group starting from your toes.\n\n3. Write it down: Sometimes putting thoughts on paper helps process them.\n\nWhich of these would you like to try?",
  'I need someone to talk to':
    "I'm here for you, and I'm listening. You don't have to go through this alone. Whether you want to vent, process something difficult, or just have someone present -- I'm not going anywhere. Take your time, there's no rush. What's on your mind?",
  'Breathing exercises':
    "Let's do a calming breathing exercise together. Try the 4-7-8 technique:\n\n1. Breathe in slowly through your nose for 4 seconds\n2. Hold your breath gently for 7 seconds\n3. Exhale slowly through your mouth for 8 seconds\n\nLet's repeat this 3-4 times. This activates your parasympathetic nervous system and helps your body shift from stress mode to calm mode. Ready to try it?",
};

const defaultAiResponse =
  "Thank you for sharing that with me. I can see this is important to you. I'm here to listen and support you through whatever you're experiencing. Would you like to explore this further, or would you prefer some coping strategies to help right now?";

const mockAngels = [
  {
    id: '1',
    name: 'Maya Chen',
    specialty: 'Anxiety & Depression',
    rating: 4.9,
    responseTime: '< 5 min',
    status: 'online',
    sessions: 47,
    bio: 'Certified peer support specialist with 8 years of personal experience navigating anxiety.',
  },
  {
    id: '2',
    name: 'Marcus Thompson',
    specialty: 'Chronic Pain',
    rating: 4.8,
    responseTime: '< 15 min',
    status: 'online',
    sessions: 32,
    bio: 'Chronic pain warrior dedicated to helping others find their coping strategies.',
  },
];

const mockMentors = [
  {
    id: '1',
    name: 'Dr. Elena Rodriguez',
    specialty: 'Clinical Psychology',
    credentials: 'PhD, Licensed Psychologist',
    rating: 4.9,
    sessions: 342,
    nextAvailable: 'Today, 3:00 PM',
    price: 75,
  },
  {
    id: '2',
    name: 'James Wilson',
    specialty: 'Recovery Coaching',
    credentials: 'CPRS, Recovery Coach',
    rating: 4.8,
    sessions: 218,
    nextAvailable: 'Tomorrow, 10:00 AM',
    price: 45,
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <i
          key={star}
          className={`${
            star <= Math.floor(rating)
              ? 'ri-star-fill'
              : star - 0.5 <= rating
                ? 'ri-star-half-fill'
                : 'ri-star-line'
          } text-[#D19A58] text-sm`}
        />
      ))}
      <span className="text-xs text-[#eedfc8]/60 ml-1">{rating}</span>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div className="w-8 h-8 rounded-full bg-[#D19A58]/20 flex items-center justify-center flex-shrink-0">
        <i className="ri-robot-line text-[#D19A58] text-sm" />
      </div>
      <div className="card-light px-4 py-3 max-w-[80%]">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#eedfc8]/40 typing-dot" />
          <div className="w-2 h-2 rounded-full bg-[#eedfc8]/40 typing-dot" />
          <div className="w-2 h-2 rounded-full bg-[#eedfc8]/40 typing-dot" />
        </div>
      </div>
    </div>
  );
}

export default function Therapy() {
  const { loading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('ai-chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'ai',
      content:
        "Hi there. I'm your KinSpace AI companion. I'm here to listen, support, and help you navigate whatever you're going through. This is a safe, judgment-free space. How are you feeling today?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const sendMessage = (content: string) => {
    if (!content.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      const response = aiResponses[content.trim()] || defaultAiResponse;
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1500 + Math.random() * 1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-primary pb-20">
        <div className="px-4 pt-6 space-y-4">
          <div className="h-8 w-48 skeleton" />
          <div className="flex gap-2">
            <div className="h-10 flex-1 skeleton rounded-full" />
            <div className="h-10 flex-1 skeleton rounded-full" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}
              >
                <div className="h-16 w-3/4 skeleton rounded-2xl" />
              </div>
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-primary pb-20 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-[#eedfc8]">Therapy</h1>
          <button className="w-10 h-10 rounded-full bg-[#eedfc8]/10 flex items-center justify-center">
            <i className="ri-phone-line text-[#eedfc8] text-lg" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex gap-1 bg-[#eedfc8]/5 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('ai-chat')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
              activeTab === 'ai-chat' ? 'tab-active' : 'tab-inactive'
            }`}
          >
            <i className="ri-robot-line" />
            AI Chat
          </button>
          <button
            onClick={() => setActiveTab('my-team')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
              activeTab === 'my-team' ? 'tab-active' : 'tab-inactive'
            }`}
          >
            <i className="ri-team-line" />
            My Team
          </button>
        </div>
      </div>

      {/* AI Chat Tab */}
      {activeTab === 'ai-chat' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${
                  msg.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                {msg.role === 'ai' && (
                  <div className="w-8 h-8 rounded-full bg-[#D19A58]/20 flex items-center justify-center flex-shrink-0">
                    <i className="ri-robot-line text-[#D19A58] text-sm" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#eedfc8] text-[#2A4A42] rounded-br-md'
                      : 'card-light rounded-bl-md'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.content}</p>
                  <p
                    className={`text-[10px] mt-1.5 ${
                      msg.role === 'user' ? 'text-[#2A4A42]/50' : 'text-[#eedfc8]/30'
                    }`}
                  >
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-4 py-2 flex-shrink-0">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt.text}
                  onClick={() => sendMessage(prompt.text)}
                  disabled={isTyping}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs whitespace-nowrap bg-[#eedfc8]/10 text-[#eedfc8]/70 hover:bg-[#eedfc8]/15 transition-all disabled:opacity-40 flex-shrink-0"
                >
                  <i className={prompt.icon} />
                  {prompt.text}
                </button>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <form
            onSubmit={handleSubmit}
            className="px-4 pb-4 flex-shrink-0"
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type a message..."
                className="input-field flex-1"
                disabled={isTyping}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="w-11 h-11 rounded-full bg-[#eedfc8] text-[#2A4A42] flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-[#eedfc8]/90"
              >
                <i className="ri-send-plane-fill text-lg" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* My Team Tab */}
      {activeTab === 'my-team' && (
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
          {/* My Angels Section */}
          <div>
            <h2 className="section-title flex items-center gap-2">
              <i className="ri-heart-pulse-line text-[#D19A58]" />
              My Angels
            </h2>
            <div className="space-y-3">
              {mockAngels.map((angel) => (
                <div key={angel.id} className="card space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-[#D19A58]/20 flex items-center justify-center">
                        <span className="text-[#D19A58] font-bold text-sm">
                          {angel.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </span>
                      </div>
                      {angel.status === 'online' && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-brand-primary pulse-dot" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#eedfc8]">{angel.name}</h3>
                      <p className="text-xs text-[#D19A58] font-medium">
                        {angel.specialty}
                      </p>
                      <StarRating rating={angel.rating} />
                    </div>
                  </div>
                  <p className="text-sm text-[#eedfc8]/60">{angel.bio}</p>
                  <div className="flex items-center gap-4 text-xs text-[#eedfc8]/50">
                    <span className="flex items-center gap-1">
                      <i className="ri-time-line" />
                      {angel.responseTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="ri-chat-check-line" />
                      {angel.sessions} sessions
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 btn-primary text-sm py-2">
                      <i className="ri-chat-1-line mr-1.5" />
                      Message
                    </button>
                    <button className="btn-secondary text-sm py-2 px-4">
                      <i className="ri-phone-line" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* My Mentors Section */}
          <div>
            <h2 className="section-title flex items-center gap-2">
              <i className="ri-user-star-line text-[#B85C3A]" />
              My Mentors
            </h2>
            <div className="space-y-3">
              {mockMentors.map((mentor) => (
                <div key={mentor.id} className="card space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#B85C3A]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#B85C3A] font-bold text-sm">
                        {mentor.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#eedfc8]">{mentor.name}</h3>
                      <p className="text-xs text-[#eedfc8]/50">{mentor.credentials}</p>
                      <StarRating rating={mentor.rating} />
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-[#D19A58]">
                        ${mentor.price}
                      </p>
                      <p className="text-[10px] text-[#eedfc8]/40">per session</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#eedfc8]/50">
                    <span className="flex items-center gap-1">
                      <i className="ri-calendar-check-line" />
                      {mentor.sessions} sessions completed
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="ri-time-line" />
                      Next: {mentor.nextAvailable}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 btn-accent text-sm py-2">
                      <i className="ri-calendar-line mr-1.5" />
                      Book Session
                    </button>
                    <button className="btn-secondary text-sm py-2 px-4">
                      <i className="ri-chat-1-line" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Find More Support */}
          <div className="card-light text-center py-6">
            <i className="ri-add-circle-line text-3xl text-[#D19A58] mb-2" />
            <p className="text-sm text-[#eedfc8]/70 mb-3">
              Looking for additional support?
            </p>
            <button className="btn-secondary text-sm">Browse Angels & Mentors</button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
