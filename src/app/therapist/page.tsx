'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'

interface Message {
  id: number
  role: 'user' | 'ai'
  text: string
  timestamp: Date
}

const quickPrompts = [
  { text: 'I feel anxious', icon: 'ri-emotion-unhappy-line' },
  { text: 'I feel depressed', icon: 'ri-emotion-sad-line' },
  { text: 'I am stressed', icon: 'ri-mental-health-line' },
  { text: 'I am grieving', icon: 'ri-heart-3-line' },
  { text: 'I need motivation', icon: 'ri-sparkling-2-line' },
  { text: 'Help me relax', icon: 'ri-leaf-line' },
]

const greetingMessage: Message = {
  id: 0,
  role: 'ai',
  text: "Hello, I'm glad you're here. This is a safe, judgment-free space where you can share whatever is on your mind. I'm here to listen, support, and help you work through what you're feeling. What would you like to talk about today?",
  timestamp: new Date(),
}

function getAIResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase()

  // Anxiety-related
  if (lower.includes('anxious') || lower.includes('anxiety') || lower.includes('worried') || lower.includes('panic') || lower.includes('nervous')) {
    const responses = [
      "I hear you, and anxiety can feel really overwhelming. Let's try a quick grounding exercise together: Take a slow deep breath in for 4 counts, hold for 4, and exhale for 6. Can you try that right now? Remember, anxiety is your body's alarm system -- it's trying to protect you, even when there's no real danger. You're safe here.",
      "Thank you for sharing that with me. Anxiety often feeds on uncertainty. Here are some things that can help right now: 1) Name 5 things you can see around you, 2) Focus on your breathing -- slow, steady breaths, 3) Remind yourself that this feeling is temporary. What specific situation is triggering your anxiety?",
      "I understand how draining anxiety can be. One technique that helps many people is the 5-4-3-2-1 grounding method: notice 5 things you see, 4 you can touch, 3 you hear, 2 you smell, and 1 you taste. It helps bring you back to the present moment. Would you like to try it together?",
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  // Depression-related
  if (lower.includes('depress') || lower.includes('sad') || lower.includes('hopeless') || lower.includes('empty') || lower.includes('worthless')) {
    const responses = [
      "I'm really glad you told me that. Your feelings are valid, and experiencing sadness or depression doesn't mean you're broken -- it means you're human. Even on the hardest days, you're still here, and that takes incredible strength. Can you think of one small thing you could do today, even something as simple as stepping outside for fresh air?",
      "What you're feeling matters, and you don't have to face it alone. Depression can make everything feel heavy and colorless, but please know this: the fact that you're reaching out right now shows courage. Let's start with something small today -- maybe drinking a glass of water, taking a short walk, or simply sitting in sunlight for a few minutes.",
      "I hear the pain in your words, and I want you to know that you are not a burden. Depression lies to us, telling us things won't get better, but that's not the truth. Recovery happens in small steps. What's one thing that used to bring you joy, even a little? Let's explore that together.",
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  // Stress-related
  if (lower.includes('stress') || lower.includes('overwhelm') || lower.includes('too much') || lower.includes('pressure') || lower.includes('burnout')) {
    const responses = [
      "It sounds like you're carrying a lot right now. Let's try a grounding technique: Place both feet flat on the floor, feel the weight of your body in your chair, and take three deep breaths. Stress often makes us feel like everything needs to happen at once, but you can only do one thing at a time. What feels most urgent right now?",
      "Being overwhelmed is your mind's way of saying it needs a break. Here's what I'd suggest: 1) Write down everything on your mind, 2) Circle the ONE thing you can address today, 3) Give yourself permission to let the rest wait. You're not failing by needing to slow down -- you're being wise. What's weighing on you most?",
      "I understand that feeling of being pulled in every direction. Let's practice a quick body scan: Close your eyes, start from the top of your head, and slowly notice where you're holding tension. Breathe into those areas. Stress lives in our bodies as much as our minds. Where do you feel it most right now?",
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  // Grief-related
  if (lower.includes('grief') || lower.includes('grieving') || lower.includes('lost') || lower.includes('miss') || lower.includes('died') || lower.includes('death') || lower.includes('passed away')) {
    const responses = [
      "I'm so sorry for what you're going through. Grief has no timeline and no right way to experience it. Whatever you're feeling right now -- sadness, anger, numbness, or even moments of unexpected joy -- it's all part of the process. Would you like to tell me about who or what you're grieving? I'm here to listen for as long as you need.",
      "Thank you for trusting me with something so tender. Grief can come in waves -- sometimes manageable, sometimes crashing over you without warning. Please be gentle with yourself. You don't need to 'get over it' on anyone else's schedule. What would feel comforting to you right now?",
      "Losing someone or something important leaves a space that nothing else quite fills, and that's okay. Your grief is a reflection of how deeply you loved. There's no rushing this journey. I'm here to sit with you in this, without judgment. Would you like to share a memory that means a lot to you?",
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  // Motivation / encouragement
  if (lower.includes('motivat') || lower.includes('encourage') || lower.includes('give up') || lower.includes('can\'t do') || lower.includes('stuck')) {
    const responses = [
      "I want you to know that feeling stuck doesn't mean you've failed -- it means you're at a crossroads, and that's actually a place of possibility. You've overcome challenges before, even ones that seemed impossible at the time. What's one small step you could take today, no matter how tiny? Progress isn't always visible, but every effort counts.",
      "You're being really honest with yourself right now, and that takes strength. Sometimes motivation doesn't come before action -- it comes after. Can you commit to just 5 minutes of something you've been putting off? Often, starting is the hardest part. What would you attempt if you knew you couldn't fail?",
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  // Relaxation
  if (lower.includes('relax') || lower.includes('calm') || lower.includes('peace') || lower.includes('sleep') || lower.includes('rest')) {
    const responses = [
      "Let's create a moment of calm together. Try this: Sit comfortably, close your eyes, and breathe in slowly for 4 counts... hold for 2... and exhale for 6 counts. Repeat this 5 times. As you breathe, imagine warmth spreading from your chest to your fingertips. How does that feel?",
      "Your body deserves rest, and so does your mind. Here's a progressive relaxation exercise: Starting with your toes, tense each muscle group for 5 seconds, then release. Work your way up through your legs, stomach, hands, arms, shoulders, and face. Notice the difference between tension and release. Would you like to try this together?",
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  // General / catch-all
  const generalResponses = [
    "Thank you for sharing that with me. I can tell this is important to you. Could you tell me more about how this makes you feel? Understanding our emotions is the first step toward working through them.",
    "I appreciate you opening up. What you're experiencing sounds meaningful, and I want to make sure I understand fully. When you think about this situation, what emotion comes up first? Let's explore that together.",
    "I'm here with you. Sometimes just putting things into words can help us see them more clearly. What feels most important about what you just shared? I'd like to understand what's at the heart of it.",
    "That takes courage to share. I'm listening without judgment. How long have you been feeling this way? And is there anything specific that triggered it, or has it been building over time?",
  ]
  return generalResponses[Math.floor(Math.random() * generalResponses.length)]
}

export default function TherapistPage() {
  const [messages, setMessages] = useState<Message[]>([greetingMessage])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextId = useRef(1)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  const sendMessage = (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText) return

    const userMsg: Message = {
      id: nextId.current++,
      role: 'user',
      text: messageText,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    // Simulate AI thinking delay
    setTimeout(() => {
      const response = getAIResponse(messageText)
      const aiMsg: Message = {
        id: nextId.current++,
        role: 'ai',
        text: response,
        timestamp: new Date(),
      }
      setIsTyping(false)
      setMessages(prev => [...prev, aiMsg])
    }, 1200 + Math.random() * 800)
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-brand-primary flex flex-col">
      {/* Chat Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-brand-primary/95 backdrop-blur-md border-b border-[#eedfc8]/10">
        <div className="px-5 py-3 flex items-center justify-between">
          <Link
            href="/therapy"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#eedfc8]/10 transition-colors"
          >
            <i className="ri-arrow-left-line text-[#eedfc8] text-lg"></i>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6B8A83] to-[#2A4A42] flex items-center justify-center">
              <i className="ri-robot-2-line text-[#eedfc8] text-base"></i>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#eedfc8]">AI Therapist</h2>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#6B8A83] pulse-dot"></div>
                <span className="text-[10px] text-[#eedfc8]/50">Always available</span>
              </div>
            </div>
          </div>
          <div className="w-9 h-9"></div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 px-5 pt-20 pb-40 overflow-y-auto">
        <div className="space-y-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-[#B85C3A] text-[#eedfc8] rounded-2xl rounded-br-md'
                    : 'card text-[#eedfc8] rounded-2xl rounded-bl-md'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                <p className={`text-[10px] mt-1.5 ${
                  msg.role === 'user' ? 'text-[#eedfc8]/50' : 'text-[#eedfc8]/30'
                }`}>
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="card rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#eedfc8]/40 typing-dot"></div>
                  <div className="w-2 h-2 rounded-full bg-[#eedfc8]/40 typing-dot"></div>
                  <div className="w-2 h-2 rounded-full bg-[#eedfc8]/40 typing-dot"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Prompts - shown when few messages */}
      {messages.length <= 2 && (
        <div className="fixed bottom-32 left-0 right-0 px-5 z-30">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => sendMessage(prompt.text)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#eedfc8]/10 border border-[#eedfc8]/15 text-xs text-[#eedfc8]/70 whitespace-nowrap hover:bg-[#eedfc8]/15 transition-colors shrink-0"
              >
                <i className={`${prompt.icon} text-sm`}></i>
                {prompt.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="fixed bottom-16 left-0 right-0 z-30 bg-brand-primary/95 backdrop-blur-md border-t border-[#eedfc8]/10 px-5 py-3 md:bottom-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Share what's on your mind..."
            className="input-field flex-1 pr-4"
            disabled={isTyping}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isTyping}
            className="w-10 h-10 rounded-full bg-[#B85C3A] flex items-center justify-center shrink-0 hover:bg-[#B85C3A]/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="ri-send-plane-fill text-[#eedfc8] text-base"></i>
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
