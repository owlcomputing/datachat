import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { MessageSquareText, Database, User, Trash2 } from "lucide-react"
import Link from "next/link"
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/router'
import { LineChartComponent } from "@/components/LineChart"
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'

// Add this interface at the top of the file
interface VisualizationData {
  type: string;
  componentConfig?: {
    data: Array<Record<string, any>>;
    config: Record<string, any>;
    title: string;
    description?: string;
    xAxisKey: string;
    lineKeys: string[];
    footerText?: string;
    trendText?: string;
  };
}

// Update the messages state type
interface Message {
  content: string;
  isUser: boolean;
  visualization?: VisualizationData;
}

function useStreamingResponse(connections: Array<{ name: string; connection: string }>) {
    const [streamingText, setStreamingText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const supabaseClient = useSupabaseClient();
    const user = useUser();

    const sendMessage = useCallback(async (message: string, selectedDb: string | null) => {
        setIsLoading(true);
        setError(null);
        setStreamingText('');

        if (!user || !selectedDb) {
            setIsLoading(false);
            setError(new Error("User not logged in or no database selected."));
            return;
        }

        const connection = connections.find(db => db.connection === selectedDb);
        if (!connection) {
            setIsLoading(false);
            setError(new Error("Selected database connection not found."));
            return;
        }

        try {
            const response = await fetch('/api/agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    userId: user.id,
                    displayName: connection.name,
                }),
            });

            if (!response.ok || !response.body) {
                throw new Error('Network response was not ok');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                setStreamingText(prev => prev + chunk);
            }
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, [user, connections]);

    useEffect(() => {
        if (!isLoading && streamingText) {
            setStreamingText(""); // Reset after adding to messages
        }
    }, [isLoading, streamingText]);

    return { streamingText, isLoading, error, sendMessage, setStreamingText };
}

// Update the loading indicator
const LoadingDots = () => (
  <div className="flex justify-start">
    <div className="p-3 rounded-lg max-w-[75%] bg-gray-200 text-black flex space-x-1">
      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.5s]"></div>
    </div>
  </div>
);

