"use client"

import { TrendingUp, Share } from "lucide-react"
import { CartesianGrid, LabelList, Line, LineChart, XAxis } from "recharts"
import { useState, useEffect, useCallback } from 'react'
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
import html2canvas from 'html2canvas'

interface LineChartProps {
  data: Array<Record<string, any>>;
  config: ChartConfig;
  title: string;
  description?: string;
  xAxisKey: string;
  lineKeys: string[];
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

export function LineChartComponent({
  data,
  config,
  title,
  description,
  xAxisKey,
  lineKeys,
  footerText,
  trendText,
  showLabels = false,
  margin = { top: 20, left: 12, right: 12 }
}: LineChartProps) {
  const [processedData, setProcessedData] = useState(data);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  
  // Process data and create color map
  useEffect(() => {
    // Create a map of key to color from the config
    const newColorMap: Record<string, string> = {};
    
    Object.entries(config).forEach(([key, value]) => {
      if (value.color) {
        newColorMap[key] = value.color;
      }
    });
    
    // For any keys without colors, assign default chart colors
    lineKeys.forEach((key, index) => {
      if (!newColorMap[key]) {
        newColorMap[key] = `hsl(var(--chart-${(index % 5) + 1}))`;
      }
    });
    
    setColorMap(newColorMap);
    setProcessedData([...data]);
  }, [data, config, lineKeys]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ChartContainer config={config}>
          <LineChart
            accessibilityLayer
            data={processedData}
            margin={margin}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => typeof value === 'string' ? value.slice(0, 3) : value}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            {lineKeys.map((key, index) => (
              <Line
                key={key}
                dataKey={key}
                type="natural"
                stroke={colorMap[key] || `hsl(var(--chart-${(index % 5) + 1}))`}
                strokeWidth={2}
                dot={{
                  fill: colorMap[key] || `hsl(var(--chart-${(index % 5) + 1}))`,
                }}
                activeDot={{
                  r: 6,
                }}
              >
                {showLabels && (
                  <LabelList
                    position="top"
                    offset={12}
                    className="fill-foreground"
                    fontSize={12}
                  />
                )}
              </Line>
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
      {(footerText || trendText) && (
        <CardFooter className="flex justify-between items-center">
          {trendText && (
            <div className="flex gap-2 font-medium leading-none">
              {trendText} <TrendingUp className="h-4 w-4" />
            </div>
          )}
          {footerText && (
            <div className="leading-none text-muted-foreground">
              {footerText}
            </div>
          )}
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
      )}
    </Card>
  )
}

export default LineChartComponent;