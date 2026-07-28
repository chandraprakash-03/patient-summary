"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { loadPatientWithClinicalSummary } from "@/lib/services/patient-data.service";
import {
	PatientData,
	MetricConfig,
	PatientClinicalSummary,
} from "@/types/patient";
import { ThemeToggle } from "@/components/theme-toggle";
import { DiseaseList } from "@/components/patient/disease-list";
import { ProcedureList } from "@/components/patient/procedure-list";
import { VisitSummary } from "@/components/patient/visit-summary";
import { LineChart } from "@/components/charts/line-chart";
import { GanttChart } from "@/components/charts/gantt-chart";
import { ObservationCard } from "@/components/patient/observation-card";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, Stethoscope, Pill, Eye, Layers, Activity, ScanLine, Droplets, Circle, Maximize, FileText } from "lucide-react";

export default function PatientDetailPage() {
	const params = useParams();
	const searchParams = useSearchParams();
	const uid = params.uid as string;
	const [patientData, setPatientData] = useState<PatientData | null>(null);
	const [clinicalSummary, setClinicalSummary] =
		useState<PatientClinicalSummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [selectedEye, setSelectedEye] = useState<"RE" | "LE" | "BE">(() => {
		const eye = searchParams.get("eye");
		if (eye === "LE" || eye === "BE") return eye;
		return "RE";
	});

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

	// Calculate eye index
	const eyeIndex = selectedEye === "RE" ? 0 : selectedEye === "LE" ? 1 : 2;

	// Compute data based on patient and selected eye
	const computedData = useMemo(() => {
		if (!patientData) return null;
		const mrno = patientData.p.mr;
		const diseases = getDiseases(patientData);
		const procedures = getProcedures(patientData, eyeIndex);
		const diagnosisData = getGanttData(patientData, "diagnosis", eyeIndex);
		const medicationsData = getMedicationsGanttData(patientData, eyeIndex);
		const lensData = getGanttData(patientData, "lens", eyeIndex);
		const backgroundRetinaData = getGanttData(
			patientData,
			"background_retina",
			eyeIndex
		);
		const maculaFovealReflexData = getGanttData(
			patientData,
			"foveal_reflex",
			eyeIndex
		);
		const conjunctivaData = getGanttData(patientData, "conjunctiva", eyeIndex);
		const mediaData = getGanttData(patientData, "media", eyeIndex);
		const anteriorChamberData = getGanttData(
			patientData,
			"anterior_chamber",
			eyeIndex
		);
		const irisData = getGanttData(patientData, "iris", eyeIndex);
		const discData = getGanttData(patientData, "disc", eyeIndex);
		const pupilData = getGanttData(patientData, "pupil", eyeIndex);
		const vesselsData = getGanttData(patientData, "vessels", eyeIndex);
		const undilatedFundusData = getGanttData(
			patientData,
			"undilated_fundus",
			eyeIndex
		);
		const lineChartData = getLineChartData(patientData, eyeIndex);

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
				<ul className="list-disc pl-5 space-y-2">
					{sections.map((section, idx) => (
						<li key={idx}>
							<strong>{section.heading}:</strong> {section.content}
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
					<div key="bilateral" className="mb-4">
						<div className="font-bold mb-2 text-foreground">Bilateral</div>
						<div className="pl-2">{clinicalSummary.beSummary}</div>
					</div>
				);
			}

			if (clinicalSummary.reSummary) {
				const formattedRE = formatSummaryText(clinicalSummary.reSummary);
				summaryElements.push(
					<div key="re" className="mb-4">
						<div className="font-bold mb-2 text-foreground">RE</div>
						<div>{formattedRE}</div>
					</div>
				);
			}

			if (clinicalSummary.leSummary) {
				const formattedLE = formatSummaryText(clinicalSummary.leSummary);
				summaryElements.push(
					<div key="le" className="mb-4">
						<div className="font-bold mb-2 text-foreground">LE</div>
						<div>{formattedLE}</div>
					</div>
				);
			}

			if (clinicalSummary.clinicalNote) {
				summaryElements.push(
					<div key="clinical-note" className="mb-4">
						<div className="font-bold mb-2 text-foreground">Clinical Note</div>
						<div className="pl-2">{clinicalSummary.clinicalNote}</div>
					</div>
				);
			}

			return summaryElements.length > 0 ? (
				<div>{summaryElements}</div>
			) : null;
		};

		const summary = getAllClinicalSummaries();

		const hasLineChartData =
			lineChartData.visualAcuityData.length > 0 ||
			lineChartData.iopData.length > 0 ||
			lineChartData.cmtData.length > 0 ||
			lineChartData.procedures.length > 0;

		return {
			mrno,
			diseases,
			procedures,
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
			lineChartData,
			summary,
			hasLineChartData,
		};
	}, [patientData, eyeIndex, clinicalSummary]);

	const lineChartMetrics: MetricConfig[] = [
		{
			name: "Dist : BCVA / Near : BCVA",
			color: "#4a9eff",
			colorLight: "#e76e50",
			colorDark: "#6bb6ff",
			min: -2.0,
			max: 1.6,
			step: 0.3,
			yAxisId: "y1",
		},
		{
			name: "IOP",
			color: "#4ade80",
			colorLight: "#2a9d90",
			colorDark: "#5fea9a",
			min: 0,
			max: 20,
			step: 5,
			yAxisId: "y2",
		},
		{
			name: "CMT",
			color: "#f472b6",
			colorLight: "#f4a462",
			colorDark: "#f78bc9",
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
		<>
			<div className="h-screen w-full overflow-hidden bg-background flex flex-col animate-in fade-in duration-700">
				{/* Sticky Top Header Row with Glassmorphism */}
				<div className="flex items-center gap-3 px-4 py-3 border-b bg-background/80 backdrop-blur-md shadow-sm sticky top-0 z-10 shrink-0">
					<div className="flex items-center justify-center bg-muted/50 rounded-md border px-4 py-2 font-medium shrink-0 shadow-inner">
						{uid}
					</div>
					<div className="flex items-center justify-center bg-muted rounded-md border px-4 py-2 font-medium shrink-0 text-muted-foreground">
						MR: {computedData.mrno}
					</div>

					<div className="ml-auto flex items-center shrink-0 mr-2 gap-2">
						<Sheet>
							<SheetTrigger asChild>
								<button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-semibold transition-colors shadow-sm">
									<FileText className="w-4 h-4" />
									<span className="hidden md:inline">Patient Context</span>
								</button>
							</SheetTrigger>
							<SheetContent side="right" className="w-[400px] sm:w-[540px] border-l sm:max-w-none p-0 flex flex-col shadow-2xl">
								<div className="p-6 border-b bg-muted/10 shrink-0">
									<SheetHeader>
										<SheetTitle className="text-2xl flex items-center gap-2">
											<FileText className="w-6 h-6 text-primary" />
											Patient Context
										</SheetTitle>
										<SheetDescription>
											Detailed clinical summary.
										</SheetDescription>
									</SheetHeader>
								</div>
								<div className="p-6 flex-1 overflow-y-auto box-scroll space-y-8">
									<div className="space-y-3">
										<h3 className="font-semibold text-lg flex items-center gap-2 text-foreground">
											<Stethoscope className="w-5 h-5 text-primary" />
											Clinical Summary
										</h3>
										<div className="text-sm leading-relaxed text-muted-foreground bg-card p-5 rounded-xl border shadow-sm">
											{computedData.summary || "No clinical summary available."}
										</div>
									</div>
								</div>
							</SheetContent>
						</Sheet>

						<Sheet>
							<SheetTrigger asChild>
								<button className="flex items-center gap-2 px-4 py-2 bg-background border hover:bg-muted rounded-md text-sm font-semibold transition-colors shadow-sm">
									<Activity className="w-4 h-4" />
									<span className="hidden md:inline">Visit & History</span>
								</button>
							</SheetTrigger>
							<SheetContent side="right" className="w-[400px] sm:w-[540px] border-l sm:max-w-none p-0 flex flex-col shadow-2xl">
								<div className="p-6 border-b bg-muted/10 shrink-0">
									<SheetHeader>
										<SheetTitle className="text-2xl flex items-center gap-2">
											<Activity className="w-6 h-6 text-primary" />
											Visit & History
										</SheetTitle>
										<SheetDescription>
											Visit summary, systemic history, and procedures.
										</SheetDescription>
									</SheetHeader>
								</div>
								<div className="p-6 flex-1 overflow-y-auto box-scroll space-y-8">
									<VisitSummary patientData={patientData} />
									{computedData.diseases && computedData.diseases.length > 0 && (
										<div className="space-y-3">
											<h3 className="font-semibold text-lg flex items-center gap-2 text-foreground">
												<Activity className="w-5 h-5 text-primary" />
												Systemic History
											</h3>
											<div className="bg-card rounded-xl border shadow-sm p-4">
												<DiseaseList diseases={computedData.diseases} compact />
											</div>
										</div>
									)}
									<div className="space-y-3 pb-8">
										<h3 className="font-semibold text-lg flex items-center gap-2 text-foreground">
											<Layers className="w-5 h-5 text-primary" />
											Procedures
										</h3>
										<div className="bg-card p-5 rounded-xl border shadow-sm">
											{computedData.procedures && computedData.procedures.length > 0 ? (
												<ProcedureList procedures={computedData.procedures} compact />
											) : (
												<div className="text-sm text-muted-foreground text-center py-4">No procedures recorded.</div>
											)}
										</div>
									</div>
								</div>
							</SheetContent>
						</Sheet>
					</div>

					<div className="flex shrink-0 bg-muted/50 p-1 rounded-full shadow-inner border border-border/50">
						{(["RE", "LE", "BE"] as const).map((eye) => (
							<button
								key={eye}
								onClick={() => setSelectedEye(eye)}
								className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all duration-300 ${selectedEye === eye
									? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
									: "text-muted-foreground hover:text-foreground hover:bg-background/50"
									}`}
							>
								{eye === "RE" ? "Right Eye" : eye === "LE" ? "Left Eye" : "Both Eyes"}
							</button>
						))}
					</div>

					<div className="flex items-center shrink-0 ml-2">
						<ThemeToggle />
					</div>
				</div>



				{/* Main Full-Width Content Area */}
				<div className="flex-1 min-h-0 overflow-y-auto w-full">
					<div className="w-full px-4 py-6 space-y-6">

						{/* Line Chart Section - Always visible if data exists */}
						{computedData.hasLineChartData && (
							<div className="bg-card rounded-xl border shadow-sm overflow-hidden mb-6">
								<div className="p-6">
									<LineChart
										key={`linechart-${selectedEye}`}
										data={computedData.lineChartData}
										metrics={lineChartMetrics}
										showVA={true}
										showIOP={true}
										showCMT={true}
										showProcedures={true}
									/>
								</div>
							</div>
						)}

						<div className="mb-4 mt-10 animate-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both">
							<h3 className="text-2xl font-bold tracking-tight flex items-center gap-2">
								<span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
									Observations Dashboard
								</span>
							</h3>
							{/* <p className="text-sm text-muted-foreground mt-1.5">Click on any card to open a full-screen detailed timeline view.</p> */}
						</div>

						{/* Observations Grid */}
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-10 animate-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">

							{/* Diagnosis Timeline */}
							{computedData.diagnosisData.length > 0 && (
								<ObservationCard
									title="Diagnoses"
									summary={getGlimpse(computedData.diagnosisData)}
									icon={Activity}
									badgeCount={computedData.diagnosisData.length}
								>
									<GanttChart
										data={computedData.diagnosisData}
										title="Diagnoses"
										barColorLight="#f4a462"
										barColorDark="#e23670"
									/>
								</ObservationCard>
							)}

							{/* Medications Timeline */}
							{computedData.medicationsData.length > 0 && (
								<ObservationCard
									title="Medications"
									summary={getGlimpse(computedData.medicationsData)}
									icon={Pill}
									badgeCount={computedData.medicationsData.length}
								>
									<GanttChart
										data={computedData.medicationsData}
										title="Medications"
										barColorLight="#e8c468"
										barColorDark="#af57db"
									/>
								</ObservationCard>
							)}

							{/* Lens Observations */}
							{computedData.lensData.length > 0 && (
								<ObservationCard
									title="Lens"
									summary={getGlimpse(computedData.lensData)}
									icon={Eye}
									badgeCount={computedData.lensData.length}
								>
									<GanttChart data={computedData.lensData} title="Lens" />
								</ObservationCard>
							)}

							{/* Background Retina */}
							{computedData.backgroundRetinaData.length > 0 && (
								<ObservationCard
									title="Background Retina"
									summary={getGlimpse(computedData.backgroundRetinaData)}
									icon={Layers}
									badgeCount={computedData.backgroundRetinaData.length}
								>
									<GanttChart
										data={computedData.backgroundRetinaData}
										title="Background Retina"
									/>
								</ObservationCard>
							)}

							{/* Macula Foveal Reflex */}
							{computedData.maculaFovealReflexData.length > 0 && (
								<ObservationCard
									title="Macula Foveal Reflex"
									summary={getGlimpse(computedData.maculaFovealReflexData)}
									icon={ScanLine}
									badgeCount={computedData.maculaFovealReflexData.length}
								>
									<GanttChart
										data={computedData.maculaFovealReflexData}
										title="Macula Foveal Reflex"
									/>
								</ObservationCard>
							)}

							{/* Conjunctiva */}
							{computedData.conjunctivaData.length > 0 && (
								<ObservationCard
									title="Conjunctiva"
									summary={getGlimpse(computedData.conjunctivaData)}
									icon={Activity}
									badgeCount={computedData.conjunctivaData.length}
								>
									<GanttChart
										data={computedData.conjunctivaData}
										title="Conjunctiva"
									/>
								</ObservationCard>
							)}

							{/* Media */}
							{computedData.mediaData.length > 0 && (
								<ObservationCard
									title="Media"
									summary={getGlimpse(computedData.mediaData)}
									icon={Droplets}
									badgeCount={computedData.mediaData.length}
								>
									<GanttChart data={computedData.mediaData} title="Media" />
								</ObservationCard>
							)}

							{/* Anterior Chamber */}
							{computedData.anteriorChamberData.length > 0 && (
								<ObservationCard
									title="Anterior Chamber"
									summary={getGlimpse(computedData.anteriorChamberData)}
									icon={Maximize}
									badgeCount={computedData.anteriorChamberData.length}
								>
									<GanttChart
										data={computedData.anteriorChamberData}
										title="Anterior Chamber"
									/>
								</ObservationCard>
							)}

							{/* Iris */}
							{computedData.irisData.length > 0 && (
								<ObservationCard
									title="Iris"
									summary={getGlimpse(computedData.irisData)}
									icon={Circle}
									badgeCount={computedData.irisData.length}
								>
									<GanttChart data={computedData.irisData} title="Iris" />
								</ObservationCard>
							)}

							{/* Disc */}
							{computedData.discData.length > 0 && (
								<ObservationCard
									title="Disc"
									summary={getGlimpse(computedData.discData)}
									icon={Circle}
									badgeCount={computedData.discData.length}
								>
									<GanttChart data={computedData.discData} title="Disc" />
								</ObservationCard>
							)}

							{/* Pupil */}
							{computedData.pupilData.length > 0 && (
								<ObservationCard
									title="Pupil"
									summary={getGlimpse(computedData.pupilData)}
									icon={Circle}
									badgeCount={computedData.pupilData.length}
								>
									<GanttChart data={computedData.pupilData} title="Pupil" />
								</ObservationCard>
							)}

							{/* Vessels */}
							{computedData.vesselsData.length > 0 && (
								<ObservationCard
									title="Vessels"
									summary={getGlimpse(computedData.vesselsData)}
									icon={Activity}
									badgeCount={computedData.vesselsData.length}
								>
									<GanttChart data={computedData.vesselsData} title="Vessels" />
								</ObservationCard>
							)}

							{/* Undilated Fundus */}
							{computedData.undilatedFundusData.length > 0 && (
								<ObservationCard
									title="Undilated Fundus"
									summary={getGlimpse(computedData.undilatedFundusData)}
									icon={Eye}
									badgeCount={computedData.undilatedFundusData.length}
								>
									<GanttChart
										data={computedData.undilatedFundusData}
										title="Undilated Fundus"
									/>
								</ObservationCard>
							)}

						</div>
					</div>
				</div>
			</div>
		</>
	);
}
