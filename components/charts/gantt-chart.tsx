import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GanttData } from "@/types/patient";
import { useTheme } from "next-themes";
import { format, parseISO } from "date-fns";
import {
	ScatterChart,
	Scatter,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
} from "recharts";

interface GanttChartProps {
	data: GanttData[];
	title: string;
	barColorLight?: string;
	barColorDark?: string;
}

const GanttBar = (props: any) => {
	const { cx, cy, payload, xAxisMap, xAxis: propsXAxis, barColor } = props;

	if (!payload || cx === undefined || cy === undefined) return null;

	const xAxis = propsXAxis || (xAxisMap && xAxisMap[Object.keys(xAxisMap)[0]]);
	if (!xAxis || !xAxis.scale) return null;

	// Start pixel is mapped by Recharts automatically as cx.
	const startPixel = cx;

	// Map the end time to pixel coordinate.
	let endPixel = xAxis.scale(payload.end);

	// Calculate width
	let barWidth = endPixel - startPixel;

	// Ensure a minimum width so 1-day events are visible as circles/pills
	if (barWidth < 30) {
		barWidth = 30;
	}

	const barHeight = 22;
	const y = cy - barHeight / 2;

	const maxChars = Math.floor((barWidth - 16) / 6.5);
	let label = payload.task;
	if (label.length > maxChars) {
		label = maxChars >= 3 ? label.substring(0, maxChars - 2) + ".." : "...";
	}

	return (
		<g className="transition-all duration-300 hover:opacity-80 cursor-pointer">
			<rect
				x={startPixel}
				y={y}
				width={barWidth}
				height={barHeight}
				fill={barColor}
				rx={barHeight / 2}
				ry={barHeight / 2}
			/>
			{label && (
				<text
					x={startPixel + barWidth / 2}
					y={cy + 1}
					textAnchor="middle"
					dominantBaseline="central"
					fontSize={11}
					fontWeight={500}
					fill="#ffffff"
					style={{ pointerEvents: 'none' }}
				>
					{label}
				</text>
			)}
		</g>
	);
};

const CustomTooltip = ({ active, payload }: any) => {
	if (active && payload && payload.length) {
		const data = payload[0].payload;
		return (
			<div className="bg-popover text-popover-foreground border border-border/50 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] p-3 text-xs max-w-xs z-50">
				<p className="font-bold mb-2 text-sm text-primary border-b pb-1">{data.task}</p>
				{data.dosage && (
					<div className="flex justify-between gap-4 mb-1">
						<span className="text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">Dosage</span>
						<span className="font-medium">{data.dosage}</span>
					</div>
				)}
				<div className="flex justify-between gap-4 mb-1">
					<span className="text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">Start Date</span>
					<span className="font-medium">{format(data.start, "dd MMM yyyy")}</span>
				</div>
				<div className="flex justify-between gap-4">
					<span className="text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">End Date</span>
					<span className="font-medium">{format(data.end, "dd MMM yyyy")}</span>
				</div>
			</div>
		);
	}
	return null;
};

export function GanttChart({
	data,
	title,
	barColorLight = "#f4a462",
	barColorDark = "#e23670",
}: GanttChartProps) {
	const { theme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{title}</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="min-h-[200px] flex items-center justify-center">
						<p className="text-muted-foreground">Loading chart...</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!data || data.length === 0) {
		return null;
	}

	const DAY_IN_MS = 86400000;

	// Process data for the ScatterChart
	const processedData = data.map(d => {
		let start = parseISO(d.start).getTime();
		let end = parseISO(d.end).getTime();

		if (isNaN(start)) start = new Date().getTime();
		if (isNaN(end)) end = start;
		if (end < start) end = start;

		return {
			...d,
			start,
			end: end === start ? start + DAY_IN_MS : end, // Give 1 day duration for identical start/end dates
		};
	}).sort((a, b) => a.start - b.start);

	// Determine bar color based on theme
	const isDark = theme === "dark";
	const solidBarColor = isDark ? barColorDark : barColorLight;

	// Get unique tasks to calculate height properly
	const uniqueTasks = Array.from(new Set(processedData.map(d => d.task)));
	const dynamicHeight = Math.max(60 + uniqueTasks.length * 28, 100);

	// Padding for X-axis domain to ensure dots aren't cut off at the edges
	const minTime = Math.min(...processedData.map(d => d.start)) - (DAY_IN_MS * 30); // 30 days padding
	const maxTime = Math.max(...processedData.map(d => d.end)) + (DAY_IN_MS * 30);

	// Generate exactly 5 evenly spaced ticks to prevent Recharts duplicate tick bug on identical start dates
	const xTicks = [];
	if (minTime && maxTime && maxTime > minTime) {
		const step = (maxTime - minTime) / 4;
		for (let i = 0; i <= 4; i++) {
			xTicks.push(minTime + step * i);
		}
	} else {
		xTicks.push(minTime || new Date().getTime());
	}

	return (
		<Card className="overflow-hidden border-border/50 shadow-sm transition-shadow hover:shadow-md">
			<CardHeader className="pb-2 pt-4 bg-muted/20 border-b">
				<CardTitle className="text-base flex items-center gap-2">
					<div className="w-2 h-2 rounded-full" style={{ background: solidBarColor }} />
					{title}
				</CardTitle>
			</CardHeader>
			<CardContent className="p-0">
				<div className="w-full relative" style={{ height: `${dynamicHeight}px` }}>
					<ResponsiveContainer width="100%" height="100%">
						<ScatterChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
							<CartesianGrid strokeDasharray="4 4" horizontal={true} vertical={true} opacity={0.2} />

							<XAxis
								type="number"
								dataKey="start"
								scale="time"
								name="Time"
								domain={[minTime, maxTime]}
								ticks={xTicks}
								tickFormatter={(val) => format(val, "MMM yyyy")}
								tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
								tickLine={false}
								axisLine={{ stroke: 'var(--border)', strokeWidth: 1 }}
								tickMargin={10}
							/>

							<YAxis
								type="category"
								dataKey="task"
								allowDuplicatedCategory={false}
								width={10}
								tick={false}
								tickLine={false}
								axisLine={false}
							/>

							<Tooltip
								content={<CustomTooltip />}
								cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.2 }}
							/>

							<Scatter
								data={processedData}
								shape={<GanttBar barColor={solidBarColor} />}
							/>
						</ScatterChart>
					</ResponsiveContainer>
				</div>
			</CardContent>
		</Card>
	);
}
