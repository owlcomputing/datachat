"use client"

import { TrendingUp, Share } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { useState, useEffect } from "react"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import html2canvas from 'html2canvas'
import { useCallback } from 'react'

interface AreaChartProps {
  data: Array<Record<string, any>>;
  config: ChartConfig;
  title: string;
  description?: string;
  xAxisKey: string;
  gamesToShow?: number | 'all';
  areaKey?: string;
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

export function AreaChartComponent({
  data,
  config,
  title,
  description,
  xAxisKey,
  gamesToShow = 'all',
  areaKey,
  footerText,
  trendText,
  showLabels = false,
  margin = { left: 12, right: 12, top: 12 }
}: AreaChartProps) {
  const [processedData, setProcessedData] = useState<Array<Record<string, any>>>([]);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const [selectedStats, setSelectedStats] = useState<Array<keyof typeof config>>(
    Object.keys(config).slice(0, 3) as Array<keyof typeof config>
  );
  
  // Process data and create color map
  useEffect(() => {
    const rawData = gamesToShow === 'all' ? data : data.slice(-Number(gamesToShow));
    setProcessedData(rawData);
    
    // Create a map of key to color from the config
    const newColorMap: Record<string, string> = {};
    
    Object.entries(config).forEach(([key, value]) => {
      if (value.color) {
        newColorMap[key] = value.color;
      } else {
        // Assign default chart colors
        const colorIndex = Object.keys(newColorMap).length % 5 + 1;
        newColorMap[key] = `hsl(var(--chart-${colorIndex}))`;
      }
    });
    
    setColorMap(newColorMap);
  }, [data, config, gamesToShow]);

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
        <CardDescription>
          {description && <div>{description}</div>}
          {gamesToShow !== undefined && (
            <Tabs 
              value={gamesToShow.toString()}
              onValueChange={(value) => {
                const newValue = value === 'all' ? 'all' : Number(value)
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('gameFilterChange', { detail: newValue }))
                }
              }}
              className="w-full"
            >
              <TabsList className="grid h-9 w-full grid-cols-6 gap-1 bg-background p-1 text-muted-foreground">
                <TabsTrigger
                  value="all"
                  className="rounded-sm px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  All
                </TabsTrigger>
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <TabsTrigger
                    key={num}
                    value={num.toString()}
                    className="rounded-sm px-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    {num}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config}>
          <AreaChart
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
              tickFormatter={(value) => typeof value === 'string' ? value.replace('Game ', '') : value}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            
            {areaKey ? (
              <Area
                key={areaKey}
                dataKey={areaKey}
                type="natural"
                fill={colorMap[areaKey] || `hsl(var(--chart-1))`}
                fillOpacity={0.1}
                stroke={colorMap[areaKey] || `hsl(var(--chart-1))`}
                strokeWidth={2}
              />
            ) : (
              Object.entries(config).map(([key, configItem], index) => (
                <Area
                  key={key}
                  dataKey={key}
                  type="natural"
                  fill={colorMap[key] || `hsl(var(--chart-${(index % 5) + 1}))`}
                  fillOpacity={0.1}
                  stroke={colorMap[key] || `hsl(var(--chart-${(index % 5) + 1}))`}
                  strokeWidth={2}
                />
              ))
            )}
          </AreaChart>
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

export default AreaChartComponent;
