/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo } from "react";
import {
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	LineChart as RechartsLineChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartData, MetricConfig, ProcedureData } from "@/types/patient";
import { useTheme } from "next-themes";
import { format, parseISO } from "date-fns";
import { Syringe, Cookie, Flashlight, Scissors } from "lucide-react";
import { convertNumericToSnellen } from "@/lib/utils/vision-utils";


interface LineChartProps {
	data: ChartData;
	metrics: MetricConfig[];
	showVA?: boolean;
	showIOP?: boolean;
	showCMT?: boolean;
	showProcedures?: boolean;
}

export function LineChart({
	data,
	metrics,
	showVA = true,
	showIOP = true,
	showCMT = true,
	showProcedures = true,
}: LineChartProps) {
	const { theme } = useTheme();
	const [tooltipData, setTooltipData] = useState<{
		visible: boolean;
		x: number;
		y: number;
		procedure: ProcedureData | null;
	}>({ visible: false, x: 0, y: 0, procedure: null });

	const positionedProcedures = useMemo(() => {
		if (!data.procedures.length) {
			return [];
		}

		const chartDateStrings = Array.from(
			new Set([
				...data.visualAcuityData.map((d) => d.x),
				...data.iopData.map((d) => d.x),
				...data.cmtData.map((d) => d.x),
			])
		)
			.filter((d) => !isNaN(new Date(d).getTime()))
			.sort();

		if (!chartDateStrings.length) return [];

		const n = chartDateStrings.length;
		const chartTimes = chartDateStrings.map((d) => new Date(d).getTime());

		const getProcedurePosition = (dateStr: string): number => {
			const t = new Date(dateStr).getTime();
			if (n === 1) return 50;
			if (t <= chartTimes[0]) return 0;
			if (t >= chartTimes[n - 1]) return 100;

			for (let i = 0; i < n - 1; i++) {
				if (t >= chartTimes[i] && t <= chartTimes[i + 1]) {
					const frac =
						(t - chartTimes[i]) / (chartTimes[i + 1] - chartTimes[i]);
					return ((i + frac) / (n - 1)) * 100;
				}
			}
			return 100;
		};

		const procedures = data.procedures.map((proc) => ({
			...proc,
			position: getProcedurePosition(proc.date),
			offsetIndex: 0,
		}));

		procedures.sort((a, b) => a.position - b.position);

		const OVERLAP_THRESHOLD = 3;

		for (let i = 0; i < procedures.length; i++) {
			const currentProc = procedures[i];
			let maxOffsetInRange = 0;

			for (let j = 0; j < i; j++) {
				const prevProc = procedures[j];
				const distance = Math.abs(currentProc.position - prevProc.position);

				if (distance < OVERLAP_THRESHOLD) {
					maxOffsetInRange = Math.max(
						maxOffsetInRange,
						prevProc.offsetIndex + 1
					);
				}
			}

			currentProc.offsetIndex = maxOffsetInRange;
		}

		return procedures;
	}, [data]);


	const isDark = theme === "dark";

	// Prepare data for each chart
	const vaChartData = data.visualAcuityData.map((d) => ({
		date: d.x,
		value: d.yNumeric,
		label: d.y,
		nv: d.nv,
		sph: d.sph,
		visData: d.visData,
	}));
	const iopChartData = data.iopData.map((d) => ({ date: d.x, value: d.y }));
	const cmtChartData = data.cmtData.map((d) => ({ date: d.x, value: d.y }));

	// Calculate dynamic ranges based on data
	const vaValues = vaChartData.map((d) => d.value).filter((v) => v != null);
	const iopValues = iopChartData.map((d) => d.value).filter((v) => v != null);
	const cmtValues = cmtChartData.map((d) => d.value).filter((v) => v != null);

	// VA range
	const vaDataMin = vaValues.length ? Math.min(...vaValues) : 0.5;
	const vaDataMax = vaValues.length ? Math.max(...vaValues) : 1.5;
	const vaMin = Math.min(0.25, Math.floor(vaDataMin * 2) / 2 - 0.5);
	const vaMax = Math.max(1.75, Math.ceil(vaDataMax * 2) / 2 + 0.5);

	// IOP range
	const iopDataMin = iopValues.length ? Math.min(...iopValues) : 8;
	const iopDataMax = iopValues.length ? Math.max(...iopValues) : 12;
	const iopMin = Math.min(4, Math.floor((iopDataMin - 2) / 4) * 4);
	const iopMax = Math.max(16, Math.ceil((iopDataMax + 2) / 4) * 4);

	// CMT range
	const cmtDataMax = cmtValues.length ? Math.max(...cmtValues) : 400;
	const cmtMin = 0;
	const cmtMax = Math.max(500, Math.ceil(cmtDataMax / 500) * 500);

	// Walk backwards from the current date to find the most recent prior non-null value
	const getPreviousValue = (
		chartData: { date: string; value: number | null | undefined }[],
		currentDate: string
	): number | undefined => {
		const idx = chartData.findIndex((p) => p.date === currentDate);
		if (idx <= 0) return undefined;
		for (let i = idx - 1; i >= 0; i--) {
			if (chartData[i].value != null) return chartData[i].value as number;
		}
		return undefined;
	};

	// Trend indicator: arrow + color based on direction and whether higher is better
	const TrendIndicator = ({
		current,
		previous,
		higherIsBetter,
	}: {
		current: number | null | undefined;
		previous: number | null | undefined;
		higherIsBetter: boolean;
	}) => {
		if (current == null || previous == null) return null;
		if (current === previous)
			return (
				<span style={{ color: "#6b7280", fontWeight: 700, marginLeft: 4 }}>→</span>
			);
		const increased = current > previous;
		const isImprovement = higherIsBetter ? increased : !increased;
		const color = isImprovement ? "#22c55e" : "#ef4444";
		const arrow = increased ? "↑" : "↓";
		return (
			<span style={{ color, fontWeight: 700, marginLeft: 4 }}>{arrow}</span>
		);
	};

	const VATooltip = ({ active, payload }: any) => {
		if (!active || !payload || payload.length === 0) return null;
		const d = payload[0].payload;
		// console.log("📊 VA Tooltip data:", d);
		return (
			<div
				className="bg-background border rounded-lg shadow-lg p-2 text-xs"
				style={{
					borderLeft: `4px solid ${isDark
						? metrics[0]?.colorDark || "#666"
						: metrics[0]?.colorLight || "#ccc"
						}`,
				}}
			>
				<p className="font-semibold mb-1 text-xs">
					{format(parseISO(d.date), "dd MMM yyyy")}
				</p>
				<div className="flex items-center gap-1.5 mb-0.5">
					<div
						className="w-2 h-2 rounded-full"
						style={{
							backgroundColor: isDark
								? metrics[0]?.colorDark || "#666"
								: metrics[0]?.colorLight || "#ccc",
						}}
					/>
					<span className="text-xs flex items-center gap-0.5">
						VA: {convertNumericToSnellen(d.value)}
						<TrendIndicator
							current={d.value}
							previous={getPreviousValue(vaChartData, d.date)}
							higherIsBetter={true}
						/>
						{d.sph && d.sph.trim() && d.sph !== "-" && d.sph !== ";" && (
							<span className="text-muted-foreground ml-1">Sph: {d.sph}</span>
						)}
					</span>
				</div>
				{d.visData && Object.keys(d.visData).length > 0 && (
					<div className="mt-1 pt-1 border-t border-border/50">
						{Object.entries(d.visData).map(([key, val]: [string, any]) => (
							<div key={key} className="flex items-center gap-1.5 text-xs">
								<span className="text-muted-foreground">{key}:</span>
								<span>{val}</span>
							</div>
						))}
					</div>
				)}
			</div>
		);
	};

	const IOPTooltip = ({ active, payload }: any) => {
		if (!active || !payload || payload.length === 0) return null;
		const d = payload[0].payload;
		return (
			<div
				className="bg-background border rounded-lg shadow-lg p-2 text-xs"
				style={{
					borderLeft: `4px solid ${isDark
						? metrics[1]?.colorDark || "#666"
						: metrics[1]?.colorLight || "#ccc"
						}`,
				}}
			>
				<p className="font-semibold mb-1 text-xs">
					{format(parseISO(d.date), "dd MMM yyyy")}
				</p>
				<div className="flex items-center gap-1.5">
					<div
						className="w-2 h-2 rounded-full"
						style={{
							backgroundColor: isDark
								? metrics[1]?.colorDark || "#666"
								: metrics[1]?.colorLight || "#ccc",
						}}
					/>
					<span className="text-xs flex items-center gap-0.5">
						IOP: {d.value} mmHg
						<TrendIndicator
							current={d.value}
							previous={getPreviousValue(iopChartData, d.date)}
							higherIsBetter={false}
						/>
					</span>
				</div>
			</div>
		);
	};

	const CMTTooltip = ({ active, payload }: any) => {
		if (!active || !payload || payload.length === 0) return null;
		const d = payload[0].payload;
		return (
			<div
				className="bg-background border rounded-lg shadow-lg p-2 text-xs"
				style={{
					borderLeft: `4px solid ${isDark
						? metrics[2]?.colorDark || "#666"
						: metrics[2]?.colorLight || "#ccc"
						}`,
				}}
			>
				<p className="font-semibold mb-1 text-xs">
					{format(parseISO(d.date), "dd MMM yyyy")}
				</p>
				<div className="flex items-center gap-1.5">
					<div
						className="w-2 h-2 rounded-full"
						style={{
							backgroundColor: isDark
								? metrics[2]?.colorDark || "#666"
								: metrics[2]?.colorLight || "#ccc",
						}}
					/>
					<span className="text-xs flex items-center gap-0.5">
						CMT: {d.value} µm
						<TrendIndicator
							current={d.value}
							previous={getPreviousValue(cmtChartData, d.date)}
							higherIsBetter={false}
						/>
					</span>
				</div>
			</div>
		);
	};

	// Check if at least one metric is enabled
	const hasAnyMetric = showVA || showIOP || showCMT;
	const hasAnyData =
		vaChartData.length > 0 ||
		iopChartData.length > 0 ||
		cmtChartData.length > 0 ||
		positionedProcedures.length > 0;

	if (!hasAnyData) {
		return null;
	}

	if (!hasAnyMetric) {
		return (
			<Card className="overflow-visible">
				<CardContent>
					<div className="h-[400px] flex items-center justify-center">
						<p className="text-muted-foreground">
							Please enable at least one metric (VA, IOP, or CMT) to view the
							chart
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	const handleProcedureMouseEnter = (
		e: React.MouseEvent<HTMLDivElement>,
		procedure: ProcedureData
	) => {
		const target = e.currentTarget;
		const rect = target.getBoundingClientRect();
		const containerRect = target
			.closest(".procedures-overlay")
			?.getBoundingClientRect();

		if (!containerRect) return;

		setTooltipData({
			visible: true,
			x: rect.left - containerRect.left + rect.width / 2,
			y: rect.top - containerRect.top - 10,
			procedure,
		});
	};

	const handleProcedureMouseLeave = () => {
		setTooltipData({ visible: false, x: 0, y: 0, procedure: null });
	};

	const chartHeight = 120;

	// These must match the chart margin.left + YAxis width props below so the
	// procedure overlay aligns exactly with the Recharts plot area.
	const YAXIS_WIDTH = 50;
	const CHART_MARGIN_LEFT = 20;
	const CHART_MARGIN_RIGHT = 20;

	return (
		<Card className="overflow-visible">
			<CardHeader className="pb-0 pt-2">
				<CardTitle className="text-base">Visual Acuity, IOP, and CMT Trends</CardTitle>
			</CardHeader>
			<CardContent className="overflow-visible">
				<div className="relative">
					{/* Procedures Overlay */}
					{showProcedures && positionedProcedures.length > 0 && (
						<div
							className="procedures-overlay absolute top-0 h-[30px] z-10"
							style={{
								left: `${CHART_MARGIN_LEFT + YAXIS_WIDTH}px`,
								right: `${CHART_MARGIN_RIGHT}px`,
							}}
						>
							{positionedProcedures.map((procedure, idx) => {
								const Icon =
									procedure.type === "injection"
										? Syringe
										: procedure.type === "laser"
											? Cookie
											: procedure.type === "surgery"
												? Scissors
												: Flashlight;
								return (
									<div
										key={idx}
										className="absolute top-0 cursor-pointer transition-transform hover:scale-110"
										style={{
											left: `calc(${procedure.position}% + ${procedure.offsetIndex * 20}px)`,
											transform: "translateX(-50%)",
										}}
										onMouseEnter={(e) =>
											handleProcedureMouseEnter(e, procedure)
										}
										onMouseLeave={handleProcedureMouseLeave}
									>
										<Icon
											className="w-4 h-4"
											style={{ color: procedure.color }}
										/>
									</div>
								);
							})}

							{/* Tooltip */}
							{tooltipData.visible && tooltipData.procedure && (
								<div
									className="absolute pointer-events-none z-50 animate-in fade-in-0 zoom-in-95 duration-200"
									style={{
										left: `${tooltipData.x}px`,
										top: `${tooltipData.y}px`,
										transform: "translateX(-30%) translateY(80%)",
									}}
								>
									<div
										className="bg-background border rounded-lg shadow-lg p-2 text-xs whitespace-nowrap"
										style={{
											borderLeft: `4px solid ${tooltipData.procedure.color}`,
										}}
									>
										<div className="font-semibold mb-0.5 text-xs">
											{tooltipData.procedure.name}
										</div>
										<div className="text-muted-foreground text-xs">
											{format(
												parseISO(tooltipData.procedure.date),
												"MMM d, yyyy"
											)}
										</div>
										{tooltipData.procedure.count &&
											tooltipData.procedure.count > 1 && (
												<div className="text-muted-foreground text-xs mt-0.5 italic">
													Occurred {tooltipData.procedure.count} times
												</div>
											)}
									</div>
								</div>
							)}
						</div>
					)}

					{/* Visual Acuity Chart */}
					{showVA && vaChartData.length > 0 && (
						<div className="pt-[45px]">
							<ResponsiveContainer width="100%" height={chartHeight}>
								<RechartsLineChart
									data={vaChartData}
									margin={{ top: 5, right: 20, bottom: 0, left: 20 }}
								>
									<CartesianGrid strokeDasharray="3 3" opacity={0.3} />
									<XAxis dataKey="date" hide />
									<YAxis
										width={YAXIS_WIDTH}
										domain={[vaMin, vaMax]}
										tick={{ fontSize: 11 }}
										tickFormatter={(v) => v.toFixed(1)}
									/>
									<Tooltip content={(props: any) => <VATooltip {...props} />} cursor={false} />
									<Line
										type="monotone"
										dataKey="value"
										stroke={
											isDark
												? metrics[0]?.colorDark || "#666"
												: metrics[0]?.colorLight || "#ccc"
										}
										strokeWidth={2}
										dot={{ r: 4 }}
										connectNulls
									/>
								</RechartsLineChart>
							</ResponsiveContainer>
						</div>
					)}

					{/* IOP Chart */}
					{showIOP && iopChartData.length > 0 && (
						<div
							className={
								showVA && vaChartData.length > 0 ? "mt-0" : "pt-[45px]"
							}
						>
							<ResponsiveContainer width="100%" height={chartHeight}>
								<RechartsLineChart
									data={iopChartData}
									margin={{ top: 5, right: 20, bottom: 0, left: 20 }}
								>
									<CartesianGrid strokeDasharray="3 3" opacity={0.3} />
									<XAxis dataKey="date" hide />
									<YAxis width={YAXIS_WIDTH} domain={[iopMin, iopMax]} tick={{ fontSize: 11 }} />
									<Tooltip content={(props: any) => <IOPTooltip {...props} />} cursor={false} />
									<Line
										type="monotone"
										dataKey="value"
										stroke={
											isDark
												? metrics[1]?.colorDark || "#666"
												: metrics[1]?.colorLight || "#ccc"
										}
										strokeWidth={2}
										dot={{ r: 4 }}
										connectNulls
									/>
								</RechartsLineChart>
							</ResponsiveContainer>
						</div>
					)}

					{/* CMT Chart */}
					{showCMT && cmtChartData.length > 0 && (
						<div
							className={
								(showVA && vaChartData.length > 0) ||
									(showIOP && iopChartData.length > 0)
									? "mt-0"
									: "pt-[45px]"
							}
						>
							<ResponsiveContainer width="100%" height={chartHeight}>
								<RechartsLineChart
									data={cmtChartData}
									margin={{ top: 5, right: 20, bottom: 20, left: 20 }}
								>
									<CartesianGrid strokeDasharray="3 3" opacity={0.3} />
									<XAxis
										dataKey="date"
										tickFormatter={(date) => format(parseISO(date), "MMM yy")}
										tick={{ fontSize: 12 }}
									/>
									<YAxis width={YAXIS_WIDTH} domain={[cmtMin, cmtMax]} tick={{ fontSize: 11 }} />
									<Tooltip content={(props: any) => <CMTTooltip {...props} />} cursor={false} />
									<Line
										type="monotone"
										dataKey="value"
										stroke={
											isDark
												? metrics[2]?.colorDark || "#666"
												: metrics[2]?.colorLight || "#ccc"
										}
										strokeWidth={2}
										dot={{ r: 4 }}
										connectNulls
									/>
								</RechartsLineChart>
							</ResponsiveContainer>
						</div>
					)}
				</div>

				{/* Legend */}
				{/* <div className="flex flex-wrap gap-4 mt-4 justify-center">
					{showVA && (
						<div className="flex items-center gap-2">
							<div
								className="w-3 h-3 rounded-full"
								style={{
									backgroundColor: isDark
										? metrics[0]?.colorDark || "#666"
										: metrics[0]?.colorLight || "#ccc",
								}}
							/>
							<span className="text-sm">Visual Acuity</span>
						</div>
					)}
					{showIOP && (
						<div className="flex items-center gap-2">
							<div
								className="w-3 h-3 rounded-full"
								style={{
									backgroundColor: isDark
										? metrics[1]?.colorDark || "#666"
										: metrics[1]?.colorLight || "#ccc",
								}}
							/>
							<span className="text-sm">IOP (mmHg)</span>
						</div>
					)}
					{showCMT && (
						<div className="flex items-center gap-2">
							<div
								className="w-3 h-3 rounded-full"
								style={{
									backgroundColor: isDark
										? metrics[2]?.colorDark || "#666"
										: metrics[2]?.colorLight || "#ccc",
								}}
							/>
							<span className="text-sm">CMT (µm)</span>
						</div>
					)}
				</div> */}
			</CardContent>
		</Card>
	);
}
