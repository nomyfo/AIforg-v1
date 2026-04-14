import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Minus, 
  Square, 
  Mail, 
  Globe, 
  Terminal, 
  Folder, 
  Search, 
  Settings, 
  Power,
  User,
  Bell,
  Wifi,
  Volume2,
  Clock,
  Send,
  UserPlus,
  Paperclip,
  Maximize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface WindowState {
  id: string;
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  isMinimized: boolean;
  zIndex: number;
  type: 'mail' | 'browser' | 'terminal' | 'files';
}

export const VirtualLaptop = forwardRef(({ isVisible }: { isVisible: boolean }, ref) => {
  const [windows, setWindows] = useState<WindowState[]>([
    { id: 'mail', title: 'Outlook', icon: <Mail size={14} />, isOpen: false, isMinimized: false, zIndex: 1, type: 'mail' },
    { id: 'browser', title: 'Edge', icon: <Globe size={14} />, isOpen: false, isMinimized: false, zIndex: 1, type: 'browser' },
    { id: 'terminal', title: 'PowerShell', icon: <Terminal size={14} />, isOpen: false, isMinimized: false, zIndex: 1, type: 'terminal' },
    { id: 'files', title: 'File Explorer', icon: <Folder size={14} />, isOpen: false, isMinimized: false, zIndex: 1, type: 'files' },
  ]);

  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [maxZIndex, setMaxZIndex] = useState(10);
  const [time, setTime] = useState(new Date());

  // App Specific State
  const [mailState, setMailState] = useState({ to: '', subject: '', body: '' });
  const [browserUrl, setBrowserUrl] = useState('https://www.google.com');
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);

  useImperativeHandle(ref, () => ({
    executeAction: (action: string, params?: any) => {
      switch (action) {
        case 'open':
          openWindow(params.id);
          break;
        case 'close':
          closeWindow(params.id);
          break;
        case 'type_mail':
          setMailState(prev => ({ ...prev, ...params }));
          openWindow('mail');
          break;
        case 'navigate':
          setBrowserUrl(params.url);
          openWindow('browser');
          break;
        case 'run_command':
          setTerminalHistory(prev => [...prev, `PS C:\\Users\\AI_Forge> ${params.command}`, `Result: Executing ${params.command}...`]);
          openWindow('terminal');
          break;
      }
    },
    getState: () => ({
      windows: windows.filter(w => w.isOpen).map(w => ({ id: w.id, title: w.title, isMinimized: w.isMinimized })),
      activeWindow: activeWindowId,
      mail: mailState,
      browser: browserUrl,
      terminal: terminalHistory.slice(-5)
    })
  }));

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const openWindow = (id: string) => {
    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        return { ...w, isOpen: true, isMinimized: false, zIndex: maxZIndex + 1 };
      }
      return w;
    }));
    setActiveWindowId(id);
    setMaxZIndex(prev => prev + 1);
  };

  const closeWindow = (id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isOpen: false } : w));
    if (activeWindowId === id) setActiveWindowId(null);
  };

  const minimizeWindow = (id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: true } : w));
    setActiveWindowId(null);
  };

  const focusWindow = (id: string) => {
    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        return { ...w, isMinimized: false, zIndex: maxZIndex + 1 };
      }
      return w;
    }));
    setActiveWindowId(id);
    setMaxZIndex(prev => prev + 1);
  };

  if (!isVisible) return null;

  return (
    <div className="relative w-full h-full bg-[#0078d4] overflow-hidden rounded-xl border-4 border-slate-800 shadow-2xl font-sans select-none">
      {/* Desktop Wallpaper (Windows 11 Style) */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-500 to-purple-600 opacity-80" />
      <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/windows11/1920/1080')] bg-cover bg-center mix-blend-overlay opacity-30" />

      {/* Desktop Icons */}
      <div className="absolute top-4 left-4 grid grid-flow-row gap-6">
        {windows.map(w => (
          <button 
            key={w.id}
            onDoubleClick={() => openWindow(w.id)}
            className="flex flex-col items-center gap-1 w-20 group"
          >
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 group-hover:bg-white/20 transition-all shadow-lg text-white">
              {React.cloneElement(w.icon as React.ReactElement<any>, { size: 32 })}
            </div>
            <span className="text-[10px] font-medium text-white drop-shadow-md text-center px-1 rounded group-hover:bg-blue-500/50">
              {w.title}
            </span>
          </button>
        ))}
      </div>

      {/* Windows Container */}
      <div className="absolute inset-0 pointer-events-none">
        <AnimatePresence>
          {windows.filter(w => w.isOpen && !w.isMinimized).map(w => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{ zIndex: w.zIndex }}
              className={`absolute top-10 left-10 w-[80%] h-[70%] bg-white/90 backdrop-blur-xl rounded-xl shadow-2xl border border-white/30 flex flex-col overflow-hidden pointer-events-auto ${activeWindowId === w.id ? 'ring-2 ring-blue-400/50' : ''}`}
              onMouseDown={() => focusWindow(w.id)}
            >
              {/* Title Bar */}
              <div className="h-10 bg-slate-100/50 border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">{w.icon}</span>
                  <span className="text-xs font-semibold text-slate-700">{w.title}</span>
                </div>
                <div className="flex items-center">
                  <button onClick={() => minimizeWindow(w.id)} className="p-2 hover:bg-slate-200 text-slate-500 transition-colors"><Minus size={14} /></button>
                  <button className="p-2 hover:bg-slate-200 text-slate-500 transition-colors"><Square size={12} /></button>
                  <button onClick={() => closeWindow(w.id)} className="p-2 hover:bg-red-500 hover:text-white text-slate-500 transition-colors"><X size={14} /></button>
                </div>
              </div>

              {/* Window Content */}
              <div className="flex-grow overflow-auto p-4 bg-white">
                {w.type === 'mail' && <MailApp state={mailState} setState={setMailState} />}
                {w.type === 'browser' && <BrowserApp url={browserUrl} setUrl={setBrowserUrl} />}
                {w.type === 'terminal' && <TerminalApp history={terminalHistory} />}
                {w.type === 'files' && <FilesApp />}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Taskbar */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-white/70 backdrop-blur-2xl border-t border-white/30 flex items-center justify-between px-4 z-[9999]">
        <div className="flex items-center gap-1">
          <button className="p-2 hover:bg-white/50 rounded-md transition-all text-blue-600">
            <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
              <div className="bg-current rounded-sm opacity-60" />
              <div className="bg-current rounded-sm" />
              <div className="bg-current rounded-sm" />
              <div className="bg-current rounded-sm opacity-60" />
            </div>
          </button>
          <div className="w-px h-6 bg-slate-300 mx-1" />
          <div className="flex items-center gap-1">
            {windows.map(w => (
              <button 
                key={w.id}
                onClick={() => w.isOpen ? (w.isMinimized ? focusWindow(w.id) : minimizeWindow(w.id)) : openWindow(w.id)}
                className={`p-2 rounded-md transition-all relative group ${w.isOpen ? 'bg-white/50 shadow-sm' : 'hover:bg-white/30'}`}
              >
                <div className={`${w.isOpen ? 'text-blue-600' : 'text-slate-600'}`}>
                  {w.icon}
                </div>
                {w.isOpen && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1 bg-blue-600 rounded-full" />
                )}
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {w.title}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2 py-1 hover:bg-white/50 rounded-md transition-all cursor-default">
            <Wifi size={14} className="text-slate-600" />
            <Volume2 size={14} className="text-slate-600" />
            <div className="flex flex-col items-end leading-none">
              <span className="text-[10px] font-bold text-slate-700">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-[8px] text-slate-500">{time.toLocaleDateString()}</span>
            </div>
          </div>
          <button className="p-2 hover:bg-white/50 rounded-md transition-all text-slate-600">
            <Bell size={14} />
          </button>
          <div className="w-1 h-full border-l border-slate-300 ml-1" />
        </div>
      </div>
    </div>
  );
});

const MailApp = ({ state, setState }: { state: any, setState: any }) => (
  <div className="h-full flex flex-col gap-4">
    <div className="flex items-center justify-between border-b pb-4">
      <h3 className="text-lg font-bold text-slate-800">New Message</h3>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="text-xs h-8"><Paperclip size={14} className="mr-1" /> Attach</Button>
        <Button size="sm" className="bg-blue-600 text-white text-xs h-8"><Send size={14} className="mr-1" /> Send</Button>
      </div>
    </div>
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b py-2">
        <span className="text-xs font-bold text-slate-400 w-12">To:</span>
        <Input 
          placeholder="recipients@example.com" 
          value={state.to}
          onChange={(e) => setState({ ...state, to: e.target.value })}
          className="border-none shadow-none h-6 text-sm focus-visible:ring-0 px-0" 
        />
        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400"><UserPlus size={14} /></Button>
      </div>
      <div className="flex items-center gap-2 border-b py-2">
        <span className="text-xs font-bold text-slate-400 w-12">Subject:</span>
        <Input 
          placeholder="Enter subject" 
          value={state.subject}
          onChange={(e) => setState({ ...state, subject: e.target.value })}
          className="border-none shadow-none h-6 text-sm focus-visible:ring-0 px-0" 
        />
      </div>
      <Textarea 
        placeholder="Write your email here..." 
        value={state.body}
        onChange={(e) => setState({ ...state, body: e.target.value })}
        className="flex-grow border-none shadow-none resize-none text-sm focus-visible:ring-0 px-0 min-h-[200px]"
      />
    </div>
  </div>
);

const BrowserApp = ({ url, setUrl }: { url: string, setUrl: any }) => (
  <div className="h-full flex flex-col gap-4">
    <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-lg">
      <div className="flex gap-1 mr-2">
        <div className="w-3 h-3 rounded-full bg-slate-300" />
        <div className="w-3 h-3 rounded-full bg-slate-300" />
      </div>
      <div className="flex-grow flex items-center gap-2 bg-white px-3 py-1 rounded-md border border-slate-200">
        <Globe size={12} className="text-slate-400" />
        <Input 
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="border-none shadow-none h-5 text-xs focus-visible:ring-0 px-0 flex-grow" 
        />
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8"><Search size={14} /></Button>
    </div>
    <div className="flex-grow flex flex-col items-center justify-center text-slate-300 gap-4">
      <Globe size={64} strokeWidth={1} />
      <p className="text-sm font-medium">Browsing: {url}</p>
    </div>
  </div>
);

const TerminalApp = ({ history }: { history: string[] }) => (
  <div className="h-full bg-slate-900 rounded-lg p-4 font-mono text-xs text-emerald-400 overflow-auto">
    <p className="mb-2 text-slate-400">Windows PowerShell</p>
    <p className="mb-4 text-slate-400">Copyright (C) Microsoft Corporation. All rights reserved.</p>
    {history.map((line, i) => (
      <p key={i} className="mb-1">{line}</p>
    ))}
    <div className="flex gap-2">
      <span className="text-blue-400">PS C:\Users\AI_Forge&gt;</span>
      <span className="animate-pulse">_</span>
    </div>
  </div>
);

const FilesApp = () => (
  <div className="h-full flex flex-col gap-4">
    <div className="flex items-center gap-4 text-xs font-medium text-slate-500 border-b pb-2">
      <button className="text-blue-600 border-b-2 border-blue-600 pb-2 px-1">Home</button>
      <button className="hover:text-slate-800 pb-2 px-1">Gallery</button>
      <button className="hover:text-slate-800 pb-2 px-1">Desktop</button>
      <button className="hover:text-slate-800 pb-2 px-1">Documents</button>
    </div>
    <div className="grid grid-cols-4 gap-4">
      {['Documents', 'Pictures', 'Music', 'Videos', 'Downloads', 'Desktop'].map(folder => (
        <div key={folder} className="flex flex-col items-center gap-1 p-2 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors group">
          <Folder size={40} className="text-blue-400 fill-blue-50 group-hover:fill-blue-100 transition-colors" />
          <span className="text-[10px] font-medium text-slate-600">{folder}</span>
        </div>
      ))}
    </div>
  </div>
);
