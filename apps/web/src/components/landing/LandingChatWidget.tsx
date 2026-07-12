'use client';

import { useState } from 'react';
import { ArrowRight, Bot } from 'lucide-react';

export default function LandingChatWidget() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <>
      {/* Floating Chatbot (Always Visible) */}
      <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50">
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="bg-brand-primary hover:bg-brand-primary-hover text-white px-4 sm:px-5 md:px-6 py-3 sm:py-3.5 md:py-4 rounded-full shadow-2xl transition-all transform hover:scale-105 flex items-center gap-2 sm:gap-3 group border-2 sm:border-4 border-white/20 animate-bounce-slow"
        >
          <Bot className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 group-hover:rotate-12 transition-transform flex-shrink-0" />
          <span className="font-semibold text-xs sm:text-sm md:text-base hidden sm:inline">Ask MISA AI</span>
          <span className="font-semibold text-xs sm:hidden">AI</span>
        </button>
      </div>

      {/* Chatbot Modal */}
      {isChatOpen && (
        <div className="fixed bottom-20 sm:bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in-up">
          <div className="bg-brand-primary p-3 sm:p-4 flex justify-between items-center gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <div className="bg-white/20 p-1 sm:p-1.5 rounded-lg flex-shrink-0">
                <Bot className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-xs sm:text-sm truncate">MISA</p>
                <p className="text-white/80 text-[10px] truncate">MyFNG Instant Service Assistant</p>
                <p className="text-blue-100 text-[10px] sm:text-xs truncate">Online • Book service directly</p>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-white/80 hover:text-white text-xl sm:text-2xl flex-shrink-0">
              ×
            </button>
          </div>
          <div className="h-64 sm:h-72 md:h-80 bg-gray-50 p-3 sm:p-4 overflow-y-auto">
            <div className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-brand-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-primary" />
              </div>
              <div className="bg-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl rounded-tl-none shadow-sm border border-gray-100 text-xs sm:text-sm text-gray-700">
                Hi! 👋 I&apos;m MISA — MyFNG Instant Service Assistant. Book your car service directly with me - no employee needed!
                <br />
                <br />
                What service do you need today?
              </div>
            </div>
            <div className="flex gap-1.5 sm:gap-2 justify-end mb-3 sm:mb-4">
              <div className="bg-brand-primary p-2.5 sm:p-3 rounded-xl sm:rounded-2xl rounded-tr-none shadow-sm text-xs sm:text-sm text-white max-w-[80%]">
                I need periodic service for my car
              </div>
            </div>
            <div className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-brand-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-primary" />
              </div>
              <div className="bg-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl rounded-tl-none shadow-sm border border-gray-100 text-xs sm:text-sm text-gray-700">
                Perfect! I can help you book periodic service.
                <br />
                <br />
                <strong>Transparent Pricing:</strong> Starting from ₹1,999 (varies by car model).
                <br />
                <br />
                Would you like me to check your car details and show exact pricing?
              </div>
            </div>
          </div>
          <div className="p-2.5 sm:p-3 border-t border-gray-100 bg-white">
            <div className="flex gap-1.5 sm:gap-2">
              <input
                id="chat-message"
                name="chat-message"
                type="text"
                placeholder="Type your message..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:border-brand-primary"
              />
              <button className="bg-brand-primary text-white p-1.5 sm:p-2 rounded-full hover:bg-brand-primary-hover flex-shrink-0">
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

