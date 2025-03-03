"use client"

import { TrendingUp, Share } from "lucide-react"
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, Cell } from "recharts"
import { useCallback, useState, useEffect } from 'react'
import html2canvas from 'html2canvas'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Button } from "@/components/ui/button"

interface BarChartProps {
  data: Array<Record<string, any>>;
  config: ChartConfig;
  title: string;
  description?: string;
  xAxisKey: string;
  barKeys?: string[];
  footerText?: string;
  trendText?: string;
  showLabels?: boolean;
  margin?: {
    top?: number;
    left?: number;
    right?: number;
    bottom?: number;
  };
}

export function BarChartComponent({
  data,
  config,
  title,
  description,
  xAxisKey,
  barKeys,
  footerText = "Showing total visitors for the last 6 months",
  trendText = "Trending up by 5.2% this month",
  showLabels = false,
  margin = { left: 12, right: 12, top: 12 }
}: BarChartProps) {
  const [processedData, setProcessedData] = useState(data);
  const [keysToRender, setKeysToRender] = useState<string[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  
  // Process data and determine which keys to render
  useEffect(() => {
    // Create a map of key to color from the config
    const newColorMap: Record<string, string> = {};
    
    Object.entries(config).forEach(([key, value]) => {
      if (value.color) {
        newColorMap[key] = value.color;
      }
    });
    
    setColorMap(newColorMap);
    
    // Determine which keys to render
    const keys = barKeys || Object.keys(config).filter(key => key !== xAxisKey);
    setKeysToRender(keys);
    
    // Process data to ensure it has the right format
    const newData = [...data];
    setProcessedData(newData);
  }, [data, config, barKeys, xAxisKey]);
  
  const handleExport = useCallback(async () => {
    const chartElement = document.querySelector('.recharts-wrapper') as HTMLElement;
    if (chartElement) {
      try {
        const canvas = await html2canvas(chartElement, {
          scale: 2,
          logging: false,
          backgroundColor: '#ffffff',
          useCORS: true
        });
        
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        const tweetText = encodeURIComponent(`Check out this chart: ${title}\n\n`);
        const tweetUrl = `https://x.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(dataUrl)}`;
        window.open(tweetUrl, '_blank');
      } catch (error) {
        console.error('Error exporting chart:', error);
      }
    }
  }, [title, processedData, config]);

  // Get color for a specific key
  const getColorForKey = (key: string, index: number): string => {
    if (colorMap[key]) {
      return colorMap[key];
    }
    
    // Fallback to chart colors
    return `hsl(var(--chart-${(index % 5) + 1}))`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ChartContainer config={config}>
          <RechartsBarChart accessibilityLayer data={processedData} margin={margin}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => typeof value === 'string' && value.length > 3 ? value.slice(0, 3) : value}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel={!showLabels} />}
            />
            {keysToRender.map((key, keyIndex) => (
              <Bar 
                key={key} 
                dataKey={key} 
                radius={8}
              >
                {processedData.map((entry, entryIndex) => (
                  <Cell 
                    key={`cell-${entryIndex}`} 
                    fill={getColorForKey(key, keyIndex)} 
                  />
                ))}
              </Bar>
            ))}
          </RechartsBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="flex flex-col gap-2">
          {trendText && (
            <div className="flex items-center gap-2 font-medium leading-none">
              {trendText} <TrendingUp className="h-4 w-4" />
            </div>
          )}
          {footerText && (
            <div className="leading-none text-muted-foreground">
              {footerText}
            </div>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleExport}
          className="flex items-center gap-2"
        >
          <Share className="h-4 w-4" />
          Share on Twitter
        </Button>
      </CardFooter>
    </Card>
  )
}

// For backward compatibility
export function Component() {
  const chartData = [
    { month: "January", desktop: 186 },
    { month: "February", desktop: 305 },
    { month: "March", desktop: 237 },
    { month: "April", desktop: 73 },
    { month: "May", desktop: 209 },
    { month: "June", desktop: 214 },
  ]

  const chartConfig = {
    desktop: {
      label: "Desktop",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig

  return (
    <BarChartComponent
      data={chartData}
      config={chartConfig}
      title="Bar Chart"
      description="January - June 2024"
      xAxisKey="month"
      barKeys={["desktop"]}
    />
  )
}

export default BarChartComponent;
