/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo } from "react";
import {
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	ReferenceLine,
	LineChart as RechartsLineChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartData, MetricConfig, ProcedureData } from "@/types/patient";
import { format } from "date-fns";
import {
	Syringe,
	Zap,
	Scissors,
	Activity,
	Eye,
	Droplets,
	ScanLine,
	Calendar,
	CheckCircle2,
	AlertCircle,
} from "lucide-react";
import { convertNumericToSnellen } from "@/lib/utils/vision-utils";

interface LineChartProps {
	reData?: ChartData;
	leData?: ChartData;
	beData?: ChartData;
	data?: ChartData;
	metrics?: MetricConfig[];
	showVA?: boolean;
	showIOP?: boolean;
	showCMT?: boolean;
	showProcedures?: boolean;
	selectedEye?: "BE" | "RE" | "LE";
	hideCardWrapper?: boolean;
}

// Helper to safely format dates without throwing
function formatDateSafe(dateStr?: string, formatStr: string = "dd MMM yyyy"): string {
	if (!dateStr) return "—";
	try {
		const d = new Date(dateStr);
		if (isNaN(d.getTime())) return dateStr;
		return format(d, formatStr);
	} catch {
		return dateStr;
	}
}

// Format numeric LogMAR value into standard clinical Snellen rating
function formatVATick(v: number): string {
	if (v >= 1.45) return "6/6";
	if (v >= 1.15 && v <= 1.25) return "6/12";
	if (v >= 0.85 && v <= 0.95) return "6/24";
	if (v >= 0.45 && v <= 0.55) return "6/60";
	if (v >= -0.15 && v <= 0.15) return "CF";
	if (v <= -0.5) return "HM";
	return convertNumericToSnellen(v);
}

