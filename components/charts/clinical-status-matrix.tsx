/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useMemo } from "react";
import { ChartData, ProcedureData } from "@/types/patient";
import { format, parseISO, subYears, isAfter } from "date-fns";
import {
	Eye,
	Droplets,
	ScanLine,
	Syringe,
	Cookie,
	Flashlight,
	Scissors,
	Layers,
	SlidersHorizontal,
	ArrowUpDown,
	LayoutGrid,
	Milestone,
} from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface ClinicalStatusMatrixProps {
	reData?: ChartData;
	leData?: ChartData;
	beData?: ChartData;
	data?: ChartData;
	showVA?: boolean;
	showIOP?: boolean;
	showCMT?: boolean;
	showProcedures?: boolean;
}

type StatusSeverity = "normal" | "moderate" | "critical" | "unknown";
type FilterPreset = "recent5" | "recent10" | "1year" | "procedures" | "alerts" | "all";
type ViewLayout = "matrix" | "milestones";

interface StatusInfo {
	severity: StatusSeverity;
	label: string;
	interpretation: string;
}

interface MetricDelta {
	label: string;
	diffText: string;
	trend: "up" | "down" | "stable";
	isPositive: boolean;
	priorDate?: string;
	priorVal?: string | number;
}

// Visual Acuity Evaluation (LogMAR / Snellen)
function evaluateVA(yNumeric: number | null | undefined): StatusInfo {
	if (yNumeric == null) {
		return {
			severity: "unknown",
			label: "No Record",
			interpretation: "No visual acuity recorded on this visit date.",
		};
	}

	if (yNumeric >= 1.20) {
		return {
			severity: "normal",
			label: "Normal / Good",
			interpretation: "Visual acuity is within optimal functional reference range.",
		};
	} else if (yNumeric >= 0.50) {
		return {
			severity: "moderate",
			label: "Moderate Impairment",
			interpretation: "Moderate visual impairment documented. Monitor therapeutic response.",
		};
	} else {
		return {
			severity: "critical",
			label: "Severe Impairment",
			interpretation: "Severe visual impairment noted. Requires focused clinical review.",
		};
	}
}

// IOP Evaluation
function evaluateIOP(iop: number | null | undefined): StatusInfo {
	if (iop == null) {
		return {
			severity: "unknown",
			label: "No Record",
			interpretation: "No IOP measured on this visit date.",
		};
	}

	if (iop >= 10 && iop <= 21) {
		return {
			severity: "normal",
			label: "Normotensive",
			interpretation: "Intraocular pressure is within standard physiological range.",
		};
	} else if ((iop >= 22 && iop <= 25) || (iop >= 6 && iop < 10)) {
		const isHigh = iop >= 22;
		return {
			severity: "moderate",
			label: isHigh ? "Borderline High" : "Borderline Low",
			interpretation: isHigh
				? "Mildly elevated pressure. Monitor for ocular hypertension."
				: "Mildly low intraocular pressure. Monitor for hypotony signs.",
		};
	} else {
		const isVeryHigh = iop > 25;
		return {
			severity: "critical",
			label: isVeryHigh ? "Ocular Hypertension" : "Hypotony",
			interpretation: isVeryHigh
				? "Significantly elevated pressure. Heightened risk of glaucomatous damage."
				: "Significant hypotony. Risk of choroidal folds or maculopathy.",
		};
	}
}

// CMT Evaluation (Normal 200-280 um)
function evaluateCMT(cmt: number | null | undefined): StatusInfo {
	if (cmt == null) {
		return {
			severity: "unknown",
			label: "No Record",
			interpretation: "No central macular thickness measured on this visit date.",
		};
	}

	if (cmt >= 200 && cmt <= 280) {
		return {
			severity: "normal",
			label: "Normal Contour",
			interpretation: "Foveal thickness within normal anatomical limits without edema.",
		};
	} else if (cmt > 280 && cmt <= 350) {
		return {
			severity: "moderate",
			label: "Mild Thickening",
			interpretation: "Mild macular thickening / early intraretinal fluid accumulation.",
		};
	} else if (cmt < 200 && cmt >= 150) {
		return {
			severity: "moderate",
			label: "Mild Thinning",
			interpretation: "Mild foveal thinning or early outer retinal atrophy.",
		};
	} else {
		const isSevereEdema = cmt > 350;
		return {
			severity: "critical",
			label: isSevereEdema ? "Marked Edema" : "Severe Atrophy",
			interpretation: isSevereEdema
				? "Marked macular edema (DME/RVO/AMD). Therapeutic intervention indicated."
				: "Advanced foveal thinning / geographic atrophy.",
		};
	}
}

