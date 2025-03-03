"use client"

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { TrendingUp, Share } from "lucide-react"
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
import { useCallback } from 'react'

interface AreaChartProps {
  data: Array<Record<string, any>>;
  config: ChartConfig;
  title: string;
  description?: string;
  xAxisKey: string;
  areaKey: string;
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
  areaKey,
  footerText,
  trendText,
  showLabels = false,
  margin = { top: 10, right: 30, left: 0, bottom: 0 }
}: AreaChartProps) {
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
  }, [title, data, config]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ChartContainer config={config}>
          <AreaChart
            data={data}
            margin={margin}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey={xAxisKey} 
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => typeof value === 'string' ? value.slice(0, 3) : value}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="area" />}
            />
            <Area
              type="monotone"
              dataKey={areaKey}
              stroke={`var(--color-${areaKey})`}
              fill={`var(--color-${areaKey})`}
              fillOpacity={0.2}
            />
          </AreaChart>
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
  );
}

export default AreaChartComponent; 