export function LineChart({
	reData: rawREData,
	leData: rawLEData,
	beData: rawBEData,
	data: fallbackData,
	showVA = true,
	showIOP = true,
	showCMT = true,
	showProcedures = true,
	selectedEye = "BE",
	hideCardWrapper = true,
}: LineChartProps) {
	const reSource = rawREData || fallbackData || { procedures: [], visualAcuityData: [], iopData: [], cmtData: [] };
	const leSource = rawLEData || fallbackData || { procedures: [], visualAcuityData: [], iopData: [], cmtData: [] };
	const beSource = rawBEData || { procedures: [], visualAcuityData: [], iopData: [], cmtData: [] };

	// Chronologically sorted distinct date list across all eyes & modalities
	const chartDateStrings = useMemo(() => {
		return Array.from(
			new Set([
				...reSource.visualAcuityData.map((d) => d.x),
				...reSource.iopData.map((d) => d.x),
				...reSource.cmtData.map((d) => d.x),
				...reSource.procedures.map((d) => d.date),
				...leSource.visualAcuityData.map((d) => d.x),
				...leSource.iopData.map((d) => d.x),
				...leSource.cmtData.map((d) => d.x),
				...leSource.procedures.map((d) => d.date),
				...beSource.visualAcuityData.map((d) => d.x),
				...beSource.iopData.map((d) => d.x),
				...beSource.cmtData.map((d) => d.x),
				...beSource.procedures.map((d) => d.date),
			])
		)
			.filter((d) => d && !isNaN(new Date(d).getTime()))
			.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
	}, [reSource, leSource, beSource]);

	// Combined procedures with laterality tags
	const combinedProcedures = useMemo(() => {
		const procs: Array<ProcedureData & { eyeTag: "RE" | "LE" | "BE" }> = [];
		reSource.procedures.forEach((p) => procs.push({ ...p, eyeTag: "RE" }));
		leSource.procedures.forEach((p) => procs.push({ ...p, eyeTag: "LE" }));
		beSource.procedures.forEach((p) => procs.push({ ...p, eyeTag: "BE" }));
		return procs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
	}, [reSource, leSource, beSource]);

	// Filtered procedures based on eye filter
	const activeProcedures = useMemo(() => {
		if (selectedEye === "RE") return combinedProcedures.filter((p) => p.eyeTag === "RE" || p.eyeTag === "BE");
		if (selectedEye === "LE") return combinedProcedures.filter((p) => p.eyeTag === "LE" || p.eyeTag === "BE");
		return combinedProcedures;
	}, [combinedProcedures, selectedEye]);

	// Unified dataset containing all tracks to synchronize crosshairs and tooltips
	const unifiedData = useMemo(() => {
		if (!chartDateStrings.length) return [];

		return chartDateStrings.map((date, idx) => {
			const reVA = reSource.visualAcuityData.find((d) => d.x === date) || beSource.visualAcuityData.find((d) => d.x === date);
			const leVA = leSource.visualAcuityData.find((d) => d.x === date) || beSource.visualAcuityData.find((d) => d.x === date);

			const reIOP = reSource.iopData.find((d) => d.x === date) || beSource.iopData.find((d) => d.x === date);
			const leIOP = leSource.iopData.find((d) => d.x === date) || beSource.iopData.find((d) => d.x === date);

			const reCMT = reSource.cmtData.find((d) => d.x === date) || beSource.cmtData.find((d) => d.x === date);
			const leCMT = leSource.cmtData.find((d) => d.x === date) || beSource.cmtData.find((d) => d.x === date);

			const procsOnDate = activeProcedures.filter((p) => p.date === date);

			return {
				date,
				visitIndex: idx + 1,
				reVA: reVA?.yNumeric ?? null,
				reVALabel: reVA?.y ?? null,
				reVASph: reVA?.sph ?? null,
				leValue: leVA?.yNumeric ?? null,
				leVALabel: leVA?.y ?? null,
				leVASph: leVA?.sph ?? null,
				reIOP: reIOP?.y ?? null,
				leIOP: leIOP?.y ?? null,
				reCMT: reCMT?.y ?? null,
				leCMT: leCMT?.y ?? null,
				procedures: procsOnDate,
				hasProcedure: procsOnDate.length > 0,
			};
		});
	}, [chartDateStrings, reSource, leSource, beSource, activeProcedures]);

	// Calculate clinical Y ranges
	const allVA = unifiedData
		.flatMap((d) => [selectedEye !== "LE" ? d.reVA : null, selectedEye !== "RE" ? d.leValue : null])
		.filter((v): v is number => v != null);

	const allIOP = unifiedData
		.flatMap((d) => [selectedEye !== "LE" ? d.reIOP : null, selectedEye !== "RE" ? d.leIOP : null])
		.filter((v): v is number => v != null);

	const allCMT = unifiedData
		.flatMap((d) => [selectedEye !== "LE" ? d.reCMT : null, selectedEye !== "RE" ? d.leCMT : null])
		.filter((v): v is number => v != null);

	// VA range
	const minVA = allVA.length ? Math.min(...allVA) : 0.2;
	const maxVA = allVA.length ? Math.max(...allVA) : 1.5;
	const vaMin = Math.min(0.0, Math.floor(minVA * 2) / 2);
	const vaMax = Math.max(1.5, Math.ceil(maxVA * 2) / 2);
	const vaTicks = [0.0, 0.5, 0.9, 1.2, 1.5].filter((t) => t >= vaMin - 0.05 && t <= vaMax + 0.05);

	// IOP range
	const maxIOP = allIOP.length ? Math.max(...allIOP) : 22;
	const minIOP = allIOP.length ? Math.min(...allIOP) : 8;
	const iopMin = Math.max(0, Math.min(6, Math.floor(minIOP / 4) * 4));
	const iopMax = Math.max(26, Math.ceil((maxIOP + 2) / 4) * 4);

	// CMT range
	const maxCMT = allCMT.length ? Math.max(...allCMT) : 320;
	const cmtMin = 0;
	const cmtMax = Math.max(450, Math.ceil((maxCMT + 40) / 100) * 100);

	// Geometry standards to guarantee 100% pixel-aligned vertical gridlines
	const YAXIS_WIDTH = 68;
	const CHART_HEIGHT = 145;
	const SYNC_ID = "clinicalMetricsTrendSync";
	const BASE_MARGIN = { top: 8, right: 30, left: 8, bottom: 4 };

	// Determine which visible chart is at the bottom to render the date X-Axis
	const isBottomMost = (metric: "VA" | "IOP" | "CMT") => {
		if (metric === "CMT") return true;
		if (metric === "IOP") return !showCMT;
		if (metric === "VA") return !showCMT && !showIOP;
		return false;
	};

	// Unified clinical tooltip
	const UnifiedTrendTooltip = ({ active, label }: any) => {
		if (!active || !label) return null;
		const item = unifiedData.find((d) => d.date === label);
		if (!item) return null;

		return (
			<div className="bg-popover/98 backdrop-blur-md border border-border/80 rounded-xl shadow-xl p-3 text-xs min-w-[260px] max-w-[340px] z-50 animate-in fade-in-0 duration-150">
				{/* Header: Date + Visit number */}
				<div className="flex items-center justify-between border-b border-border/60 pb-1.5 mb-2">
					<div className="flex items-center gap-1.5">
						<Calendar className="w-3.5 h-3.5 text-primary" />
						<span className="font-bold text-foreground text-xs">
							{formatDateSafe(item.date, "dd MMM yyyy")}
						</span>
					</div>
					<span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
						Visit #{item.visitIndex} of {unifiedData.length}
					</span>
				</div>

				{/* Interventions / Procedures on this date */}
				{item.procedures && item.procedures.length > 0 && (
					<div className="mb-2 p-1.5 rounded-lg bg-primary/10 border border-primary/20 space-y-1">
						<div className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
							<Syringe className="w-3 h-3 text-primary" />
							<span>Interventions Performed:</span>
						</div>
						{item.procedures.map((p, pIdx) => (
							<div key={pIdx} className="flex items-center justify-between text-[11px] gap-2">
								<span className="font-medium text-foreground break-words">{p.name}</span>
								<span
									className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
										p.eyeTag === "RE"
											? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
											: p.eyeTag === "LE"
											? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
											: "bg-muted text-foreground"
									}`}
								>
									{p.eyeTag}
								</span>
							</div>
						))}
					</div>
				)}

				{/* Metrics Grid */}
				<div className="space-y-1.5">
					{/* VA */}
					{showVA && (
						<div className="p-1.5 rounded-md bg-muted/30 border border-border/40 space-y-0.5">
							<div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
								<span className="flex items-center gap-1">
									<Eye className="w-3 h-3 text-primary" /> Visual Acuity (BCVA)
								</span>
							</div>
							<div className="flex items-center justify-between text-[11px] font-mono">
								{(selectedEye === "BE" || selectedEye === "RE") && (
									<div className="flex items-center gap-1 text-sky-700 dark:text-sky-400 font-bold">
										<span>RE:</span>
										<span>{item.reVALabel || (item.reVA != null ? convertNumericToSnellen(item.reVA) : "—")}</span>
										{item.reVASph && <span className="text-[9px] font-normal text-muted-foreground">({item.reVASph})</span>}
									</div>
								)}
								{selectedEye === "BE" && <span className="text-muted-foreground/30">|</span>}
								{(selectedEye === "BE" || selectedEye === "LE") && (
									<div className="flex items-center gap-1 text-purple-700 dark:text-purple-400 font-bold">
										<span>LE:</span>
										<span>{item.leVALabel || (item.leValue != null ? convertNumericToSnellen(item.leValue) : "—")}</span>
										{item.leVASph && <span className="text-[9px] font-normal text-muted-foreground">({item.leVASph})</span>}
									</div>
								)}
							</div>
						</div>
					)}

					{/* IOP */}
					{showIOP && (
						<div className="p-1.5 rounded-md bg-muted/30 border border-border/40 space-y-0.5">
							<div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
								<span className="flex items-center gap-1">
									<Droplets className="w-3 h-3 text-primary" /> IOP (mmHg)
								</span>
								<span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">Safe: 10–21 mmHg</span>
							</div>
							<div className="flex items-center justify-between text-[11px] font-mono">
								{(selectedEye === "BE" || selectedEye === "RE") && (
									<div
										className={`flex items-center gap-1 font-bold ${
											item.reIOP && item.reIOP > 21
												? "text-amber-600 dark:text-amber-400"
												: "text-sky-700 dark:text-sky-400"
										}`}
									>
										<span>RE:</span>
										<span>{item.reIOP != null ? `${item.reIOP} mmHg` : "—"}</span>
										{item.reIOP && item.reIOP > 21 && (
											<AlertCircle className="w-2.5 h-2.5 text-amber-500 ml-0.5" />
										)}
									</div>
								)}
								{selectedEye === "BE" && <span className="text-muted-foreground/30">|</span>}
								{(selectedEye === "BE" || selectedEye === "LE") && (
									<div
										className={`flex items-center gap-1 font-bold ${
											item.leIOP && item.leIOP > 21
												? "text-amber-600 dark:text-amber-400"
												: "text-purple-700 dark:text-purple-400"
										}`}
									>
										<span>LE:</span>
										<span>{item.leIOP != null ? `${item.leIOP} mmHg` : "—"}</span>
										{item.leIOP && item.leIOP > 21 && (
											<AlertCircle className="w-2.5 h-2.5 text-amber-500 ml-0.5" />
										)}
									</div>
								)}
							</div>
						</div>
					)}

					{/* CMT */}
					{showCMT && (
						<div className="p-1.5 rounded-md bg-muted/30 border border-border/40 space-y-0.5">
							<div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
								<span className="flex items-center gap-1">
									<ScanLine className="w-3 h-3 text-primary" /> Macular Thickness (CMT)
								</span>
								<span className="text-[9px] text-muted-foreground font-medium">Normal: ≤ 280 µm</span>
							</div>
							<div className="flex items-center justify-between text-[11px] font-mono">
								{(selectedEye === "BE" || selectedEye === "RE") && (
									<div
										className={`flex items-center gap-1 font-bold ${
											item.reCMT && item.reCMT > 280
												? "text-primary dark:text-[#2990d8]"
												: "text-sky-700 dark:text-sky-400"
										}`}
									>
										<span>RE:</span>
										<span>{item.reCMT != null ? `${item.reCMT} µm` : "—"}</span>
										{item.reCMT && item.reCMT > 280 && (
											<span className="text-[9px] font-medium text-amber-600 ml-0.5">(Edema)</span>
										)}
									</div>
								)}
								{selectedEye === "BE" && <span className="text-muted-foreground/30">|</span>}
								{(selectedEye === "BE" || selectedEye === "LE") && (
									<div
										className={`flex items-center gap-1 font-bold ${
											item.leCMT && item.leCMT > 280
												? "text-primary dark:text-[#2990d8]"
												: "text-purple-700 dark:text-purple-400"
										}`}
									>
										<span>LE:</span>
										<span>{item.leCMT != null ? `${item.leCMT} µm` : "—"}</span>
										{item.leCMT && item.leCMT > 280 && (
											<span className="text-[9px] font-medium text-amber-600 ml-0.5">(Edema)</span>
										)}
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
		);
	};

	if (!unifiedData.length) {
		return (
			<div className="p-8 text-center text-muted-foreground text-xs italic bg-muted/20 rounded-lg border border-border/60">
				No longitudinal visual metric observations recorded.
			</div>
		);
	}

	const content = (
		<div className="space-y-3.5 select-none">
			{/* Interventions & Procedures Timeline Ribbon */}
			{showProcedures && activeProcedures.length > 0 && (
				<div className="p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-1.5 shadow-2xs">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
							<Syringe className="w-3.5 h-3.5 text-primary" />
							<span>Interventions & Procedures Timeline ({activeProcedures.length})</span>
						</div>
						<span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">
							Hover any curve or date to view synchronized metrics
						</span>
					</div>
					<div className="flex items-center gap-1.5 overflow-x-auto box-scroll pb-1">
						{activeProcedures.map((proc, idx) => {
							const Icon =
								proc.type === "injection"
									? Syringe
									: proc.type === "laser"
									? Zap
									: proc.type === "surgery"
									? Scissors
									: Activity;
							return (
								<div
									key={idx}
									className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-card border border-border/70 text-xs shadow-2xs whitespace-nowrap shrink-0 hover:border-primary/50 transition-colors"
								>
									<div
										className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
										style={{ backgroundColor: `${proc.color || "#0284c7"}18`, color: proc.color || "#0284c7" }}
									>
										<Icon className="w-2.5 h-2.5" />
									</div>
									<span className="font-semibold text-foreground text-[11px]">{proc.name}</span>
									<span
										className={`px-1 py-0.2 rounded text-[9px] font-bold ${
											proc.eyeTag === "RE"
												? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
												: proc.eyeTag === "LE"
												? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
												: "bg-muted text-foreground"
										}`}
									>
										{proc.eyeTag}
									</span>
									<span className="text-[10px] text-muted-foreground font-mono">
										{formatDateSafe(proc.date, "dd MMM yy")}
									</span>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* ========================================================================= */}
			{/* 1. VISUAL ACUITY (BCVA) CHART TRACK                                       */}
			{/* ========================================================================= */}
			{showVA && (
				<div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
					{/* Track Header */}
					<div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-50/80 dark:bg-slate-900/60 border-b border-border/70 text-xs">
						<div className="flex items-center gap-2">
							<Eye className="w-3.5 h-3.5 text-primary" />
							<span className="font-bold text-foreground">Visual Acuity (BCVA)</span>
						</div>
						<div className="flex items-center gap-3 text-[11px]">
							{(selectedEye === "BE" || selectedEye === "RE") && (
								<span className="flex items-center gap-1.5 text-foreground font-semibold">
									<span className="w-3 h-0.5 bg-sky-600 rounded-full inline-block" /> RE (Right Eye)
								</span>
							)}
							{(selectedEye === "BE" || selectedEye === "LE") && (
								<span className="flex items-center gap-1.5 text-foreground font-semibold">
									<span className="w-3 h-0.5 bg-purple-600 border-b border-dashed rounded-full inline-block" /> LE (Left Eye)
								</span>
							)}
						</div>
					</div>

					{/* Recharts Canvas */}
					<div className="p-1 pt-2">
						<ResponsiveContainer width="100%" height={CHART_HEIGHT}>
							<RechartsLineChart
								syncId={SYNC_ID}
								data={unifiedData}
								margin={
									isBottomMost("VA")
										? { ...BASE_MARGIN, bottom: 24 }
										: BASE_MARGIN
								}
							>
								<CartesianGrid strokeDasharray="3 3" opacity={0.25} />
								<XAxis
									dataKey="date"
									hide={!isBottomMost("VA")}
									tickFormatter={(date) => formatDateSafe(date, "MMM yy")}
									tick={{ fontSize: 10, fill: "currentColor" }}
									interval="preserveStartEnd"
								/>
								<YAxis
									width={YAXIS_WIDTH}
									domain={[vaMin, vaMax]}
									ticks={vaTicks}
									tick={{ fontSize: 10, fill: "currentColor" }}
									tickFormatter={formatVATick}
								/>
								<Tooltip content={(props: any) => <UnifiedTrendTooltip {...props} />} />

								{/* Subtle vertical milestone lines for procedures */}
								{showProcedures &&
									unifiedData
										.filter((d) => d.hasProcedure)
										.map((d) => (
											<ReferenceLine
												key={`proc-va-${d.date}`}
												x={d.date}
												stroke="#818cf8"
												strokeDasharray="2 2"
												strokeWidth={1}
												strokeOpacity={0.5}
											/>
										))}

								{/* Right Eye Line (Sky Blue, solid) */}
								{(selectedEye === "BE" || selectedEye === "RE") && (
									<Line
										type="monotone"
										dataKey="reVA"
										stroke="#0284c7"
										strokeWidth={2.2}
										dot={{ r: 3, fill: "#0284c7", stroke: "#ffffff", strokeWidth: 1.5 }}
										activeDot={{ r: 5, fill: "#0284c7", stroke: "#ffffff", strokeWidth: 2 }}
										connectNulls
										name="RE"
									/>
								)}

								{/* Left Eye Line (Purple, dashed) */}
								{(selectedEye === "BE" || selectedEye === "LE") && (
									<Line
										type="monotone"
										dataKey="leValue"
										stroke="#9333ea"
										strokeWidth={2.2}
										strokeDasharray="5 5"
										dot={{ r: 3, fill: "#9333ea", stroke: "#ffffff", strokeWidth: 1.5 }}
										activeDot={{ r: 5, fill: "#9333ea", stroke: "#ffffff", strokeWidth: 2 }}
										connectNulls
										name="LE"
									/>
								)}
							</RechartsLineChart>
						</ResponsiveContainer>
					</div>
				</div>
			)}

			{/* ========================================================================= */}
			{/* 2. INTRAOCULAR PRESSURE (IOP) CHART TRACK                                 */}
			{/* ========================================================================= */}
			{showIOP && (
				<div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
					{/* Track Header */}
					<div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-50/80 dark:bg-slate-900/60 border-b border-border/70 text-xs">
						<div className="flex items-center gap-2">
							<Droplets className="w-3.5 h-3.5 text-primary" />
							<span className="font-bold text-foreground">Intraocular Pressure (IOP)</span>
							{/* <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
								Safe Range: 10 – 21 mmHg
							</span> */}
						</div>
						<div className="flex items-center gap-3 text-[11px]">
							{(selectedEye === "BE" || selectedEye === "RE") && (
								<span className="flex items-center gap-1.5 text-foreground font-semibold">
									<span className="w-3 h-0.5 bg-sky-600 rounded-full inline-block" /> RE (Right Eye)
								</span>
							)}
							{(selectedEye === "BE" || selectedEye === "LE") && (
								<span className="flex items-center gap-1.5 text-foreground font-semibold">
									<span className="w-3 h-0.5 bg-purple-600 border-b border-dashed rounded-full inline-block" /> LE (Left Eye)
								</span>
							)}
						</div>
					</div>

					{/* Recharts Canvas */}
					<div className="p-1 pt-2">
						<ResponsiveContainer width="100%" height={CHART_HEIGHT}>
							<RechartsLineChart
								syncId={SYNC_ID}
								data={unifiedData}
								margin={
									isBottomMost("IOP")
										? { ...BASE_MARGIN, bottom: 24 }
										: BASE_MARGIN
								}
							>
								<CartesianGrid strokeDasharray="3 3" opacity={0.25} />
								<XAxis
									dataKey="date"
									hide={!isBottomMost("IOP")}
									tickFormatter={(date) => formatDateSafe(date, "MMM yy")}
									tick={{ fontSize: 10, fill: "currentColor" }}
									interval="preserveStartEnd"
								/>
								<YAxis
									width={YAXIS_WIDTH}
									domain={[iopMin, iopMax]}
									tick={{ fontSize: 10, fill: "currentColor" }}
									tickFormatter={(v) => `${v}`}
								/>
								<Tooltip content={(props: any) => <UnifiedTrendTooltip {...props} />} />

								{/* Subtle vertical milestone lines for procedures */}
								{showProcedures &&
									unifiedData
										.filter((d) => d.hasProcedure)
										.map((d) => (
											<ReferenceLine
												key={`proc-iop-${d.date}`}
												x={d.date}
												stroke="#818cf8"
												strokeDasharray="2 2"
												strokeWidth={1}
												strokeOpacity={0.5}
											/>
										))}

								{/* Right Eye Line */}
								{(selectedEye === "BE" || selectedEye === "RE") && (
									<Line
										type="monotone"
										dataKey="reIOP"
										stroke="#0284c7"
										strokeWidth={2.2}
										dot={{ r: 3, fill: "#0284c7", stroke: "#ffffff", strokeWidth: 1.5 }}
										activeDot={{ r: 5, fill: "#0284c7", stroke: "#ffffff", strokeWidth: 2 }}
										connectNulls
										name="RE"
									/>
								)}

								{/* Left Eye Line */}
								{(selectedEye === "BE" || selectedEye === "LE") && (
									<Line
										type="monotone"
										dataKey="leIOP"
										stroke="#9333ea"
										strokeWidth={2.2}
										strokeDasharray="5 5"
										dot={{ r: 3, fill: "#9333ea", stroke: "#ffffff", strokeWidth: 1.5 }}
										activeDot={{ r: 5, fill: "#9333ea", stroke: "#ffffff", strokeWidth: 2 }}
										connectNulls
										name="LE"
									/>
								)}
							</RechartsLineChart>
						</ResponsiveContainer>
					</div>
				</div>
			)}

			{/* ========================================================================= */}
			{/* 3. CENTRAL MACULAR THICKNESS (CMT) CHART TRACK                           */}
			{/* ========================================================================= */}
			{showCMT && (
				<div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
					{/* Track Header */}
					<div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-50/80 dark:bg-slate-900/60 border-b border-border/70 text-xs">
						<div className="flex items-center gap-2">
							<ScanLine className="w-3.5 h-3.5 text-primary" />
							<span className="font-bold text-foreground">Central Macular Thickness (CMT)</span>
							{/* <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
								Normal Limit: ≤ 280 µm
							</span> */}
						</div>
						<div className="flex items-center gap-3 text-[11px]">
							{(selectedEye === "BE" || selectedEye === "RE") && (
								<span className="flex items-center gap-1.5 text-foreground font-semibold">
									<span className="w-3 h-0.5 bg-sky-600 rounded-full inline-block" /> RE (Right Eye)
								</span>
							)}
							{(selectedEye === "BE" || selectedEye === "LE") && (
								<span className="flex items-center gap-1.5 text-foreground font-semibold">
									<span className="w-3 h-0.5 bg-purple-600 border-b border-dashed rounded-full inline-block" /> LE (Left Eye)
								</span>
							)}
						</div>
					</div>

					{/* Recharts Canvas */}
					<div className="p-1 pt-2">
						<ResponsiveContainer width="100%" height={CHART_HEIGHT}>
							<RechartsLineChart
								syncId={SYNC_ID}
								data={unifiedData}
								margin={
									isBottomMost("CMT")
										? { ...BASE_MARGIN, bottom: 24 }
										: BASE_MARGIN
								}
							>
								<CartesianGrid strokeDasharray="3 3" opacity={0.25} />
								<XAxis
									dataKey="date"
									hide={!isBottomMost("CMT")}
									tickFormatter={(date) => formatDateSafe(date, "MMM yy")}
									tick={{ fontSize: 10, fill: "currentColor" }}
									interval="preserveStartEnd"
								/>
								<YAxis
									width={YAXIS_WIDTH}
									domain={[cmtMin, cmtMax]}
									tick={{ fontSize: 10, fill: "currentColor" }}
									tickFormatter={(v) => `${v}`}
								/>
								<Tooltip content={(props: any) => <UnifiedTrendTooltip {...props} />} />

								{/* Subtle vertical milestone lines for procedures */}
								{showProcedures &&
									unifiedData
										.filter((d) => d.hasProcedure)
										.map((d) => (
											<ReferenceLine
												key={`proc-cmt-${d.date}`}
												x={d.date}
												stroke="#818cf8"
												strokeDasharray="2 2"
												strokeWidth={1}
												strokeOpacity={0.5}
											/>
										))}

								{/* Right Eye Line */}
								{(selectedEye === "BE" || selectedEye === "RE") && (
									<Line
										type="monotone"
										dataKey="reCMT"
										stroke="#0284c7"
										strokeWidth={2.2}
										dot={{ r: 3, fill: "#0284c7", stroke: "#ffffff", strokeWidth: 1.5 }}
										activeDot={{ r: 5, fill: "#0284c7", stroke: "#ffffff", strokeWidth: 2 }}
										connectNulls
										name="RE"
									/>
								)}

								{/* Left Eye Line */}
								{(selectedEye === "BE" || selectedEye === "LE") && (
									<Line
										type="monotone"
										dataKey="leCMT"
										stroke="#9333ea"
										strokeWidth={2.2}
										strokeDasharray="5 5"
										dot={{ r: 3, fill: "#9333ea", stroke: "#ffffff", strokeWidth: 1.5 }}
										activeDot={{ r: 5, fill: "#9333ea", stroke: "#ffffff", strokeWidth: 2 }}
										connectNulls
										name="LE"
									/>
								)}
							</RechartsLineChart>
						</ResponsiveContainer>
					</div>
				</div>
			)}
		</div>
	);

	if (hideCardWrapper) {
		return content;
	}

	return (
		<Card className="overflow-hidden">
			<CardHeader className="pb-1 pt-3">
				<CardTitle className="text-sm font-bold">Bilateral Visual Acuity, IOP, and CMT Trends</CardTitle>
			</CardHeader>
			<CardContent className="p-3">{content}</CardContent>
		</Card>
	);
}