// Single Eye Track Subcomponent inside Bilateral Cell
function MetricEyeTrack({
	eye,
	value,
	unit,
	status,
	delta,
	date,
	metricName,
}: {
	eye: "RE" | "LE";
	value: string | number | null | undefined;
	unit?: string;
	status: StatusInfo;
	delta: MetricDelta | null;
	date: string;
	metricName: string;
}) {
	const hasValue = value != null && value !== "" && value !== "—";
	const isRE = eye === "RE";
	const isAbnormal = status.severity === "moderate" || status.severity === "critical";
	const deltaColor = !delta
		? "text-[#8aa0bb]"
		: delta.trend === "up"
		? "text-[#00a978]"
		: delta.trend === "down"
		? "text-[#f06d22]"
		: "text-[#8aa0bb]";

	if (!hasValue) {
		return (
			<div className="flex items-center justify-between px-2 py-1 text-xs opacity-45">
				<span className={`text-xs font-bold tracking-tight ${isRE ? "text-[#0089df]" : "text-[#6828ee]"}`}>
					{eye}
				</span>
				<span className="font-mono text-xs text-muted-foreground/60">—</span>
			</div>
		);
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div className="flex items-center justify-between gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-[#f7fbff] cursor-pointer">
					{/* Eye Laterality Tag & Formatted Value */}
					<div className="flex items-center gap-1.5 min-w-0">
						<span className={`text-xs font-bold tracking-tight shrink-0 ${isRE ? "text-[#0089df]" : "text-[#6828ee]"}`}>
							{eye}
						</span>
						<span
							className={`font-bold text-xs truncate ${isAbnormal ? "text-[#f06d22]" : "text-[#0a315c] dark:text-slate-100"}`}
						>
							{value}
								{unit && <span className="text-xs font-semibold text-[#537397] ml-1">{unit}</span>}
						</span>
					</div>

					{/* Delta Indicator & Subtle Severity Dot (Only for Borderline / Critical) */}
					<div className="flex items-center gap-1 shrink-0">
						{delta && (
							<span className={`text-xs font-semibold tracking-tight ${deltaColor}`} title={delta.diffText}>
								{delta.label}
							</span>
						)}
					</div>
				</div>
			</TooltipTrigger>
			<TooltipContent side="top" className="text-xs p-2 shadow-md border border-border/80 bg-popover text-popover-foreground">
				<div className="flex flex-col gap-1 min-w-[130px]">
					<div className="flex items-center justify-between gap-3 text-xs">
						<span className="text-muted-foreground">Recorded Value:</span>
						<strong className="font-bold text-foreground font-mono">{value} {unit || ""}</strong>
					</div>
					<div className="flex items-center justify-between gap-3 text-xs">
						<span className="text-muted-foreground">Status:</span>
						<span className="font-medium text-foreground">{status.label}</span>
					</div>
				</div>
			</TooltipContent>
		</Tooltip>
	);
}

