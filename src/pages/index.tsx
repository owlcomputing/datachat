import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { BarChart, LineChart, MessageSquareText, Database } from "lucide-react"
import { AreaChart, Area, CartesianGrid, XAxis } from "recharts"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import AreaChartTest from "@/components/AreaChart"
import AreaChartInteractive from "@/components/AreaChartInteractive"
import PieChartLabel from "@/components/PieChartLabel"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


const chartData = [
  { month: "Jan", value: 186 },
  { month: "Feb", value: 305 },
  { month: "Mar", value: 237 },
  { month: "Apr", value: 73 },
  { month: "May", value: 209 },
  { month: "Jun", value: 214 },
];

function DataChart() {
  return (
    <div className="p-4 bg-background border border-border rounded-lg">
      <AreaChart
        width={500}
        height={300}
        data={chartData}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis 
          dataKey="month" 
          stroke="hsl(var(--muted-foreground))"
          tick={{ fill: "hsl(var(--muted-foreground))" }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--chart-1))"
          fill="hsl(var(--chart-1))"
          fillOpacity={0.2}
        />
      </AreaChart>
    </div>
  )
}

interface PlayerStats {
  full_name: string;
  matchup: string;
  game_date: string;
  pts: number;
  ast: number;
  reb: number;
  fg_pct: number;
  avg_pts?: number;
  avg_ast?: number;
  avg_reb?: number;
}

function transformPlayerData(apiResponse: any): PlayerStats[] {
  if (!apiResponse?.results) return [];
  return apiResponse.results.map((player: any) => ({
    full_name: player.full_name,
    matchup: player.matchup,
    game_date: player.game_date,
    pts: player.pts,
    ast: player.ast,
    reb: player.reb,
    fg_pct: player.fg_pct,
    avg_pts: player.avg_pts,
    avg_ast: player.avg_ast,
    avg_reb: player.avg_reb
  }));
}

