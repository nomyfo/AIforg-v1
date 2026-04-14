import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  MessageSquare, 
  Plus, 
  History, 
  Trash2, 
  Sparkles,
  Search,
  Bot,
  User as UserIcon,
  Clock,
  ChevronRight,
  MoreVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  orderBy,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { db, auth, signInWithGoogle } from '../lib/firebase';
import { AIModel, ChatSession, ChatMessage } from '../types';
import { callCommunityAI } from '../lib/gemini';
import { toast } from 'sonner';
import { User } from 'firebase/auth';

interface CommunityChatProps {
  user: User | null;
  communityModels: AIModel[];
  searchQuery: string;
}

export const CommunityChat = ({ user, communityModels, searchQuery }: CommunityChatProps) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setActiveSession(null);
      return;
    }

    // Fetch user's chat sessions
    const q = query(
      collection(db, 'chats'), 
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as ChatSession));
      setSessions(sessionsData);
      
      // If no active session, pick the latest one
      if (!activeSession && sessionsData.length > 0) {
        setActiveSession(sessionsData[0]);
      }
    }, (error) => {
      console.error("Firestore error:", error);
      if (error.message.includes("index")) {
        toast.error("Database index is being built. Please wait a few minutes.");
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeSession?.messages]);

  const createNewSession = async () => {
    if (!user) return;
    
    try {
      const newSession = {
        userId: user.uid,
        title: 'New Conversation',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      const docRef = await addDoc(collection(db, 'chats'), newSession);
      setActiveSession({ id: docRef.id, ...newSession });
      toast.success("New chat started");
    } catch (error) {
      console.error(error);
      toast.error("Failed to create chat");
    }
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'chats', id));
      if (activeSession?.id === id) {
        setActiveSession(null);
      }
      toast.success("Chat deleted");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete chat");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || isLoading) return;

    let currentSession = activeSession;
    
    // Create session if none active
    if (!currentSession) {
      const newSessionData = {
        userId: user.uid,
        title: input.slice(0, 30) + (input.length > 30 ? '...' : ''),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const docRef = await addDoc(collection(db, 'chats'), newSessionData);
      currentSession = { id: docRef.id, ...newSessionData };
      setActiveSession(currentSession);
    }

    const userMsg: ChatMessage = {
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    const updatedMessages = [...currentSession.messages, userMsg];
    setInput('');
    setIsLoading(true);

    // Optimistic update
    setActiveSession({ ...currentSession, messages: updatedMessages });

    try {
      const response = await callCommunityAI(communityModels, input, currentSession.messages);
      
      const aiMsg: ChatMessage = {
        role: 'model',
        text: response,
        timestamp: Date.now()
      };

      const finalMessages = [...updatedMessages, aiMsg];
      
      await updateDoc(doc(db, 'chats', currentSession.id), {
        messages: finalMessages,
        updatedAt: Date.now(),
        title: currentSession.messages.length === 0 ? input.slice(0, 30) + (input.length > 30 ? '...' : '') : currentSession.title
      });

      setActiveSession({ ...currentSession, messages: finalMessages });
    } catch (error) {
      console.error(error);
      toast.error("Failed to get AI response");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-r border-slate-100 bg-slate-50/50 flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <History size={18} className="text-indigo-600" />
                History
              </h3>
              <Button variant="ghost" size="icon" onClick={createNewSession} className="h-8 w-8 text-indigo-600 hover:bg-indigo-50">
                <Plus size={18} />
              </Button>
            </div>
            
            <ScrollArea className="flex-grow">
              <div className="p-2 space-y-1">
                {sessions
                  .filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((s) => (
                  <div 
                    key={s.id}
                    onClick={() => setActiveSession(s)}
                    className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                      activeSession?.id === s.id 
                        ? 'bg-white shadow-sm ring-1 ring-slate-200' 
                        : 'hover:bg-slate-100/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <MessageSquare size={16} className={activeSession?.id === s.id ? 'text-indigo-600' : 'text-slate-400'} />
                      <div className="flex flex-col overflow-hidden">
                        <span className={`text-sm truncate ${activeSession?.id === s.id ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                          {s.title}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(s.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => deleteSession(s.id, e)}
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-grow flex flex-col bg-white relative">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-500">
              <ChevronRight size={20} className={`transition-transform ${isSidebarOpen ? 'rotate-180' : ''}`} />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">Community Forge AI</h2>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px] py-0 px-1 border-indigo-100 text-indigo-600 bg-indigo-50">
                    {communityModels.length} Models Integrated
                  </Badge>
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 hidden sm:flex">
              Live Updates Active
            </Badge>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-grow overflow-hidden relative">
          {!user ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <UserIcon size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900">Sign in to use Forge AI</h3>
                <p className="text-sm text-slate-500 max-w-xs">
                  Connect with the community and save your conversation history by signing in.
                </p>
              </div>
              <Button onClick={() => signInWithGoogle()} className="bg-indigo-600 hover:bg-indigo-700">
                Sign in with Google
              </Button>
            </div>
          ) : (
            <div ref={scrollRef} className="h-full overflow-y-auto p-6 space-y-8">
              {!activeSession || activeSession.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
                <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-2">
                  <Bot size={40} strokeWidth={1.5} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">Welcome to the Community Forge</h3>
                  <p className="text-slate-500 text-sm">
                    This AI synthesizes the collective intelligence of every model shared by the community. 
                    Ask anything, and I'll use the best expertise available.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full">
                  {[
                    "What are the best community models for coding?",
                    "How can I improve my AI training data?",
                    "Summarize the latest AI trends.",
                    "Help me design a new AI persona."
                  ].map((suggestion, i) => (
                    <button 
                      key={i}
                      onClick={() => setInput(suggestion)}
                      className="p-3 text-left text-xs bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl border border-slate-100 transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              activeSession.messages.map((msg, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={i} 
                  className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                    msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-indigo-600'
                  }`}>
                    {msg.role === 'user' ? <UserIcon size={20} /> : <Sparkles size={20} />}
                  </div>
                  <div className={`flex flex-col gap-2 max-w-[80%] ${msg.role === 'user' ? 'items-end' : ''}`}>
                    <div className={`p-4 rounded-3xl shadow-sm border ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none' 
                        : 'bg-white border-slate-100 rounded-tl-none'
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock size={10} /> {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </motion.div>
              ))
            )}
            {isLoading && (
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <Sparkles size={20} className="animate-pulse" />
                </div>
                <div className="bg-slate-50 p-4 rounded-3xl rounded-tl-none flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-slate-100">
          <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={user ? "Ask the Community AI anything..." : "Please sign in to chat"}
              className="w-full pl-6 pr-16 py-7 bg-slate-50 border-slate-200 rounded-3xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner text-base"
              disabled={isLoading || !user}
            />
            <Button 
              type="submit" 
              disabled={!input.trim() || isLoading || !user}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 transition-all"
            >
              <Send size={20} />
            </Button>
          </form>
          <p className="text-center text-[10px] text-slate-400 mt-4">
            Community Forge AI uses collective intelligence. Responses may vary based on available models.
          </p>
        </div>
      </div>
    </div>
  );
};
