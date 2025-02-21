import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export default function AreaChartTest({
  data,
  chartConfig
}: {
  data: any[];
  chartConfig: {
    dataKey: string;
    stroke: string;
    fill: string;
    xAxisKey: string;
  };
}) {
  return (
    <AreaChart
      width={500}
      height={300}
      data={data}
      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
    >
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis 
        dataKey={chartConfig.xAxisKey} 
        stroke="hsl(var(--muted-foreground))"
        tick={{ fill: "hsl(var(--muted-foreground))" }}
      />
      <YAxis
        stroke="hsl(var(--muted-foreground))"
        tick={{ fill: "hsl(var(--muted-foreground))" }}
      />
      <Tooltip />
      <Area
        type="monotone"
        dataKey={chartConfig.dataKey}
        stroke={chartConfig.stroke}
        fill={chartConfig.fill}
        fillOpacity={0.2}
      />
    </AreaChart>
  );
} 