export default function Index() {
  const [selectedDb, setSelectedDb] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ 
    content: string | React.ReactNode; 
    isUser: boolean 
  }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiError, setApiError] = useState<string>('');
  const [gamesToShow, setGamesToShow] = useState<number | 'all'>('all')

  const databases = [
    { name: "Sales Analytics", connection: "sales" },
    { name: "User Metrics", connection: "analytics" },
    { name: "Inventory DB", connection: "inventory" }
  ]

  const handleSend = async () => {
    if (!message.trim()) return;

    // Add user message
    setMessages(prev => [...prev, { content: message, isUser: true }]);

    try {
      const response = await fetch('https://www.boxscorewatch.com/api/natural-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add authorization header if needed
        },
        body: JSON.stringify({
          query: message,
          format: "json"
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      console.log(data);
      
      // Format summary text with bold styling
      const formattedSummary = data.summaryText?.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') || '';
      
      // Create chat response with both text and chart
      const botResponse = (
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <img 
              src={data.headshotUrl} 
              alt="Player headshot" 
              className="h-16 w-16 rounded-full border-2 border-primary"
            />
            <div 
              className="whitespace-pre-wrap p-2 rounded bg-background flex-1"
              dangerouslySetInnerHTML={{ __html: formattedSummary }}
            />
          </div>
        </div>
      );

      setMessages(prev => [...prev, { 
        content: botResponse, 
        isUser: false 
      }]);

      setApiResponse(data);

    } catch (err: any) {
      setMessages(prev => [...prev, { 
        content: `Error: ${err.message}`, 
        isUser: false 
      }]);
    }

    setMessage('');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollTo({
      top: messagesEndRef.current.scrollHeight,
      behavior: "smooth"
    })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages]); // Trigger on messages change

  const handleBoxscoreQuery = async () => {
    try {
      setApiError('');
      setApiResponse(null);
      
      const response = await fetch('https://www.boxscorewatch.com/api/natural-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add authorization header if required
          // 'Authorization': `Bearer ${process.env.API_KEY}`
        },
        body: JSON.stringify({
          query: "Top 5 scorers from January 30th 2025",
          format: "json"
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      setApiResponse(data);
      console.log(apiResponse);
      console.log('Boxscore API Response:', data);

    } catch (err: any) {
      setApiError(err.message);
      console.error('Boxscore API Error:', err);
    }
  };

  const renderChatResponse = (data: any) => {
    // Add event listener for game filter changes
    if (typeof window !== 'undefined') {
      window.addEventListener('gameFilterChange', ((e: CustomEvent) => {
        setGamesToShow(e.detail)
      }) as EventListener)
    }

    const transformedData = transformPlayerData(data);
    const columns = ['full_name', 'pts', 'ast', 'reb', 'fg_pct'];
    
    // Transform API data for chart
    const chartData = transformedData
      .slice(gamesToShow === 'all' ? 0 : -gamesToShow)
      .map((player, index) => ({
        month: `Game ${index + 1}`,
        pts: player.pts,
        ast: player.ast,
        reb: player.reb,
        fgPct: player.fg_pct,
      }));

    return (
      <div className="space-y-4 w-full">
        <div className="flex flex-col lg:flex-row gap-4 w-full">
          <div className="lg:flex-1">
            {/* Summary Section */}
            <div 
              className="whitespace-pre-wrap p-2 rounded bg-background"
              dangerouslySetInnerHTML={{ __html: apiResponse?.summaryText?.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') || '' }}
            />
            
            {/* Stats Table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col} className="text-foreground">
                        {col.startsWith('avg_') 
                          ? `Avg ${col.split('_')[1].toUpperCase()}`
                          : col.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ')}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transformedData.map((player, index) => (
                    <TableRow key={index}>
                      {columns.map((col) => (
                        <TableCell key={col}>
                          {col === 'fg_pct' 
                            ? `${Math.round(Number(player[col as keyof PlayerStats]) * 100)}%` 
                            : col.startsWith('avg_') 
                              ? Number(player[col as keyof PlayerStats]).toFixed(1)
                              : player[col as keyof PlayerStats]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          
          <div className="lg:flex-1">
            <Card className="h-full">
              <CardContent className="pt-6">
                <AreaChartTest 
                  data={chartData} 
                  gamesToShow={gamesToShow}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 border-r border-border bg-muted/20 p-4">
        <nav className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Data Connections</h2>
          <div className="space-y-1">
            {databases.map((db) => (
              <Button
                key={db.connection}
                variant={selectedDb === db.connection ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setSelectedDb(db.connection)}
              >
                <span className="truncate">{db.name}</span>
              </Button>
            ))}
          </div>
        </nav>
      </aside>

      {/* Mobile Menu */}
      <Sheet>
        <SheetTrigger asChild className="lg:hidden absolute top-4 left-4">
          <Button variant="outline" size="icon">
            <span className="sr-only">Open menu</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="bg-background border-border">
          <nav className="space-y-4 p-4">
            <h2 className="text-lg font-semibold tracking-tight">Data Connections</h2>
            <div className="space-y-1">
              {databases.map((db) => (
                <Button
                  key={db.connection}
                  variant={selectedDb === db.connection ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setSelectedDb(db.connection)}
                >
                  {db.name}
                </Button>
              ))}
            </div>
          </nav>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="border-b border-border p-4">
          <h1 className="text-2xl font-bold">
            {selectedDb ? `${databases.find(db => db.connection === selectedDb)?.name} Chat` : "Select a Database"}
          </h1>
        </header>

        <div className="flex-1 flex flex-col p-6 gap-6 w-full overflow-hidden">
          <Card className="bg-background border-border h-full">
            <CardContent ref={messagesEndRef} className="space-y-4 h-[calc(100vh-200px)] overflow-y-auto">
              {messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`p-3 rounded-lg flex items-start gap-2 ${
                    msg.isUser 
                      ? 'bg-primary/5 ml-auto border border-primary/20' 
                      : 'bg-muted/5 border-l-4 border-muted-foreground/50'
                  }`}
                  style={{ maxWidth: '100%' }}
                >
                  {!msg.isUser && <Database className="h-4 w-4 mt-1 text-muted-foreground" />}
                  <div className="flex-1">
                    {msg.isUser ? (
                      <div className="whitespace-pre-wrap p-2 rounded bg-background">
                        {msg.content}
                      </div>
                    ) : (
                      renderChatResponse(apiResponse)
                    )}
                  </div>
                  {msg.isUser && <MessageSquareText className="h-4 w-4 mt-1 text-primary" />}
                </div>
              ))}
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
              Send
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
