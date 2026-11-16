/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { PatientData, GanttData } from "@/types/patient";
import { format, parseISO } from "date-fns";
import {
	Activity,
	Pill,
	Eye,
	Layers,
	ScanLine,
	Circle,
	AlertTriangle,
	CheckCircle2,
	Calendar,
	Columns,
	Table as TableIcon,
	ListFilter,
	History,
	Sparkles,
	Clock,
	CheckCircle,
	Search,
	X,
	Filter,
	RotateCcw,
	LayoutList,
	ChevronDown,
	ChevronUp,
	ChevronRight,
	ArrowRight,
	ArrowLeft,
	ArrowLeftRight,
	LayoutGrid,
	SlidersHorizontal,
	Zap,
	GitCommit,
	ChevronsLeft,
	ChevronsRight,
	ShieldCheck,
	FileText,
	Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ObservationCard } from "./observation-card";
import { GanttChart } from "@/components/charts/gantt-chart";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { extractObservationValue, calculateOnsetDate, formatDurationBreakdown } from "@/lib/utils/data-processing";

export type ObservationMode =
	| "bilateralExam"
	| "longitudinalMatrix"
	| "pathologyMatrix"
	| "legacyGantt";

interface ObservationsViewProps {
	patientData: PatientData;
	computedData: {
		diagnosisData: GanttData[];
		medicationsData: GanttData[];
		lensData: GanttData[];
		backgroundRetinaData: GanttData[];
		maculaFovealReflexData: GanttData[];
		conjunctivaData: GanttData[];
		mediaData: GanttData[];
		anteriorChamberData: GanttData[];
		irisData: GanttData[];
		discData: GanttData[];
		pupilData: GanttData[];
		vesselsData: GanttData[];
		undilatedFundusData: GanttData[];
	};
}

// Helper to determine clinical severity of an observation text
function evaluateFindingSeverity(text?: string): {
	severity: "normal" | "watch" | "pathology" | "unknown";
	badgeClass: string;
	textClass: string;
	dotClass: string;
	label: string;
} {
	const trimmed = (text || "").trim();
	if (!trimmed || trimmed === "-" || trimmed === "—" || trimmed === "–" || trimmed === "0" || trimmed === "N/A" || trimmed === "na") {
		return {
			severity: "unknown",
			badgeClass: "bg-muted/30 text-muted-foreground border-border/40",
			textClass: "text-muted-foreground/60 italic",
			dotClass: "bg-muted-foreground/30",
			label: "Not Recorded",
		};
	}

	const lower = trimmed.toLowerCase();

	// Normal keywords
	if (
		lower.includes("normal") ||
		lower.includes("clear") ||
		lower.includes("quiet") ||
		lower.includes("deep & quiet") ||
		lower.includes("wnl") ||
		lower.includes("round") ||
		lower.includes("regular") ||
		lower.includes("intact") ||
		lower.includes("healthy") ||
		lower.includes("flat")
	) {
		return {
			severity: "normal",
			badgeClass: "bg-muted/40 text-foreground border-border/60",
			textClass: "text-foreground font-normal",
			dotClass: "bg-muted-foreground/40",
			label: "Normal / Quiet",
		};
	}

	// Post-op / Monitored keywords
	if (
		lower.includes("pseudophaki") ||
		lower.includes("pciol") ||
		lower.includes("aciol") ||
		lower.includes("scar") ||
		lower.includes("post-op") ||
		lower.includes("operated") ||
		lower.includes("haze") ||
		lower.includes("drusen")
	) {
		return {
			severity: "watch",
			badgeClass: "bg-amber-500/[0.08] text-amber-800 dark:text-amber-300 border-amber-500/25",
			textClass: "text-foreground font-medium",
			dotClass: "bg-amber-500",
			label: "Monitored / Post-Op",
		};
	}

	// High priority / Clinical finding keywords
	return {
		severity: "pathology",
		badgeClass: "bg-primary/[0.08] text-primary border-primary/30 font-semibold",
		textClass: "text-primary dark:text-[#2990d8] font-semibold",
		dotClass: "bg-primary",
		label: "Clinical Finding / Alteration",
	};
}

// Helper to check whether two clinical findings represent a meaningful change
export function isMeaningfulChange(v1?: string, v2?: string): boolean {
	const normalize = (v?: string) => {
		const s = (v || "").trim().toLowerCase();
		if (!s || s === "—" || s === "-" || s === "0" || s === "n/a" || s === "na") return "empty";
		if (s === "normal" || s === "wnl" || s === "quiet") return "normal";
		return s;
	};
	const n1 = normalize(v1);
	const n2 = normalize(v2);
	if (n1 === "empty" && n2 === "empty") return false;
	if (n1 === "normal" && n2 === "normal") return false;
	return n1 !== n2;
}

// Helper for mild, professional laterality badge and accent colors in clinical records
export function getLateralityStyles(eye: "RE" | "LE" | "BE" | string) {
	const normalized = (eye || "").toUpperCase().trim();
	if (normalized === "RE" || normalized === "0") {
		return {
			badge: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800 font-semibold",
			card: "bg-sky-50/50 dark:bg-sky-950/20 border-sky-200/80 dark:border-sky-800/50",
			headerText: "text-sky-900 dark:text-sky-200",
			dot: "bg-sky-500",
			bullet: "fill-sky-500 text-sky-500",
			label: "Right Eye (RE)",
		};
	}
	if (normalized === "LE" || normalized === "1") {
		return {
			badge: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 font-semibold",
			card: "bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/80 dark:border-purple-800/50",
			headerText: "text-purple-900 dark:text-purple-200",
			dot: "bg-purple-500",
			bullet: "fill-purple-500 text-purple-500",
			label: "Left Eye (LE)",
		};
	}
	// BE, Both Eyes, or general
	return {
		badge: "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 font-semibold",
		card: "bg-teal-50/50 dark:bg-teal-950/20 border-teal-200/80 dark:border-teal-800/50",
		headerText: "text-teal-900 dark:text-teal-200",
		dot: "bg-teal-500",
		bullet: "fill-teal-500 text-teal-500",
		label: "Bilateral (BE)",
	};
}

