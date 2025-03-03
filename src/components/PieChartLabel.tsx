"use client"

import { TrendingUp, Share } from "lucide-react"
import { Pie, PieChart } from "recharts"

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

interface PieChartProps {
  data: Array<Record<string, any>>;
  config: ChartConfig;
  title: string;
  description?: string;
  dataKey: string;
  nameKey: string;
  footerText?: string;
  trendText?: string;
  hideLabel?: boolean;
  className?: string;
}

export function PieChartComponent({
  data,
  config,
  title,
  description,
  dataKey,
  nameKey,
  footerText,
  trendText,
  hideLabel = false,
  className
}: PieChartProps) {
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
    <Card className={`flex flex-col ${className || ''}`}>
      <CardHeader className="items-center pb-0">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={config}
          className="mx-auto aspect-square max-h-[250px] pb-0 [&_.recharts-pie-label-text]:fill-foreground"
        >
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel={hideLabel} />} />
            <Pie data={data} dataKey={dataKey} label nameKey={nameKey} />
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="flex flex-col gap-2 text-sm">
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

export default PieChartComponent;
