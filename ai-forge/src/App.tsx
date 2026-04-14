/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { auth, db, signInWithGoogle, logout } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
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
  increment
} from 'firebase/firestore';
import { AIModel, Review } from './types';
import { testModel, getTrainerAdvice, generateBulkExamples, generateWebExamples } from './lib/gemini';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { 
  Brain, 
  Plus, 
  Send, 
  Download, 
  Star, 
  MessageSquare, 
  Trash2, 
  Save, 
  Play, 
  Users, 
  User as UserIcon,
  Sparkles,
  LogOut,
  Search,
  Paperclip,
  FolderPlus,
  Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { VirtualLaptop } from '@/components/VirtualLaptop';
import { CommunityChat } from './components/CommunityChat';

export default function App() {
  const laptopRef = useRef<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [models, setModels] = useState<AIModel[]>([]);
  const [myModels, setMyModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [chatHistory, setChatHistory] = useState<{ role: string, text: string, vmState?: any }[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [trainerAdvice, setTrainerAdvice] = useState<string | null>(null);
  const [isGettingAdvice, setIsGettingAdvice] = useState(false);
  const [modelReviews, setModelReviews] = useState<Review[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);

  const [modelToDelete, setModelToDelete] = useState<AIModel | null>(null);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkTopic, setBulkTopic] = useState('');
  const [bulkCount, setBulkCount] = useState(20);
  const [isWebGenerating, setIsWebGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [trainingMode, setTrainingMode] = useState<'manual' | 'files'>('manual');
  const [deepSearchEnabled, setDeepSearchEnabled] = useState(false);
  const [deepThinkEnabled, setDeepThinkEnabled] = useState(false);

  // New Model State
  const [newModel, setNewModel] = useState<Partial<AIModel>>({
    name: '',
    description: '',
    systemInstruction: '',
    examples: [],
    isPublic: false,
    webAccessEnabled: false,
    deepThinkEnabled: false,
    personalLaptopEnabled: false
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Fetch public models
    const q = query(collection(db, 'models'), where('isPublic', '==', true), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const modelsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AIModel));
      setModels(modelsData);
    }, (error) => {
      console.error("Public models fetch error:", error);
      if (error.message.includes("index")) {
        toast.error("Database index for public models is being built.");
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setMyModels([]);
      return;
    }
    // Fetch user's models
    const q = query(collection(db, 'models'), where('creatorId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const modelsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AIModel));
      setMyModels(modelsData);
    }, (error) => {
      console.error("My models fetch error:", error);
      if (error.message.includes("index")) {
        toast.error("Database index for your models is being built.");
      }
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!selectedModel) {
      setModelReviews([]);
      return;
    }
    setIsLoadingReviews(true);
    const q = query(collection(db, 'models', selectedModel.id, 'reviews'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reviewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
      setModelReviews(reviewsData);
      setIsLoadingReviews(false);
    });
    return () => unsubscribe();
  }, [selectedModel?.id]);

  const handleSaveModel = async () => {
    if (!user) return toast.error("Please sign in to save models");
    if (!newModel.name || !newModel.systemInstruction) return toast.error("Name and System Instruction are required");

    try {
      const modelData = {
        name: newModel.name || '',
        description: newModel.description || '',
        systemInstruction: newModel.systemInstruction || '',
        examples: newModel.examples || [],
        isPublic: !!newModel.isPublic,
        webAccessEnabled: !!newModel.webAccessEnabled,
        deepThinkEnabled: !!newModel.deepThinkEnabled,
        personalLaptopEnabled: !!newModel.personalLaptopEnabled,
        creatorId: user.uid,
        creatorName: user.displayName || 'Anonymous',
        createdAt: selectedModel?.createdAt || Date.now(),
        rating: selectedModel?.rating || 0,
        reviewCount: selectedModel?.reviewCount || 0,
        downloads: selectedModel?.downloads || 0
      };

      if (selectedModel?.id && selectedModel.creatorId === user.uid) {
        await updateDoc(doc(db, 'models', selectedModel.id), modelData);
        toast.success("Model updated successfully");
      } else {
        await addDoc(collection(db, 'models'), modelData);
        toast.success("Model created successfully");
      }
      
      setNewModel({ name: '', description: '', systemInstruction: '', examples: [], isPublic: false, webAccessEnabled: false, deepThinkEnabled: false, personalLaptopEnabled: false });
      setSelectedModel(null);
      setActiveTab('my-models');
    } catch (error) {
      console.error(error);
      toast.error("Failed to save model");
    }
  };

  const handleTestModel = async () => {
    if (!selectedModel || !inputMessage.trim()) return;

    const newMessage = { role: 'user', text: inputMessage };
    setChatHistory(prev => [...prev, newMessage]);
    setInputMessage('');
    setIsTesting(true);

    try {
      // Create a simple UI context if laptop is enabled
      let uiContext = "";
      if (selectedModel.personalLaptopEnabled && laptopRef.current) {
        const laptopState = laptopRef.current.getState();
        uiContext = `
          The AI is currently using a Windows 11 VM.
          Open Windows: ${laptopState.windows.map((w: any) => w.title).join(', ') || 'None'}
          Active Window: ${laptopState.activeWindow || 'Desktop'}
          Browser URL: ${laptopState.browser}
          Mail Draft: To: ${laptopState.mail.to}, Subject: ${laptopState.mail.subject}
          Terminal History: ${laptopState.terminal.join('\n')}
          
          To perform an action, include [VM_ACTION: type, params] in your response.
          Types: open (id), close (id), type_mail (to, subject, body), navigate (url), run_command (command).
          IDs: mail, browser, terminal, files.
        `;
      }

      const response = await testModel(selectedModel, inputMessage, chatHistory, selectedModel.deepThinkEnabled, uiContext);
      const modelResponse = response || 'No response';
      
      // Parse VM actions
      let currentVMState = null;
      if (selectedModel.personalLaptopEnabled && laptopRef.current) {
        const actionMatch = modelResponse.match(/\[VM_ACTION:\s*(\w+),\s*({.*?}|.*?)\]/);
        if (actionMatch) {
          try {
            const action = actionMatch[1];
            let params: any = actionMatch[2];
            if (params.startsWith('{')) {
              params = JSON.parse(params);
            } else {
              params = { id: params.trim() };
            }
            laptopRef.current.executeAction(action, params);
            currentVMState = laptopRef.current.getState();
          } catch (e) {
            console.error("Failed to parse VM action", e);
          }
        }
      }

      setChatHistory(prev => [...prev, { role: 'model', text: modelResponse, vmState: currentVMState }]);

      // If DeepThink is enabled, save this turn as a training example
      if (selectedModel.deepThinkEnabled && user?.uid === selectedModel.creatorId) {
        const newExample = {
          id: Math.random().toString(36).substr(2, 9),
          input: inputMessage,
          output: modelResponse,
          type: 'manual' as const
        };
        
        const updatedExamples = [...selectedModel.examples, newExample];
        await updateDoc(doc(db, 'models', selectedModel.id), {
          examples: updatedExamples
        });
        
        // Update local state for selected model to reflect the new example
        setSelectedModel(prev => prev ? { ...prev, examples: updatedExamples } : null);
        toast.success("New training example captured via DeepThink!", { duration: 2000 });
      }
    } catch (error) {
      console.error(error);
      toast.error("Error testing model");
    } finally {
      setIsTesting(false);
    }
  };

  const handleGetAdvice = async () => {
    if (!newModel.systemInstruction) return toast.error("Add some instructions first");
    setIsGettingAdvice(true);
    try {
      const advice = await getTrainerAdvice(newModel.systemInstruction || '', (newModel.examples || []).map(e => ({ input: e.input, output: e.output })));
      setTrainerAdvice(advice || "No advice available");
    } catch (error) {
      console.error(error);
      toast.error("Failed to get advice");
    } finally {
      setIsGettingAdvice(false);
    }
  };

  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const handleAddReview = async () => {
    if (!user || !selectedModel) return toast.error("Please sign in to review");
    if (!reviewComment.trim()) return toast.error("Please add a comment");

    try {
      const reviewData = {
        modelId: selectedModel.id,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        rating: reviewRating,
        comment: reviewComment,
        createdAt: Date.now()
      };

      await addDoc(collection(db, 'models', selectedModel.id, 'reviews'), reviewData);
      
      // Update model stats
      const newReviewCount = selectedModel.reviewCount + 1;
      const newRating = ((selectedModel.rating * selectedModel.reviewCount) + reviewRating) / newReviewCount;
      
      await updateDoc(doc(db, 'models', selectedModel.id), {
        rating: newRating,
        reviewCount: newReviewCount
      });

      toast.success("Review submitted!");
      setIsReviewing(false);
      setReviewComment('');
      setReviewRating(5);
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit review");
    }
  };

  const handleDeleteModel = async () => {
    if (!modelToDelete) return;
    try {
      await deleteDoc(doc(db, 'models', modelToDelete.id));
      toast.success("Model deleted");
      setModelToDelete(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete model");
    }
  };

  const handleBulkGenerate = async () => {
    if (!bulkTopic.trim()) return toast.error("Please enter a topic");
    setIsBulkGenerating(true);
    try {
      let newExamples = [];
      if (newModel.webAccessEnabled) {
        newExamples = await generateWebExamples(bulkTopic, newModel.systemInstruction || '', bulkCount, deepSearchEnabled);
      } else {
        newExamples = await generateBulkExamples(bulkTopic, bulkCount, deepSearchEnabled);
      }
      
      if (newExamples.length > 0) {
        setNewModel(prev => ({
          ...prev,
          examples: [...(prev.examples || []), ...newExamples.map((ex: any) => ({ ...ex, id: Math.random().toString(36).substr(2, 9), type: 'manual' }))]
        }));
        toast.success(`Generated and appended ${newExamples.length} examples!`);
      } else {
        toast.error("Failed to generate examples");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error generating examples");
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'chat' | 'example-input' | 'example-output' | 'bulk-upload', exampleId?: string) => {
    const files = e.target.files;
    if (!files) return;

    let combinedContent = "";
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await file.text();
        combinedContent += `\n[File: ${file.name}]\n${text}\n`;
      } catch (err) {
        toast.error(`Could not read ${file.name}`);
      }
    }

    if (target === 'chat') {
      setInputMessage(prev => prev + combinedContent);
    } else if (target === 'example-input' && exampleId) {
      setNewModel(prev => ({
        ...prev,
        examples: prev.examples?.map(ex => ex.id === exampleId ? { ...ex, input: ex.input + combinedContent } : ex)
      }));
    } else if (target === 'example-output' && exampleId) {
      setNewModel(prev => ({
        ...prev,
        examples: prev.examples?.map(ex => ex.id === exampleId ? { ...ex, output: ex.output + combinedContent } : ex)
      }));
    } else if (target === 'bulk-upload') {
      const newExamples = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const text = await file.text();
          newExamples.push({
            id: Math.random().toString(36).substr(2, 9),
            input: `Reference File: ${file.name}`,
            output: text,
            type: 'file' as const,
            fileName: file.name
          });
        } catch (err) {
          toast.error(`Could not read ${file.name}`);
        }
      }
      setNewModel(prev => ({
        ...prev,
        examples: [...(prev.examples || []), ...newExamples]
      }));
      toast.success(`Added ${newExamples.length} files as training data`);
    }
    // Reset input
    e.target.value = '';
  };

  const downloadModel = (model: AIModel) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(model, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${model.name.replace(/\s+/g, '_')}_config.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    // Increment download count
    updateDoc(doc(db, 'models', model.id), { downloads: increment(1) });
    toast.success("Model configuration downloaded");
  };

  useEffect(() => {
    // Keep selected model in sync with updated data
    if (selectedModel) {
      const updated = models.find(m => m.id === selectedModel.id) || myModels.find(m => m.id === selectedModel.id);
      if (updated) setSelectedModel(updated);
    }
  }, [models, myModels]);

  const filteredModels = models.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMyModels = myModels.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 font-sans selection:bg-indigo-100">
      <Toaster position="top-center" />
      
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('home')}>
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200">
            <Brain size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
            AI Forge
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{user.displayName}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <Avatar className="h-9 w-9 border-2 border-indigo-50">
                <AvatarImage src={user.photoURL || ''} />
                <AvatarFallback><UserIcon size={18} /></AvatarFallback>
              </Avatar>
              <Button variant="ghost" size="icon" onClick={logout} className="text-slate-500 hover:text-red-600">
                <LogOut size={18} />
              </Button>
            </div>
          ) : (
            <Button onClick={signInWithGoogle} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6">
              Sign In
            </Button>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <TabsList className="bg-slate-100 p-1 rounded-full">
              <TabsTrigger value="home" className="rounded-full px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Sparkles size={16} className="mr-2" /> Forge AI
              </TabsTrigger>
              <TabsTrigger value="community" className="rounded-full px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Users size={16} className="mr-2" /> Community
              </TabsTrigger>
              <TabsTrigger value="my-models" className="rounded-full px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Brain size={16} className="mr-2" /> My Models
              </TabsTrigger>
              <TabsTrigger value="train" className="rounded-full px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Plus size={16} className="mr-2" /> Train New
              </TabsTrigger>
            </TabsList>
            
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input 
                placeholder="Search models..." 
                value={searchQuery || ''}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-full bg-slate-100 border-none focus:ring-indigo-500"
              />
            </div>

            {activeTab === 'community' && (
              <div className="text-sm text-slate-500 font-medium">
                Explore {models.length} community models
              </div>
            )}
          </div>
          
          <TabsContent value="home" className="mt-0">
            <CommunityChat user={user} communityModels={models} searchQuery={searchQuery} />
          </TabsContent>

          {/* Community Tab */}
          <TabsContent value="community" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredModels.map((model) => (
                  <motion.div
                    key={model.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <Card className="group hover:shadow-xl transition-all duration-300 border-slate-200 overflow-hidden h-full flex flex-col">
                      <CardHeader className="pb-4">
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-100">
                            {model.creatorName}
                          </Badge>
                          <div className="flex items-center gap-1 text-amber-500">
                            <Star size={14} fill="currentColor" />
                            <span className="text-xs font-bold">{model.rating.toFixed(1)}</span>
                          </div>
                        </div>
                        <CardTitle className="text-xl group-hover:text-indigo-600 transition-colors">{model.name}</CardTitle>
                        <CardDescription className="line-clamp-2 min-h-[40px]">{model.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <div className="flex gap-4 text-xs text-slate-500 font-medium">
                          <div className="flex items-center gap-1">
                            <MessageSquare size={14} /> {model.reviewCount} reviews
                          </div>
                          <div className="flex items-center gap-1">
                            <Download size={14} /> {model.downloads} downloads
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="bg-slate-50/50 p-4 flex gap-2">
                        <Button 
                          className="flex-1 bg-white border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200" 
                          variant="outline"
                          onClick={() => {
                            setSelectedModel(model);
                            setChatHistory([]);
                            setActiveTab('test');
                          }}
                        >
                          <Play size={16} className="mr-2" /> Test
                        </Button>
                        <Button 
                          size="icon" 
                          variant="outline" 
                          className="bg-white border-slate-200 hover:bg-indigo-50 hover:text-indigo-700"
                          onClick={() => downloadModel(model)}
                        >
                          <Download size={16} />
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </TabsContent>

          {/* My Models Tab */}
          <TabsContent value="my-models" className="mt-0">
            {!user ? (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <UserIcon size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold">Sign in to see your models</h3>
                <p className="text-slate-500 mb-6">Your trained AI models will appear here.</p>
                <Button onClick={signInWithGoogle} className="bg-indigo-600 text-white rounded-full">Sign In with Google</Button>
              </div>
            ) : myModels.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <Brain size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold">No models yet</h3>
                <p className="text-slate-500 mb-6">Start training your first AI model today.</p>
                <Button onClick={() => setActiveTab('train')} className="bg-indigo-600 text-white rounded-full">Train New Model</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMyModels.map((model) => (
                  <Card key={model.id} className="hover:shadow-lg transition-all border-slate-200">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-xl">{model.name}</CardTitle>
                        <Badge variant={model.isPublic ? "default" : "secondary"} className={model.isPublic ? "bg-green-100 text-green-700" : ""}>
                          {model.isPublic ? "Public" : "Private"}
                        </Badge>
                      </div>
                      <CardDescription>{model.description}</CardDescription>
                    </CardHeader>
                    <CardFooter className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => {
                          setSelectedModel(model);
                          setNewModel(model);
                          setActiveTab('train');
                        }}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => {
                          setSelectedModel(model);
                          setChatHistory([]);
                          setActiveTab('test');
                        }}
                      >
                        Test
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => setModelToDelete(model)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Train Tab */}
          <TabsContent value="train" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle>Model Configuration</CardTitle>
                    <CardDescription>Define how your AI should behave and respond.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Model Name</label>
                      <Input 
                        placeholder="e.g. Creative Writer, Code Assistant..." 
                        value={newModel.name || ''}
                        onChange={(e) => setNewModel(prev => ({ ...prev, name: e.target.value }))}
                        className="border-slate-200 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Description</label>
                      <Input 
                        placeholder="What does this model do?" 
                        value={newModel.description || ''}
                        onChange={(e) => setNewModel(prev => ({ ...prev, description: e.target.value }))}
                        className="border-slate-200 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-semibold text-slate-700">System Instruction</label>
                        <Button variant="ghost" size="sm" onClick={handleGetAdvice} disabled={isGettingAdvice} className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                          <Sparkles size={14} className="mr-1" /> {isGettingAdvice ? "Thinking..." : "Get Advice"}
                        </Button>
                      </div>
                      <Textarea 
                        placeholder="You are a helpful assistant that specialized in..." 
                        rows={6}
                        value={newModel.systemInstruction || ''}
                        onChange={(e) => setNewModel(prev => ({ ...prev, systemInstruction: e.target.value }))}
                        className="border-slate-200 focus:ring-indigo-500 resize-none"
                      />
                    </div>
                    <div className="flex flex-wrap gap-4 pt-2">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="isPublic" 
                          checked={!!newModel.isPublic}
                          onChange={(e) => setNewModel(prev => ({ ...prev, isPublic: e.target.checked }))}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="isPublic" className="text-sm font-medium text-slate-700">Share with community</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="webAccessEnabled" 
                          checked={!!newModel.webAccessEnabled}
                          onChange={(e) => setNewModel(prev => ({ ...prev, webAccessEnabled: e.target.checked }))}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="webAccessEnabled" className="text-sm font-medium text-slate-700 flex items-center gap-1">
                          Web Access <Badge variant="outline" className="text-[10px] py-0 px-1 border-indigo-200 text-indigo-600">New</Badge>
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="deepThinkEnabled" 
                          checked={!!newModel.deepThinkEnabled}
                          onChange={(e) => setNewModel(prev => ({ ...prev, deepThinkEnabled: e.target.checked }))}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="deepThinkEnabled" className="text-sm font-medium text-slate-700 flex items-center gap-1">
                          DeepThink <Badge variant="outline" className="text-[10px] py-0 px-1 border-amber-200 text-amber-600 bg-amber-50">Auto-Learn</Badge>
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="personalLaptopEnabled" 
                          checked={!!newModel.personalLaptopEnabled}
                          onChange={(e) => setNewModel(prev => ({ ...prev, personalLaptopEnabled: e.target.checked }))}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="personalLaptopEnabled" className="text-sm font-medium text-slate-700 flex items-center gap-1">
                          Personal Laptop <Badge variant="outline" className="text-[10px] py-0 px-1 border-emerald-200 text-emerald-600 bg-emerald-50">VM Mode</Badge>
                        </label>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle>Training Examples</CardTitle>
                      <CardDescription>Provide examples or reference files.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setNewModel(prev => ({ 
                          ...prev, 
                          examples: [...(prev.examples || []), { id: Date.now().toString(), input: '', output: '', type: 'manual' }] 
                        }))}
                        className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                      >
                        <Plus size={16} className="mr-1" /> Add Manual
                      </Button>
                      <label className="cursor-pointer flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-md text-xs font-medium hover:bg-indigo-100 transition-colors border border-indigo-100">
                        <Paperclip size={14} /> Add Files
                        <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e, 'bulk-upload')} />
                      </label>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      {newModel.examples?.map((ex, idx) => (
                        ex.type === 'manual' || !ex.type ? (
                          <div key={ex.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 relative group">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-600"
                              onClick={() => {
                                const newEx = [...(newModel.examples || [])];
                                const actualIdx = newEx.findIndex(e => e.id === ex.id);
                                newEx.splice(actualIdx, 1);
                                setNewModel(prev => ({ ...prev, examples: newEx }));
                              }}
                            >
                              <Trash2 size={14} />
                            </Button>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-[10px] uppercase bg-white">Manual Example</Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                  <label className="text-xs font-bold text-slate-500 uppercase">Input</label>
                                  <div className="flex gap-1">
                                    <label className="cursor-pointer p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors" title="Upload Files">
                                      <Paperclip size={14} />
                                      <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e, 'example-input', ex.id)} />
                                    </label>
                                    <label className="cursor-pointer p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors" title="Upload Folder">
                                      <FolderPlus size={14} />
                                      <input type="file" multiple {...{ webkitdirectory: "" } as any} className="hidden" onChange={(e) => handleFileUpload(e, 'example-input', ex.id)} />
                                    </label>
                                  </div>
                                </div>
                                <Textarea 
                                  placeholder="User message..." 
                                  value={ex.input || ''}
                                  onChange={(e) => {
                                    const newEx = [...(newModel.examples || [])];
                                    const actualIdx = newEx.findIndex(e => e.id === ex.id);
                                    newEx[actualIdx].input = e.target.value;
                                    setNewModel(prev => ({ ...prev, examples: newEx }));
                                  }}
                                  className="bg-white border-slate-200 text-sm h-20"
                                />
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                  <label className="text-xs font-bold text-slate-500 uppercase">Output</label>
                                  <div className="flex gap-1">
                                    <label className="cursor-pointer p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors" title="Upload Files">
                                      <Paperclip size={14} />
                                      <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e, 'example-output', ex.id)} />
                                    </label>
                                    <label className="cursor-pointer p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors" title="Upload Folder">
                                      <FolderPlus size={14} />
                                      <input type="file" multiple {...{ webkitdirectory: "" } as any} className="hidden" onChange={(e) => handleFileUpload(e, 'example-output', ex.id)} />
                                    </label>
                                  </div>
                                </div>
                                <Textarea 
                                  placeholder="AI response..." 
                                  value={ex.output || ''}
                                  onChange={(e) => {
                                    const newEx = [...(newModel.examples || [])];
                                    const actualIdx = newEx.findIndex(e => e.id === ex.id);
                                    newEx[actualIdx].output = e.target.value;
                                    setNewModel(prev => ({ ...prev, examples: newEx }));
                                  }}
                                  className="bg-white border-slate-200 text-sm h-20"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div key={ex.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg group">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-md">
                                <Paperclip size={16} />
                              </div>
                              <div className="overflow-hidden">
                                <p className="text-sm font-medium truncate">{ex.fileName}</p>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">Reference File</p>
                              </div>
                            </div>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                const newEx = [...(newModel.examples || [])];
                                const actualIdx = newEx.findIndex(e => e.id === ex.id);
                                newEx.splice(actualIdx, 1);
                                setNewModel(prev => ({ ...prev, examples: newEx }));
                              }}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        )
                      ))}
                      {(!newModel.examples || newModel.examples.length === 0) && (
                        <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl">
                          <FolderPlus size={32} className="mx-auto text-slate-200 mb-2" />
                          <p className="text-sm text-slate-400">No examples added yet.</p>
                          <p className="text-[10px] text-slate-300">Add manual examples or upload files to train your AI.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => {
                      setSelectedModel(null);
                      setNewModel({ name: '', description: '', systemInstruction: '', examples: [], isPublic: false, webAccessEnabled: false, deepThinkEnabled: false, personalLaptopEnabled: false });
                      setActiveTab('community');
                    }}>Cancel</Button>
                    <Button onClick={handleSaveModel} className="bg-indigo-600 text-white rounded-full px-8">
                      <Save size={16} className="mr-2" /> {selectedModel ? "Update Model" : "Save Model"}
                    </Button>
                  </CardFooter>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="border-slate-200 shadow-sm bg-indigo-600 text-white overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Sparkles size={80} />
                  </div>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles size={20} /> AI Trainer Mentor
                    </CardTitle>
                    <CardDescription className="text-indigo-100">Get expert advice on your model's design.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] pr-4">
                      {trainerAdvice ? (
                        <div className="text-sm leading-relaxed space-y-4">
                          <p className="whitespace-pre-wrap">{trainerAdvice}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
                          <Brain size={40} className="mb-4" />
                          <p className="text-sm">Click "Get Advice" to receive feedback on your system instructions and examples.</p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-900">
                      <Sparkles size={20} className="text-indigo-600" /> Bulk Data Generator
                    </CardTitle>
                    <CardDescription>
                      {newModel.webAccessEnabled 
                        ? "Using Google Search to find real-world data." 
                        : "Generate hundreds of examples automatically."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Topic or Scenario</label>
                      <Input 
                        placeholder="e.g. Customer support for a bakery" 
                        value={bulkTopic || ''}
                        onChange={(e) => setBulkTopic(e.target.value)}
                        className="border-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">
                        Batch Size
                      </label>
                      <Input 
                        type="number"
                        min={1}
                        value={bulkCount || ''}
                        onChange={(e) => setBulkCount(parseInt(e.target.value) || 0)}
                        className="border-slate-200"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input 
                        type="checkbox" 
                        id="deepSearch" 
                        checked={!!deepSearchEnabled}
                        onChange={(e) => setDeepSearchEnabled(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="deepSearch" className="text-xs font-medium text-slate-700 flex items-center gap-1">
                        Deep Search <Badge variant="outline" className="text-[9px] py-0 px-1 border-amber-200 text-amber-600 bg-amber-50">High Quality</Badge>
                      </label>
                    </div>
                    <Button 
                      className={`w-full ${newModel.webAccessEnabled ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white`} 
                      onClick={handleBulkGenerate}
                      disabled={isBulkGenerating}
                    >
                      {isBulkGenerating ? "Generating..." : (newModel.webAccessEnabled ? "Deep Web Search" : "Generate Examples")}
                    </Button>
                    <p className="text-[10px] text-slate-400 text-center">
                      {newModel.webAccessEnabled 
                        ? "Web search is active. This uses your system instructions to find specific data." 
                        : "Note: Large batches are processed with high reasoning to ensure quality."}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Test Tab */}
          <TabsContent value="test" className="mt-0">
            {selectedModel ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <Card className="border-slate-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg">{selectedModel.name}</CardTitle>
                      <CardDescription>{selectedModel.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">System Instruction</label>
                        <p className="text-xs text-slate-600 line-clamp-6 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {selectedModel.systemInstruction}
                        </p>
                      </div>
                      <Separator />
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">Community Rating</span>
                          <div className="flex items-center gap-1 text-amber-500">
                            <Star size={14} fill="currentColor" />
                            <span className="text-sm font-bold">{selectedModel.rating.toFixed(1)}</span>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                          onClick={() => setIsReviewing(true)}
                        >
                          <Star size={14} className="mr-2" /> Rate & Review
                        </Button>
                      </div>
                      <Separator />
                      <div className="space-y-3">
                        <span className="text-xs font-bold text-slate-500 uppercase">Recent Reviews</span>
                        <ScrollArea className="h-[200px] pr-3">
                          <div className="space-y-3">
                            {isLoadingReviews ? (
                              <p className="text-xs text-slate-400">Loading reviews...</p>
                            ) : modelReviews.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">No reviews yet.</p>
                            ) : (
                              modelReviews.map((review) => (
                                <div key={review.id} className="text-xs space-y-1">
                                  <div className="flex justify-between items-center">
                                    <span className="font-semibold">{review.userName}</span>
                                    <div className="flex items-center text-amber-500">
                                      <Star size={10} fill="currentColor" />
                                      <span className="ml-1">{review.rating}</span>
                                    </div>
                                  </div>
                                  <p className="text-slate-600 leading-relaxed">{review.comment}</p>
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                      <Separator />
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm" onClick={() => downloadModel(selectedModel)}>
                          <Download size={14} className="mr-2" /> Download Config
                        </Button>
                        {user?.uid === selectedModel.creatorId && (
                          <Button variant="outline" size="sm" onClick={() => {
                            setNewModel(selectedModel);
                            setActiveTab('train');
                          }}>
                            <Plus size={14} className="mr-2" /> Edit Model
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className={`lg:col-span-3 grid ${selectedModel.personalLaptopEnabled ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'} gap-6`}>
                  {selectedModel.personalLaptopEnabled && (
                    <div className="h-[600px] hidden xl:block">
                      <VirtualLaptop isVisible={true} ref={laptopRef} />
                    </div>
                  )}
                  <Card className="border-slate-200 shadow-lg h-[600px] flex flex-col overflow-hidden">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-sm font-semibold">Testing Mode</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${selectedModel.deepThinkEnabled ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-slate-100 text-slate-500'}`}>
                              DeepThink: {selectedModel.deepThinkEnabled ? 'ON' : 'OFF'}
                            </div>
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${selectedModel.personalLaptopEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500'}`}>
                              Laptop: {selectedModel.personalLaptopEnabled ? 'ON' : 'OFF'}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setChatHistory([])} className="text-slate-500">
                            Clear Chat
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-grow p-0 overflow-hidden">
                      <ScrollArea className="h-full p-6">
                        <div className="space-y-6">
                          {chatHistory.length === 0 && (
                            <div className="text-center py-20 text-slate-400">
                              <MessageSquare size={40} className="mx-auto mb-4 opacity-20" />
                              <p>Start a conversation to test your model's behavior.</p>
                            </div>
                          )}
                          {chatHistory.map((msg, idx) => (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              key={idx}
                              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-[80%] p-4 rounded-2xl ${
                                msg.role === 'user' 
                                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                                  : 'bg-slate-100 text-slate-800 rounded-tl-none'
                              }`}>
                                {msg.vmState && (
                                  <div className="mb-3 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 aspect-video relative group shadow-inner">
                                    {/* Scanlines effect */}
                                    <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,118,0.06))] bg-[length:100%_2px,3px_100%] z-20" />
                                    <div className="absolute inset-0 bg-blue-500/10 animate-pulse pointer-events-none" />
                                    
                                    {/* Recording Indicator */}
                                    <div className="absolute top-3 left-3 flex items-center gap-2 z-30">
                                      <div className="flex items-center gap-1.5 px-2 py-1 bg-red-600/90 text-white text-[9px] font-bold rounded shadow-lg backdrop-blur-sm">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                                        REC
                                      </div>
                                      <div className="px-2 py-1 bg-black/50 text-white text-[9px] font-mono rounded backdrop-blur-sm">
                                        {new Date().toLocaleTimeString([], { hour12: false })}
                                      </div>
                                    </div>

                                    {/* Content */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
                                      <div className="relative mb-3">
                                        <Monitor size={40} className="text-indigo-400/60" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <div className="w-4 h-4 bg-indigo-500/20 rounded-full animate-ping" />
                                        </div>
                                      </div>
                                      <p className="text-[11px] text-slate-200 font-mono tracking-tight">
                                        EXECUTING: {msg.vmState.activeWindow || 'SYSTEM_DESKTOP'}
                                      </p>
                                      <div className="mt-2 flex flex-col gap-1 w-full max-w-[180px]">
                                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                          <div className="h-full bg-indigo-500 w-2/3 animate-[loading_3s_ease-in-out_infinite]" />
                                        </div>
                                        <p className="text-[8px] text-slate-500 font-mono uppercase">Processing Data Stream...</p>
                                      </div>
                                    </div>

                                    {/* Bottom Info */}
                                    <div className="absolute bottom-2 right-3 text-[8px] text-slate-500 font-mono z-30">
                                      VM_ID: {selectedModel.id.slice(0, 8)}
                                    </div>
                                  </div>
                                )}
                                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                              </div>
                            </motion.div>
                          ))}
                          {isTesting && (
                            <div className="flex justify-start">
                              <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none flex gap-1">
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                              </div>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                    <CardFooter className="p-4 border-t border-slate-100">
                      <div className="flex w-full gap-2 items-end">
                        <div className="flex gap-1 mb-2">
                          <label className="cursor-pointer p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors" title="Upload Files">
                            <Paperclip size={18} />
                            <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e, 'chat')} />
                          </label>
                          <label className="cursor-pointer p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors" title="Upload Folder">
                            <FolderPlus size={18} />
                            <input type="file" multiple {...{ webkitdirectory: "" } as any} className="hidden" onChange={(e) => handleFileUpload(e, 'chat')} />
                          </label>
                        </div>
                        <form 
                          className="flex flex-grow gap-2" 
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleTestModel();
                          }}
                        >
                          <Input 
                            placeholder="Type a message to test..." 
                            value={inputMessage || ''}
                            onChange={(e) => setInputMessage(e.target.value)}
                            className="flex-grow border-slate-200 focus:ring-indigo-500"
                          />
                          <Button type="submit" disabled={isTesting || !inputMessage.trim()} className="bg-indigo-600 text-white rounded-full">
                            <Send size={18} />
                          </Button>
                        </form>
                      </div>
                    </CardFooter>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="text-center py-20">
                <Play size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold">Select a model to test</h3>
                <p className="text-slate-500 mb-6">Go to Community or My Models to pick an AI.</p>
                <Button onClick={() => setActiveTab('community')} className="bg-indigo-600 text-white rounded-full">Browse Community</Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-slate-200 py-12 px-6 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <Brain size={18} />
            </div>
            <span className="font-bold text-slate-900">AI Forge</span>
          </div>
          <div className="flex gap-8 text-sm text-slate-500 font-medium">
            <a href="#" className="hover:text-indigo-600 transition-colors">Documentation</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Terms of Service</a>
          </div>
          <p className="text-sm text-slate-400">© 2026 AI Forge. Empowering AI creators.</p>
        </div>
      </footer>

      <AnimatePresence>
        {isReviewing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200"
            >
              <h2 className="text-2xl font-bold mb-2">Rate {selectedModel?.name}</h2>
              <p className="text-slate-500 mb-6">Share your experience with this AI model.</p>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button 
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className={`p-2 rounded-lg transition-colors ${reviewRating >= star ? 'text-amber-500' : 'text-slate-300'}`}
                      >
                        <Star size={24} fill={reviewRating >= star ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Comment</label>
                  <Textarea 
                    placeholder="What do you think about this model?" 
                    value={reviewComment || ''}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="border-slate-200 focus:ring-indigo-500 h-32"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button variant="ghost" className="flex-1" onClick={() => setIsReviewing(false)}>Cancel</Button>
                  <Button className="flex-1 bg-indigo-600 text-white" onClick={handleAddReview}>Submit Review</Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {modelToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200"
            >
              <h2 className="text-2xl font-bold mb-2 text-red-600">Delete Model?</h2>
              <p className="text-slate-500 mb-6">Are you sure you want to delete "{modelToDelete.name}"? This action cannot be undone.</p>
              
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setModelToDelete(null)}>Cancel</Button>
                <Button className="flex-1 bg-red-600 text-white hover:bg-red-700" onClick={handleDeleteModel}>Delete Forever</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