export function ClinicalStatusMatrix({
	reData: rawREData,
	leData: rawLEData,
	beData: rawBEData,
	data: fallbackData,
	showVA = true,
	showIOP = true,
	showCMT = true,
	showProcedures = true,
}: ClinicalStatusMatrixProps) {
	// Standardize sources
	const reSource = rawREData || fallbackData || { procedures: [], visualAcuityData: [], iopData: [], cmtData: [] };
	const leSource = rawLEData || fallbackData || { procedures: [], visualAcuityData: [], iopData: [], cmtData: [] };
	const beSource = rawBEData || { procedures: [], visualAcuityData: [], iopData: [], cmtData: [] };

	// Filter and windowing state
	const [filterPreset, setFilterPreset] = useState<FilterPreset>("recent5");
	const [sortOrder, setSortOrder] = useState<"newestFirst" | "oldestFirst">("oldestFirst");
	const [layout, setLayout] = useState<ViewLayout>("matrix");

	// Build sorted unique dates across all metrics and procedures (chronological oldest to newest)
	const allDatesChronological = useMemo(() => {
		const allDates = Array.from(
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

		return allDates;
	}, [reSource, leSource, beSource]);

	// Build comprehensive data point array for all dates with RE and LE separation
	const allDatePoints = useMemo(() => {
		return allDatesChronological.map((date, idx) => {
			// RE readings (fallback to BE if missing)
			const reVA = reSource.visualAcuityData.find((d) => d.x === date) || beSource.visualAcuityData.find((d) => d.x === date);
			const reIOP = reSource.iopData.find((d) => d.x === date) || beSource.iopData.find((d) => d.x === date);
			const reCMT = reSource.cmtData.find((d) => d.x === date) || beSource.cmtData.find((d) => d.x === date);

			// LE readings (fallback to BE if missing)
			const leVA = leSource.visualAcuityData.find((d) => d.x === date) || beSource.visualAcuityData.find((d) => d.x === date);
			const leIOP = leSource.iopData.find((d) => d.x === date) || beSource.iopData.find((d) => d.x === date);
			const leCMT = leSource.cmtData.find((d) => d.x === date) || beSource.cmtData.find((d) => d.x === date);

			// Procedures tagged by eye
			const reProcs = reSource.procedures.filter((p) => p.date === date).map((p) => ({ ...p, eyeTag: "RE" }));
			const leProcs = leSource.procedures.filter((p) => p.date === date).map((p) => ({ ...p, eyeTag: "LE" }));
			const beProcs = beSource.procedures.filter((p) => p.date === date).map((p) => ({ ...p, eyeTag: "BE" }));
			const allProcedures = [...reProcs, ...leProcs, ...beProcs];

			// Find previous available values for delta calculation
			let prevREVA: typeof reVA;
			let prevLEVA: typeof leVA;
			let prevREIOP: typeof reIOP;
			let prevLEIOP: typeof leIOP;
			let prevRECMT: typeof reCMT;
			let prevLECMT: typeof leCMT;

			for (let i = idx - 1; i >= 0; i--) {
				const prevDate = allDatesChronological[i];
				if (!prevREVA) prevREVA = reSource.visualAcuityData.find((d) => d.x === prevDate) || beSource.visualAcuityData.find((d) => d.x === prevDate);
				if (!prevLEVA) prevLEVA = leSource.visualAcuityData.find((d) => d.x === prevDate) || beSource.visualAcuityData.find((d) => d.x === prevDate);
				if (!prevREIOP) prevREIOP = reSource.iopData.find((d) => d.x === prevDate) || beSource.iopData.find((d) => d.x === prevDate);
				if (!prevLEIOP) prevLEIOP = leSource.iopData.find((d) => d.x === prevDate) || beSource.iopData.find((d) => d.x === prevDate);
				if (!prevRECMT) prevRECMT = reSource.cmtData.find((d) => d.x === prevDate) || beSource.cmtData.find((d) => d.x === prevDate);
				if (!prevLECMT) prevLECMT = leSource.cmtData.find((d) => d.x === prevDate) || beSource.cmtData.find((d) => d.x === prevDate);
			}

			// Deltas for RE Visual Acuity
			let reVADelta: MetricDelta | null = null;
			if (reVA?.yNumeric != null && prevREVA?.yNumeric != null) {
				const diff = reVA.yNumeric - prevREVA.yNumeric;
				if (Math.abs(diff) < 0.05) {
					reVADelta = { label: "Stable", diffText: "Stable (no Snellen line change)", trend: "stable", isPositive: true, priorDate: prevREVA.x, priorVal: prevREVA.y };
				} else if (diff > 0) {
					reVADelta = { label: "↑ Imp", diffText: "Improved Snellen acuity", trend: "up", isPositive: true, priorDate: prevREVA.x, priorVal: prevREVA.y };
				} else {
					reVADelta = { label: "↓ Dec", diffText: "Reduced Snellen acuity", trend: "down", isPositive: false, priorDate: prevREVA.x, priorVal: prevREVA.y };
				}
			}

			// Deltas for LE Visual Acuity
			let leVADelta: MetricDelta | null = null;
			if (leVA?.yNumeric != null && prevLEVA?.yNumeric != null) {
				const diff = leVA.yNumeric - prevLEVA.yNumeric;
				if (Math.abs(diff) < 0.05) {
					leVADelta = { label: "Stable", diffText: "Stable (no Snellen line change)", trend: "stable", isPositive: true, priorDate: prevLEVA.x, priorVal: prevLEVA.y };
				} else if (diff > 0) {
					leVADelta = { label: "↑ Imp", diffText: "Improved Snellen acuity", trend: "up", isPositive: true, priorDate: prevLEVA.x, priorVal: prevLEVA.y };
				} else {
					leVADelta = { label: "↓ Dec", diffText: "Reduced Snellen acuity", trend: "down", isPositive: false, priorDate: prevLEVA.x, priorVal: prevLEVA.y };
				}
			}

			// Deltas for RE IOP
			let reIOPDelta: MetricDelta | null = null;
			if (reIOP?.y != null && prevREIOP?.y != null) {
				const diff = Math.round((reIOP.y - prevREIOP.y) * 10) / 10;
				if (diff === 0) {
					reIOPDelta = { label: "0", diffText: "Stable (0 mmHg change)", trend: "stable", isPositive: true, priorDate: prevREIOP.x, priorVal: `${prevREIOP.y} mmHg` };
				} else if (diff > 0) {
					reIOPDelta = { label: `+${diff}`, diffText: `+${diff} mmHg (Increased pressure)`, trend: "up", isPositive: false, priorDate: prevREIOP.x, priorVal: `${prevREIOP.y} mmHg` };
				} else {
					reIOPDelta = { label: `${diff}`, diffText: `${diff} mmHg (Decreased pressure)`, trend: "down", isPositive: true, priorDate: prevREIOP.x, priorVal: `${prevREIOP.y} mmHg` };
				}
			}

			// Deltas for LE IOP
			let leIOPDelta: MetricDelta | null = null;
			if (leIOP?.y != null && prevLEIOP?.y != null) {
				const diff = Math.round((leIOP.y - prevLEIOP.y) * 10) / 10;
				if (diff === 0) {
					leIOPDelta = { label: "0", diffText: "Stable (0 mmHg change)", trend: "stable", isPositive: true, priorDate: prevLEIOP.x, priorVal: `${prevLEIOP.y} mmHg` };
				} else if (diff > 0) {
					leIOPDelta = { label: `+${diff}`, diffText: `+${diff} mmHg (Increased pressure)`, trend: "up", isPositive: false, priorDate: prevLEIOP.x, priorVal: `${prevLEIOP.y} mmHg` };
				} else {
					leIOPDelta = { label: `${diff}`, diffText: `${diff} mmHg (Decreased pressure)`, trend: "down", isPositive: true, priorDate: prevLEIOP.x, priorVal: `${prevLEIOP.y} mmHg` };
				}
			}

			// Deltas for RE CMT
			let reCMTDelta: MetricDelta | null = null;
			if (reCMT?.y != null && prevRECMT?.y != null) {
				const diff = Math.round(reCMT.y - prevRECMT.y);
				if (Math.abs(diff) < 8) {
					reCMTDelta = { label: "Stable", diffText: "Stable (< 8 µm thickness change)", trend: "stable", isPositive: true, priorDate: prevRECMT.x, priorVal: `${prevRECMT.y} µm` };
				} else if (diff > 0) {
					reCMTDelta = { label: `+${diff}µm`, diffText: `+${diff} µm (Increased macular edema)`, trend: "up", isPositive: false, priorDate: prevRECMT.x, priorVal: `${prevRECMT.y} µm` };
				} else {
					reCMTDelta = { label: `${diff}µm`, diffText: `${diff} µm (Resolving macular edema)`, trend: "down", isPositive: true, priorDate: prevRECMT.x, priorVal: `${prevRECMT.y} µm` };
				}
			}

			// Deltas for LE CMT
			let leCMTDelta: MetricDelta | null = null;
			if (leCMT?.y != null && prevLECMT?.y != null) {
				const diff = Math.round(leCMT.y - prevLECMT.y);
				if (Math.abs(diff) < 8) {
					leCMTDelta = { label: "Stable", diffText: "Stable (< 8 µm thickness change)", trend: "stable", isPositive: true, priorDate: prevLECMT.x, priorVal: `${prevLECMT.y} µm` };
				} else if (diff > 0) {
					leCMTDelta = { label: `+${diff}µm`, diffText: `+${diff} µm (Increased macular edema)`, trend: "up", isPositive: false, priorDate: prevLECMT.x, priorVal: `${prevLECMT.y} µm` };
				} else {
					leCMTDelta = { label: `${diff}µm`, diffText: `${diff} µm (Resolving macular edema)`, trend: "down", isPositive: true, priorDate: prevLECMT.x, priorVal: `${prevLECMT.y} µm` };
				}
			}

			const reVAStatus = evaluateVA(reVA?.yNumeric);
			const leVAStatus = evaluateVA(leVA?.yNumeric);
			const reIOPStatus = evaluateIOP(reIOP?.y);
			const leIOPStatus = evaluateIOP(leIOP?.y);
			const reCMTStatus = evaluateCMT(reCMT?.y);
			const leCMTStatus = evaluateCMT(leCMT?.y);

			const severities = [
				reVAStatus.severity, leVAStatus.severity,
				reIOPStatus.severity, leIOPStatus.severity,
				reCMTStatus.severity, leCMTStatus.severity,
			];
			const worstSeverity: StatusSeverity = severities.includes("critical")
				? "critical"
				: severities.includes("moderate")
				? "moderate"
				: severities.includes("normal")
				? "normal"
				: "unknown";

			const hasAlert = worstSeverity === "critical" || worstSeverity === "moderate";

			return {
				date,
				isLatest: idx === allDatesChronological.length - 1,
				isBaseline: idx === 0,
				reVA,
				leVA,
				reIOP,
				leIOP,
				reCMT,
				leCMT,
				procedures: allProcedures,
				reVADelta,
				leVADelta,
				reIOPDelta,
				leIOPDelta,
				reCMTDelta,
				leCMTDelta,
				reVAStatus,
				leVAStatus,
				reIOPStatus,
				leIOPStatus,
				reCMTStatus,
				leCMTStatus,
				worstSeverity,
				hasAlert,
			};
		});
	}, [allDatesChronological, reSource, leSource, beSource]);

	// Filtered visits based on preset
	const filteredDatePoints = useMemo(() => {
		if (allDatePoints.length === 0) return [];

		let result = [...allDatePoints];
		const latestDate = parseISO(allDatePoints[allDatePoints.length - 1].date);

		switch (filterPreset) {
			case "recent5":
				result = allDatePoints.slice(-5);
				break;
			case "recent10":
				result = allDatePoints.slice(-10);
				break;
			case "1year": {
				const oneYearAgo = subYears(latestDate, 1);
				result = allDatePoints.filter((d) => isAfter(parseISO(d.date), oneYearAgo));
				if (result.length === 0) result = allDatePoints.slice(-5);
				break;
			}
			case "procedures": {
				result = allDatePoints.filter((d) => d.procedures.length > 0);
				if (result.length === 0) result = allDatePoints;
				break;
			}
			case "alerts": {
				result = allDatePoints.filter((d) => d.hasAlert);
				if (result.length === 0) result = allDatePoints;
				break;
			}
			case "all":
			default:
				result = allDatePoints;
				break;
		}

		if (sortOrder === "newestFirst") {
			result = [...result].reverse();
		}

		return result;
	}, [allDatePoints, filterPreset, sortOrder]);

	// Key Milestones computation (Baseline, Peak IOP, Peak CMT, Latest)
	const milestones = useMemo(() => {
		if (allDatePoints.length === 0) return null;

		const baseline = allDatePoints[0];
		const latest = allDatePoints[allDatePoints.length - 1];

		// Peak IOP
		const iopPoints = allDatePoints.filter((d) => d.reIOP?.y != null || d.leIOP?.y != null);
		const peakIOP = iopPoints.length
			? [...iopPoints].sort((a, b) => {
					const maxA = Math.max(a.reIOP?.y || 0, a.leIOP?.y || 0);
					const maxB = Math.max(b.reIOP?.y || 0, b.leIOP?.y || 0);
					return maxB - maxA;
			  })[0]
			: null;

		// Peak CMT
		const cmtPoints = allDatePoints.filter((d) => d.reCMT?.y != null || d.leCMT?.y != null);
		const peakCMT = cmtPoints.length
			? [...cmtPoints].sort((a, b) => {
					const maxA = Math.max(a.reCMT?.y || 0, a.leCMT?.y || 0);
					const maxB = Math.max(b.reCMT?.y || 0, b.leCMT?.y || 0);
					return maxB - maxA;
			  })[0]
			: null;

		return {
			baseline,
			latest,
			peakIOP,
			peakCMT,
			totalVisits: allDatePoints.length,
		};
	}, [allDatePoints]);

	const pastYearCount = useMemo(() => {
		if (allDatePoints.length === 0) return 0;
		const latestDate = parseISO(allDatePoints[allDatePoints.length - 1].date);
		const oneYearAgo = subYears(latestDate, 1);
		const count = allDatePoints.filter((d) => isAfter(parseISO(d.date), oneYearAgo)).length;
		return count > 0 ? count : Math.min(5, allDatePoints.length);
	}, [allDatePoints]);

	if (allDatesChronological.length === 0) {
		return (
			<div className="py-12 text-center text-muted-foreground text-sm">
				No longitudinal vital metrics recorded.
			</div>
		);
	}

	const getProcedureIcon = (type: ProcedureData["type"]) => {
		switch (type) {
			case "injection":
				return Syringe;
			case "laser":
				return Cookie;
			case "surgery":
				return Scissors;
			default:
				return Flashlight;
		}
	};

	const proceduresCount = allDatePoints.filter((d) => d.procedures.length > 0).length;
	const alertsCount = allDatePoints.filter((d) => d.hasAlert).length;

	return (
		<TooltipProvider delayDuration={120}>
			<div className="w-full h-full flex flex-col overflow-hidden rounded-[18px] border border-[#d9e4ee] bg-white shadow-[0_8px_24px_rgba(58,83,109,0.04)] dark:border-slate-700 dark:bg-slate-900">
				{/* Top Status Grid Control Bar */}
				<div className="flex min-h-[56px] items-center justify-between gap-5 border-b border-[#dce6f0] bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-900 shrink-0">
					{/* Left: Window Presets Segmented Bar */}
					<div className="flex min-w-0 items-center gap-3 overflow-x-auto pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
						<span className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#8195b1]">
							<SlidersHorizontal className="w-3.5 h-3.5 text-[#8298b5]" />
							<span>Window</span>
						</span>

						<div className="inline-flex shrink-0 items-center gap-1">
							<button
								data-no-hover
								onClick={() => setFilterPreset("recent5")}
								className={`h-[30px] rounded-lg border px-3 text-[11px] font-semibold transition-colors flex items-center justify-center ${
									filterPreset === "recent5"
										? "border-[#71caff] bg-[#dff3ff] text-[#0078bd]"
										: "border-[#d8e4ef] bg-white text-[#51708f] hover:border-[#a8cdec] hover:bg-[#f4f9fd]"
								}`}
							>
								Recent (5)
							</button>

							<button
								data-no-hover
								onClick={() => setFilterPreset("recent10")}
								className={`h-[30px] rounded-lg border px-3 text-[11px] font-semibold transition-colors flex items-center justify-center ${
									filterPreset === "recent10"
										? "border-[#71caff] bg-[#dff3ff] text-[#0078bd]"
										: "border-[#d8e4ef] bg-white text-[#51708f] hover:border-[#a8cdec] hover:bg-[#f4f9fd]"
								}`}
							>
								Recent (10)
							</button>

							<button
								data-no-hover
								onClick={() => setFilterPreset("1year")}
								className={`h-[30px] rounded-lg border px-3 text-[11px] font-semibold transition-colors flex items-center justify-center ${
									filterPreset === "1year"
										? "border-[#71caff] bg-[#dff3ff] text-[#0078bd]"
										: "border-[#d8e4ef] bg-white text-[#51708f] hover:border-[#a8cdec] hover:bg-[#f4f9fd]"
								}`}
							>
								Past 1 Year ({pastYearCount})
							</button>

							<button
								data-no-hover
								onClick={() => setFilterPreset("procedures")}
								className={`h-[30px] rounded-lg border px-3 text-[11px] font-semibold transition-colors flex items-center justify-center ${
									filterPreset === "procedures"
										? "border-[#71caff] bg-[#dff3ff] text-[#0078bd]"
										: "border-[#d8e4ef] bg-white text-[#51708f] hover:border-[#a8cdec] hover:bg-[#f4f9fd]"
								}`}
							>
								Procedures ({proceduresCount})
							</button>

							<button
								data-no-hover
								onClick={() => setFilterPreset("alerts")}
								className={`h-[30px] rounded-lg border px-3 text-[11px] font-semibold transition-colors flex items-center justify-center ${
									filterPreset === "alerts"
										? "border-[#71caff] bg-[#dff3ff] text-[#0078bd]"
										: "border-[#d8e4ef] bg-white text-[#51708f] hover:border-[#a8cdec] hover:bg-[#f4f9fd]"
								}`}
							>
								Alerts ({alertsCount})
							</button>

							<button
								data-no-hover
								onClick={() => setFilterPreset("all")}
								className={`h-[30px] rounded-lg border px-3 text-[11px] font-semibold transition-colors flex items-center justify-center ${
									filterPreset === "all"
										? "border-[#71caff] bg-[#dff3ff] text-[#0078bd]"
										: "border-[#d8e4ef] bg-white text-[#51708f] hover:border-[#a8cdec] hover:bg-[#f4f9fd]"
								}`}
							>
								All ({allDatePoints.length})
							</button>
						</div>
					</div>

					{/* Right: Legend & Sort & View Layout */}
					<div className="flex shrink-0 items-center gap-2.5">
						{/* Sort Direction Toggle */}
						<button
							data-no-hover
							onClick={() =>
								setSortOrder(sortOrder === "oldestFirst" ? "newestFirst" : "oldestFirst")
							}
							className="flex h-[30px] items-center gap-1.5 rounded-lg border border-[#d8e4ef] bg-white px-3 text-[11px] font-semibold text-[#51708f] transition-colors hover:border-[#a8cdec] hover:bg-[#f4f9fd]"
							title="Toggle chronological direction"
						>
							<ArrowUpDown className="w-3.5 h-3.5 text-[#6683a2]" />
							<span>{sortOrder === "oldestFirst" ? "Oldest → Newest" : "Newest → Oldest"}</span>
						</button>

						{/* View Layout Toggle (Grid vs Milestones) */}
						<div className="inline-flex rounded-lg border border-[#d8e4ef] bg-[#f7f9fc] p-0.5 gap-1 dark:border-slate-700 dark:bg-slate-800">
							<button
								data-no-hover
								onClick={() => setLayout("matrix")}
								className={`flex h-[30px] items-center gap-1.5 rounded-md px-3 text-[11px] font-semibold transition-colors ${
									layout === "matrix"
										? "border border-[#e1e9f2] bg-white text-[#0078bd] shadow-[0_1px_2px_rgba(28,54,81,0.08)]"
										: "border border-transparent text-[#6c84a2] hover:bg-white/80"
								}`}
								title="Status Grid View"
							>
								<LayoutGrid className={`w-3.5 h-3.5 ${layout === "matrix" ? "text-[#0078bd]" : "text-[#6c84a2]"}`} />
								<span className="hidden sm:inline">Grid</span>
							</button>

							<button
								data-no-hover
								onClick={() => setLayout("milestones")}
								className={`flex h-[30px] items-center gap-1.5 rounded-md px-3 text-[11px] font-semibold transition-colors ${
									layout === "milestones"
										? "border border-[#e1e9f2] bg-white text-[#0078bd] shadow-[0_1px_2px_rgba(28,54,81,0.08)]"
										: "border border-transparent text-[#6c84a2] hover:bg-white/80"
								}`}
								title="Milestones Summary View"
							>
								<Milestone className={`w-3.5 h-3.5 ${layout === "milestones" ? "text-[#0078bd]" : "text-[#6c84a2]"}`} />
								<span className="hidden sm:inline">Milestones</span>
							</button>
						</div>
					</div>
				</div>

				{/* MILESTONES SUMMARY VIEW */}
				{layout === "milestones" && milestones && (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in-50 duration-300">
						{/* Initial Visit */}
						<div className="p-3.5 rounded-xl border border-border/80 bg-card shadow-2xs space-y-2.5">
							<div className="flex items-center justify-between border-b border-border/60 pb-2">
								<Badge variant="outline" className="text-xs font-semibold text-muted-foreground uppercase px-2.5 py-0.5">
									Initial Visit
								</Badge>
								<span className="text-xs text-muted-foreground font-mono">
									{format(parseISO(milestones.baseline.date), "dd MMM yyyy")}
								</span>
							</div>
							<div className="space-y-2 text-xs">
								<div className="flex items-center justify-between">
									<span className="font-bold text-xs text-sky-700 dark:text-sky-400">RE:</span>
									<span className="text-xs font-mono text-muted-foreground">
										VA: <strong className="text-foreground">{milestones.baseline.reVA?.y || "—"}</strong> | IOP: <strong className="text-foreground">{milestones.baseline.reIOP ? `${milestones.baseline.reIOP.y}` : "—"}</strong> | CMT: <strong className="text-foreground">{milestones.baseline.reCMT ? `${milestones.baseline.reCMT.y}` : "—"}</strong>
									</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="font-bold text-xs text-purple-700 dark:text-purple-400">LE:</span>
									<span className="text-xs font-mono text-muted-foreground">
										VA: <strong className="text-foreground">{milestones.baseline.leVA?.y || "—"}</strong> | IOP: <strong className="text-foreground">{milestones.baseline.leIOP ? `${milestones.baseline.leIOP.y}` : "—"}</strong> | CMT: <strong className="text-foreground">{milestones.baseline.leCMT ? `${milestones.baseline.leCMT.y}` : "—"}</strong>
									</span>
								</div>
							</div>
						</div>

						{/* Peak IOP */}
						<div className="p-3.5 rounded-xl border border-border/80 bg-card shadow-2xs space-y-2.5">
							<div className="flex items-center justify-between border-b border-border/60 pb-2">
								<Badge variant="outline" className="text-xs font-semibold text-muted-foreground uppercase px-2.5 py-0.5">
									Peak IOP Record
								</Badge>
								<span className="text-xs text-muted-foreground font-mono">
									{milestones.peakIOP ? format(parseISO(milestones.peakIOP.date), "dd MMM yyyy") : "—"}
								</span>
							</div>
							<div className="space-y-2 text-xs">
								<div className="flex items-center justify-between">
									<span className="font-bold text-xs text-sky-700 dark:text-sky-400">RE:</span>
									<span className="text-xs font-mono font-semibold text-foreground">
										{milestones.peakIOP?.reIOP ? `${milestones.peakIOP.reIOP.y} mmHg` : "—"}
									</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="font-bold text-xs text-purple-700 dark:text-purple-400">LE:</span>
									<span className="text-xs font-mono font-semibold text-foreground">
										{milestones.peakIOP?.leIOP ? `${milestones.peakIOP.leIOP.y} mmHg` : "—"}
									</span>
								</div>
							</div>
						</div>

						{/* Peak CMT */}
						<div className="p-3.5 rounded-xl border border-border/80 bg-card shadow-2xs space-y-2.5">
							<div className="flex items-center justify-between border-b border-border/60 pb-2">
								<Badge variant="outline" className="text-xs font-semibold text-muted-foreground uppercase px-2.5 py-0.5">
									Peak CMT Record
								</Badge>
								<span className="text-xs text-muted-foreground font-mono">
									{milestones.peakCMT ? format(parseISO(milestones.peakCMT.date), "dd MMM yyyy") : "—"}
								</span>
							</div>
							<div className="space-y-2 text-xs">
								<div className="flex items-center justify-between">
									<span className="font-bold text-xs text-sky-700 dark:text-sky-400">RE:</span>
									<span className="text-xs font-mono font-semibold text-foreground">
										{milestones.peakCMT?.reCMT ? `${milestones.peakCMT.reCMT.y} µm` : "—"}
									</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="font-bold text-xs text-purple-700 dark:text-purple-400">LE:</span>
									<span className="text-xs font-mono font-semibold text-foreground">
										{milestones.peakCMT?.leCMT ? `${milestones.peakCMT.leCMT.y} µm` : "—"}
									</span>
								</div>
							</div>
						</div>

						{/* Latest Visit */}
						<div className="p-3.5 rounded-xl border border-border/80 bg-card shadow-2xs space-y-2.5">
							<div className="flex items-center justify-between border-b border-border/60 pb-2">
								<Badge variant="outline" className="text-xs font-bold text-foreground uppercase px-2.5 py-0.5">
									Latest Visit
								</Badge>
								<span className="text-xs font-medium text-foreground font-mono">
									{format(parseISO(milestones.latest.date), "dd MMM yyyy")}
								</span>
							</div>
							<div className="space-y-2 text-xs">
								<div className="flex items-center justify-between">
									<span className="font-bold text-xs text-sky-700 dark:text-sky-400">RE:</span>
									<span className="text-xs font-mono text-muted-foreground">
										VA: <strong className="text-foreground">{milestones.latest.reVA?.y || "—"}</strong> | IOP: <strong className="text-foreground">{milestones.latest.reIOP ? `${milestones.latest.reIOP.y}` : "—"}</strong> | CMT: <strong className="text-foreground">{milestones.latest.reCMT ? `${milestones.latest.reCMT.y}` : "—"}</strong>
									</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="font-bold text-xs text-purple-700 dark:text-purple-400">LE:</span>
									<span className="text-xs font-mono text-muted-foreground">
										VA: <strong className="text-foreground">{milestones.latest.leVA?.y || "—"}</strong> | IOP: <strong className="text-foreground">{milestones.latest.leIOP ? `${milestones.latest.leIOP.y}` : "—"}</strong> | CMT: <strong className="text-foreground">{milestones.latest.leCMT ? `${milestones.latest.leCMT.y}` : "—"}</strong>
									</span>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* BILATERAL STATUS MATRIX TABLE */}
				{layout === "matrix" && (
					<div className="w-full flex-1 min-h-0 overflow-auto bg-white box-scroll">
						<table className="w-full border-collapse text-left min-w-[700px]">
							<thead>
								<tr className="sticky top-0 z-30 border-b border-[#dbe5ef] bg-[#f7f9fc]">
									{/* Sticky Parameter Column Header */}
									<th className="sticky left-0 z-30 w-[220px] min-w-[220px] px-4 py-3 text-xs font-semibold bg-[#f7f9fc] dark:bg-slate-800 border-b border-r border-[#dbe5ef]">
										<div className="flex items-center gap-2.5">
											<div className="w-8 h-8 rounded-lg bg-[#eaf7ff] text-[#0089df] flex items-center justify-center shrink-0">
												<Layers className="w-4 h-4 stroke-[2]" />
											</div>
											<div className="flex flex-col min-w-0">
												<span className="text-[13px] font-bold text-[#0b2d55] tracking-tight">Parameters</span>
												<span className="text-[11px] font-medium text-[#6380a4]">Bilateral eye metrics</span>
											</div>
										</div>
									</th>

									{/* Visit Column Headers */}
									{filteredDatePoints.map((col) => {
										const originalIndex = allDatesChronological.indexOf(col.date);

										return (
											<th
												key={col.date}
												className="min-w-[145px] border-r border-[#dbe5ef] px-3 py-3 text-center last:border-r-0"
											>
												<div className="flex flex-col items-center justify-center gap-0.5">
													<span className="text-xs font-bold text-[#0b2d55]">
														{format(parseISO(col.date), "dd MMM yyyy")}
													</span>
													<div className="flex items-center gap-1.5 text-xs">
														<span className="font-medium text-[#8298b6]">#{originalIndex + 1}</span>
														<span className={`inline-block h-1.5 w-1.5 rounded-full ${col.hasAlert ? "bg-[#f5a623]" : "bg-[#c7d5e5]"}`} title={col.hasAlert ? "Borderline or notable findings on this date" : "Recorded visit"} />
													</div>
												</div>
											</th>
										);
									})}
								</tr>
							</thead>

							<tbody>
								{/* 1. PROCEDURES ROW */}
								{showProcedures && (
									<tr className="border-b border-[#dbe5ef] hover:bg-[#fbfdff] transition-colors">
										<td className="sticky left-0 z-20 bg-white px-4 py-3.5 dark:bg-slate-900 border-b border-r border-[#dbe5ef]">
											<div className="flex items-center gap-3">
												<div className="w-8 h-8 rounded-lg bg-[#eaf7ff] text-[#0089df] flex items-center justify-center shrink-0">
													<Syringe className="w-4 h-4 stroke-[2.2]" />
												</div>
												<div className="flex flex-col min-w-0">
													<span className="text-[13px] font-bold text-[#0b2d55] leading-tight">
														Procedures
													</span>
													<span className="text-[11px] font-medium text-[#6380a4] mt-0.5">
														Injections & Surgery
													</span>
												</div>
											</div>
										</td>
										{filteredDatePoints.map((col) => {
											const procs = col.procedures;
											return (
												<td
													key={`proc-${col.date}`}
													className="border-r border-[#dbe5ef] px-2.5 py-2.5 text-center align-middle last:border-r-0"
												>
													{procs.length > 0 ? (
														<div className="flex flex-col gap-1.5 items-center justify-center max-w-[155px] mx-auto">
															{procs.map((proc, pIdx) => {
																const IconComponent = getProcedureIcon(proc.type);
																const isRE = proc.eyeTag === "RE";
																const isLE = proc.eyeTag === "LE";

																return (
																	<Tooltip key={pIdx}>
																		<TooltipTrigger asChild>
																	<div className="w-full inline-flex items-center gap-1.5 rounded-md bg-[#f6f8fb] px-2.5 py-1.5 text-xs font-medium text-[#0b2d55] transition-colors hover:bg-[#eef3f8] cursor-pointer dark:bg-slate-800">
																		<span className={`text-xs font-bold ${isRE ? "text-[#0089df]" : isLE ? "text-[#6828ee]" : "text-[#738aa6]"}`}>
																					{proc.eyeTag}:
																				</span>
																		<IconComponent className="w-3.5 h-3.5 text-[#6f89a7] shrink-0" />
																		<span className="truncate text-xs text-[#0b2d55] font-semibold">
																					{proc.name}
																				</span>
																			</div>
																		</TooltipTrigger>
																		<TooltipContent side="top" className="text-xs p-2 shadow-md border border-border/80 bg-popover text-popover-foreground">
																			<div className="flex flex-col gap-1 min-w-[130px]">
																				<div className="flex items-center justify-between gap-3 text-xs">
																					<span className="text-muted-foreground">Recorded Value:</span>
																					<strong className="font-bold text-foreground">{proc.name}</strong>
																				</div>
																				<div className="flex items-center justify-between gap-3 text-xs">
																					<span className="text-muted-foreground">Status:</span>
																					<span className="font-medium text-foreground">{proc.type.toUpperCase()}</span>
																				</div>
																			</div>
																		</TooltipContent>
																	</Tooltip>
																);
															})}
														</div>
													) : (
														<span className="text-xs text-muted-foreground/40 font-mono">—</span>
													)}
												</td>
											);
										})}
									</tr>
								)}

								{/* 2. VISUAL ACUITY (BCVA) ROW */}
								{showVA && (
									<tr className="border-b border-[#dbe5ef] hover:bg-[#fbfdff] transition-colors">
										<td className="sticky left-0 z-20 bg-white px-4 py-3.5 dark:bg-slate-900 border-b border-r border-[#dbe5ef]">
											<div className="flex items-center gap-3">
												<div className="w-8 h-8 rounded-lg bg-[#eaf7ff] text-[#0089df] flex items-center justify-center shrink-0">
													<Eye className="w-4 h-4 stroke-[2.2]" />
												</div>
												<div className="flex flex-col min-w-0">
													<span className="text-[13px] font-bold text-[#0b2d55] leading-tight">
														Visual Acuity (BCVA)
													</span>
													<span className="text-[11px] font-medium text-[#6380a4] mt-0.5">
														Distance & Near Vision
													</span>
												</div>
											</div>
										</td>
										{filteredDatePoints.map((col) => {
											const hasAnyVA = col.reVA || col.leVA;
											return (
												<td
													key={`va-${col.date}`}
													className="border-r border-[#dbe5ef] px-2.5 py-2.5 text-center align-middle last:border-r-0"
												>
													{hasAnyVA ? (
														<div className="mx-auto flex w-full max-w-[155px] flex-col gap-1 rounded-lg border border-[#b7d0e7] bg-white p-1.5 shadow-[0_1px_2px_rgba(36,83,121,0.05)]">
															{/* RE Track */}
															<MetricEyeTrack
																eye="RE"
																value={col.reVA?.y}
																status={col.reVAStatus}
																delta={col.reVADelta}
																date={col.date}
																metricName="Visual Acuity"
															/>

															{/* Hairline Separator */}
															<div className="h-px w-full bg-[#deebf5]" />

															{/* LE Track */}
															<MetricEyeTrack
																eye="LE"
																value={col.leVA?.y}
																status={col.leVAStatus}
																delta={col.leVADelta}
																date={col.date}
																metricName="Visual Acuity"
															/>
														</div>
													) : (
														<span className="text-xs text-muted-foreground/40 font-mono">—</span>
													)}
												</td>
											);
										})}
									</tr>
								)}

								{/* 3. INTRAOCULAR PRESSURE (IOP) ROW */}
								{showIOP && (
									<tr className="border-b border-[#dbe5ef] hover:bg-[#fbfdff] transition-colors">
										<td className="sticky left-0 z-20 bg-white px-4 py-3.5 dark:bg-slate-900 border-b border-r border-[#dbe5ef]">
											<div className="flex items-center gap-3">
												<div className="w-8 h-8 rounded-lg bg-[#eaf7ff] text-[#0089df] flex items-center justify-center shrink-0">
													<Droplets className="w-4 h-4 stroke-[2.2]" />
												</div>
												<div className="flex flex-col min-w-0">
													<span className="text-[13px] font-bold text-[#0b2d55] leading-tight">
														Intraocular Pressure (IOP)
													</span>
													<span className="text-[11px] font-medium text-[#6380a4] mt-0.5">
														Tonometry (mmHg)
													</span>
												</div>
											</div>
										</td>
										{filteredDatePoints.map((col) => {
											const hasAnyIOP = col.reIOP || col.leIOP;
											return (
												<td
													key={`iop-${col.date}`}
													className="border-r border-[#dbe5ef] px-2.5 py-2.5 text-center align-middle last:border-r-0"
												>
													{hasAnyIOP ? (
														<div className="mx-auto flex w-full max-w-[155px] flex-col gap-1 rounded-lg border border-[#b7d0e7] bg-white p-1.5 shadow-[0_1px_2px_rgba(36,83,121,0.05)]">
															{/* RE Track */}
															<MetricEyeTrack
																eye="RE"
																value={col.reIOP?.y}
																unit="mmHg"
																status={col.reIOPStatus}
																delta={col.reIOPDelta}
																date={col.date}
																metricName="Intraocular Pressure"
															/>

															{/* Hairline Separator */}
															<div className="h-px w-full bg-[#deebf5]" />

															{/* LE Track */}
															<MetricEyeTrack
																eye="LE"
																value={col.leIOP?.y}
																unit="mmHg"
																status={col.leIOPStatus}
																delta={col.leIOPDelta}
																date={col.date}
																metricName="Intraocular Pressure"
															/>
														</div>
													) : (
														<span className="text-xs text-muted-foreground/40 font-mono">—</span>
													)}
												</td>
											);
										})}
									</tr>
								)}

								{/* 4. CENTRAL MACULAR THICKNESS (CMT) ROW */}
								{showCMT && (
									<tr className="border-b border-[#dbe5ef] hover:bg-[#fbfdff] transition-colors">
										<td className="sticky left-0 z-20 bg-white px-4 py-3.5 dark:bg-slate-900 border-b border-r border-[#dbe5ef]">
											<div className="flex items-center gap-3">
												<div className="w-8 h-8 rounded-lg bg-[#eaf7ff] text-[#0089df] flex items-center justify-center shrink-0">
													<ScanLine className="w-4 h-4 stroke-[2.2]" />
												</div>
												<div className="flex flex-col min-w-0">
													<span className="text-[13px] font-bold text-[#0b2d55] leading-tight">
														Central Macula (CMT)
													</span>
													<span className="text-[11px] font-medium text-[#6380a4] mt-0.5">
														OCT Thickness (µm)
													</span>
												</div>
											</div>
										</td>
										{filteredDatePoints.map((col) => {
											const hasAnyCMT = col.reCMT || col.leCMT;
											return (
												<td
													key={`cmt-${col.date}`}
													className="border-r border-[#dbe5ef] px-2.5 py-2.5 text-center align-middle last:border-r-0"
												>
													{hasAnyCMT ? (
														<div className="mx-auto flex w-full max-w-[155px] flex-col gap-1 rounded-lg border border-[#b7d0e7] bg-white p-1.5 shadow-[0_1px_2px_rgba(36,83,121,0.05)]">
															{/* RE Track */}
															<MetricEyeTrack
																eye="RE"
																value={col.reCMT?.y}
																unit="µm"
																status={col.reCMTStatus}
																delta={col.reCMTDelta}
																date={col.date}
																metricName="Central Macular Thickness"
															/>

															{/* Hairline Separator */}
															<div className="h-px w-full bg-[#deebf5]" />

															{/* LE Track */}
															<MetricEyeTrack
																eye="LE"
																value={col.leCMT?.y}
																unit="µm"
																status={col.leCMTStatus}
																delta={col.leCMTDelta}
																date={col.date}
																metricName="Central Macular Thickness"
															/>
														</div>
													) : (
														<span className="text-xs text-muted-foreground/40 font-mono">—</span>
													)}
												</td>
											);
										})}
									</tr>
								)}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</TooltipProvider>
	);
}