export default function Index() {
    const [selectedDb, setSelectedDb] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const router = useRouter();
    const [connections, setConnections] = useState<Array<{ name: string; connection: string }>>([]);
    const { streamingText, isLoading, error, sendMessage, setStreamingText } = useStreamingResponse(connections); // Use the hook

    // Fetch connections
    useEffect(() => {
        const fetchConnections = async () => {
            if (user) {
                const { data, error } = await supabaseClient
                    .from('database_connections')
                    .select('display_name, id')
                    .eq('user_id', user.id);

                if (error) {
                    console.error("Error fetching connections:", error);
                } else if (data) {
                    const formattedConnections = data.map(item => ({
                        name: item.display_name,
                        connection: item.id,
                    }));
                    setConnections(formattedConnections);
                    if (formattedConnections.length > 0 && !selectedDb) {
                        setSelectedDb(formattedConnections[0].connection);
                    }
                }
            }
        };

        fetchConnections();
    }, [user, supabaseClient, selectedDb]);

    // Basic session check
    useEffect(() => {
        if (!user) {
            console.log("No user logged in");
        } else {
            console.log("User logged in:", user.email);
        }
    }, [user, router]);

    // Update the useEffect for scrolling
    useEffect(() => {
        const scrollContainer = document.querySelector('.overflow-y-auto');
        if (scrollContainer) {
            scrollContainer.scrollTo({
                top: scrollContainer.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages, streamingText, isLoading]);

    const handleSend = async () => {
        if (!selectedDb) return;
        if (!message.trim()) return;

        const newMessage = { content: message, isUser: true };
        setMessages(prev => [...prev, newMessage]);
        setMessage('');
        sendMessage(message, selectedDb);
    };

    // Update the useEffect that handles streamingText
    useEffect(() => {
        if (!isLoading && streamingText) {
            try {
                const response = JSON.parse(streamingText);
                setMessages((prev) => [
                    ...prev, 
                    { 
                        content: response.answer, 
                        isUser: false,
                        visualization: response.visualization
                    }
                ]);
                setStreamingText('');
            } catch (e) {
                // If it's not JSON, treat it as plain text
                setMessages((prev) => [
                    ...prev, 
                    { 
                        content: streamingText, 
                        isUser: false 
                    }
                ]);
                setStreamingText('');
            }
        }
    }, [isLoading, streamingText, setMessages]);

    return (
        <div className="min-h-screen w-full bg-background text-foreground flex">
            {/* Desktop Sidebar - Display Connections */}
            <aside className="hidden lg:block w-64 border-r border-border bg-muted/20 p-4">
                <nav className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold tracking-tight">Data Connections</h2>
                    </div>

                    <div className="space-y-1">
                        {connections.map((db) => (
                            <div key={db.connection} className="flex gap-1 items-center">
                                <Button
                                    variant={selectedDb === db.connection ? 'secondary' : 'ghost'}
                                    className="w-full justify-start flex-1"
                                    onClick={() => setSelectedDb(db.connection)}
                                >
                                    <span className="truncate">{db.name}</span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t">
                        <Link href="/profile">
                            <Button
                                variant="ghost"
                                className="w-full justify-start"
                            >
                                <User className="h-4 w-4 mr-2" />
                                Profile & Settings
                            </Button>
                        </Link>
                    </div>
                </nav>
            </aside>

            {/* Mobile Menu - Display Connections */}
            <Sheet>
                <SheetTrigger asChild className="lg:hidden absolute top-4 left-4">
                    <Button variant="outline" size="icon">
                        <span className="sr-only">Open menu</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24">
                            <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="bg-background border-border">
                    <nav className="space-y-4 p-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-semibold tracking-tight">Data Connections</h2>
                            <div className="flex gap-1">
                                <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            {connections.map((db) => (
                                <div key={db.connection} className="flex gap-1 items-center">
                                    <Button
                                        variant={selectedDb === db.connection ? 'secondary' : 'ghost'}
                                        className="w-full justify-start flex-1"
                                        onClick={() => setSelectedDb(db.connection)}
                                    >
                                        <span className="truncate">{db.name}</span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 hover:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <div className="pt-4 border-t">
                            <Link href="/profile">
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start"
                                >
                                    <User className="h-4 w-4 mr-2" />
                                    Profile
                                </Button>
                            </Link>
                        </div>
                    </nav>
                </SheetContent>
            </Sheet>

            {/* Main Content - Chat Area */}
            <main className="flex-1 flex flex-col">
                <header className="border-b border-border p-4">
                    <h1 className="text-2xl font-bold">
                        {selectedDb ? connections.find(db => db.connection === selectedDb)?.name : "Select a Database"}
                    </h1>
                </header>

                <div className="flex-1 flex flex-col p-6 gap-6 w-full overflow-hidden">
                    <Card className="bg-background border-border h-full">
                        <CardContent className="space-y-4 h-[calc(100vh-200px)] overflow-y-auto">
                            <AnimatePresence>
                                {messages.map((msg, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <div className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                                            <motion.div
                                                className={`p-3 rounded-lg max-w-[75%] ${
                                                    msg.isUser
                                                        ? 'bg-blue-500 text-white ml-auto'
                                                        : 'bg-gray-200 text-black'
                                                }`}
                                                initial={{ scale: 0.9 }}
                                                animate={{ scale: 1 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <ReactMarkdown>
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </motion.div>
                                        </div>
                                        {msg.visualization?.type === 'line' && msg.visualization.componentConfig && (
                                            <div className="w-full mt-3 max-w-[50%]">
                                                <LineChartComponent
                                                    data={msg.visualization.componentConfig.data}
                                                    config={msg.visualization.componentConfig.config}
                                                    title={msg.visualization.componentConfig.title}
                                                    description={msg.visualization.componentConfig.description}
                                                    xAxisKey={msg.visualization.componentConfig.xAxisKey}
                                                    lineKeys={msg.visualization.componentConfig.lineKeys}
                                                    footerText={msg.visualization.componentConfig.footerText}
                                                    trendText={msg.visualization.componentConfig.trendText}
                                                />
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {isLoading && <LoadingDots />}
                            <div ref={messagesEndRef} />
                        </CardContent>
                    </Card>

                    <div className="flex gap-2">
                        <Input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Ask a question about your data..."
                            className="border-border bg-background focus-visible:ring-primary"
                            onKeyUp={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <Button
                            onClick={handleSend}
                            disabled={!selectedDb}
                            className="bg-primary/90 hover:bg-primary text-primary-foreground"
                        >
                            {isLoading ? 'Sending...' : 'Send'}
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    );
}
