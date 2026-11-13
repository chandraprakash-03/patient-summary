/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useMemo } from "react";
import { ChartData, MetricConfig } from "@/types/patient";
import { ClinicalStatusMatrix } from "./clinical-status-matrix";
import { LineChart } from "./line-chart";
import {
	Grid3X3,
	LineChart as LineChartIcon,
	Eye,
	Droplets,
	ScanLine,
	Activity,
	Syringe,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface ClinicalMetricsViewProps {
	reData?: ChartData;
	leData?: ChartData;
	beData?: ChartData;
	data?: ChartData;
	metrics: MetricConfig[];
	defaultMode?: "matrix" | "trend";
}

export function ClinicalMetricsView({
	reData: rawREData,
	leData: rawLEData,
	beData: rawBEData,
	data: fallbackData,
	metrics,
	defaultMode = "matrix",
}: ClinicalMetricsViewProps) {
	const [viewMode, setViewMode] = useState<"matrix" | "trend">(defaultMode);
	const [selectedEye, setSelectedEye] = useState<"BE" | "RE" | "LE">("BE");
	const [showVA, setShowVA] = useState(true);
	const [showIOP, setShowIOP] = useState(true);
	const [showCMT, setShowCMT] = useState(true);
	const [showProcedures, setShowProcedures] = useState(true);

	const reSource = rawREData || fallbackData || { procedures: [], visualAcuityData: [], iopData: [], cmtData: [] };
	const leSource = rawLEData || fallbackData || { procedures: [], visualAcuityData: [], iopData: [], cmtData: [] };
	const beSource = rawBEData || { procedures: [], visualAcuityData: [], iopData: [], cmtData: [] };

	// Calculate latest recorded values for both eyes
	const latestSnapshot = useMemo(() => {
		const allDates = Array.from(
			new Set([
				...reSource.visualAcuityData.map((d) => d.x),
				...reSource.iopData.map((d) => d.x),
				...reSource.cmtData.map((d) => d.x),
				...leSource.visualAcuityData.map((d) => d.x),
				...leSource.iopData.map((d) => d.x),
				...leSource.cmtData.map((d) => d.x),
				...beSource.visualAcuityData.map((d) => d.x),
				...beSource.iopData.map((d) => d.x),
				...beSource.cmtData.map((d) => d.x),
			])
		)
			.filter((d) => d && !isNaN(new Date(d).getTime()))
			.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

		const mostRecentDate = allDates[0];
		if (!mostRecentDate) return null;

		const latestREVA = reSource.visualAcuityData.find((d) => d.x === mostRecentDate) || beSource.visualAcuityData.find((d) => d.x === mostRecentDate) || (reSource.visualAcuityData.length ? reSource.visualAcuityData[reSource.visualAcuityData.length - 1] : null);
		const latestLEVA = leSource.visualAcuityData.find((d) => d.x === mostRecentDate) || beSource.visualAcuityData.find((d) => d.x === mostRecentDate) || (leSource.visualAcuityData.length ? leSource.visualAcuityData[leSource.visualAcuityData.length - 1] : null);

		const latestREIOP = reSource.iopData.find((d) => d.x === mostRecentDate) || beSource.iopData.find((d) => d.x === mostRecentDate) || (reSource.iopData.length ? reSource.iopData[reSource.iopData.length - 1] : null);
		const latestLEIOP = leSource.iopData.find((d) => d.x === mostRecentDate) || beSource.iopData.find((d) => d.x === mostRecentDate) || (leSource.iopData.length ? leSource.iopData[leSource.iopData.length - 1] : null);

		const latestRECMT = reSource.cmtData.find((d) => d.x === mostRecentDate) || beSource.cmtData.find((d) => d.x === mostRecentDate) || (reSource.cmtData.length ? reSource.cmtData[reSource.cmtData.length - 1] : null);
		const latestLECMT = leSource.cmtData.find((d) => d.x === mostRecentDate) || beSource.cmtData.find((d) => d.x === mostRecentDate) || (leSource.cmtData.length ? leSource.cmtData[leSource.cmtData.length - 1] : null);

		return {
			date: mostRecentDate,
			latestREVA,
			latestLEVA,
			latestREIOP,
			latestLEIOP,
			latestRECMT,
			latestLECMT,
		};
	}, [reSource, leSource, beSource]);

	const hasAnyData =
		reSource.visualAcuityData.length > 0 ||
		reSource.iopData.length > 0 ||
		reSource.cmtData.length > 0 ||
		leSource.visualAcuityData.length > 0 ||
		leSource.iopData.length > 0 ||
		leSource.cmtData.length > 0;

	if (!hasAnyData) {
		return null;
	}

	return (
		<div className="w-full h-full flex flex-col space-y-2">
			{/* Top toolbar */}
			<div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900/60 rounded-xl border border-border shadow-xs shrink-0">
				<div className="flex items-center gap-3.5 flex-wrap">
					<div className="flex items-center gap-2.5">
						<div className="w-7 h-7 rounded-lg bg-[#1176bc]/10 text-[#1176bc] flex items-center justify-center">
							<Activity className="w-4 h-4" />
						</div>
						<h2 className="text-[13px] font-semibold text-foreground tracking-tight">
							Visual Acuity, IOP &amp; CMT Monitoring
						</h2>
					</div>

					{/* Latest Snapshot Badges */}
					{latestSnapshot && (
						<div className="flex items-center gap-2.5 flex-wrap">
							<span className="text-[13px] text-muted-foreground font-medium">
								Latest ({format(parseISO(latestSnapshot.date), "dd MMM yyyy")}):
							</span>

							{(latestSnapshot.latestREVA || latestSnapshot.latestLEVA) && (
								<span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-muted/40 text-foreground border border-border/70 shadow-2xs">
									<Eye className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
									<span className="text-[13px] font-semibold text-muted-foreground uppercase">VA:</span>
									<span className="text-[13px] font-bold text-sky-700 dark:text-sky-400">RE</span>
									<strong className="font-semibold text-foreground">{latestSnapshot.latestREVA?.y || "—"}</strong>
									<span className="text-muted-foreground/40">|</span>
									<span className="text-[13px] font-bold text-purple-700 dark:text-purple-400">LE</span>
									<strong className="font-semibold text-foreground">{latestSnapshot.latestLEVA?.y || "—"}</strong>
								</span>
							)}

							{(latestSnapshot.latestREIOP || latestSnapshot.latestLEIOP) && (
								<span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-muted/40 text-foreground border border-border/70 shadow-2xs">
									<Droplets className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
									<span className="text-[13px] font-semibold text-muted-foreground uppercase">IOP:</span>
									<span className="text-[13px] font-bold text-sky-700 dark:text-sky-400">RE</span>
									<strong className="font-semibold text-foreground">{latestSnapshot.latestREIOP ? `${latestSnapshot.latestREIOP.y}` : "—"}</strong>
									<span className="text-muted-foreground/40">|</span>
									<span className="text-[13px] font-bold text-purple-700 dark:text-purple-400">LE</span>
									<strong className="font-semibold text-foreground">{latestSnapshot.latestLEIOP ? `${latestSnapshot.latestLEIOP.y}` : "—"}</strong>
									<span className="text-[13px] text-muted-foreground">mmHg</span>
								</span>
							)}

							{(latestSnapshot.latestRECMT || latestSnapshot.latestLECMT) && (
								<span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-muted/40 text-foreground border border-border/70 shadow-2xs">
									<ScanLine className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
									<span className="text-[13px] font-semibold text-muted-foreground uppercase">CMT:</span>
									<span className="text-[13px] font-bold text-sky-700 dark:text-sky-400">RE</span>
									<strong className="font-semibold text-foreground">{latestSnapshot.latestRECMT ? `${latestSnapshot.latestRECMT.y}` : "—"}</strong>
									<span className="text-muted-foreground/40">|</span>
									<span className="text-[13px] font-bold text-purple-700 dark:text-purple-400">LE</span>
									<strong className="font-semibold text-foreground">{latestSnapshot.latestLECMT ? `${latestSnapshot.latestLECMT.y}` : "—"}</strong>
									<span className="text-[13px] text-muted-foreground">µm</span>
								</span>
							)}
						</div>
					)}
				</div>

				{/* View toggle */}
				<div className="flex items-center p-1 bg-muted/50 dark:bg-muted/30 rounded-lg border border-border shrink-0 gap-1">
					<button
						onClick={() => setViewMode("matrix")}
						className={`flex items-center gap-1.5 px-3.5 py-1.5 h-8 rounded-md text-xs font-semibold transition-all duration-150 ${
							viewMode === "matrix"
								? "bg-[#1176bc] text-white shadow-xs font-bold"
								: "text-muted-foreground hover:text-foreground hover:bg-background/60"
						}`}
						title="Tabular status grid"
					>
						<Grid3X3 className={`w-3.5 h-3.5 ${viewMode === "matrix" ? "text-white" : "text-[#1176bc]"}`} />
						<span>Status Grid</span>
					</button>
					<button
						onClick={() => setViewMode("trend")}
						className={`flex items-center gap-1.5 px-3.5 py-1.5 h-8 rounded-md text-xs font-semibold transition-all duration-150 ${
							viewMode === "trend"
								? "bg-[#1176bc] text-white shadow-xs font-bold"
								: "text-muted-foreground hover:text-foreground hover:bg-background/60"
						}`}
						title="Trend curves"
					>
						<LineChartIcon className={`w-3.5 h-3.5 ${viewMode === "trend" ? "text-white" : "text-[#1176bc]"}`} />
						<span>Trend Curves</span>
					</button>
				</div>
			</div>

			<div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
				{viewMode === "matrix" ? (
					<div className="h-full w-full animate-in fade-in-50 duration-300 flex flex-col">
						<ClinicalStatusMatrix
							reData={reSource}
							leData={leSource}
							beData={beSource}
							showVA={showVA}
							showIOP={showIOP}
							showCMT={showCMT}
							showProcedures={showProcedures}
						/>
					</div>
				) : (
					<div className="h-full w-full animate-in fade-in-50 duration-300 flex flex-col space-y-2">
						{/* Trend Curves Interactive Toolbar: Eye filter & Metric track toggles */}
						<div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-muted/40 dark:bg-muted/20 rounded-lg border border-border dark:border-border text-xs shadow-2xs">
							{/* Eye Focus Selector */}
							<div className="flex items-center gap-1.5 flex-wrap">
								<span className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mr-0.5">
									Laterality:
								</span>
								<div className="inline-flex rounded-md p-0.5 bg-slate-200/60 dark:bg-slate-800/80 border border-slate-300/60 dark:border-slate-700/60 shadow-2xs">
									<button
										type="button"
										onClick={() => setSelectedEye("BE")}
										className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-all ${
											selectedEye === "BE"
												? "bg-primary text-primary-foreground shadow-xs font-bold"
												: "text-muted-foreground hover:text-foreground"
										}`}
									>
										Both Eyes (BE)
									</button>
									<button
										type="button"
										onClick={() => setSelectedEye("RE")}
										className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
											selectedEye === "RE"
												? "bg-sky-50 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 shadow-xs font-bold ring-1 ring-sky-300 dark:ring-sky-700"
												: "text-muted-foreground hover:text-sky-600"
										}`}
									>
										<span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
										Right Eye (RE)
									</button>
									<button
										type="button"
										onClick={() => setSelectedEye("LE")}
										className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
											selectedEye === "LE"
												? "bg-purple-50 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 shadow-xs font-bold ring-1 ring-purple-300 dark:ring-purple-700"
												: "text-muted-foreground hover:text-purple-600"
										}`}
									>
										<span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
										Left Eye (LE)
									</button>
								</div>
							</div>

							{/* Metric Track Toggles */}
							<div className="flex items-center gap-1.5 flex-wrap">
								<span className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mr-0.5">
									Tracks:
								</span>
								<button
									type="button"
									onClick={() => setShowVA(!showVA)}
									className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border transition-all ${
										showVA
											? "bg-emerald-50 text-emerald-800 border-emerald-300/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
											: "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground line-through opacity-60"
									}`}
								>
									<Eye className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
									<span>BCVA</span>
								</button>

								<button
									type="button"
									onClick={() => setShowIOP(!showIOP)}
									className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border transition-all ${
										showIOP
											? "bg-amber-50 text-amber-800 border-amber-300/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
											: "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground line-through opacity-60"
									}`}
								>
									<Droplets className="w-3 h-3 text-amber-600 dark:text-amber-400" />
									<span>IOP</span>
								</button>

								<button
									type="button"
									onClick={() => setShowCMT(!showCMT)}
									className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border transition-all ${
										showCMT
											? "bg-[#1176bc]/10 text-[#1176bc] border-[#1176bc]/30 dark:bg-[#1176bc]/20 dark:text-[#2990d8] dark:border-[#1176bc]/50"
											: "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground line-through opacity-60"
									}`}
								>
									<ScanLine className="w-3 h-3 text-[#1176bc] dark:text-[#2990d8]" />
									<span>CMT</span>
								</button>

								<button
									type="button"
									onClick={() => setShowProcedures(!showProcedures)}
									className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border transition-all ${
										showProcedures
											? "bg-primary/10 text-primary border-primary/30"
											: "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground line-through opacity-60"
									}`}
								>
									<Syringe className="w-3 h-3 text-primary" />
									<span>Interventions</span>
								</button>
							</div>
						</div>

						{/* Line Chart Container */}
						<div className="flex-1 overflow-y-auto box-scroll pr-1 bg-card border border-border/80 rounded-lg p-2.5 sm:p-3 shadow-xs">
							<LineChart
								reData={reSource}
								leData={leSource}
								beData={beSource}
								metrics={metrics}
								showVA={showVA}
								showIOP={showIOP}
								showCMT={showCMT}
								showProcedures={showProcedures}
								selectedEye={selectedEye}
								hideCardWrapper={true}
							/>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
