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
import { AreaChartComponent } from "@/components/AreaChart"
import { PieChartComponent } from "@/components/PieChartLabel"
import { RadialChartComponent } from "@/components/Radial"
import BarChartComponent from '@/components/BarChart'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { motion, AnimatePresence } from 'framer-motion'
import TableComponent, { Column } from '@/components/Table'

interface VisualizationData {
  type: string;
  componentConfig?: {
    data: Array<Record<string, any>>;
    config: Record<string, any>;
    title: string;
    description?: string;
    xAxisKey?: string;
    lineKeys?: string[];
    areaKey?: string;
    dataKey?: string;
    nameKey?: string;
    labelText?: string;
    footerText?: string;
    trendText?: string;
    className?: string;
    showLabels?: boolean;
    hideLabel?: boolean;
    margin?: {
      top?: number;
      left?: number;
      right?: number;
      bottom?: number;
    };
    barKeys?: string[];
    columns?: Column[];
    caption?: string;
    footerData?: {
      label: string;
      value: string | number;
      colSpan?: number;
    };
  };
}

// Update the messages state type
interface Message {
  content: string;
  isUser: boolean;
  visualization?: VisualizationData;
  tableData?: VisualizationData;
}

// Component to render the appropriate chart based on visualization type
const VisualizationComponent = ({ visualization }: { visualization: VisualizationData }) => {
  if (!visualization || !visualization.componentConfig) {
    return null;
  }

  const config = visualization.componentConfig;
  console.log(`Rendering visualization of type: ${visualization.type}`, config);

  switch (visualization.type.toLowerCase()) {
    case 'line':
      return (
        <LineChartComponent
          data={config.data}
          config={config.config}
          title={config.title}
          description={config.description}
          xAxisKey={config.xAxisKey || ''}
          lineKeys={config.lineKeys || []}
          footerText={config.footerText}
          trendText={config.trendText}
          showLabels={config.showLabels}
          margin={config.margin}
        />
      );
    case 'bar':
      return (
        <BarChartComponent
          data={config.data}
          config={config.config}
          title={config.title}
          description={config.description}
          xAxisKey={config.xAxisKey || ''}
          barKeys={config.barKeys || Object.keys(config.config)}
          footerText={config.footerText}
          trendText={config.trendText}
          showLabels={config.showLabels}
          margin={config.margin}
        />
      );
    case 'area':
      return (
        <AreaChartComponent
          data={config.data}
          config={config.config}
          title={config.title}
          description={config.description}
          xAxisKey={config.xAxisKey || ''}
          gamesToShow='all'
          areaKey={config.areaKey || Object.keys(config.config)[0] || ''}
          footerText={config.footerText}
          trendText={config.trendText}
          showLabels={config.showLabels}
          margin={config.margin}
        />
      );
    case 'pie':
      return (
        <PieChartComponent
          data={config.data}
          config={config.config}
          title={config.title}
          description={config.description}
          dataKey={config.dataKey || 'value'}
          nameKey={config.nameKey || 'name'}
          footerText={config.footerText}
          trendText={config.trendText}
          hideLabel={config.hideLabel}
          className={config.className}
        />
      );
    case 'radial':
      // Extract numeric values from the data array
      const numericData = Array.isArray(config.data) 
        ? config.data.map(item => {
            // If the item is a number, use it directly
            if (typeof item === 'number') return item;
            // If it's an object with a 'value' property, use that
            if (item && typeof item.value === 'number') return item.value;
            // Otherwise, try to find the first numeric property
            const numericValue = Object.values(item).find(val => typeof val === 'number');
            return numericValue !== undefined ? numericValue : 0;
          })
        : [];
      
      return (
        <RadialChartComponent
          data={numericData}
          config={config.config}
          title={config.title}
          description={config.description}
          footerText={config.footerText}
          trendText={config.trendText}
          className={config.className}
          labelText={config.labelText || 'Value'}
        />
      );
    case 'table':
      return (
        <TableComponent
          data={config.data}
          columns={config.columns || []}
          caption={config.caption}
          footerData={config.footerData}
          className={config.className}
        />
      );
    default:
      console.warn(`Unknown visualization type: ${visualization.type}`);
      return null;
  }
};

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

    // Update the useEffect for scrolling to use the ref directly
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
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
                console.log("Received response:", response);
                
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
                console.error("Error parsing response:", e);
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

    // Function to render message content
    const renderMessageContent = (msg: Message) => {
        return (
            <div className="space-y-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm]} 
                        rehypePlugins={[rehypeRaw]}
                    >
                        {msg.content}
                    </ReactMarkdown>
                </div>
                
                {msg.visualization && (
                    <div className="mt-4 w-full">
                        <VisualizationComponent visualization={msg.visualization} />
                    </div>
                )}
                
                {msg.tableData && (
                    <div className="mt-4 w-full">
                        <VisualizationComponent visualization={msg.tableData} />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen w-full bg-background text-foreground flex">
            {/* Desktop Sidebar - Display Connections */}
            <aside className="hidden lg:block w-64 border-r border-border bg-muted/20 p-4 fixed h-screen">
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
                                Profile
                            </Button>
                        </Link>
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col ml-0 lg:ml-64">
                {/* Mobile Header */}
                <header className="lg:hidden flex items-center justify-between p-4 border-b fixed w-full bg-background z-10">
                    <div className="flex items-center gap-2">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Database className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
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
                                                Profile
                                            </Button>
                                        </Link>
                                    </div>
                                </nav>
                            </SheetContent>
                        </Sheet>
                        <h1 className="text-lg font-semibold">Data Chat</h1>
                    </div>
                </header>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-container pt-16 lg:pt-0 pb-32">
                    <AnimatePresence>
                        {messages.map((msg, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`p-3 rounded-lg max-w-[75%] ${msg.isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                    {renderMessageContent(msg)}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {isLoading && <LoadingDots />}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t fixed bottom-0 w-full lg:w-[calc(100%-16rem)] bg-background">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Ask a question about your data..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            className="flex-1"
                        />
                        <Button onClick={handleSend} disabled={isLoading || !message.trim()}>
                            <MessageSquareText className="h-4 w-4 mr-2" />
                            Send
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
