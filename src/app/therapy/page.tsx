'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

export default function TherapyPage() {
  const [selectedType, setSelectedType] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedHuman, setSelectedHuman] = useState(null);

  // User's Angels and Mentors
  const myAngels = [
    {
      id: 1,
      name: 'Maya Chen',
      specialty: 'Evening Support & Mindfulness',
      avatar: 'angel1',
      responseTime: '2-5 mins',
      rating: 4.9,
      soulsSupported: 8,
      isAvailable: true,
      bio: 'I love creating calm, safe spaces for evening reflection and gentle conversations.'
    },
    {
      id: 2,
      name: 'Marcus Thompson',
      specialty: 'Daily Motivation & Life Balance',
      avatar: 'angel2',
      responseTime: '5-10 mins',
      rating: 4.8,
      soulsSupported: 12,
      isAvailable: true,
      bio: 'I believe in celebrating small wins and finding strength in everyday moments.'
    }
  ];

  const myMentors = [
    {
      id: 1,
      name: 'Dr. Elena Rodriguez',
      specialty: 'Anxiety & Depression Support',
      avatar: 'mentor1',
      sessions: 156,
      rating: 4.9,
      isAvailable: true,
      bio: 'I understand the journey because I\'ve walked it too. Let\'s navigate this together.'
    },
    {
      id: 2,
      name: 'James Wilson',
      specialty: 'Chronic Pain & Wellness',
      avatar: 'mentor2',
      sessions: 203,
      rating: 4.8,
      isAvailable: false,
      bio: 'Living well with chronic conditions is possible. I\'m here to share what I\'ve learned.'
    }
  ];

  const aiGreetings = [
    "Hi Sarah! 🌸 I&apos;m so glad you&apos;re here. This is your safe space to share whatever is on your heart. What would you like to talk about today?",
    "Welcome to our cozy corner, Sarah! 💙 I&apos;m here to listen without judgment and support you through whatever you&apos;re feeling. How are you doing right now?",
    "Hello beautiful soul! ✨ Thank you for trusting me with your thoughts. I&apos;m here to offer comfort, understanding, and gentle guidance. What&apos;s weighing on your mind?",
    "Hey Sarah! 🌿 I&apos;m honored you chose to spend this time with me. This space is all yours - share whatever feels right for you today. I&apos;m listening with my whole heart."
  ];

  const aiResponses = [
    "That sounds really challenging, Sarah. It takes so much courage to share that with me. How are you feeling about it right now? 💙",
    "Thank you for trusting me with something so personal. Your feelings are completely valid. Would you like to explore this feeling a bit more? 🌸",
    "I hear you, and I want you to know that what you're experiencing is real and important. You're not alone in this. What would help you feel more supported right now? ✨",
    "That must feel really heavy to carry. I&apos;m glad you felt safe enough to share it here. Sometimes just saying things out loud can help. How does it feel to express this? 🌿"
  ];

  // Typing animation effect
  const typeText = (text) => {
    setIsTyping(true);
    setTypingText('');
    let index = 0;
    
    const timer = setInterval(() => {
      if (index < text.length) {
        setTypingText(text.slice(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(timer);
      }
    }, 40);
  };

  const startAIChat = () => {
    setSelectedType('ai');
    setShowChat(true);
    const randomGreeting = aiGreetings[Math.floor(Math.random() * aiGreetings.length)];
    const welcomeMessage = {
      type: 'ai',
      text: randomGreeting,
      timestamp: new Date()
    };
    setChatMessages([welcomeMessage]);
    setTimeout(() => typeText(randomGreeting), 500);
  };

  const startHumanChat = (person, type) => {
    setSelectedType('human');
    setSelectedHuman({...person, supportType: type});
    setShowChat(true);
    const welcomeMessage = {
      type: 'system',
      text: `Connecting you with ${person.name}... They&apos;ll be with you shortly! 💙`,
      timestamp: new Date()
    };
    setChatMessages([welcomeMessage]);
  };

  const sendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      type: 'user',
      text: inputMessage,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    // AI Response
    if (selectedType === 'ai') {
      setTimeout(() => {
        const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
        const aiMessage = {
          type: 'ai',
          text: randomResponse,
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, aiMessage]);
        typeText(randomResponse);
      }, 1000);
    }
  };

  const quickResponses = [
    "I&apos;m feeling anxious today 😰",
    "I had a good day! 😊",
    "I&apos;m struggling with motivation 😔",
    "I feel lonely lately 💙",
    "I&apos;m proud of myself today! 🌟",
    "I need some encouragement 🤗"
  ];

  if (showChat) {
    return (
      <div className="min-h-screen bg-brand-primary pb-24 page-therapy">
        {/* Chat Header */}
        <div className="pt-20 px-6 pb-4 bg-brand-primary border-b border-[#eedfc8]/30">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => {setShowChat(false); setSelectedType(''); setChatMessages([]);}}
              className="w-8 h-8 flex items-center justify-center"
            >
              <i className="ri-arrow-left-line text-xl text-brand-background"></i>
            </button>
            <div className="flex items-center space-x-2">
              {selectedType === 'ai' ? (
                <>
                  <div className="w-8 h-8 bg-gradient-to-r from-[#2A4A42] to-[#2A4A42]/80 rounded-full flex items-center justify-center">
                    <i className="ri-robot-line text-[#eedfc8] text-sm"></i>
                  </div>
                  <span className="font-semibold text-brand-background">AI Buddy</span>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full overflow-hidden">
                    <Image 
                      src={`https://readdy.ai/api/search-image?query=Friendly%20$%7BselectedHuman%3F.supportType%7D%20profile%20photo%2C%20warm%20smile%2C%20caring%20expression%2C%20professional%20headshot%2C%20diverse%20representation%2C%20soft%20natural%20lighting&width=32&height=32&seq=${selectedHuman?.avatar}&orientation=squarish`}
                      alt={selectedHuman?.name}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="font-semibold text-brand-background text-sm">{selectedHuman?.name}</div>
                    <div className="text-xs text-brand-background opacity-70">Your {selectedHuman?.supportType}</div>
                  </div>
                </>
              )}
            </div>
            <div className="w-8 h-8"></div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="px-6 pb-20 space-y-4">
          {chatMessages.map((message, index) => (
            <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md ${
                message.type === 'user' 
                  ? 'bg-gradient-to-r from-[var(--page-accent)] to-[var(--page-accent-light)] text-[#eedfc8] rounded-l-2xl rounded-tr-2xl' 
                  : message.type === 'system'
                  ? 'bg-[var(--page-accent)]/20 text-brand-background rounded-2xl text-center text-sm'
                  : 'bg-[#eedfc8]/20 text-brand-background rounded-r-2xl rounded-tl-2xl border border-[#eedfc8]/30'
              } px-4 py-3`}>
                <p className="text-sm leading-relaxed">
                  {message.type === 'ai' && index === chatMessages.length - 1 ? (
                    <>
                      {typingText}
                      {isTyping && <span className="animate-pulse">|</span>}
                    </>
                  ) : (
                    message.text
                  )}
                </p>
                <p className={`text-xs mt-1 opacity-70 ${message.type === 'user' ? 'text-[#eedfc8]/80' : 'text-brand-background/70'}`}>
                  {message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Responses */}
        {selectedType === 'ai' && chatMessages.length <= 2 && (
          <div className="fixed bottom-20 left-0 right-0 px-6">
            <div className="bg-[#eedfc8]/20 rounded-2xl p-4 border border-[#eedfc8]/30 mb-4">
              <h4 className="text-sm font-semibold text-brand-background mb-3">Quick share options:</h4>
              <div className="flex flex-wrap gap-2">
                {quickResponses.map((response, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setInputMessage(response);
                      setTimeout(() => sendMessage(), 100);
                    }}
                    className="bg-[var(--page-accent)]/20 text-brand-background px-3 py-2 rounded-full text-xs !rounded-button border border-[#eedfc8]/30 hover:bg-[var(--page-accent)]/30"
                  >
                    {response}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message Input */}
        <div className="fixed bottom-0 left-0 right-0 bg-[#eedfc8]/20 border-t border-[#eedfc8]/30 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Share what's on your heart..."
                className="w-full bg-[#eedfc8]/30 border border-[#eedfc8]/50 rounded-full px-4 py-3 pr-12 text-brand-background placeholder-brand-background/60 focus:outline-none focus:border-[var(--page-accent)] text-sm"
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim()}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-gradient-to-r from-[var(--page-accent)] to-[var(--page-accent-light)] rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-send-plane-fill text-[#eedfc8] text-sm"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-primary pb-24 page-therapy">
      {/* Header */}
      <div className="pt-20 px-6">
        {/* Welcome Section */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-[var(--page-accent)] to-[var(--page-accent-light)] rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-heart-line text-[#eedfc8] text-3xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-brand-background mb-2">Your Safe Haven 🌸</h1>
          <p className="text-brand-background opacity-80 text-sm leading-relaxed">
            This is your cozy corner to open up, share your feelings, and receive gentle support. 
            Choose who you&apos;d like to talk with today.
          </p>
        </div>

        {/* Support Type Selection */}
        <div className="space-y-6 mb-8">
          {/* AI Support Option */}
          <div className="bg-gradient-to-r from-[var(--page-accent)] to-[var(--page-accent-light)] rounded-2xl p-6 text-[#eedfc8] shadow-lg">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-[#eedfc8]/20 rounded-full flex items-center justify-center">
                <i className="ri-robot-line text-2xl"></i>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">🤖 AI Buddy</h3>
                <p className="text-[#eedfc8]/80 text-sm">Always here, always listening</p>
              </div>
            </div>
            
            <div className="bg-[#eedfc8]/10 rounded-xl p-4 mb-4">
              <p className="text-[#eedfc8]/80 text-sm leading-relaxed mb-3">
                • Available 24/7 with instant responses 🌙<br/>
                • Completely confidential and non-judgmental 🤐<br/>
                • Gentle guidance and emotional support 💙<br/>
                • Safe space to explore your feelings 🌸
              </p>
            </div>
            
            <button 
              onClick={startAIChat}
              className="w-full bg-[#eedfc8] text-[var(--page-accent)] py-3 rounded-full font-semibold !rounded-button"
            >
              Talk with AI Buddy 💬
            </button>
          </div>

          {/* Human Support Options */}
          <div className="bg-amber-50 rounded-2xl p-6 border border-emerald-200 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <i className="ri-user-heart-line text-emerald-600 text-lg"></i>
              </div>
              <h3 className="font-bold text-lg text-emerald-800">👥 Connect with Humans</h3>
            </div>
            
            <p className="text-emerald-600 text-sm mb-6 leading-relaxed">
              Sometimes we need that human connection. Chat with your chosen Angels or Mentors who understand your journey.
            </p>

            {/* My Angels */}
            <div className="mb-6">
              <h4 className="font-semibold text-emerald-800 mb-3 text-sm">👼 My Angels</h4>
              <div className="space-y-3">
                {myAngels.map((angel) => (
                  <div key={angel.id} className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl p-4 border border-emerald-200">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden">
                        <Image 
                          src={`https://readdy.ai/api/search-image?query=Friendly%20angel%20profile%20photo%2C%20warm%20smile%2C%20caring%20expression%2C%20professional%20headshot%2C%20diverse%20representation%2C%20soft%20natural%20lighting&width=40&height=40&seq=${angel.avatar}&orientation=squarish`}
                          alt={angel.name}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h5 className="font-semibold text-emerald-800 text-sm">{angel.name}</h5>
                          {angel.isAvailable && (
                            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          )}
                        </div>
                        <p className="text-emerald-600 text-xs">{angel.specialty}</p>
                        <p className="text-emerald-500 text-xs">Usually responds in {angel.responseTime}</p>
                      </div>
                    </div>
                    
                    <p className="text-emerald-600 text-xs mb-3 italic">&quot;{angel.bio}&quot;</p>
                    
                    <button 
                      onClick={() => startHumanChat(angel, 'angel')}
                      disabled={!angel.isAvailable}
                      className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 text-cream py-2 rounded-full text-sm font-medium !rounded-button disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {angel.isAvailable ? 'Connect with Angel 👼' : 'Currently Unavailable'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* My Mentors */}
            <div>
              <h4 className="font-semibold text-emerald-800 mb-3 text-sm">🌟 My Mentors</h4>
              <div className="space-y-3">
                {myMentors.map((mentor) => (
                  <div key={mentor.id} className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-200">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden">
                        <Image 
                          src={`https://readdy.ai/api/search-image?query=Professional%20mentor%20profile%20photo%2C%20warm%20smile%2C%20experienced%20and%20caring%20expression%2C%20professional%20headshot%2C%20diverse%20representation%2C%20soft%20natural%20lighting&width=40&height=40&seq=${mentor.avatar}&orientation=squarish`}
                          alt={mentor.name}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h5 className="font-semibold text-emerald-800 text-sm">{mentor.name}</h5>
                          {mentor.isAvailable && (
                            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          )}
                        </div>
                        <p className="text-emerald-600 text-xs">{mentor.specialty}</p>
                        <p className="text-emerald-500 text-xs">{mentor.sessions} sessions completed</p>
                      </div>
                    </div>
                    
                    <p className="text-emerald-600 text-xs mb-3 italic">&quot;{mentor.bio}&quot;</p>
                    
                    <button 
                      onClick={() => startHumanChat(mentor, 'mentor')}
                      disabled={!mentor.isAvailable}
                      className="w-full bg-gradient-to-r from-emerald-500 to-green-500 text-cream py-2 rounded-full text-sm font-medium !rounded-button disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {mentor.isAvailable ? 'Connect with Mentor 🌟' : 'Currently in Session'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Comfort Features */}
        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl p-6 border border-emerald-200 mb-8">
          <h3 className="font-semibold text-emerald-800 mb-4 text-center">🌿 Your Comfort Toolkit</h3>
          <div className="grid grid-cols-2 gap-4">
            <button className="bg-amber-50 rounded-xl p-4 text-center border border-emerald-200 !rounded-button">
              <i className="ri-music-line text-emerald-600 text-2xl mb-2"></i>
              <p className="text-emerald-800 text-sm font-medium">Calming Sounds</p>
            </button>
            <button className="bg-amber-50 rounded-xl p-4 text-center border border-emerald-200 !rounded-button">
              <i className="ri-leaf-line text-emerald-600 text-2xl mb-2"></i>
              <p className="text-emerald-800 text-sm font-medium">Breathing Exercise</p>
            </button>
            <button className="bg-amber-50 rounded-xl p-4 text-center border border-emerald-200 !rounded-button">
              <i className="ri-bookmark-line text-emerald-600 text-2xl mb-2"></i>
              <p className="text-emerald-800 text-sm font-medium">Affirmations</p>
            </button>
            <button className="bg-amber-50 rounded-xl p-4 text-center border border-emerald-200 !rounded-button">
              <i className="ri-heart-pulse-line text-emerald-600 text-2xl mb-2"></i>
              <p className="text-emerald-800 text-sm font-medium">Mood Check</p>
            </button>
          </div>
        </div>

        {/* Emergency Support */}
        <div className="bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl p-6 text-cream text-center">
          <div className="w-12 h-12 bg-cream/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <i className="ri-phone-line text-2xl"></i>
          </div>
          <h3 className="font-bold mb-2">Need Immediate Help? 🆘</h3>
          <p className="text-red-100 text-sm mb-4">If you&apos;re in crisis, please reach out for immediate support</p>
          <div className="space-y-2">
            <button className="w-full bg-cream text-red-600 py-3 rounded-full font-semibold !rounded-button">
              Crisis Helpline: 988
            </button>
            <button className="w-full border border-cream/30 py-2 rounded-full text-sm !rounded-button">
              Local Emergency Resources
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}