"use client"

import { TrendingUp, Share } from "lucide-react"
import {
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChartConfig, ChartContainer } from "@/components/ui/chart"
import { Button } from "@/components/ui/button"
import html2canvas from 'html2canvas'
import { useCallback } from 'react'

interface RadialChartProps {
  data: number[];
  config: ChartConfig;
  title: string;
  description?: string;
  footerText?: string;
  trendText?: string;
  className?: string;
  labelText?: string;
  startAngle?: number;
  endAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
}

export function RadialChartComponent({
  data,
  config,
  title,
  description,
  footerText,
  trendText,
  className,
  labelText = "Average",
  startAngle = 0,
  endAngle = 250,
  innerRadius = 80,
  outerRadius = 110
}: RadialChartProps) {
  const averageValue = data.length > 0 
    ? (data.reduce((a, b) => a + b, 0) / data.length) * 100  // Convert to percentage
    : 0;

  const chartData = [
    { 
      value: averageValue,
      fill: "hsl(var(--chart-1))",
      label: labelText
    },
  ];

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
    <Card className={`flex flex-col ${className}`}>
      <CardHeader className="items-center pb-0">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={config}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <RadialBarChart
            data={chartData}
            startAngle={startAngle}
            endAngle={endAngle}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
          >
            <PolarGrid
              gridType="circle"
              radialLines={false}
              stroke="none"
              className="first:fill-muted last:fill-background"
              polarRadius={[86, 74]}
            />
            <RadialBar dataKey="value" background cornerRadius={10} />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-4xl font-bold"
                        >
                          {averageValue.toFixed(1)}%
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground"
                        >
                          {labelText}
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </PolarRadiusAxis>
          </RadialBarChart>
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

export default RadialChartComponent;