export function ObservationsView({
	patientData,
	computedData,
}: ObservationsViewProps) {
	const [activeMode, setActiveMode] = useState<ObservationMode>("longitudinalMatrix");
	const [showBaselineComparison, setShowBaselineComparison] = useState<boolean>(false);
	const [visitDetailsTab, setVisitDetailsTab] = useState<"diagnosis" | "systemic" | "medications" | "procedures" | "other">("diagnosis");

	// Sorted visits from oldest to latest
	const visits = useMemo(() => {
		return [...(patientData.visits || [])].sort((a, b) =>
			a.d.localeCompare(b.d)
		);
	}, [patientData]);
	const baselineVisit = visits[0];

	// State for Longitudinal Structure Progression (Timeline Inspector)
	const [progressionEye, setProgressionEye] = useState<"BE" | "RE" | "LE">("BE");
	const [timelineScope, setTimelineScope] = useState<"milestones" | "all">("all");
	const [inspectorVisitIndex, setInspectorVisitIndex] = useState<number>(() => {
		return visits.length > 0 ? visits.length - 1 : 0;
	});
	const inspectedVisit = visits[inspectorVisitIndex] || visits[visits.length - 1];
	const currentVisit = inspectedVisit;
	const selectedVisitIndex = inspectorVisitIndex;
	const isLatestSelected = inspectorVisitIndex === visits.length - 1;
	const isBaselineSelected = inspectorVisitIndex === 0;

	// State for Anterior & Posterior Comparison Filter (Within ±3 visits or Baseline)
	const [isCompareMode, setIsCompareMode] = useState<boolean>(false);
	const [compareVisitIndex, setCompareVisitIndex] = useState<number | null>(null);

	const isComparing = isCompareMode && compareVisitIndex !== null && compareVisitIndex !== inspectorVisitIndex;
	const earlierVisitIndex = isComparing ? Math.min(inspectorVisitIndex, compareVisitIndex!) : inspectorVisitIndex;
	const laterVisitIndex = isComparing ? Math.max(inspectorVisitIndex, compareVisitIndex!) : inspectorVisitIndex;
	const earlierVisit = visits[earlierVisitIndex];
	const laterVisit = visits[laterVisitIndex];

	// Check if any filter or non-default state is active (for Reset button)
	const isResetAvailable = !isLatestSelected || isCompareMode || compareVisitIndex !== null || timelineScope !== "all";

	// Reset inspector visit when visits change
	useEffect(() => {
		if (visits.length > 0) {
			setInspectorVisitIndex(visits.length - 1);
			setCompareVisitIndex(null);
			setIsCompareMode(false);
		}
	}, [visits]);

	// Auto-scroll selected visit into view inside the 5-item filmstrip viewport
	const scrubberContainerRef = useRef<HTMLDivElement | null>(null);
	const selectedScrubberRef = useRef<HTMLButtonElement | null>(null);

	useEffect(() => {
		if (selectedScrubberRef.current && scrubberContainerRef.current) {
			const container = scrubberContainerRef.current;
			const button = selectedScrubberRef.current;
			const scrollLeft = button.offsetLeft - container.offsetWidth / 2 + button.offsetWidth / 2;
			container.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
		}
	}, [inspectorVisitIndex]);



	// Extract helper to parse visit field safely, checking raw_fields first
	const getVisitValue = (
		parent: string,
		field: string,
		eyeIdx: number,
		visitObj = currentVisit,
		sectionKey?: string
	): string => {
		if (!visitObj) return "—";

		// 1. Primary: Extract from raw_fields or normality flags if sectionKey provided
		if (sectionKey) {
			const extracted = extractObservationValue(visitObj, sectionKey, eyeIdx);
			if (extracted && extracted !== "-" && extracted !== "0") {
				return extracted;
			}
		}

		// 2. Structured fallback: parent[field]
		const parentData = (visitObj as any)[parent];
		if (!parentData) return "—";
		const val = parentData[field];
		if (!val) return "—";
		if (Array.isArray(val)) {
			return val[eyeIdx] || val[0] || "—";
		}
		if (typeof val === "string") {
			const parts = val.split(";");
			if (parts.length > 1) {
				return parts[eyeIdx]?.trim() || parts[0]?.trim() || "—";
			}
			return val.trim();
		}
		return String(val);
	};

	// Format date nicely
	const formatVisitDate = (dateStr: string) => {
		try {
			return format(parseISO(dateStr), "dd-MMM-yyyy");
		} catch {
			return dateStr;
		}
	};



	// Anatomical Rows Definition for clinical exam
	const anatomicalLayers = useMemo(() => [
		{
			category: "Anterior Segment",
			icon: Eye,
			items: [
				{ id: "conjunctiva", label: "Conjunctiva / Cornea", parent: "at", field: "cj", sectionKey: "conjunctiva" },
				{ id: "anterior_chamber", label: "Anterior Chamber (AC)", parent: "at", field: "ac", sectionKey: "anterior_chamber" },
				{ id: "iris", label: "Iris", parent: "at", field: "ir", sectionKey: "iris" },
				{ id: "pupil", label: "Pupil & Reactivity", parent: "at", field: "pu", sectionKey: "pupil" },
				{ id: "lens", label: "Crystalline Lens / IOL", parent: "at", field: "lens", sectionKey: "lens" },
			],
		},
		{
			category: "Posterior Segment & Fundus",
			icon: ScanLine,
			items: [
				{ id: "disc", label: "Optic Disc (C/D Ratio)", parent: "fu", field: "di", sectionKey: "disc" },
				{ id: "macula", label: "Macula / Foveal Reflex", parent: "fu", field: "mf", sectionKey: "foveal_reflex" },
				{ id: "retina", label: "Background Retina", parent: "fu", field: "br", sectionKey: "background_retina" },
				{ id: "media", label: "Media / Vitreous", parent: "fu", field: "me", sectionKey: "media" },
				{ id: "vessels", label: "Retinal Vessels", parent: "fu", field: "ve", sectionKey: "vessels" },
				{ id: "undilated", label: "Fundus Remarks", parent: "fu", field: "rem", sectionKey: "undilated_fundus" },
			],
		},
	], []);



	// Visit Details: Diagnoses for inspected visit
	const inspectedDiagnoses = useMemo(() => {
		if (!inspectedVisit) return { re: [], le: [], be: [], totalCount: 0 };
		const diag = (inspectedVisit as any).diag;
		if (!diag) return { re: [], le: [], be: [], totalCount: 0 };

		const extractList = (val: any) => {
			if (!val) return [];
			if (Array.isArray(val)) return val.filter(Boolean);
			if (typeof val === "string") {
				return val.split(";").map((s) => s.trim()).filter((s) => s && s !== "-");
			}
			return [String(val)];
		};

		const re = extractList(diag.re || diag[0]);
		const le = extractList(diag.le || diag[1]);
		const be = extractList(diag.be || diag.all || diag.general);

		return {
			re,
			le,
			be,
			totalCount: re.length + le.length + be.length,
		};
	}, [inspectedVisit]);

	// Visit Details: Systemic History for inspected visit
	const inspectedSystemic = useMemo(() => {
		if (!inspectedVisit) return { active: [], ruledOut: [] };
		const s = inspectedVisit.s || {};
		const rf = inspectedVisit.raw_fields || {};

		const rawHistory = rf.historydesc_241 || s.h || "";
		const rawDuration = rf.duration_243 || s.d || "";
		const rawResult = rf.resultvalue_242 || s.p || "";
		const rawNeg = s.neg_h || "";

		const activeList: Array<{ name: string; recordedDuration: string; currentDuration: string }> = [];
		const ruledOutList: string[] = [];

		const ignoreList = [
			"remarks", "remark", "identification marks", "identification mark",
			"id marks", "id mark", "others"
		];

		if (rawHistory) {
			const diseases = rawHistory.split(";").map((d: string) => d.trim()).filter(Boolean);
			const durations = rawDuration ? rawDuration.split(";").map((d: string) => d.trim()) : [];
			const results = rawResult ? rawResult.split(";").map((r: string) => r.trim()) : [];

			diseases.forEach((disease: string, idx: number) => {
				if (ignoreList.includes(disease.toLowerCase())) return;

				if (results.length > idx && (results[idx] === "0" || results[idx]?.toUpperCase() === "NO")) {
					ruledOutList.push(disease);
					return;
				}

				const recDur = durations[idx] || "";
				let visitDateObj = new Date();
				try {
					if (inspectedVisit.d) visitDateObj = parseISO(inspectedVisit.d);
				} catch {
					visitDateObj = new Date();
				}

				const onset = calculateOnsetDate(visitDateObj, recDur);
				const curDur = formatDurationBreakdown(onset, new Date());

				activeList.push({
					name: disease,
					recordedDuration: recDur,
					currentDuration: curDur,
				});
			});
		}

		if (rawNeg) {
			rawNeg.split(";").map((d: string) => d.trim()).filter(Boolean).forEach((d: string) => {
				if (!ruledOutList.includes(d) && !ignoreList.includes(d.toLowerCase())) {
					ruledOutList.push(d);
				}
			});
		}

		return { active: activeList, ruledOut: ruledOutList };
	}, [inspectedVisit]);

	// Visit Details: Medications for inspected visit
	const inspectedMedications = useMemo(() => {
		if (!inspectedVisit || !inspectedVisit.m) return [];
		return inspectedVisit.m.map((med: any) => {
			if (typeof med === "string") {
				const eyeMatch = med.match(/\\[(RE|LE|BE)\\]/i);
				const eye = eyeMatch ? eyeMatch[1].toUpperCase() : "BE";
				const cleanName = med.replace(/\\[(RE|LE|BE)\\]/i, "").trim();
				return {
					name: cleanName,
					eye: eye as "RE" | "LE" | "BE",
					frequency: "",
					dosage: "",
				};
			}
			const name = med.n || med.name || "Medication";
			const eye: "RE" | "LE" | "BE" = med.e === 0 ? "RE" : med.e === 1 ? "LE" : "BE";
			const freq = med.f || med.freq || "";
			const dose = med.d || med.dose || "";
			return {
				name,
				eye,
				frequency: freq,
				dosage: dose,
			};
		});
	}, [inspectedVisit]);

	// Visit Details: Procedures for inspected visit
	const inspectedProcedures = useMemo(() => {
		if (!inspectedVisit) return [];
		const procs: Array<{ type: string; name: string; eye: string; details?: string }> = [];

		const pr = inspectedVisit.pr as any;
		if (pr) {
			if (Array.isArray(pr.Las)) {
				[0, 1].forEach((eyeIdx) => {
					const eye = eyeIdx === 0 ? "RE" : "LE";
					const list = pr.Las[eyeIdx];
					if (Array.isArray(list)) {
						list.forEach((p: any) => {
							if (p && p.procedure_type) {
								procs.push({
									type: "Laser",
									name: p.laser_type ? `${p.procedure_type} - ${p.laser_type}` : p.procedure_type,
									eye,
									details: p.power ? `Power: ${p.power}` : undefined,
								});
							}
						});
					}
				});
			}
			if (Array.isArray(pr.inj)) {
				[0, 1].forEach((eyeIdx) => {
					const eye = eyeIdx === 0 ? "RE" : "LE";
					const list = pr.inj[eyeIdx];
					if (Array.isArray(list)) {
						list.forEach((p: any) => {
							const name = p.Injection_name || p.procedure_type || "Intravitreal Injection";
							if (p && name) {
								procs.push({
									type: "Injection",
									name,
									eye,
									details: p.batch_no ? `Batch: ${p.batch_no}` : undefined,
								});
							}
						});
					}
				});
			}
			if (Array.isArray(pr.surg)) {
				[0, 1].forEach((eyeIdx) => {
					const eye = eyeIdx === 0 ? "RE" : "LE";
					const list = pr.surg[eyeIdx];
					if (Array.isArray(list)) {
						list.forEach((p: any) => {
							const name = p.surgery_name || p.procedure_type || "Surgery";
							if (p && name) {
								procs.push({
									type: "Surgery",
									name,
									eye,
									details: p.anesthesia ? `Anesthesia: ${p.anesthesia}` : undefined,
								});
							}
						});
					}
				});
			}
			if (Array.isArray(pr.min)) {
				pr.min.forEach((p: any) => {
					if (p?.procedure_type) {
						procs.push({ type: "Minor Procedure", name: p.procedure_type, eye: "BE" });
					}
				});
			}
			if (Array.isArray(pr.oth)) {
				pr.oth.forEach((p: any) => {
					if (p?.procedure_type) {
						procs.push({ type: "Other Procedure", name: p.procedure_type, eye: "BE" });
					}
				});
			}
		}

		if (Array.isArray(inspectedVisit.treatments)) {
			inspectedVisit.treatments.forEach((t: any) => {
				const name = t.treatment || t.name || t.procedure;
				if (name) {
					const eye = t.eye === 0 ? "RE" : t.eye === 1 ? "LE" : "BE";
					procs.push({
						type: "Treatment",
						name,
						eye,
						details: t.duration ? `Duration: ${t.duration}` : undefined,
					});
				}
			});
		}

		return procs;
	}, [inspectedVisit]);

	// Visit Details: Other clinical data for inspected visit
	const inspectedOtherData = useMemo(() => {
		if (!inspectedVisit) return { hasData: false };
		const hasConsultation = Boolean(inspectedVisit.c || inspectedVisit.t);
		const hasFollowUp = Boolean(inspectedVisit.fup?.date || inspectedVisit.fup?.adv || inspectedVisit.fup?.loc || inspectedVisit.fup?.placename);
		const hasOpinion = Boolean(inspectedVisit.op?.ref || inspectedVisit.op?.cl || inspectedVisit.op?.dept || inspectedVisit.op?.oc || inspectedVisit.op?.comm_desc || inspectedVisit.op?.rem);
		const hasAdvice = Boolean(inspectedVisit.adv?.txt || inspectedVisit.adv?.lens || inspectedVisit.adv?.prim);
		const hasVi = Boolean(inspectedVisit.vi && ((inspectedVisit.vi as any).re || (inspectedVisit.vi as any).le || (inspectedVisit.vi as any).rem));

		return {
			hasData: hasConsultation || hasFollowUp || hasOpinion || hasAdvice || hasVi,
			hasConsultation,
			hasFollowUp,
			hasOpinion,
			hasAdvice,
			hasVi,
		};
	}, [inspectedVisit]);


	// Comprehensive longitudinal analysis by anatomical structure across all patient visits
	const structuresAnalysis = useMemo(() => {
		const dataByStructure: {
			[id: string]: {
				item: any;
				category: string;
				timeline: Array<{
					visit: any;
					date: string;
					isBaseline: boolean;
					isLatest: boolean;
					reVal: string;
					leVal: string;
					evalRe: ReturnType<typeof evaluateFindingSeverity>;
					evalLe: ReturnType<typeof evaluateFindingSeverity>;
					hasChangedFromPrev: boolean;
					isAbnormal: boolean;
				}>;
				hasAnyAbnormal: boolean;
				hasAnyChange: boolean;
				latestRe: string;
				latestLe: string;
				latestEvalRe: ReturnType<typeof evaluateFindingSeverity>;
				latestEvalLe: ReturnType<typeof evaluateFindingSeverity>;
			};
		} = {};

		let totalCount = 0;
		let abnormalCount = 0;
		let normalCount = 0;

		anatomicalLayers.forEach((cat) => {
			cat.items.forEach((item: any) => {
				totalCount++;
				const timeline: any[] = [];
				let prevRe = "";
				let prevLe = "";

				visits.forEach((v, idx) => {
					const reVal = getVisitValue(item.parent, item.field, 0, v, item.sectionKey);
					const leVal = getVisitValue(item.parent, item.field, 1, v, item.sectionKey);
					const evalRe = evaluateFindingSeverity(reVal);
					const evalLe = evaluateFindingSeverity(leVal);
					const isAbnormal =
						evalRe.severity === "watch" ||
						evalRe.severity === "pathology" ||
						evalLe.severity === "watch" ||
						evalLe.severity === "pathology";
					const hasChangedFromPrev =
						idx > 0 && (isMeaningfulChange(reVal, prevRe) || isMeaningfulChange(leVal, prevLe));

					timeline.push({
						visit: v,
						date: v.d,
						isBaseline: idx === 0,
						isLatest: idx === visits.length - 1,
						reVal,
						leVal,
						evalRe,
						evalLe,
						hasChangedFromPrev,
						isAbnormal,
					});

					prevRe = reVal;
					prevLe = leVal;
				});

				const hasAnyAbnormal = timeline.some((t) => t.isAbnormal);
				const hasAnyChange = timeline.some((t) => t.hasChangedFromPrev);
				const latestEntry = timeline[timeline.length - 1] || {
					reVal: "—",
					leVal: "—",
					evalRe: evaluateFindingSeverity("—"),
					evalLe: evaluateFindingSeverity("—"),
				};

				if (hasAnyAbnormal) {
					abnormalCount++;
				} else {
					normalCount++;
				}

				dataByStructure[item.id] = {
					item,
					category: cat.category,
					timeline,
					hasAnyAbnormal,
					hasAnyChange,
					latestRe: latestEntry.reVal,
					latestLe: latestEntry.leVal,
					latestEvalRe: latestEntry.evalRe,
					latestEvalLe: latestEntry.evalLe,
				};
			});
		});

		return { totalCount, abnormalCount, normalCount, dataByStructure };
	}, [anatomicalLayers, visits]);

	// Milestone visits for Timeline Inspector (Design 2)
	const milestoneVisitIndices = useMemo(() => {
		if (visits.length <= 1) return [0];
		const milestoneSet = new Set<number>();
		milestoneSet.add(0); // Baseline
		milestoneSet.add(visits.length - 1); // Latest

		Object.values(structuresAnalysis.dataByStructure).forEach((struct) => {
			struct.timeline.forEach((t, vIdx) => {
				if (t.hasChangedFromPrev || t.isAbnormal) {
					milestoneSet.add(vIdx);
				}
			});
		});

		return Array.from(milestoneSet).sort((a, b) => a - b);
	}, [visits, structuresAnalysis]);

	// Filtered visits for the scrubber filmstrip based on timelineScope
	const scrubberVisits = useMemo(() => {
		if (timelineScope === "milestones") {
			return visits
				.map((v, idx) => ({ visit: v, originalIndex: idx }))
				.filter((item) => milestoneVisitIndices.includes(item.originalIndex));
		}
		return visits.map((v, idx) => ({ visit: v, originalIndex: idx }));
	}, [visits, timelineScope, milestoneVisitIndices]);

	// Delta Stream Analysis (Design 3: Changes & Active Findings Only)
	const deltaAnalysis = useMemo(() => {
		const changedStructures: Array<{
			id: string;
			label: string;
			category: string;
			hasAnyAbnormal: boolean;
			milestones: Array<{
				visit: any;
				date: string;
				isBaseline: boolean;
				isLatest: boolean;
				reVal: string;
				leVal: string;
				evalRe: ReturnType<typeof evaluateFindingSeverity>;
				evalLe: ReturnType<typeof evaluateFindingSeverity>;
				hasChangedFromPrev: boolean;
				isAbnormal: boolean;
			}>;
			latestRe: string;
			latestLe: string;
			latestEvalRe: ReturnType<typeof evaluateFindingSeverity>;
			latestEvalLe: ReturnType<typeof evaluateFindingSeverity>;
		}> = [];

		const normalStructures: Array<{
			id: string;
			label: string;
			category: string;
			latestRe: string;
			latestLe: string;
		}> = [];

		anatomicalLayers.forEach((cat) => {
			cat.items.forEach((item: any) => {
				const struct = structuresAnalysis.dataByStructure[item.id];
				if (!struct) return;

				if (struct.hasAnyAbnormal || struct.hasAnyChange) {
					const milestones = struct.timeline.filter(
						(t, idx) =>
							idx === 0 ||
							idx === struct.timeline.length - 1 ||
							(t.hasChangedFromPrev && (t.reVal !== "—" || t.leVal !== "—")) ||
							t.isAbnormal
					);
					changedStructures.push({
						id: item.id,
						label: item.label,
						category: cat.category,
						hasAnyAbnormal: struct.hasAnyAbnormal,
						milestones,
						latestRe: struct.latestRe,
						latestLe: struct.latestLe,
						latestEvalRe: struct.latestEvalRe,
						latestEvalLe: struct.latestEvalLe,
					});
				} else {
					normalStructures.push({
						id: item.id,
						label: item.label,
						category: cat.category,
						latestRe: struct.latestRe,
						latestLe: struct.latestLe,
					});
				}
			});
		});

		return { changedStructures, normalStructures };
	}, [anatomicalLayers, structuresAnalysis]);

	// Pathology triage aggregation across all structures
	const pathologyOverview = useMemo(() => {
		const activeAbnormalities: Array<{
			structure: string;
			eye: "RE" | "LE" | "BE";
			finding: string;
			firstSeen: string;
			latestSeen: string;
		}> = [];

		const monitoredFindings: Array<{
			structure: string;
			eye: "RE" | "LE" | "BE";
			finding: string;
			status: string;
		}> = [];

		const normalStructures: Array<{
			structure: string;
			reStatus: string;
			leStatus: string;
		}> = [];

		// Analyze current visit findings
		anatomicalLayers.forEach((cat) => {
			cat.items.forEach((item: any) => {
				const reVal = getVisitValue(item.parent, item.field, 0, currentVisit, item.sectionKey);
				const leVal = getVisitValue(item.parent, item.field, 1, currentVisit, item.sectionKey);

				const reEval = evaluateFindingSeverity(reVal);
				const leEval = evaluateFindingSeverity(leVal);

				if (reEval.severity === "pathology") {
					activeAbnormalities.push({
						structure: item.label,
						eye: "RE",
						finding: reVal,
						firstSeen: visits[0]?.d || "",
						latestSeen: currentVisit?.d || "",
					});
				} else if (reEval.severity === "watch") {
					monitoredFindings.push({
						structure: item.label,
						eye: "RE",
						finding: reVal,
						status: "Monitored",
					});
				}

				if (leEval.severity === "pathology") {
					activeAbnormalities.push({
						structure: item.label,
						eye: "LE",
						finding: leVal,
						firstSeen: visits[0]?.d || "",
						latestSeen: currentVisit?.d || "",
					});
				} else if (leEval.severity === "watch") {
					monitoredFindings.push({
						structure: item.label,
						eye: "LE",
						finding: leVal,
						status: "Monitored",
					});
				}

				if (reEval.severity === "normal" && leEval.severity === "normal") {
					normalStructures.push({
						structure: item.label,
						reStatus: reVal,
						leStatus: leVal,
					});
				}
			});
		});

		return { activeAbnormalities, monitoredFindings, normalStructures };
	}, [anatomicalLayers, currentVisit, visits]);

	return (
		<div className="w-full rounded-xl border border-border bg-card shadow-xs overflow-hidden transition-all">
			{/* Top Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b">
				<div className="flex items-center gap-2.5">
					<div className="h-5 w-1 rounded-full bg-[#1176bc]" />
					<h3 className="text-sm font-semibold text-foreground">
						Structure Progression &amp; History
					</h3>
				</div>
			</div>

			{/* ========================================================================= */}
			{/* STRUCTURE PROGRESSION & HISTORY (ANTERIOR/FUNDUS + VISIT TABS)            */}
			{/* ========================================================================= */}
			{activeMode === "longitudinalMatrix" && (
				<div className="p-5 sm:p-6 space-y-6">
					{/* UNIFIED TIMELINE INSPECTOR & HISTORICAL SCRUBBER */}
					<div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
						{/* Consolidated Header Row */}
						<div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 border-b border-border bg-slate-50/80 dark:bg-slate-900/60">
							{/* Left: Filter Controls (Laterality Filter + Scope Filter + Compare Visits Filter) */}
							<div className="flex flex-wrap items-center gap-2">
								{/* Laterality Filter (BE / RE / LE) */}
								<div className="inline-flex items-center rounded-lg bg-muted/60 p-0.5 border border-border/80 shadow-2xs">
									<button
										onClick={() => setProgressionEye("BE")}
										className={`h-7.5 px-2.5 sm:px-3 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${progressionEye === "BE"
											? "bg-primary text-primary-foreground shadow-xs font-bold border border-primary"
											: "text-muted-foreground hover:text-foreground hover:bg-background/50"
											}`}
										title="Both Eyes (BE)"
									>
										<span className="hidden md:inline">Both </span>
										<span>(BE)</span>
									</button>
									<button
										onClick={() => setProgressionEye("RE")}
										className={`h-7.5 px-2.5 sm:px-3 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${progressionEye === "RE"
											? "bg-primary text-primary-foreground shadow-xs font-bold border border-primary"
											: "text-muted-foreground hover:text-foreground hover:bg-background/50"
											}`}
										title="Right Eye (RE)"
									>
										<span className="hidden md:inline">Right </span>
										<span>(RE)</span>
									</button>
									<button
										onClick={() => setProgressionEye("LE")}
										className={`h-7.5 px-2.5 sm:px-3 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${progressionEye === "LE"
											? "bg-primary text-primary-foreground shadow-xs font-bold border border-primary"
											: "text-muted-foreground hover:text-foreground hover:bg-background/50"
											}`}
										title="Left Eye (LE)"
									>
										<span className="hidden md:inline">Left </span>
										<span>(LE)</span>
									</button>
								</div>

								{/* Scope Filter: All Visits vs Events */}
								<div className="inline-flex items-center rounded-lg bg-muted/60 p-0.5 border border-border/80 shadow-2xs">
									<button
										onClick={() => setTimelineScope("all")}
										className={`h-7.5 px-2.5 sm:px-3 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${timelineScope === "all"
											? "bg-primary text-primary-foreground shadow-xs font-bold border border-primary"
											: "text-muted-foreground hover:text-foreground hover:bg-background/50"
											}`}
									>
										<span>All Visits ({visits.length})</span>
									</button>
									<button
										onClick={() => setTimelineScope("milestones")}
										className={`h-7.5 px-2.5 sm:px-3 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${timelineScope === "milestones"
											? "bg-primary text-primary-foreground shadow-xs font-bold border border-primary"
											: "text-muted-foreground hover:text-foreground hover:bg-background/50"
											}`}
									>
										<span>Events ({milestoneVisitIndices.length})</span>
									</button>
								</div>

								{/* Compare Toggle Button */}
								<button
									type="button"
									onClick={() => {
										setIsCompareMode((prev) => !prev);
										setCompareVisitIndex(null);
									}}
									className={`h-7.5 px-3 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 shadow-2xs ${isCompareMode
										? "bg-primary text-primary-foreground border-primary font-bold shadow-xs ring-2 ring-primary/20"
										: "bg-card text-muted-foreground border-border/80 hover:text-foreground hover:bg-muted/50"
										}`}
									title={isCompareMode ? "Exit comparison mode" : "Compare this visit with Initial visit or ±3 visits"}
								>
									<ArrowLeftRight className="w-3.5 h-3.5" />
									<span>Compare</span>
									{isCompareMode && (
										<span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse ml-0.5" />
									)}
								</button>
							</div>

							{/* Right: Visit Navigation Stepper & Reset to Latest */}
							<div className="flex items-center gap-2">
								{isResetAvailable && (
									<button
										onClick={() => {
											setInspectorVisitIndex(visits.length - 1);
											setCompareVisitIndex(null);
											setIsCompareMode(false);
											setTimelineScope("all");
										}}
										className="h-7.5 flex items-center gap-1 px-2.5 text-xs font-semibold rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all shadow-2xs whitespace-nowrap"
										title="Reset view to latest examination, clear filters, and exit comparison mode"
									>
										<RotateCcw className="w-3.5 h-3.5" />
										<span>Reset</span>
									</button>
								)}

								{/* Unified Clinical Stepper Controller */}
								<div className="inline-flex items-center h-7.5 rounded-lg border border-border/80 bg-card shadow-2xs overflow-hidden">
									<button
										onClick={() => {
											setInspectorVisitIndex(0);
											setCompareVisitIndex(null);
										}}
										disabled={inspectorVisitIndex === 0}
										className="h-full px-2 text-xs font-medium hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors border-r border-border/60 flex items-center gap-0.5"
										title="Go to Initial Visit"
									>
										<ChevronsLeft className="w-3.5 h-3.5" />
										<span className="hidden 2xl:inline text-[11px] font-semibold">Initial</span>
									</button>
									<button
										onClick={() => {
											if (timelineScope === "milestones") {
												const prevMilestones = milestoneVisitIndices.filter((idx) => idx < inspectorVisitIndex);
												if (prevMilestones.length > 0) {
													setInspectorVisitIndex(prevMilestones[prevMilestones.length - 1]);
													setCompareVisitIndex(null);
												}
											} else {
												setInspectorVisitIndex((prev) => Math.max(0, prev - 1));
												setCompareVisitIndex(null);
											}
										}}
										disabled={
											timelineScope === "milestones"
												? !milestoneVisitIndices.some((idx) => idx < inspectorVisitIndex)
												: inspectorVisitIndex === 0
										}
										className="h-full w-7 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors border-r border-border/60 flex items-center justify-center"
										title="Previous visit"
									>
										<ArrowLeft className="w-3.5 h-3.5" />
									</button>
									<div className="h-full px-2.5 flex items-center justify-center text-xs font-semibold text-foreground whitespace-nowrap bg-muted/20">
										<span className="text-muted-foreground mr-1 font-normal">Visit</span>
										<span className="text-primary font-bold">{inspectorVisitIndex + 1}</span>
										<span className="text-muted-foreground/50 mx-1">/</span>
										<span className="text-muted-foreground font-medium">{visits.length}</span>
									</div>
									<button
										onClick={() => {
											if (timelineScope === "milestones") {
												const nextMilestone = milestoneVisitIndices.find((idx) => idx > inspectorVisitIndex);
												if (nextMilestone !== undefined) {
													setInspectorVisitIndex(nextMilestone);
													setCompareVisitIndex(null);
												}
											} else {
												setInspectorVisitIndex((prev) => Math.min(visits.length - 1, prev + 1));
												setCompareVisitIndex(null);
											}
										}}
										disabled={
											timelineScope === "milestones"
												? !milestoneVisitIndices.some((idx) => idx > inspectorVisitIndex)
												: inspectorVisitIndex === visits.length - 1
										}
										className="h-full w-7 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors border-l border-border/60 flex items-center justify-center"
										title="Next visit"
									>
										<ArrowRight className="w-3.5 h-3.5" />
									</button>
									<button
										onClick={() => {
											setInspectorVisitIndex(visits.length - 1);
											setCompareVisitIndex(null);
										}}
										disabled={inspectorVisitIndex === visits.length - 1}
										className="h-full px-2 text-xs font-medium hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors border-l border-border/60 flex items-center gap-0.5"
										title="Go to Latest Visit"
									>
										<span className="hidden 2xl:inline text-[11px] font-semibold">Latest</span>
										<ChevronsRight className="w-3.5 h-3.5" />
									</button>
								</div>
							</div>
						</div>

						{/* Scrollable Scrubber Filmstrip (Shows 5 visits at a time, rest scrolls horizontally) */}
						<div className="border-t border-border/80 bg-muted/10 px-4 pt-3 pb-2">
							<div ref={scrubberContainerRef} className="flex items-center gap-2 overflow-x-auto pt-1 pb-3 box-scroll">
								{scrubberVisits.map(({ visit: v, originalIndex: vIdx }) => {
									const isSelected = vIdx === inspectorVisitIndex;
									const isBaseline = vIdx === 0;
									const isLatest = vIdx === visits.length - 1;
									const isMilestone = milestoneVisitIndices.includes(vIdx);

									// Compare Mode eligibility: Initial Visit (0), or within 3 visits of inspectorVisitIndex
									const offset = vIdx - inspectorVisitIndex;
									const isWithin3Visits = Math.abs(offset) <= 3;
									const isAllowedInCompare = isBaseline || isWithin3Visits;
									const isDisabledInCompare = isCompareMode && !isAllowedInCompare;
									const isCompareTarget = isCompareMode && compareVisitIndex === vIdx;

									const offsetTag = isBaseline && !isSelected
										? "Initial"
										: offset > 0
											? `+${offset}`
											: `${offset}`;

									return (
										<button
											key={v.d || vIdx}
											ref={isSelected ? selectedScrubberRef : null}
											disabled={isDisabledInCompare}
											onClick={() => {
												if (isCompareMode) {
													if (isSelected) {
														// Clicking the base visit unselects any comparison target (show single visit)
														setCompareVisitIndex(null);
													} else if (isCompareTarget) {
														// Clicking already selected comparison target unselects it (show single visit)
														setCompareVisitIndex(null);
													} else if (isAllowedInCompare) {
														// Select this visit as comparison target
														setCompareVisitIndex(vIdx);
													}
												} else {
													setInspectorVisitIndex(vIdx);
													setCompareVisitIndex(null);
												}
											}}
											className={`flex-shrink-0 w-[calc((100%-32px)/5)] min-w-[120px] px-3.5 py-2.5 rounded-xl border text-[13px] font-medium transition-all flex flex-col items-center gap-1 group ${isDisabledInCompare
												? "opacity-25 cursor-not-allowed pointer-events-none bg-muted/20 border-dashed border-border/40 text-muted-foreground/40 select-none"
												: isCompareTarget
													? "bg-primary text-primary-foreground border-primary shadow-xs font-bold ring-2 ring-primary/40 scale-[1.02]"
													: isSelected
														? "bg-primary text-primary-foreground border-primary shadow-xs font-bold scale-[1.02]"
														: isCompareMode && isAllowedInCompare
															? "bg-primary/10 text-primary border-primary/40 hover:bg-primary/20 hover:border-primary cursor-pointer"
															: "bg-card text-foreground border-border/80 hover:bg-primary hover:text-primary-foreground hover:border-primary"
												}`}
											title={
												isDisabledInCompare
													? `Disabled in Compare Mode (Only Initial Visit and ±3 visits from Visit ${inspectorVisitIndex + 1} are selectable)`
													: isCompareTarget
														? `Comparing with Visit ${vIdx + 1} (Click to unselect and view single visit)`
														: isSelected
															? isCompareMode ? `Selected Visit (Visit ${vIdx + 1})` : `Selected Visit (Visit ${vIdx + 1})`
															: isCompareMode && isAllowedInCompare
																? `Click to compare Visit ${vIdx + 1} (${offsetTag}) with Visit ${inspectorVisitIndex + 1}`
																: `Select Visit ${vIdx + 1}`
											}
										>
											<span className="text-[13px] font-bold">
												{formatVisitDate(v.d)}
											</span>
											<div className="flex items-center gap-1.5 text-[13px]">
												{isCompareTarget ? (
													<span className="text-white font-extrabold uppercase tracking-wider text-[13px]">
														Compare
													</span>
												) : isSelected ? (
													<span className="text-primary-foreground font-bold text-[13px]">
														{isCompareMode ? "Selected" : isLatest ? "Latest" : isBaseline ? "Initial" : `#${vIdx + 1}`}
													</span>
												) : isCompareMode && isAllowedInCompare ? (
													<span className="font-bold text-primary text-[13px]">
														{vIdx}
													</span>
												) : isLatest ? (
													<span className="text-primary group-hover:text-white font-bold text-[13px]">Latest</span>
												) : isBaseline ? (
													<span className="font-semibold text-muted-foreground group-hover:text-white text-[13px]">Initial Visit</span>
												) : (
													<span className="text-muted-foreground/75 group-hover:text-white text-[13px]">#{vIdx + 1}</span>
												)}
												{isMilestone && !isSelected && !isCompareTarget && !isDisabledInCompare && (
													<span className="w-2 h-2 rounded-full bg-primary/50 group-hover:bg-white/80 inline-block ml-0.5" title="Clinical events/procedures" />
												)}
											</div>
										</button>
									);
								})}
							</div>
						</div>

						{/* Compare Mode Active Banner / Guidance */}
						{isCompareMode && (
							<div className="px-3.5 py-2 bg-primary/10 border-t border-primary/20 flex flex-wrap items-center justify-between gap-2.5 text-xs">
								<div className="flex items-center gap-2 text-foreground">
									<div className="w-5 h-5 rounded-md bg-primary/20 text-primary flex items-center justify-center font-bold shrink-0">
										<ArrowLeftRight className="w-3 h-3" />
									</div>
									{isComparing ? (
										<span className="leading-snug">
											Comparing <strong>Visit {earlierVisitIndex + 1}</strong> ({formatVisitDate(earlierVisit?.d || "")}) ➔ <strong>Visit {laterVisitIndex + 1}</strong> ({formatVisitDate(laterVisit?.d || "")})
										</span>
									) : (
										<span className="leading-snug">
											<strong>Compare Mode Active:</strong> Showing <strong>Visit {inspectorVisitIndex + 1}</strong> ({formatVisitDate(inspectedVisit?.d || "")}). Click an enabled visit above to compare.
										</span>
									)}
								</div>
								<div className="flex items-center gap-2">
									{isComparing && (
										<button
											type="button"
											onClick={() => setCompareVisitIndex(null)}
											className="text-xs font-semibold text-primary hover:underline px-2.5 py-1 rounded-md hover:bg-primary/10 transition-colors"
										>
											Clear Comparison (Single Visit)
										</button>
									)}
									<button
										type="button"
										onClick={() => {
											setIsCompareMode(false);
											setCompareVisitIndex(null);
										}}
										className="text-xs font-semibold text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md hover:bg-muted/60 transition-colors border border-border/60"
									>
										Exit Compare Mode
									</button>
								</div>
							</div>
						)}
					</div>

					{/* ========================================================================= */}
					{/* VISIT CLINICAL DETAILS TABS (DIAGNOSIS, SYSTEMIC, RX, PROCEDURES, OTHER)  */}
					{/* ========================================================================= */}
					<div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
						{/* Tab Switcher Header */}
						<div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-900/60 border-b border-border flex flex-wrap items-center justify-between gap-3">
							<div className="flex items-center gap-2.5 shrink-0">
								<div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
									<FileText className="w-4 h-4" />
								</div>
								<div className="flex items-center gap-2 flex-wrap">
									<span className="text-xs font-bold text-foreground whitespace-nowrap">
										Visit Clinical Records
									</span>
									<span className="inline-flex items-center gap-1.5 whitespace-nowrap">
											<span className="text-xs px-2.5 py-1 rounded-full font-bold bg-primary text-primary-foreground shadow-xs">
												Viewing Visit #{inspectorVisitIndex + 1}
											</span>
											<span className="text-xs px-2.5 py-1 rounded-full font-bold bg-primary/10 text-primary border border-primary/40">
												{inspectedVisit ? formatVisitDate(inspectedVisit.d) : ""}
											</span>
											<span className="text-xs font-medium text-muted-foreground">
												{inspectorVisitIndex === visits.length - 1 ? "Latest visit" : `of ${visits.length} total`}
											</span>
										</span>
								</div>
							</div>

							{/* Tab Navigation Buttons */}
							<div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto box-scroll pb-1 sm:pb-0">
								<button
									onClick={() => setVisitDetailsTab("diagnosis")}
									className={`group flex items-center gap-1.5 px-3.5 py-1.5 h-8.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${visitDetailsTab === "diagnosis"
										? "bg-primary text-primary-foreground shadow-xs font-bold border border-primary"
										: "text-black dark:text-white border border-black/70 dark:border-white/60 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-xs"
										}`}
								>
									<Activity className="w-3.5 h-3.5" />
									<span className="whitespace-nowrap">Diagnosis</span>
									{inspectedDiagnoses.totalCount > 0 && (
										<span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${visitDetailsTab === "diagnosis" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground border border-border/60 group-hover:bg-white/25 group-hover:border-white/40"
											}`}>
											{inspectedDiagnoses.totalCount}
										</span>
									)}
								</button>

								<button
									onClick={() => setVisitDetailsTab("systemic")}
									className={`group flex items-center gap-1.5 px-3.5 py-1.5 h-8.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${visitDetailsTab === "systemic"
										? "bg-primary text-primary-foreground shadow-xs font-bold border border-primary"
										: "text-black dark:text-white border border-black/70 dark:border-white/60 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-xs"
										}`}
								>
									<ShieldCheck className="w-3.5 h-3.5" />
									<span className="whitespace-nowrap">System History</span>
									{inspectedSystemic.active.length > 0 && (
										<span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${visitDetailsTab === "systemic" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground border border-border/60 group-hover:bg-white/25 group-hover:border-white/40"
											}`}>
											{inspectedSystemic.active.length}
										</span>
									)}
								</button>

								<button
									onClick={() => setVisitDetailsTab("medications")}
									className={`group flex items-center gap-1.5 px-3.5 py-1.5 h-8.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${visitDetailsTab === "medications"
										? "bg-primary text-primary-foreground shadow-xs font-bold border border-primary"
										: "text-black dark:text-white border border-black/70 dark:border-white/60 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-xs"
										}`}
								>
									<Pill className="w-3.5 h-3.5" />
									<span className="whitespace-nowrap">Medications</span>
									{inspectedMedications.length > 0 && (
										<span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${visitDetailsTab === "medications" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground border border-border/60 group-hover:bg-white/25 group-hover:border-white/40"
											}`}>
											{inspectedMedications.length}
										</span>
									)}
								</button>

								<button
									onClick={() => setVisitDetailsTab("procedures")}
									className={`group flex items-center gap-1.5 px-3.5 py-1.5 h-8.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${visitDetailsTab === "procedures"
										? "bg-primary text-primary-foreground shadow-xs font-bold border border-primary"
										: "text-black dark:text-white border border-black/70 dark:border-white/60 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-xs"
										}`}
								>
									<Zap className="w-3.5 h-3.5" />
									<span className="whitespace-nowrap">Procedures</span>
									{inspectedProcedures.length > 0 && (
										<span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${visitDetailsTab === "procedures" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground border border-border/60 group-hover:bg-white/25 group-hover:border-white/40"
											}`}>
											{inspectedProcedures.length}
										</span>
									)}
								</button>

								<button
									onClick={() => setVisitDetailsTab("other")}
									className={`group flex items-center gap-1.5 px-3.5 py-1.5 h-8.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${visitDetailsTab === "other"
										? "bg-primary text-primary-foreground shadow-xs font-bold border border-primary"
										: "text-black dark:text-white border border-black/70 dark:border-white/60 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-xs"
										}`}
								>
									<Layers className="w-3.5 h-3.5" />
									<span className="whitespace-nowrap">Other Data</span>
									{inspectedOtherData.hasData && (
										<span className={`w-1.5 h-1.5 rounded-full shrink-0 ${visitDetailsTab === "other" ? "bg-primary-foreground" : "bg-primary group-hover:bg-white"
											}`} />
									)}
								</button>
							</div>
						</div>

						{/* Tab Content Body */}
						<div className="p-5 sm:p-6">
							{/* TAB 1: DIAGNOSIS */}
							{visitDetailsTab === "diagnosis" && (() => {
								const reStyle = getLateralityStyles("RE");
								const leStyle = getLateralityStyles("LE");
								const beStyle = getLateralityStyles("BE");

								return (
									<div className="space-y-4">
										{inspectedDiagnoses.totalCount > 0 ? (
											<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
												{/* RE Diagnoses */}
												<div className={`p-4 rounded-xl border shadow-xs space-y-3 ${reStyle.card}`}>
													<div className="flex items-center justify-between">
														<span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${reStyle.headerText}`}>
															<span className={`w-2 h-2 rounded-full shrink-0 ${reStyle.dot}`} />
															Right Eye (RE)
														</span>
														<Badge variant="outline" className={`text-xs px-2.5 py-0.5 border font-bold ${reStyle.badge}`}>
															{inspectedDiagnoses.re.length}
														</Badge>
													</div>
													{inspectedDiagnoses.re.length > 0 ? (
														<ul className="space-y-1.5 pl-0.5">
															{inspectedDiagnoses.re.map((d: string, i: number) => (
																<li key={i} className="flex items-start gap-1.5 text-xs text-foreground font-semibold">
																	<Circle className={`w-1.5 h-1.5 shrink-0 mt-1.5 ${reStyle.bullet}`} />
																	<span className="break-words leading-snug">{d}</span>
																</li>
															))}
														</ul>
													) : (
														<p className="text-xs text-muted-foreground/70 italic py-1">No RE diagnosis recorded.</p>
													)}
												</div>

												{/* LE Diagnoses */}
												<div className={`p-4 rounded-xl border shadow-xs space-y-3 ${leStyle.card}`}>
													<div className="flex items-center justify-between">
														<span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${leStyle.headerText}`}>
															<span className={`w-2 h-2 rounded-full shrink-0 ${leStyle.dot}`} />
															Left Eye (LE)
														</span>
														<Badge variant="outline" className={`text-xs px-2.5 py-0.5 border font-bold ${leStyle.badge}`}>
															{inspectedDiagnoses.le.length}
														</Badge>
													</div>
													{inspectedDiagnoses.le.length > 0 ? (
														<ul className="space-y-1.5 pl-0.5">
															{inspectedDiagnoses.le.map((d: string, i: number) => (
																<li key={i} className="flex items-start gap-1.5 text-xs text-foreground font-semibold">
																	<Circle className={`w-1.5 h-1.5 shrink-0 mt-1.5 ${leStyle.bullet}`} />
																	<span className="break-words leading-snug">{d}</span>
																</li>
															))}
														</ul>
													) : (
														<p className="text-xs text-muted-foreground/70 italic py-1">No LE diagnosis recorded.</p>
													)}
												</div>

												{/* BE Diagnoses */}
												<div className={`p-4 rounded-xl border shadow-xs space-y-3 ${beStyle.card}`}>
													<div className="flex items-center justify-between">
														<span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${beStyle.headerText}`}>
															<span className={`w-2 h-2 rounded-full shrink-0 ${beStyle.dot}`} />
															Bilateral (BE)
														</span>
														<Badge variant="outline" className={`text-xs px-2.5 py-0.5 border font-bold ${beStyle.badge}`}>
															{inspectedDiagnoses.be.length}
														</Badge>
													</div>
													{inspectedDiagnoses.be.length > 0 ? (
														<ul className="space-y-1.5 pl-0.5">
															{inspectedDiagnoses.be.map((d: string, i: number) => (
																<li key={i} className="flex items-start gap-1.5 text-xs text-foreground font-semibold">
																	<Circle className={`w-1.5 h-1.5 shrink-0 mt-1.5 ${beStyle.bullet}`} />
																	<span className="break-words leading-snug">{d}</span>
																</li>
															))}
														</ul>
													) : (
														<p className="text-xs text-muted-foreground/70 italic py-1">No BE diagnosis recorded.</p>
													)}
												</div>
											</div>
										) : (
											<div className="py-6 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
												<CheckCircle className="w-5 h-5 text-muted-foreground/40" />
												<span>No specific ocular diagnoses recorded on this visit date ({formatVisitDate(inspectedVisit?.d || "")}).</span>
											</div>
										)}
									</div>
								);
							})()}

							{/* TAB 2: SYSTEM HISTORY */}
							{visitDetailsTab === "systemic" && (
								<div className="space-y-3">
									{inspectedSystemic.active.length > 0 ? (
										<div className="space-y-2.5">
											<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-6 gap-2.5">
												{inspectedSystemic.active.map((cond, i) => (
													<div
														key={i}
														className="p-3 rounded-xl bg-card border border-border/80 shadow-2xs space-y-1.5"
													>
														<div className="flex items-center justify-between gap-1">
															<span className="text-xs font-bold text-foreground break-words leading-tight">
																{cond.name}
															</span>
															<span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
																Active
															</span>
														</div>
														<div className="text-[11px] space-y-0.5 text-muted-foreground">
															{cond.recordedDuration && (
																<div>
																	<span className="text-[10px] uppercase font-semibold text-muted-foreground/70">At visit: </span>
																	<span className="font-medium text-foreground/80">{cond.recordedDuration}</span>
																</div>
															)}
															<div>
																<span className="text-[10px] uppercase font-semibold text-muted-foreground/70">Total Duration: </span>
																<span className="font-bold text-foreground">{cond.currentDuration}</span>
															</div>
														</div>
													</div>
												))}
											</div>

											{inspectedSystemic.ruledOut.length > 0 && (
												<div className="pt-2 border-t border-border/60">
													<span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
														Ruled Out / Negative Conditions:
													</span>
													<div className="flex flex-wrap gap-1.5">
														{inspectedSystemic.ruledOut.map((c, i) => (
															<Badge key={i} variant="outline" className="text-[10px] font-normal text-muted-foreground/70 bg-muted/20">
																{c}
															</Badge>
														))}
													</div>
												</div>
											)}
										</div>
									) : (
										<div className="py-6 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
											<ShieldCheck className="w-5 h-5 text-muted-foreground/40" />
											<span>No systemic conditions documented on this visit date ({formatVisitDate(inspectedVisit?.d || "")}).</span>
											{patientData.p?.s?.h && (
												<p className="text-[11px] text-muted-foreground/80 mt-1">
													Patient baseline conditions: <strong>{patientData.p.s.h.split(";").filter(Boolean).join(", ")}</strong>
												</p>
											)}
										</div>
									)}
								</div>
							)}

							{/* TAB 3: MEDICATIONS */}
							{visitDetailsTab === "medications" && (
								<div className="space-y-3">
									{inspectedMedications.length > 0 ? (
										<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-6 gap-2.5">
											{inspectedMedications.map((med, i) => {
												const lat = getLateralityStyles(med.eye);
												return (
													<div
														key={i}
														className="p-2.5 rounded-xl bg-card border border-border/80 shadow-2xs flex items-center justify-between gap-2.5"
													>
														<div className="flex items-center gap-2.5 min-w-0 flex-1">
															<div className="w-6 h-6 rounded-full bg-muted text-foreground flex items-center justify-center font-bold text-xs shrink-0 border border-border/60">
																Rx
															</div>
															<div className="min-w-0 flex-1">
																<div className="text-[13px] font-bold text-foreground break-words leading-tight" title={med.name}>
																	{med.name}
																</div>
																{(med.frequency || med.dosage) && (
																	<div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-1 flex-wrap">
																		{med.frequency && (
																			<span className="font-semibold text-foreground/80">
																				{med.frequency}
																			</span>
																		)}
																		{med.dosage && (
																			<span>• {med.dosage}</span>
																		)}
																	</div>
																)}
															</div>
														</div>

														<Badge
															variant="outline"
															className={`text-[10px] font-bold px-2 py-0.5 shrink-0 border ${lat.badge}`}
														>
															{med.eye}
														</Badge>
													</div>
												);
											})}
										</div>
									) : (
										<div className="py-6 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
											<Pill className="w-5 h-5 text-muted-foreground/40" />
											<span>No active eye drops or medications prescribed on this visit date ({formatVisitDate(inspectedVisit?.d || "")}).</span>
										</div>
									)}
								</div>
							)}

							{/* TAB 4: PROCEDURES */}
							{visitDetailsTab === "procedures" && (
								<div className="space-y-3">
									{inspectedProcedures.length > 0 ? (
										<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-6 gap-2.5">
											{inspectedProcedures.map((proc, i) => {
												const lat = getLateralityStyles(proc.eye);
												return (
													<div
														key={i}
														className="p-3 rounded-xl bg-card border border-border/80 shadow-2xs space-y-1.5"
													>
														<div className="flex items-center justify-between gap-1">
															<span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-foreground border border-border/60">
																{proc.type}
															</span>
															<Badge
																variant="outline"
																className={`text-[10px] font-bold px-1.5 py-0.2 border ${lat.badge}`}
															>
																{proc.eye}
															</Badge>
														</div>
														<div className="text-xs font-bold text-foreground break-words leading-tight">
															{proc.name}
														</div>
														{proc.details && (
															<p className="text-[11px] text-muted-foreground break-words leading-snug">
																{proc.details}
															</p>
														)}
													</div>
												);
											})}
										</div>
									) : (
										<div className="py-6 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
											<Zap className="w-5 h-5 text-muted-foreground/40" />
											<span>No procedures, surgeries, or lasers recorded on this visit date ({formatVisitDate(inspectedVisit?.d || "")}).</span>
										</div>
									)}
								</div>
							)}

							{/* TAB 5: OTHER DATA */}
							{visitDetailsTab === "other" && (
								<div className="space-y-3">
									{inspectedOtherData.hasData ? (
										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
											{/* Consultation & Visit Type */}
											{/* {(inspectedVisit?.c || inspectedVisit?.t) && (
													<div className="p-3 rounded-xl bg-card border border-border/80 shadow-2xs space-y-1">
														<span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
															<Clock className="w-3.5 h-3.5 text-primary" />
															Consultation Details
														</span>
														<p className="text-xs font-bold text-foreground">
															{inspectedVisit?.c || "Routine Consultation"}
														</p>
														{inspectedVisit?.t && (
															<p className="text-[11px] text-muted-foreground">Time: {inspectedVisit.t}</p>
														)}
													</div>
												)} */}

											{/* Scheduled Follow-Up */}
											{inspectedVisit?.fup && (
												<div className="p-3 rounded-xl bg-card border border-border/80 shadow-2xs space-y-1">
													<span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
														<Calendar className="w-3.5 h-3.5 text-primary" />
														Next Follow-Up Plan
													</span>
													<p className="text-xs font-bold text-foreground">
														{inspectedVisit.fup.date ? formatVisitDate(inspectedVisit.fup.date) : inspectedVisit.fup.adv || "As advised"}
													</p>
													{(inspectedVisit.fup.loc || inspectedVisit.fup.placename || inspectedVisit.fup.place) && (
														<p className="text-[11px] text-muted-foreground">
															Clinic: {inspectedVisit.fup.loc || inspectedVisit.fup.placename || inspectedVisit.fup.place}
														</p>
													)}
												</div>
											)}

											{/* Opinions & Referrals */}
											{inspectedVisit?.op && (
												<div className="p-3 rounded-xl bg-card border border-border/80 shadow-2xs space-y-1">
													<span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
														<Activity className="w-3.5 h-3.5 text-primary" />
														Opinion & Referral
													</span>
													{inspectedVisit.op.ref && (
														<p className="text-xs font-bold text-foreground">Ref: {inspectedVisit.op.ref}</p>
													)}
													{(inspectedVisit.op.cl || inspectedVisit.op.dept) && (
														<p className="text-[11px] text-muted-foreground">
															Dept: {inspectedVisit.op.cl || inspectedVisit.op.dept}
														</p>
													)}
													{(inspectedVisit.op.oc || inspectedVisit.op.comm_desc || inspectedVisit.op.rem) && (
														<p className="text-[11px] text-muted-foreground italic break-words leading-snug">
															{inspectedVisit.op.oc || inspectedVisit.op.comm_desc || inspectedVisit.op.rem}
														</p>
													)}
												</div>
											)}

											{/* Advice & Lens Prescription */}
											{inspectedVisit?.adv && (
												<div className="p-3 rounded-xl bg-card border border-border/80 shadow-2xs space-y-1">
													<span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
														<FileText className="w-3.5 h-3.5 text-primary" />
														Clinical Advice
													</span>
													{inspectedVisit.adv.txt && (
														<p className="text-xs font-semibold text-foreground break-words leading-snug">{inspectedVisit.adv.txt}</p>
													)}
													{inspectedVisit.adv.lens && (
														<p className="text-[11px] text-muted-foreground break-words leading-snug">
															Lens: {Array.isArray(inspectedVisit.adv.lens) ? inspectedVisit.adv.lens.join(", ") : String(inspectedVisit.adv.lens)}
														</p>
													)}
													{inspectedVisit.adv.prim && (
														<p className="text-[11px] text-muted-foreground break-words leading-snug">
															Primary: {Array.isArray(inspectedVisit.adv.prim) ? inspectedVisit.adv.prim.join(", ") : String(inspectedVisit.adv.prim)}
														</p>
													)}
												</div>
											)}

											{/* Visual Acuity & IOP Snapshot */}
											{inspectedVisit?.vi && ((inspectedVisit.vi as any)?.re || (inspectedVisit.vi as any)?.le || (inspectedVisit.vi as any)?.rem) && (
												<div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs space-y-2">
													<span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
														<Eye className="w-4 h-4 text-primary" />
														VA & IOP at Visit
													</span>
													<div className="text-xs space-y-1.5 text-muted-foreground">
														{(inspectedVisit.vi as any)?.re && (
															<div className="flex items-center gap-2">
																<Badge variant="outline" className={`text-xs font-bold px-2 py-0.5 border ${getLateralityStyles("RE").badge}`}>
																	RE
																</Badge>
																<span>
																	VA <strong className="text-foreground">{((inspectedVisit.vi as any).re as any).va || ((inspectedVisit.vi as any).re as any).ucva || "—"}</strong>
																	{(((inspectedVisit.vi as any).re as any).iop || ((inspectedVisit.vi as any).re as any).t) && (
																		<span> • IOP <strong className="text-foreground">{((inspectedVisit.vi as any).re as any).iop || ((inspectedVisit.vi as any).re as any).t}</strong> mmHg</span>
																	)}
																</span>
															</div>
														)}
														{(inspectedVisit.vi as any)?.le && (
															<div className="flex items-center gap-2">
																<Badge variant="outline" className={`text-xs font-bold px-2 py-0.5 border ${getLateralityStyles("LE").badge}`}>
																	LE
																</Badge>
																<span>
																	VA <strong className="text-foreground">{((inspectedVisit.vi as any).le as any).va || ((inspectedVisit.vi as any).le as any).ucva || "—"}</strong>
																	{(((inspectedVisit.vi as any).le as any).iop || ((inspectedVisit.vi as any).le as any).t) && (
																		<span> • IOP <strong className="text-foreground">{((inspectedVisit.vi as any).le as any).iop || ((inspectedVisit.vi as any).le as any).t}</strong> mmHg</span>
																	)}
																</span>
															</div>
														)}
														{(inspectedVisit.vi as any)?.rem?.rr && (
															<p className="italic text-xs text-muted-foreground/80 mt-1">{(inspectedVisit.vi as any).rem.rr}</p>
														)}
													</div>
												</div>
											)}
										</div>
									) : (
										<div className="py-6 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
											<Layers className="w-5 h-5 text-muted-foreground/40" />
											<span>No additional clinical opinion, advice, or remarks documented on this visit date ({formatVisitDate(inspectedVisit?.d || "")}).</span>
										</div>
									)}
								</div>
							)}
						</div>
					</div>

					{/* Main Bilateral Progression Board (Side-by-Side RE & LE) */}
					<div className={`grid gap-3 sm:gap-4 ${progressionEye === "BE" ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"}`}>
						{/* RIGHT EYE (RE) PANEL */}
						{progressionEye !== "LE" && (
							<div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
								<div className="px-3.5 py-2.5 bg-muted/40 border-b border-border/70 flex items-center justify-between">
									<div className="flex items-center gap-2">
										<span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
											<Circle className="w-2 h-2 fill-primary text-primary" />
											Right Eye (RE) — {isComparing
												? `V${earlierVisitIndex + 1} ➔ V${laterVisitIndex + 1} Comparison`
												: `Visit ${inspectorVisitIndex + 1} Findings`}
										</span>
									</div>
									<span className={`text-xs font-bold whitespace-nowrap shrink-0 ${isComparing ? "text-muted-foreground" : "px-2.5 py-1 rounded-md bg-primary text-primary-foreground shadow-xs"}`}>
										{isComparing
											? `${earlierVisitIndex === 0 ? "Initial" : `V${earlierVisitIndex + 1}`} (${earlierVisit ? formatVisitDate(earlierVisit.d) : ""}) ➔ ${laterVisitIndex === visits.length - 1 ? "Latest" : `V${laterVisitIndex + 1}`} (${laterVisit ? formatVisitDate(laterVisit.d) : ""})`
											: `Visit ${inspectorVisitIndex + 1} (${inspectedVisit ? formatVisitDate(inspectedVisit.d) : ""})`}
									</span>
								</div>

								<div className="p-4 sm:p-5 space-y-5">
									{anatomicalLayers.map((cat, cIdx) => (
										<div key={cIdx} className="space-y-2">
											<div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider px-1 pb-1.5 border-b border-border/50">
												<span>{cat.category}</span>
												<span className="text-xs text-muted-foreground/70 font-normal">
													{isComparing
														? `${earlierVisitIndex === 0 ? "Initial" : `V${earlierVisitIndex + 1}`} ➔ ${laterVisitIndex === visits.length - 1 ? "Latest" : `V${laterVisitIndex + 1}`}`
														: `Visit ${inspectorVisitIndex + 1} Exam`}
												</span>
											</div>
											<div className="space-y-2">
												{cat.items.map((item: any) => {
													const struct = structuresAnalysis.dataByStructure[item.id];
													const timeline = struct?.timeline || [];

													const earlierEntry = isComparing && earlierVisitIndex !== null ? timeline[earlierVisitIndex] : null;
													const earlierVal = earlierEntry?.reVal || "—";
													const earlierEval = earlierEntry?.evalRe || evaluateFindingSeverity(earlierVal);

													const laterEntry = isComparing && laterVisitIndex !== null ? timeline[laterVisitIndex] : (timeline[inspectorVisitIndex] || timeline[timeline.length - 1]);
													const laterVal = laterEntry?.reVal || "—";
													const laterEval = laterEntry?.evalRe || evaluateFindingSeverity(laterVal);

													const inspectedEntry = timeline[inspectorVisitIndex] || timeline[timeline.length - 1];
													const inspectedVal = inspectedEntry?.reVal || "—";
													const inspectedEval = inspectedEntry?.evalRe || evaluateFindingSeverity(inspectedVal);

													const activeEval = isComparing
														? (laterEval.severity === "pathology" ? laterEval : earlierEval.severity === "pathology" ? earlierEval : laterEval)
														: inspectedEval;

													const hasChanged = isComparing && isMeaningfulChange(laterVal, earlierVal);

													return (
														<div
															key={item.id}
															className={`flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4 py-2.5 px-3.5 rounded-xl text-xs transition-colors border ${activeEval.severity === "pathology"
																? "bg-[#dc3545]/[0.06] border-[#dc3545]/40 shadow-2xs"
																: activeEval.severity === "watch"
																	? "bg-[#dc3545]/[0.06] border-[#dc3545]/40 shadow-2xs"
																	: "bg-card hover:bg-muted/40 border-border/80 shadow-2xs"
																}`}
														>
															{/* Structure Label with Severity Dot */}
															<div className="flex items-center gap-2 min-w-[150px] sm:w-[170px] lg:w-[190px] 2xl:w-[210px] shrink-0 pt-0.5">
																<span className={`w-2 h-2 rounded-full shrink-0 ${activeEval.severity === "pathology" || activeEval.severity === "watch" ? "bg-[#dc3545]" : activeEval.dotClass}`} />
																<span className="font-semibold text-foreground break-words leading-tight">{item.label}</span>
															</div>

															{/* Progression / Comparison Values */}
															<div className="flex flex-wrap items-center gap-x-2 gap-y-1 flex-1 min-w-0 justify-start">
																{isComparing ? (
																	<>
																		{/* Earlier Visit Value */}
																		<div className="flex items-baseline gap-1 text-xs text-muted-foreground min-w-0">
																			<span className={`text-xs font-bold uppercase tracking-wider shrink-0 ${earlierVisitIndex === inspectorVisitIndex
																				? "text-primary font-extrabold"
																				: "text-muted-foreground/60"
																				}`}>
																				{earlierVisitIndex === 0 ? "Initial:" : `V${earlierVisitIndex + 1}:`}
																			</span>
																			<span className="font-medium text-foreground/80 break-words leading-snug" title={earlierVal}>
																				{earlierVal}
																			</span>
																		</div>

																		<ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 self-center" />

																		{/* Later Visit Value */}
																		<div className="flex items-baseline gap-1.5 text-xs min-w-0 flex-wrap">
																			<span className={`text-xs font-bold uppercase tracking-wider shrink-0 ${laterVisitIndex === inspectorVisitIndex
																				? "text-primary font-extrabold"
																				: "text-muted-foreground/60"
																				}`}>
																				{laterVisitIndex === visits.length - 1 ? "Latest:" : `V${laterVisitIndex + 1}:`}
																			</span>
																			<span
																				className={`font-semibold break-words leading-snug ${laterEval.severity === "pathology"
																					? "text-[#dc3545]"
																					: laterEval.severity === "watch"
																						? "text-[#dc3545]"
																						: "text-foreground"
																					}`}
																				title={laterVal}
																			>
																				{laterVal}
																			</span>
																		</div>

																		{/* Changed Badge */}
																		{hasChanged && (
																			<span className="inline-flex items-center px-2 py-0.5 text-xs font-bold rounded uppercase tracking-wider bg-primary/10 text-primary border border-primary/30 shrink-0 self-center shadow-2xs">
																				Changed
																			</span>
																		)}
																	</>
																) : (
																	/* Single Visit Mode (no comparison active) */
																	<div className="flex items-baseline gap-1.5 text-xs min-w-0 flex-wrap">
																		<span
																			className={`font-semibold break-words leading-snug ${inspectedEval.severity === "pathology"
																				? "text-[#dc3545]"
																				: inspectedEval.severity === "watch"
																					? "text-[#dc3545]"
																					: "text-foreground"
																				}`}
																			title={inspectedVal}
																		>
																			{inspectedVal}
																		</span>
																	</div>
																)}
															</div>
														</div>
													);
												})}
											</div>
										</div>
									))}
								</div>
							</div>
						)}

						{/* LEFT EYE (LE) PANEL */}
						{progressionEye !== "RE" && (
							<div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
								<div className="px-3.5 py-2.5 bg-muted/40 border-b border-border/70 flex items-center justify-between">
									<div className="flex items-center gap-2">
										<span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
											<Circle className="w-2 h-2 fill-muted-foreground/60 text-muted-foreground/60" />
											Left Eye (LE) — {isComparing
												? `V${earlierVisitIndex + 1} ➔ V${laterVisitIndex + 1} Comparison`
												: `Visit ${inspectorVisitIndex + 1} Findings`}
										</span>
									</div>
									<span className={`text-xs font-bold whitespace-nowrap shrink-0 ${isComparing ? "text-muted-foreground" : "px-2.5 py-1 rounded-md bg-primary text-primary-foreground shadow-xs"}`}>
										{isComparing
											? `${earlierVisitIndex === 0 ? "Initial" : `V${earlierVisitIndex + 1}`} (${earlierVisit ? formatVisitDate(earlierVisit.d) : ""}) ➔ ${laterVisitIndex === visits.length - 1 ? "Latest" : `V${laterVisitIndex + 1}`} (${laterVisit ? formatVisitDate(laterVisit.d) : ""})`
											: `Visit ${inspectorVisitIndex + 1} (${inspectedVisit ? formatVisitDate(inspectedVisit.d) : ""})`}
									</span>
								</div>

								<div className="p-4 sm:p-5 space-y-5">
									{anatomicalLayers.map((cat, cIdx) => (
										<div key={cIdx} className="space-y-2">
											<div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider px-1 pb-1.5 border-b border-border/50">
												<span>{cat.category}</span>
												<span className="text-xs text-muted-foreground/70 font-normal">
													{isComparing
														? `${earlierVisitIndex === 0 ? "Initial" : `V${earlierVisitIndex + 1}`} ➔ ${laterVisitIndex === visits.length - 1 ? "Latest" : `V${laterVisitIndex + 1}`}`
														: `Visit ${inspectorVisitIndex + 1} Exam`}
												</span>
											</div>
											<div className="space-y-2">
												{cat.items.map((item: any) => {
													const struct = structuresAnalysis.dataByStructure[item.id];
													const timeline = struct?.timeline || [];

													const earlierEntry = isComparing && earlierVisitIndex !== null ? timeline[earlierVisitIndex] : null;
													const earlierVal = earlierEntry?.leVal || "—";
													const earlierEval = earlierEntry?.evalLe || evaluateFindingSeverity(earlierVal);

													const laterEntry = isComparing && laterVisitIndex !== null ? timeline[laterVisitIndex] : (timeline[inspectorVisitIndex] || timeline[timeline.length - 1]);
													const laterVal = laterEntry?.leVal || "—";
													const laterEval = laterEntry?.evalLe || evaluateFindingSeverity(laterVal);

													const inspectedEntry = timeline[inspectorVisitIndex] || timeline[timeline.length - 1];
													const inspectedVal = inspectedEntry?.leVal || "—";
													const inspectedEval = inspectedEntry?.evalLe || evaluateFindingSeverity(inspectedVal);

													const activeEval = isComparing
														? (laterEval.severity === "pathology" ? laterEval : earlierEval.severity === "pathology" ? earlierEval : laterEval)
														: inspectedEval;

													const hasChanged = isComparing && isMeaningfulChange(laterVal, earlierVal);

													return (
														<div
															key={item.id}
															className={`flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4 py-2.5 px-3.5 rounded-xl text-xs transition-colors border ${activeEval.severity === "pathology"
																? "bg-[#dc3545]/[0.06] border-[#dc3545]/40 shadow-2xs"
																: activeEval.severity === "watch"
																	? "bg-[#dc3545]/[0.06] border-[#dc3545]/40 shadow-2xs"
																	: "bg-card hover:bg-muted/40 border-border/80 shadow-2xs"
																}`}
														>
															{/* Structure Label with Severity Dot */}
															<div className="flex items-center gap-2 min-w-[150px] sm:w-[170px] lg:w-[190px] 2xl:w-[210px] shrink-0 pt-0.5">
																<span className={`w-2 h-2 rounded-full shrink-0 ${activeEval.severity === "pathology" || activeEval.severity === "watch" ? "bg-[#dc3545]" : activeEval.dotClass}`} />
																<span className="font-semibold text-foreground break-words leading-tight">{item.label}</span>
															</div>

															{/* Progression / Comparison Values */}
															<div className="flex flex-wrap items-center gap-x-2 gap-y-1 flex-1 min-w-0 justify-start">
																{isComparing ? (
																	<>
																		{/* Earlier Visit Value */}
																		<div className="flex items-baseline gap-1 text-xs text-muted-foreground min-w-0">
																			<span className={`text-xs font-bold uppercase tracking-wider shrink-0 ${earlierVisitIndex === inspectorVisitIndex
																				? "text-primary font-extrabold"
																				: "text-muted-foreground/60"
																				}`}>
																				{earlierVisitIndex === 0 ? "Initial:" : `V${earlierVisitIndex + 1}:`}
																			</span>
																			<span className="font-medium text-foreground/80 break-words leading-snug" title={earlierVal}>
																				{earlierVal}
																			</span>
																		</div>

																		<ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 self-center" />

																		{/* Later Visit Value */}
																		<div className="flex items-baseline gap-1.5 text-xs min-w-0 flex-wrap">
																			<span className={`text-xs font-bold uppercase tracking-wider shrink-0 ${laterVisitIndex === inspectorVisitIndex
																				? "text-primary font-extrabold"
																				: "text-muted-foreground/60"
																				}`}>
																				{laterVisitIndex === visits.length - 1 ? "Latest:" : `V${laterVisitIndex + 1}:`}
																			</span>
																			<span
																				className={`font-semibold break-words leading-snug ${laterEval.severity === "pathology"
																					? "text-[#dc3545]"
																					: laterEval.severity === "watch"
																						? "text-[#dc3545]"
																						: "text-foreground"
																					}`}
																				title={laterVal}
																			>
																				{laterVal}
																			</span>
																		</div>

																		{/* Changed Badge */}
																		{hasChanged && (
																			<span className="inline-flex items-center px-2 py-0.5 text-xs font-bold rounded uppercase tracking-wider bg-primary/10 text-primary border border-primary/30 shrink-0 self-center shadow-2xs">
																				Changed
																			</span>
																		)}
																	</>
																) : (
																	/* Single Visit Mode (no comparison active) */
																	<div className="flex items-baseline gap-1.5 text-xs min-w-0 flex-wrap">
																		<span
																			className={`font-semibold break-words leading-snug ${inspectedEval.severity === "pathology"
																				? "text-[#dc3545]"
																				: inspectedEval.severity === "watch"
																					? "text-[#dc3545]"
																					: "text-foreground"
																				}`}
																			title={inspectedVal}
																		>
																			{inspectedVal}
																		</span>
																	</div>
																)}
															</div>
														</div>
													);
												})}
											</div>
										</div>
									))}
								</div>
							</div>
						)}
					</div>


				</div>
			)}

			{/* ========================================================================= */}
			{/* MODE 3: PATHOLOGY & FINDINGS MATRIX (PROBLEM-ORIENTED TRIAGE)             */}
			{/* ========================================================================= */}
			{activeMode === "pathologyMatrix" && (
				<div className="p-3.5 space-y-3">
					<div className="text-xs text-muted-foreground">
						Problem-oriented clinical breakdown categorizing active pathologies, post-operative conditions, and normal structures.
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
						{/* 1. Active Pathologies */}
						<div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
							<div className="px-3.5 py-2.5 bg-muted/40 border-b border-border/70 flex items-center justify-between">
								<div className="flex items-center gap-1.5">
									<AlertTriangle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
									<span className="text-xs font-bold text-foreground">
										Active Pathologies ({pathologyOverview.activeAbnormalities.length})
									</span>
								</div>
							</div>
							<div className="p-2.5 space-y-2 max-h-[320px] overflow-y-auto box-scroll">
								{pathologyOverview.activeAbnormalities.length > 0 ? (
									pathologyOverview.activeAbnormalities.map((item, idx) => (
										<div key={idx} className="p-2.5 rounded-lg bg-card border border-border/80 space-y-1">
											<div className="flex items-center justify-between text-xs">
												<span className="font-bold text-foreground">{item.structure}</span>
												<Badge variant="outline" className="text-[10px] font-bold bg-muted/40 text-foreground border-border/80">
													{item.eye}
												</Badge>
											</div>
											<div className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 break-words leading-snug">
												{item.finding}
											</div>
										</div>
									))
								) : (
									<div className="text-xs text-muted-foreground italic p-3 text-center">
										No active acute pathologies recorded.
									</div>
								)}
							</div>
						</div>

						{/* 2. Monitored / Post-Op */}
						<div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
							<div className="px-3.5 py-2.5 bg-muted/40 border-b border-border/70 flex items-center justify-between">
								<div className="flex items-center gap-1.5">
									<Eye className="w-4 h-4 text-amber-600 dark:text-amber-400" />
									<span className="text-xs font-bold text-foreground">
										Monitored / Post-Op ({pathologyOverview.monitoredFindings.length})
									</span>
								</div>
							</div>
							<div className="p-2.5 space-y-2 max-h-[320px] overflow-y-auto box-scroll">
								{pathologyOverview.monitoredFindings.length > 0 ? (
									pathologyOverview.monitoredFindings.map((item, idx) => (
										<div key={idx} className="p-2.5 rounded-lg bg-card border border-border/80 space-y-1">
											<div className="flex items-center justify-between text-xs">
												<span className="font-bold text-foreground">{item.structure}</span>
												<Badge variant="outline" className="text-[10px] font-bold bg-muted/40 text-foreground border-border/80">
													{item.eye}
												</Badge>
											</div>
											<div className="text-xs font-bold text-amber-800 dark:text-amber-300 break-words leading-snug">
												{item.finding}
											</div>
										</div>
									))
								) : (
									<div className="text-xs text-muted-foreground italic p-3 text-center">
										No post-operative/monitored features recorded.
									</div>
								)}
							</div>
						</div>

						{/* 3. Normal / Quiet Structures */}
						<div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
							<div className="px-3.5 py-2.5 bg-muted/40 border-b border-border/70 flex items-center justify-between">
								<div className="flex items-center gap-1.5">
									<CheckCircle2 className="w-4 h-4 text-primary" />
									<span className="text-xs font-bold text-foreground">
										Unremarkable Structures ({pathologyOverview.normalStructures.length})
									</span>
								</div>
							</div>
							<div className="p-2.5 space-y-1.5 max-h-[320px] overflow-y-auto box-scroll">
								{pathologyOverview.normalStructures.length > 0 ? (
									pathologyOverview.normalStructures.map((item, idx) => (
										<div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs">
											<span className="text-foreground font-semibold">{item.structure}</span>
											<span className="text-[11px] text-muted-foreground font-semibold">
												Bilateral Normal
											</span>
										</div>
									))
								) : (
									<div className="text-xs text-muted-foreground italic p-3 text-center">
										All structures examined have findings.
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* ========================================================================= */}
			{/* MODE 4: LEGACY GANTT MODAL CARDS                                          */}
			{/* ========================================================================= */}
			{activeMode === "legacyGantt" && (
				<div className="p-3.5 space-y-3">
					<div className="text-xs text-muted-foreground">
						Legacy modal dialog cards containing chronological Gantt timeline graphs for each observation category.
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
						{computedData.diagnosisData.length > 0 && (
							<ObservationCard
								title="Diagnoses"
								summary={`${computedData.diagnosisData.length} records`}
								icon={Activity}
								badgeCount={computedData.diagnosisData.length}
							>
								<GanttChart
									data={computedData.diagnosisData}
									title="Diagnoses"
								/>
							</ObservationCard>
						)}

						{computedData.medicationsData.length > 0 && (
							<ObservationCard
								title="Medications"
								summary={`${computedData.medicationsData.length} records`}
								icon={Pill}
								badgeCount={computedData.medicationsData.length}
							>
								<GanttChart
									data={computedData.medicationsData}
									title="Medications"
								/>
							</ObservationCard>
						)}

						{computedData.lensData.length > 0 && (
							<ObservationCard
								title="Lens"
								summary={`${computedData.lensData.length} records`}
								icon={Eye}
								badgeCount={computedData.lensData.length}
							>
								<GanttChart data={computedData.lensData} title="Lens" />
							</ObservationCard>
						)}

						{computedData.maculaFovealReflexData.length > 0 && (
							<ObservationCard
								title="Macula / Foveal Reflex"
								summary={`${computedData.maculaFovealReflexData.length} records`}
								icon={ScanLine}
								badgeCount={computedData.maculaFovealReflexData.length}
							>
								<GanttChart data={computedData.maculaFovealReflexData} title="Macula Foveal Reflex" />
							</ObservationCard>
						)}

						{computedData.backgroundRetinaData.length > 0 && (
							<ObservationCard
								title="Background Retina"
								summary={`${computedData.backgroundRetinaData.length} records`}
								icon={Layers}
								badgeCount={computedData.backgroundRetinaData.length}
							>
								<GanttChart data={computedData.backgroundRetinaData} title="Background Retina" />
							</ObservationCard>
						)}

						{computedData.anteriorChamberData.length > 0 && (
							<ObservationCard
								title="Anterior Chamber"
								summary={`${computedData.anteriorChamberData.length} records`}
								icon={Eye}
								badgeCount={computedData.anteriorChamberData.length}
							>
								<GanttChart data={computedData.anteriorChamberData} title="Anterior Chamber" />
							</ObservationCard>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
