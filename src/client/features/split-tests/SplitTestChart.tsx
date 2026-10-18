import { Line, LineChart, ReferenceLine } from "recharts";
import {
  ChartGrid,
  ChartXAxis,
  ChartYAxis,
} from "@/client/components/ChartAxes";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/client/components/ui/chart";

// RFC-0011 5.9 step 4: both groups' clicks, indexed to 100 at the baseline.
const chartConfig: ChartConfig = {
  variant: { label: "Variant", color: "#2563eb" },
  control: { label: "Control", color: "#94a3b8" },
};

export function SplitTestChart(props: {
  series: Array<{ date: string; variant: number; control: number }>;
  deployedOn: string | null;
}) {
  if (props.series.length < 2) return null;
  return (
    <ChartContainer
      config={chartConfig}
      className="h-[220px]"
      aria-label="Daily clicks of the variant and control groups, indexed to 100 at the baseline, 7-day average"
    >
      <LineChart
        data={props.series}
        margin={{ left: 0, right: 12, top: 8, bottom: 0 }}
      >
        <ChartGrid />
        <ChartXAxis dataKey="date" />
        <ChartYAxis />
        {props.deployedOn && (
          <ReferenceLine
            x={props.deployedOn}
            stroke="currentColor"
            strokeDasharray="4 4"
          />
        )}
        <ChartTooltip content={<ChartTooltipContent />} />
        {(["variant", "control"] as const).map((key) => (
          <Line
            key={key}
            dataKey={key}
            type="monotone"
            stroke={`var(--color-${key})`}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
