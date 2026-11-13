/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { loadPatientWithClinicalSummary } from "@/lib/services/patient-data.service";
import {
	PatientData,
	MetricConfig,
	PatientClinicalSummary,
} from "@/types/patient";
import { AppHeader } from "@/components/app-header";
import { VisitSummary } from "@/components/patient/visit-summary";
import { ClinicalMetricsView } from "@/components/charts/clinical-metrics-view";
import { ObservationsView } from "@/components/patient/observations-view";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import {
	getDiseases,
	getProcedures,
	getGanttData,
	getMedicationsGanttData,
	getLineChartData,
} from "@/lib/utils/data-processing";
import { resetProcedureColors } from "@/lib/utils/chart-utils";
import Link from "next/link";
import { ArrowLeft, Stethoscope, Activity, Circle, FileText } from "lucide-react";

export default function PatientDetailPage() {
	const params = useParams();
	const uid = params.uid as string;
	const [patientData, setPatientData] = useState<PatientData | null>(null);
	const [clinicalSummary, setClinicalSummary] =
		useState<PatientClinicalSummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

	useEffect(() => {
		const loadData = async () => {
			setLoading(true);
			resetProcedureColors();
			const result = await loadPatientWithClinicalSummary(uid);
			if (result) {
				setPatientData(result.patientData);
				setClinicalSummary(result.clinicalSummary);
			}
			setLoading(false);
		};

		loadData();
	}, [uid]);

	// Compute bilateral data for patient without requiring eye toggle
	const computedData = useMemo(() => {
		if (!patientData) return null;
		const mrno = patientData.p.mr;
		const diseases = getDiseases(patientData);

		// Combine procedures across both eyes
		const reProcedures = getProcedures(patientData, 0);
		const leProcedures = getProcedures(patientData, 1);
		const procedures = [
			...reProcedures.map((p) => ({ ...p, item: `RE: ${p.item}` })),
			...leProcedures.map((p) => ({ ...p, item: `LE: ${p.item}` })),
		];

		// Longitudinal chart data for RE, LE, and BE
		const reChartData = getLineChartData(patientData, 0);
		const leChartData = getLineChartData(patientData, 1);
		const beChartData = getLineChartData(patientData, 2);

		// Bilateral Gantt data (eyeIndex = 2 includes both eyes)
		const diagnosisData = getGanttData(patientData, "diagnosis", 2);
		const medicationsData = getMedicationsGanttData(patientData, 2);
		const lensData = getGanttData(patientData, "lens", 2);
		const backgroundRetinaData = getGanttData(
			patientData,
			"background_retina",
			2
		);
		const maculaFovealReflexData = getGanttData(
			patientData,
			"foveal_reflex",
			2
		);
		const conjunctivaData = getGanttData(patientData, "conjunctiva", 2);
		const mediaData = getGanttData(patientData, "media", 2);
		const anteriorChamberData = getGanttData(
			patientData,
			"anterior_chamber",
			2
		);
		const irisData = getGanttData(patientData, "iris", 2);
		const discData = getGanttData(patientData, "disc", 2);
		const pupilData = getGanttData(patientData, "pupil", 2);
		const vesselsData = getGanttData(patientData, "vessels", 2);
		const undilatedFundusData = getGanttData(
			patientData,
			"undilated_fundus",
			2
		);

		// Helper function to format summary text as bulleted list
		const formatSummaryText = (text: string) => {
			const lines = text
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line);

			const fullText = lines.join(" ");
			const sections: { heading: string; content: string }[] = [];
			const headingPattern = /(CURRENT STATUS|COURSE|DETAILS):\s*/g;

			let currentMatch;
			const matches: { heading: string; index: number }[] = [];

			while ((currentMatch = headingPattern.exec(fullText)) !== null) {
				matches.push({
					heading: currentMatch[1],
					index: currentMatch.index + currentMatch[0].length,
				});
			}

			matches.forEach((match, idx) => {
				const nextMatch = matches[idx + 1];
				const content = fullText
					.substring(
						match.index,
						nextMatch
							? fullText.lastIndexOf(nextMatch.heading)
							: fullText.length
					)
					.trim();

				sections.push({
					heading: match.heading,
					content: content,
				});
			});

			return (
				<ul className="list-disc pl-5 space-y-1.5">
					{sections.map((section, idx) => (
						<li key={idx} className="text-xs leading-relaxed text-slate-800 dark:text-slate-200">
							<strong className="text-foreground font-bold">{section.heading}:</strong>{" "}
							<span className="text-slate-800 dark:text-slate-200">{section.content}</span>
						</li>
					))}
				</ul>
			);
		};

		// Get all clinical summaries formatted together with bold labels
		const getAllClinicalSummaries = () => {
			if (!clinicalSummary) return null;

			const summaryElements = [];

			if (clinicalSummary.beSummary) {
				summaryElements.push(
					<div key="bilateral" className="space-y-1.5">
						<div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#1176bc]">
							<Circle className="w-2 h-2 fill-[#1176bc]" />
							Bilateral
						</div>
						<div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed pl-1">{clinicalSummary.beSummary}</div>
					</div>
				);
			}

			if (clinicalSummary.reSummary) {
				const formattedRE = formatSummaryText(clinicalSummary.reSummary);
				summaryElements.push(
					<div key="re" className="space-y-1.5">
						<div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
							<Circle className="w-2 h-2 fill-sky-500" />
							Right Eye (RE)
						</div>
						<div className="text-slate-800 dark:text-slate-200 pl-1">{formattedRE}</div>
					</div>
				);
			}

			if (clinicalSummary.leSummary) {
				const formattedLE = formatSummaryText(clinicalSummary.leSummary);
				summaryElements.push(
					<div key="le" className="space-y-1.5">
						<div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300">
							<Circle className="w-2 h-2 fill-purple-500" />
							Left Eye (LE)
						</div>
						<div className="text-slate-800 dark:text-slate-200 pl-1">{formattedLE}</div>
					</div>
				);
			}

			if (clinicalSummary.clinicalNote) {
				summaryElements.push(
					<div key="clinical-note" className="space-y-1.5">
						<div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
							<FileText className="w-3.5 h-3.5 text-[#1176bc]" />
							Clinical Note
						</div>
						<div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed pl-1">{clinicalSummary.clinicalNote}</div>
					</div>
				);
			}

			return summaryElements.length > 0 ? (
				<div className="space-y-4 divide-y divide-border/60">
					{summaryElements.map((el, i) => (
						<div key={i} className={i > 0 ? "pt-3" : ""}>{el}</div>
					))}
				</div>
			) : null;
		};

		const summary = getAllClinicalSummaries();

		const hasLineChartData =
			reChartData.visualAcuityData.length > 0 ||
			reChartData.iopData.length > 0 ||
			reChartData.cmtData.length > 0 ||
			leChartData.visualAcuityData.length > 0 ||
			leChartData.iopData.length > 0 ||
			leChartData.cmtData.length > 0;

		return {
			mrno,
			diseases,
			procedures,
			reChartData,
			leChartData,
			beChartData,
			diagnosisData,
			medicationsData,
			lensData,
			backgroundRetinaData,
			maculaFovealReflexData,
			conjunctivaData,
			mediaData,
			anteriorChamberData,
			irisData,
			discData,
			pupilData,
			vesselsData,
			undilatedFundusData,
			summary,
			hasLineChartData,
		};
	}, [patientData, clinicalSummary]);

	const lineChartMetrics: MetricConfig[] = [
		{
			name: "Dist : BCVA / Near : BCVA",
			color: "#1176bc",
			colorLight: "#2990d8",
			colorDark: "#60a5fa",
			min: -2.0,
			max: 1.6,
			step: 0.3,
			yAxisId: "y1",
		},
		{
			name: "IOP",
			color: "#0d9488",
			colorLight: "#14b8a6",
			colorDark: "#2dd4bf",
			min: 0,
			max: 20,
			step: 5,
			yAxisId: "y2",
		},
		{
			name: "CMT",
			color: "#4f46e5",
			colorLight: "#6366f1",
			colorDark: "#818cf8",
			min: 0,
			max: 1000,
			step: 250,
			yAxisId: "y3",
		},
	];

	if (loading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
					<p className="text-muted-foreground">Loading patient data...</p>
				</div>
			</div>
		);
	}

	if (!patientData || !computedData) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center">
					<h2 className="text-2xl font-bold mb-2">Patient Not Found</h2>
					<p className="text-muted-foreground mb-4">
						No data found for UID: {uid}
					</p>
					<Link
						href="/"
						className="inline-flex items-center gap-2 text-primary hover:underline"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to Patient List
					</Link>
				</div>
			</div>
		);
	}

	const getGlimpse = (data: any[]) => {
		if (!data || data.length === 0) return "No records";
		const uniqueTasks = Array.from(new Set(data.map((d: any) => d.task || d.name || ''))).filter(Boolean);
		if (uniqueTasks.length === 0) return `${data.length} records`;
		return uniqueTasks.slice(0, 3).join(', ') + (uniqueTasks.length > 3 ? '...' : '');
	};

	return (
		<div className="min-h-screen lg:h-screen w-full lg:overflow-hidden bg-background flex flex-col animate-in fade-in duration-700">
			{/* Top Header Bar */}
			<AppHeader
				showPatientInfo
				patientUID={uid}
				mrNo={computedData.mrno}
			/>

			{/* Mobile Summary Toggle (below header) */}
			<div className="lg:hidden flex items-center px-4 py-2 border-b bg-background shrink-0">
				<button
					onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold bg-background hover:bg-muted text-foreground transition-colors"
					title="Toggle Patient Summary"
				>
					<Stethoscope className="w-3.5 h-3.5 text-[#1176bc]" />
					<span>{mobileSidebarOpen ? "Hide Summary" : "Patient Summary"}</span>
				</button>
			</div>

			{/* Main Split-Screen Layout */}
			<div className="flex-1 min-h-0 flex flex-col lg:flex-row w-full lg:overflow-hidden">

				{/* LEFT SIDEBAR */}
				<aside className={`w-full lg:w-[280px] xl:w-[300px] 2xl:w-[320px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#cde1ef] dark:border-border bg-white dark:bg-card flex flex-col transition-all duration-200 ${
					mobileSidebarOpen ? "block max-h-[360px] lg:max-h-none h-auto lg:h-full" : "hidden lg:flex lg:h-full"
				}`}>
					{/* Sidebar header with left/right padding */}
					<div className="px-6 py-4 border-b border-[#cde1ef]/60 dark:border-border/60 flex items-center justify-between shrink-0">
						<div className="flex items-center gap-2 text-sm font-semibold text-foreground">
							<Stethoscope className="w-4 h-4 text-[#1176bc]" />
							<span>Patient Context</span>
						</div>
						<button
							onClick={() => setMobileSidebarOpen(false)}
							className="lg:hidden text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded border bg-muted/40"
						>
							Close
						</button>
					</div>

					{/* Sidebar content with generous left/right padding */}
					<div className="flex-1 overflow-y-auto box-scroll px-6 py-5 space-y-4">
						<div className="space-y-2.5">
							<p className="text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center gap-2">
								<FileText className="w-3.5 h-3.5 text-[#1176bc]" />
								Clinical Status &amp; Course
							</p>
							{computedData.summary ? (
								computedData.summary
							) : (
								<div className="text-xs text-muted-foreground px-3 py-2.5 rounded-lg border bg-muted/20">
									No clinical summary recorded.
								</div>
							)}
						</div>
					</div>
				</aside>

				{/* RIGHT MAIN WORKSPACE */}
				<main className="flex-1 min-h-0 overflow-y-auto box-scroll p-4 sm:p-5 lg:p-6 space-y-5 sm:space-y-6 w-full max-w-[3840px] mx-auto bg-[#dcebf5] dark:bg-background">

					{/* Clinical Metrics */}
					{computedData.hasLineChartData && (
						<div className="w-full">
							<ClinicalMetricsView
								reData={computedData.reChartData}
								leData={computedData.leChartData}
								beData={computedData.beChartData}
								metrics={lineChartMetrics}
								defaultMode="matrix"
							/>
						</div>
					)}

					{/* Observations Dashboard */}
					<ObservationsView
						patientData={patientData}
						computedData={computedData}
					/>
				</main>
			</div>
		</div>
	);
}
