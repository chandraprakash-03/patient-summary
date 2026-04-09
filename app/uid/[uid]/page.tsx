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
import { LineChart } from "@/components/charts/line-chart";
import { GanttChart } from "@/components/charts/gantt-chart";
import { Sidebar } from "@/components/sidebar";
import {
	getDiseases,
	getProcedures,
	getGanttData,
	getMedicationsGanttData,
	getLineChartData,
} from "@/lib/utils/data-processing";
import { resetProcedureColors } from "@/lib/utils/chart-utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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

	// Toggle states
	const [toggles, setToggles] = useState({
		showVA: true,
		showIOP: true,
		showCMT: true,
		showProcedures: true,
		showDiagnosis: true,
		showMedication: true,
		showLens: false,
		showBackgroundRetina: false,
		showMaculaFovealReflex: false,
		showConjunctiva: false,
		showMedia: false,
		showAnteriorChamber: false,
		showIris: false,
		showDisc: false,
		showPupil: false,
		showVessels: false,
		showUndilatedFundus: false,
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
			// Split by newlines and process each line
			const lines = text
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line);

			// Join all lines
			const fullText = lines.join(" ");

			// Extract sections based on headings
			const sections: { heading: string; content: string }[] = [];
			const headingPattern = /(CURRENT STATUS|COURSE|DETAILS):\s*/g;

			let currentMatch;
			const matches: { heading: string; index: number }[] = [];

			// Find all heading matches
			while ((currentMatch = headingPattern.exec(fullText)) !== null) {
				matches.push({
					heading: currentMatch[1],
					index: currentMatch.index + currentMatch[0].length,
				});
			}

			// Extract content for each section
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
			if (!clinicalSummary) return <span>No clinical summary available.</span>;

			const summaryElements = [];

			// Add Bilateral summary first
			if (clinicalSummary.beSummary) {
				summaryElements.push(
					<div key="bilateral" className="mb-4">
						<div className="font-bold mb-2">Bilateral</div>
						<div className="pl-2">{clinicalSummary.beSummary}</div>
					</div>
				);
			}

			// Add RE summary with formatted text
			if (clinicalSummary.reSummary) {
				const formattedRE = formatSummaryText(clinicalSummary.reSummary);
				summaryElements.push(
					<div key="re" className="mb-4">
						<div className="font-bold mb-2">RE</div>
						<div>{formattedRE}</div>
					</div>
				);
			}

			// Add LE summary with formatted text
			if (clinicalSummary.leSummary) {
				const formattedLE = formatSummaryText(clinicalSummary.leSummary);
				summaryElements.push(
					<div key="le" className="mb-4">
						<div className="font-bold mb-2">LE</div>
						<div>{formattedLE}</div>
					</div>
				);
			}

			return summaryElements.length > 0 ? (
				<div>{summaryElements}</div>
			) : (
				<span>No clinical summary available.</span>
			);
		};

		const summary = getAllClinicalSummaries();

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
		};
	}, [patientData, eyeIndex, clinicalSummary]);

	const handleToggleChange = (key: string, value: boolean) => {
		setToggles((prev) => ({ ...prev, [key]: value }));
	};

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

	return (
		<div className="h-screen w-full overflow-hidden bg-background flex flex-col">
			{/* Top Header Row */}
			<div className="flex items-center gap-3 px-4 py-3 border-b bg-header/20">
				<div className="flex items-center justify-center bg-muted rounded-md border-b px-4 py-2 font-medium">
					{uid}
				</div>
				<div className="flex items-center justify-center bg-muted rounded-md border-b px-4 py-2 font-medium">
					{computedData.mrno}
				</div>

				<div className="ml-auto flex gap-2">
					{(["RE", "LE", "BE"] as const).map((eye) => (
						<button
							key={eye}
							onClick={() => setSelectedEye(eye)}
							className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${selectedEye === eye
								? "bg-primary text-primary-foreground"
								: "bg-muted text-muted-foreground hover:bg-muted/80"
								}`}
						>
							{eye === "RE"
								? "Right Eye"
								: eye === "LE"
									? "Left Eye"
									: "Both Eyes"}
						</button>
					))}
				</div>

				<div className="flex items-center">
					<ThemeToggle />
				</div>
			</div>

			{/* Main Content Area */}
			<div className="flex gap-5 px-4 py-4 flex-1 min-h-0 overflow-hidden">
				{/* Left Section - Fixed width for summary and tables */}
				<div className="w-95 flex-shrink-0 flex flex-col gap-4 h-full overflow-hidden">
					{/* Patient Summary Box */}
					<div className="flex-[1_1_40%] min-h-[150px] bg-card rounded-lg border shadow-sm flex flex-col overflow-hidden">
						<div className="px-3 py-2.5 flex-shrink-0 text-md font-bold bg-header/20">Patient Summary</div>
						<div className="p-3 overflow-y-auto box-scroll flex-1 min-h-0 text-sm leading-relaxed">
							{computedData.summary}
						</div>
					</div>

					{/* Disease Box */}
					{computedData.diseases && computedData.diseases.length > 0 && (
						<div className="flex-[1_1_30%] min-h-[120px] bg-card rounded-lg border shadow-sm flex flex-col overflow-hidden">
							<div className="px-3 py-2.5 flex-shrink-0 text-md font-bold bg-header/20">Systemic History</div>
							<div className="p-3 overflow-y-auto box-scroll flex-1 min-h-0">
								<DiseaseList diseases={computedData.diseases} compact />
							</div>
						</div>
					)}

					{/* Procedures Box */}
					{computedData.procedures && computedData.procedures.length > 0 && (
						<div className="flex-[1_1_20%] min-h-[120px] bg-card rounded-lg border shadow-sm flex flex-col overflow-hidden">
							<div className="px-3 py-2.5 flex-shrink-0 text-md font-bold bg-header/20">Procedures</div>
							<div className="p-3 overflow-y-auto box-scroll flex-1 min-h-0">
								<ProcedureList procedures={computedData.procedures} compact />
							</div>
						</div>
					)}
				</div>

				{/* Right Section - Charts with scroll */}
				<div className="flex-1 overflow-y-auto overflow-x-hidden pr-2 space-y-2">
					{/* Line Chart */}
					{/* className="border rounded p-1.5" */}
					<div>
						<LineChart
							key={`linechart-${selectedEye}`}
							data={computedData.lineChartData}
							metrics={lineChartMetrics}
							showVA={toggles.showVA}
							showIOP={toggles.showIOP}
							showCMT={toggles.showCMT}
							showProcedures={toggles.showProcedures}
						/>
					</div>

					{/* Diagnosis Timeline */}
					{/* className="border rounded p-0.5" */}
					{toggles.showDiagnosis && computedData.diagnosisData.length > 0 && (
						<div>
							<GanttChart
								data={computedData.diagnosisData}
								title="Diagnoses"
								barColorLight="#f4a462"
								barColorDark="#e23670"
							/>
						</div>
					)}

					{/* Medications Timeline */}
					{/* className="border rounded p-0.5" */}
					{toggles.showMedication &&
						computedData.medicationsData.length > 0 && (
							<div>
								<GanttChart
									data={computedData.medicationsData}
									title="Medications"
									barColorLight="#e8c468"
									barColorDark="#af57db"
								/>
							</div>
						)}

					{/* Lens Observations */}
					{/* className="border rounded p-0.5" */}
					{toggles.showLens && computedData.lensData.length > 0 && (
						<div>
							<GanttChart data={computedData.lensData} title="Lens" />
						</div>
					)}

					{/* Background Retina */}
					{/* className="border rounded p-0.5" */}
					{toggles.showBackgroundRetina &&
						computedData.backgroundRetinaData.length > 0 && (
							<div>
								<GanttChart
									data={computedData.backgroundRetinaData}
									title="Background Retina"
								/>
							</div>
						)}

					{/* Macula Foveal Reflex */}
					{/* className="border rounded p-0.5" */}
					{toggles.showMaculaFovealReflex &&
						computedData.maculaFovealReflexData.length > 0 && (
							<div>
								<GanttChart
									data={computedData.maculaFovealReflexData}
									title="Macula Foveal Reflex"
								/>
							</div>
						)}

					{/* Conjunctiva */}
					{/* className="border rounded p-0.5" */}
					{toggles.showConjunctiva &&
						computedData.conjunctivaData.length > 0 && (
							<div>
								<GanttChart
									data={computedData.conjunctivaData}
									title="Conjunctiva"
								/>
							</div>
						)}

					{/* Media */}
					{/* className="border rounded p-0.5" */}
					{toggles.showMedia && computedData.mediaData.length > 0 && (
						<div>
							<GanttChart data={computedData.mediaData} title="Media" />
						</div>
					)}

					{/* Anterior Chamber */}
					{/* className="border rounded p-0.5" */}
					{toggles.showAnteriorChamber &&
						computedData.anteriorChamberData.length > 0 && (
							<div>
								<GanttChart
									data={computedData.anteriorChamberData}
									title="Anterior Chamber"
								/>
							</div>
						)}

					{/* Iris */}
					{/* className="border rounded p-0.5" */}
					{toggles.showIris && computedData.irisData.length > 0 && (
						<div>
							<GanttChart data={computedData.irisData} title="Iris" />
						</div>
					)}

					{/* Disc */}
					{/* className="border rounded p-0.5" */}
					{toggles.showDisc && computedData.discData.length > 0 && (
						<div>
							<GanttChart data={computedData.discData} title="Disc" />
						</div>
					)}

					{/* Pupil */}
					{/* className="border rounded p-0.5" */}
					{toggles.showPupil && computedData.pupilData.length > 0 && (
						<div>
							<GanttChart data={computedData.pupilData} title="Pupil" />
						</div>
					)}

					{/* Vessels */}
					{/* className="border rounded p-0.5" */}
					{toggles.showVessels && computedData.vesselsData.length > 0 && (
						<div>
							<GanttChart data={computedData.vesselsData} title="Vessels" />
						</div>
					)}

					{/* Undilated Fundus */}
					{/* className="border rounded p-0.5" */}
					{toggles.showUndilatedFundus &&
						computedData.undilatedFundusData.length > 0 && (
							<div>
								<GanttChart
									data={computedData.undilatedFundusData}
									title="Undilated Fundus"
								/>
							</div>
						)}
				</div>
			</div>

			{/* Floating Sidebar */}
			<Sidebar toggles={toggles} onToggleChange={handleToggleChange} />
		</div>
	);
}
