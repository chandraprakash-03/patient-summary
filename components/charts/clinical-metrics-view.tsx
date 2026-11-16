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
			{/* Latest clinical status — reference header and snapshot cards */}
			<div className="shrink-0 rounded-[18px] border border-[#dbe5ef] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(58,83,109,0.05)] dark:bg-slate-900/60 dark:border-slate-700">
				<div className="flex flex-col gap-3.5">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-2 text-[#5d7595]">
							<Activity className="h-[18px] w-[18px] text-[#0089df] stroke-[2.1]" />
							<h2 className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#5d7595]">
								Latest Clinical Status
							</h2>
							{latestSnapshot && (
								<span className="text-[12px] font-medium tracking-normal text-[#8499b6]">
									{format(parseISO(latestSnapshot.date), "dd MMM yyyy")}
								</span>
							)}
						</div>

						<div className="inline-flex shrink-0 rounded-xl border border-[#dbe5ef] bg-[#f7f9fc] p-0.5 dark:border-slate-700 dark:bg-slate-800">
							<button
								data-no-hover
								onClick={() => setViewMode("matrix")}
								className={`flex h-8 items-center gap-2 rounded-[9px] px-3 text-xs font-semibold transition-colors ${viewMode === "matrix" ? "border border-[#e1e9f2] bg-white text-[#0077bc] shadow-[0_1px_2px_rgba(28,54,81,0.08)] dark:bg-slate-700" : "border border-transparent text-[#607795] hover:bg-white/70 dark:hover:bg-slate-700"}`}
								title="Tabular status grid"
							>
								<Grid3X3 className="h-3.5 w-3.5" />
								<span>Status Grid</span>
							</button>
							<button
								data-no-hover
								onClick={() => setViewMode("trend")}
								className={`flex h-8 items-center gap-2 rounded-[9px] px-3 text-xs font-semibold transition-colors ${viewMode === "trend" ? "border border-[#e1e9f2] bg-white text-[#0077bc] shadow-[0_1px_2px_rgba(28,54,81,0.08)] dark:bg-slate-700" : "border border-transparent text-[#607795] hover:bg-white/70 dark:hover:bg-slate-700"}`}
								title="Trend curves"
							>
								<LineChartIcon className="h-3.5 w-3.5" />
								<span>Trend Curves</span>
							</button>
						</div>
					</div>

					{latestSnapshot && (
						<div className="flex flex-wrap items-center gap-3">
							{(latestSnapshot.latestREVA || latestSnapshot.latestLEVA) && (
								<div className="min-w-[230px] rounded-xl border border-[#dbe5ef] bg-[#f8fafd] px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
									<p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#91a4c0]">Visual Acuity</p>
									<div className="flex items-center gap-4 text-[13px] font-bold">
										<span><span className="mr-1 text-[#0089df]">RE</span>{latestSnapshot.latestREVA?.y || "—"}</span>
										<span><span className="mr-1 text-[#6a27f5]">LE</span>{latestSnapshot.latestLEVA?.y || "—"}</span>
									</div>
								</div>
							)}

							{(latestSnapshot.latestREIOP || latestSnapshot.latestLEIOP) && (
								<div className="min-w-[230px] rounded-xl border border-[#dbe5ef] bg-[#f8fafd] px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
									<p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#91a4c0]">Intraocular Pressure</p>
									<div className="flex items-center gap-4 text-[13px] font-bold">
										<span><span className="mr-1 text-[#0089df]">RE</span>{latestSnapshot.latestREIOP ? `${latestSnapshot.latestREIOP.y} mmHg` : "—"}</span>
										<span><span className="mr-1 text-[#6a27f5]">LE</span>{latestSnapshot.latestLEIOP ? `${latestSnapshot.latestLEIOP.y} mmHg` : "—"}</span>
									</div>
								</div>
							)}
						</div>
					)}
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
