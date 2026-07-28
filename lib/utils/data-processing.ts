/* eslint-disable @typescript-eslint/no-explicit-any */
import {
	PatientData,
	ChartData,
	ProcedureData,
	VADataPoint,
	TimeDataPoint,
	GanttData,
	Disease,
	ProcedureItem,
	Medication,
} from "@/types/patient";
import { decompressVision, convertVAToNumeric } from "./vision-utils";

import {
	extractCMTFromText,
	normalizeConditionName,
	isProcedurePlaceholder,
	flattenProcedureArray,
	getProcedureColor,
	classifyProcedureType
} from "./chart-utils";
import { formatDate } from "./date-utils";

/**
 * Validate if a spherical value is valid for display
 */
function isValidSphericalValue(value: string): boolean {
	if (!value || typeof value !== "string") return false;

	const trimmed = value.trim();

	// Check for empty or invalid characters
	if (
		trimmed === "" ||
		trimmed === ";" ||
		trimmed === ";;" ||
		trimmed === "-"
	) {
		return false;
	}

	// Check if it contains only semicolons or whitespace
	if (/^[;\s]*$/.test(trimmed)) {
		return false;
	}

	// Check if it's a valid spherical value pattern
	// Valid patterns: +2.5, -1.25, 0.00, +3.00, etc.
	const sphericalPattern = /^[+-]?\d+(\.\d{1,2})?$/;

	// If it matches the pattern, it's valid
	if (sphericalPattern.test(trimmed)) {
		return true;
	}

	// For other formats that might be valid but don't match the strict pattern
	// Allow if it contains numbers and basic spherical notation
	if (/\d/.test(trimmed) && !/[^0-9+\-.\s]/.test(trimmed)) {
		return true;
	}

	return false;
}


/**
 * Parse duration strings like "22 years 5 months" into approximate days for comparison
 */
function parseDurationToDays(duration: string): number {
	if (!duration) return 0;
	const years = parseInt(duration.match(/(\d+)\s*year/i)?.[1] || "0");
	const months = parseInt(duration.match(/(\d+)\s*month/i)?.[1] || "0");
	const weeks = parseInt(duration.match(/(\d+)\s*week/i)?.[1] || "0");
	const days = parseInt(duration.match(/(\d+)\s*day/i)?.[1] || "0");
	return years * 365 + months * 30 + weeks * 7 + days;
}

export function getDiseases(patientData: PatientData): Disease[] {
	const diseasesMap = new Map<string, string>();

	const ignoreList = [
		"remarks",
		"remark",
		"identification marks",
		"identification mark",
		"id marks",
		"id mark",
		"others",
	];

	// Sort visits by date (oldest first)
	const sortedVisits = [...(patientData.visits || [])].sort((a, b) =>
		a.d.localeCompare(b.d)
	);

	sortedVisits.forEach((visit) => {
		if (visit.s && visit.s.h) {
			const diseases = visit.s.h
				.split(";")
				.map((d) => d.trim())
				.filter((d) => d !== "");

			const durations = visit.s.d
				? visit.s.d.split(";").map((d) => d.trim())
				: [];

			diseases.forEach((disease, index) => {
				const trimmed = disease.trim();
				if (
					trimmed &&
					!ignoreList.includes(trimmed.toLowerCase())
				) {
					const duration = durations[index] || "";
					const existing = diseasesMap.get(trimmed);

					if (duration) {
						if (!existing) {
							diseasesMap.set(trimmed, duration);
						} else {
							// Prioritize the longest duration found. 
							// In systemic history, time usually only increases.
							// This prevents newer but potentially incomplete/incorrect relative data from overwriting correct history.
							const dExisting = parseDurationToDays(existing);
							const dNew = parseDurationToDays(duration);

							if (dNew >= dExisting) {
								diseasesMap.set(trimmed, duration);
							}
						}
					} else if (!existing) {
						// Set empty if nothing exists yet
						diseasesMap.set(trimmed, "");
					}
				}
			});
		}
	});

	const result = Array.from(diseasesMap.entries()).map(([name, duration]) => ({
		name,
		date: duration,
	}));

	return result;
}





/**
 * Check if procedure data uses the new format (Las/inj/surg)
 */
function isNewProcedureFormat(pr: any): boolean {
	return (
		pr &&
		(pr.Las !== undefined || pr.inj !== undefined || pr.surg !== undefined)
	);
}

/**
 * Extract procedures from new format (Las/inj/surg)
 * @param eyeIndex 0 for RE, 1 for LE, 2 for BE
 */
function getProceduresFromNewFormat(
	patientData: PatientData,
	eyeIndex: number
): ProcedureItem[] {
	const procMap = new Map<string, { count: number; type: string }>();

	// Helper function to process procedures for a specific eye index
	const processEyeProcedures = (pr: any, targetEyeIndex: number) => {
		// Process Lasers
		if (pr.Las && Array.isArray(pr.Las)) {
			const laserProcs = pr.Las[targetEyeIndex];

			if (Array.isArray(laserProcs) && laserProcs.length > 0) {
				laserProcs.forEach((proc: any) => {
					if (proc && proc.procedure_type) {
						const name = proc.laser_type
							? `${proc.procedure_type} - ${proc.laser_type}`
							: proc.procedure_type;
						const existing = procMap.get(name) || { count: 0, type: "Laser" };
						procMap.set(name, { count: existing.count + 1, type: "Laser" });
					}
				});
			}
		}

		// Process Injections
		if (pr.inj && Array.isArray(pr.inj)) {
			const injProcs = pr.inj[targetEyeIndex];

			if (Array.isArray(injProcs) && injProcs.length > 0) {
				injProcs.forEach((proc: any) => {
					// For injections, we need to create a meaningful name from the available data
					if (proc && (proc.Injection_name || proc.procedure_type)) {
						const name =
							proc.Injection_name || proc.procedure_type || "Injection";
						const existing = procMap.get(name) || {
							count: 0,
							type: "Injection",
						};
						procMap.set(name, {
							count: existing.count + 1,
							type: "Injection",
						});
					}
				});
			}
		}

		// Process Surgeries
		if (pr.surg && Array.isArray(pr.surg)) {
			const surgProcs = pr.surg[targetEyeIndex];

			if (Array.isArray(surgProcs) && surgProcs.length > 0) {
				surgProcs.forEach((proc: any) => {
					const surgName = proc.surgery_name || proc.procedure_type;
					if (proc && surgName) {
						const existing = procMap.get(surgName) || {
							count: 0,
							type: "Surgery",
						};
						procMap.set(surgName, {
							count: existing.count + 1,
							type: "Surgery",
						});
					}
				});
			}
		}
	};

	(patientData.visits || []).forEach((visit) => {
		if (visit.pr && isNewProcedureFormat(visit.pr)) {
			processEyeProcedures(visit.pr, eyeIndex);
		}
	});

	const result = Array.from(procMap.entries()).map(
		([name, { count, type }]) => {
			return { type, item: `${name}${count > 1 ? ` (${count}x)` : ""}` };
		}
	);

	return result;
}

function getProceduresFromNewFormatForChart(
	patientData: PatientData,
	eyeIndex: number
): ProcedureData[] {
	const procedures: ProcedureData[] = [];

	(patientData.visits || []).forEach((visit) => {
		const date = visit.d;
		if (!date || !visit.pr || !isNewProcedureFormat(visit.pr)) return;

		const pr = visit.pr as any;

		// Process Lasers
		if (pr.Las && Array.isArray(pr.Las)) {
			const laserProcs = pr.Las[eyeIndex];
			if (Array.isArray(laserProcs) && laserProcs.length > 0) {
				laserProcs.forEach((proc: any) => {
					if (proc && proc.procedure_type) {
						const name = proc.laser_type
							? `${proc.procedure_type} - ${proc.laser_type}`
							: proc.procedure_type;
						const color = getProcedureColor(name);
						procedures.push({ date, type: "laser", name, color });
					}
				});
			}
		}

		// Process Injections
		if (pr.inj && Array.isArray(pr.inj)) {
			const injProcs = pr.inj[eyeIndex];
			if (Array.isArray(injProcs) && injProcs.length > 0) {
				injProcs.forEach((proc: any) => {
					if (proc && (proc.Injection_name || proc.procedure_type)) {
						const name =
							proc.Injection_name || proc.procedure_type || "Injection";
						const color = getProcedureColor(name);
						procedures.push({
							date,
							type: "injection",
							name,
							color,
						});
					}
				});
			}
		}

		// Process Surgeries
		if (pr.surg && Array.isArray(pr.surg)) {
			const surgProcs = pr.surg[eyeIndex];
			if (Array.isArray(surgProcs) && surgProcs.length > 0) {
				surgProcs.forEach((proc: any) => {
					const surgName = proc.surgery_name || proc.procedure_type;
					if (proc && surgName) {
						const color = getProcedureColor(surgName);
						procedures.push({
							date,
							type: "surgery",
							name: surgName,
							color,
						});
					}
				});
			}
		}
	});

	return procedures;
}
/**
 * Extract procedures from pr.act (actual procedures) or new format (Las/inj/surg)
 * @param eyeIndex 0 for RE, 1 for LE, 2 for BE
 */
export function getProcedures(
	patientData: PatientData,
	eyeIndex: number
): ProcedureItem[] {
	return getProceduresFromNewFormat(patientData, eyeIndex);
}

/**
 * Get SVG icon and color for a procedure
 */
export function getSvgForProcedure(procedureItem: string): {
	svg: string;
	color: string;
} {
	const name = procedureItem.replace(/\s*\(\d+x\)$/, "");

	let type = classifyProcedureType(name);

	let svg: string;
	switch (type) {
		case "Injection":
			svg = "injection";
			break;
		case "Laser":
			svg = "laser";
			break;
		case "Surgery":
			svg = "surgery";
			break;
		default:
			svg = "procedure";
			break;
	}

	return {
		svg,
		color: getProcedureColor(name),
	};
}

/**
 * Build gantt data from visit observations
 */
export function getGanttData(
	patientData: PatientData,
	section: string,
	eyeIndex: number
): GanttData[] {
	const sectionFieldMap: {
		[key: string]: { parent: string; field: string };
	} = {
		diagnosis: { parent: "diag", field: "" },
		background_retina: { parent: "fu", field: "br" },
		foveal_reflex: { parent: "fu", field: "mf" },
		conjunctiva: { parent: "at", field: "cj" },
		media: { parent: "fu", field: "me" },
		anterior_chamber: { parent: "at", field: "ac" },
		iris: { parent: "at", field: "ir" },
		disc: { parent: "fu", field: "di" },
		pupil: { parent: "at", field: "pu" },
		vessels: { parent: "fu", field: "ve" },
		undilated_fundus: { parent: "fu", field: "rem" },
		lens: { parent: "at", field: "lens" },
	};

	const mapping = sectionFieldMap[section];
	if (!mapping) {
		console.warn(`No field mapping found for section: ${section}`);
		return [];
	}

	// Special handling for diagnosis
	if (section === "diagnosis") {
		return getDiagnosisGanttData(patientData, eyeIndex);
	}

	const conditionMap = new Map<string, { start: string; end: string }>();
	let currentCondition: string | null = null;
	let conditionStart: string | null = null;

	const sortedVisits = [...(patientData.visits || [])].sort((a, b) =>
		a.d.localeCompare(b.d)
	);

	sortedVisits.forEach((visit, index) => {
		const visitDate = visit.d;
		const parentObj = (visit as any)[mapping.parent];

		if (!parentObj) return;

		let value: any = parentObj[mapping.field];

		if (Array.isArray(value)) {
			value = value[eyeIndex] || value[0];
		}

		if (!value || value.trim() === "") {
			if (currentCondition && conditionStart) {
				const prevDate = sortedVisits[index - 1]?.d || visitDate;
				updateConditionMap(
					conditionMap,
					currentCondition,
					conditionStart,
					prevDate
				);
				currentCondition = null;
				conditionStart = null;
			}
			return;
		}

		const normalizedValue = normalizeConditionName(value);

		if (normalizedValue !== currentCondition) {
			if (currentCondition && conditionStart) {
				const prevDate = sortedVisits[index - 1]?.d || visitDate;
				updateConditionMap(
					conditionMap,
					currentCondition,
					conditionStart,
					prevDate
				);
			}

			currentCondition = normalizedValue;
			conditionStart = visitDate;
		}
	});

	if (currentCondition && conditionStart) {
		const lastVisit = sortedVisits[sortedVisits.length - 1];
		updateConditionMap(
			conditionMap,
			currentCondition,
			conditionStart,
			lastVisit.d
		);
	}

	return Array.from(conditionMap.entries())
		.map(([task, { start, end }]) => ({ task, start, end }))
		.filter((d) => d.start && d.end);
}

/**
 * Extract diagnosis data and build gantt timelines
 */
function getDiagnosisGanttData(
	patientData: PatientData,
	eyeIndex: number
): GanttData[] {
	const diagMap = new Map<string, { start: string; end: string }>();
	const diagTracker = new Map<string, { start: string; lastSeen: string }>();

	const sortedVisits = [...(patientData.visits || [])].sort((a, b) =>
		a.d.localeCompare(b.d)
	);

	sortedVisits.forEach((visit) => {
		const visitDate = visit.d;

		if (visit.diag && Array.isArray(visit.diag)) {
			const currentDiagnoses = new Set<string>();

			let diagArray = visit.diag[eyeIndex];

			if (typeof diagArray === "string") {
				diagArray = diagArray.trim() ? [diagArray] : [];
			}

			if (diagArray && Array.isArray(diagArray)) {
				diagArray.forEach((diag: string) => {
					if (diag && diag.trim()) {
						const cleanDiag = diag
							.trim()
							.replace(/\s*x\s*\d+\s*$/, "")
							.trim();
						const normalizedDiag = normalizeConditionName(cleanDiag);

						if (normalizedDiag) {
							currentDiagnoses.add(normalizedDiag);
						}
					}
				});
			}

			// Include "Both Eyes" (index 2) diagnoses for Right Eye and Left Eye
			if (eyeIndex === 0 || eyeIndex === 1) {
				let bothEyesDiag = visit.diag[2];

				if (typeof bothEyesDiag === "string") {
					bothEyesDiag = bothEyesDiag.trim() ? [bothEyesDiag] : [];
				}

				if (bothEyesDiag && Array.isArray(bothEyesDiag)) {
					bothEyesDiag.forEach((diag: string) => {
						if (diag && diag.trim()) {
							const cleanDiag = diag
								.trim()
								.replace(/\s*x\s*\d+\s*$/, "")
								.trim();
							const normalizedDiag = normalizeConditionName(cleanDiag);

							if (normalizedDiag) {
								currentDiagnoses.add(normalizedDiag);
							}
						}
					});
				}
			}

			currentDiagnoses.forEach((normalizedDiag) => {
				if (!diagTracker.has(normalizedDiag)) {
					diagTracker.set(normalizedDiag, {
						start: visitDate,
						lastSeen: visitDate,
					});
				} else {
					const tracking = diagTracker.get(normalizedDiag)!;
					tracking.lastSeen = visitDate;
				}
			});

			diagTracker.forEach((tracking, diag) => {
				if (!currentDiagnoses.has(diag) && tracking.lastSeen !== visitDate) {
					updateConditionMap(diagMap, diag, tracking.start, tracking.lastSeen);
					diagTracker.delete(diag);
				}
			});
		}
	});

	diagTracker.forEach((tracking, diag) => {
		updateConditionMap(diagMap, diag, tracking.start, tracking.lastSeen);
	});

	return Array.from(diagMap.entries())
		.map(([task, { start, end }]) => ({ task, start, end }))
		.filter((d) => d.start && d.end);
}

/**
 * Build medications gantt from visit medications
 */
export function getMedicationsGanttData(patientData: PatientData, eyeIndex?: number): GanttData[] {
	const medMap = new Map<
		string,
		{
			start: string;
			end: string;
			dosage: string;
		}
	>();

	// Helper to normalize date from DD/MM/YYYY to YYYY-MM-DD
	const normalizeDate = (dateStr?: string): string => {
		if (!dateStr) return "";
		if (dateStr.includes("/")) {
			const parts = dateStr.split("/");
			if (parts.length === 3) {
				const [d, m, y] = parts;
				return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
			}
		}
		return dateStr;
	};

	// Helper to normalize eye value to number
	const normalizeEyeValue = (eye: any): number | null => {
		if (eye === undefined || eye === null) return null;
		if (typeof eye === "number") return eye;
		if (typeof eye === "string") {
			const normalized = eye.trim().toUpperCase();
			if (normalized === "RE" || normalized === "1") return 1;
			if (normalized === "LE" || normalized === "2") return 2;
			if (normalized === "BE" || normalized === "3") return 3;
			if (normalized === "ORAL" || normalized === "5") return 5;
			const num = Number(normalized);
			return isNaN(num) ? null : num;
		}
		return null;
	};

	(patientData.visits || []).forEach((visit) => {
		if (visit.m && Array.isArray(visit.m)) {
			const visitDate = visit.d;

			visit.m.forEach((med: Medication) => {
				if (!med || typeof med !== "object") return;

				const drugName = med.name?.trim();
				if (!drugName) return;

				// Determine which eye this medication belongs to
				const medEye = normalizeEyeValue(med.eye);

				// Filter by selected eye when eyeIndex is provided
				if (eyeIndex !== undefined && eyeIndex !== 2) {
					// eyeIndex 0 = RE, 1 = LE
					const isRE = eyeIndex === 0 && medEye === 1;
					const isLE = eyeIndex === 1 && medEye === 2;
					const isBE = medEye === 3;
					const isOral = medEye === 5;
					const isUnassigned = medEye === null || medEye === 0;

					if (!isRE && !isLE && !isBE && !isOral && !isUnassigned) return;
				}

				let eyeLabel = "";
				if (medEye === 1) {
					eyeLabel = " (RE)";
				} else if (medEye === 2) {
					eyeLabel = " (LE)";
				} else if (medEye === 3) {
					eyeLabel = " (BE)";
				} else if (medEye === 5) {
					eyeLabel = " (Oral)";
				}

				const task = `${drugName}${eyeLabel}`;

				const dosageStr =
					med.dos && med.fre
						? `${med.dos} x ${med.fre}`
						: med.dos
							? med.dos
							: "";

				// Use med.start/end if available, otherwise fallback to visit date
				const start = normalizeDate(med.start) || visitDate;
				const end = normalizeDate(med.end) || visitDate;

				if (start && end) {
					const entry = medMap.get(task) || {
						start: "9999-12-31",
						end: "0001-01-01",
						dosage: dosageStr,
					};

					if (start < entry.start) {
						entry.start = start;
						if (dosageStr) entry.dosage = dosageStr;
					}
					if (end > entry.end) {
						entry.end = end;
					}

					medMap.set(task, entry);
				}
			});
		}
	});

	return Array.from(medMap.entries())
		.map(([task, { start, end, dosage }]) => ({
			task,
			start,
			end,
			dosage,
		}))
		.filter((d) => d.start !== "9999-12-31" && d.end !== "0001-01-01");
}


/**
 * Extract line chart data (VA, IOP, CMT, Procedures)
 */
export function getLineChartData(
	patientData: PatientData,
	eyeIndex: number
): ChartData {
	console.log("[CHART] getLineChartData called with:", {
		patientUID: patientData.p?.uid,
		eyeIndex,
		visitCount: patientData.visits?.length || 0,
	});

	const procedures: ProcedureData[] = [];
	const visualAcuityData: VADataPoint[] = [];
	const iopData: TimeDataPoint[] = [];
	const cmtData: TimeDataPoint[] = [];

	(patientData.visits || []).forEach((visit) => {
		const date = visit.d;
		if (!date) return;

		// Extract Procedures - now exclusively using the new format (Las/inj/surg)
		if (visit.pr && isNewProcedureFormat(visit.pr)) {
			console.log("[CHART] Using new format for line chart");
			const newFormatProcs = getProceduresFromNewFormatForChart(
				{ p: patientData.p, visits: [visit] },
				eyeIndex
			);
			console.log("[CHART] New format procs for line chart:", newFormatProcs);
			procedures.push(...newFormatProcs);
		}

		// Extract Visual Acuity
		if (visit.vi) {
			let dvVA: string | null = null;
			let nvVA: string | null = null;
			let sphValue: string | null = null;

			// Handle distance vision (dist) - it's an object with arrays
			if (visit.vi.dist && typeof visit.vi.dist === "object") {
				const distData = visit.vi.dist as any;
				// Try va first, then ucva as fallback
				const rawVA = distData.va?.[eyeIndex] || distData.ucva?.[eyeIndex];
				if (rawVA && rawVA !== "-") {
					dvVA = decompressVision(rawVA);
				}
			}

			// Handle near vision (nr) - it's an object with arrays
			if (visit.vi.nr && typeof visit.vi.nr === "object") {
				const nrData = visit.vi.nr as any;
				// console.log(`📊 Near data for ${date}:`, nrData);
				const rawNV = nrData.va?.[eyeIndex];
				if (rawNV && rawNV !== "-") {
					nvVA = decompressVision(rawNV);
				}

				// Extract sph value from nr data
				const rawSph = nrData.sph?.[eyeIndex];
				// console.log(`📊 Raw Sph for ${date}, eyeIndex ${eyeIndex}:`, rawSph);
				if (
					rawSph &&
					rawSph !== "-" &&
					rawSph !== "" &&
					isValidSphericalValue(rawSph)
				) {
					sphValue = rawSph;
					// console.log(`📊 Extracted Sph value for ${date}:`, sphValue);
				}
			}

			// Also check vis array for additional VA data and extract all vis key-value pairs
			let visDataMap: Record<string, string> | null = null;
			if (visit.vi.vis && Array.isArray(visit.vi.vis)) {
				const visData = visit.vi.vis[eyeIndex];
				if (visData && typeof visData === "object") {
					// Extract all key-value pairs from vis object, decompressing vision values
					const entries = Object.entries(visData as Record<string, any>);
					if (entries.length > 0) {
						visDataMap = {};
						for (const [key, val] of entries) {
							if (val && typeof val === "string" && val !== "-" && val.trim() !== "") {
								visDataMap[key] = decompressVision(val);
							}
						}
						// If no valid entries after filtering, set to null
						if (Object.keys(visDataMap).length === 0) {
							visDataMap = null;
						}
					}

					// Check for UCVA or other VA fields
					const ucva =
						(visData as any).UCVA ||
						(visData as any).ucva ||
						(visData as any).va;
					if (ucva && ucva !== "-" && !dvVA) {
						dvVA = decompressVision(ucva);
					}
				}
			}

			if (dvVA) {
				const numericValue = convertVAToNumeric(dvVA);
				if (numericValue !== null) {
					const vaDataPoint = {
						x: date,
						y: dvVA,
						yNumeric: numericValue,
						nv: nvVA,
						sph: sphValue,
						visData: visDataMap,
					};
					// console.log(`📊 Final VA data point for ${date}:`, vaDataPoint);
					visualAcuityData.push(vaDataPoint);
				}
			}
		}

		// Extract IOP
		if (visit.inv && visit.inv.iop) {
			let iopValue: number | null = null;

			if (Array.isArray(visit.inv.iop)) {
				const iopStr = visit.inv.iop[eyeIndex];
				if (iopStr && iopStr !== "Not Measurable") {
					iopValue = parseFloat(iopStr);
				}
			} else if (typeof visit.inv.iop === "string") {
				if (visit.inv.iop !== "Not Measurable") {
					iopValue = parseFloat(visit.inv.iop);
				}
			}

			if (iopValue !== null && !isNaN(iopValue) && iopValue > 0) {
				iopData.push({ x: date, y: iopValue });
			}
		}

		// Extract CMT
		if (visit.inv && visit.inv.sp && visit.inv.sp.r) {
			const cmtValues = extractCMTFromText(visit.inv.sp.r);
			const cmtValue = eyeIndex === 0 ? cmtValues.RE : cmtValues.LE;

			if (cmtValue !== null) {
				cmtData.push({ x: date, y: cmtValue });
			}
		}
	});

	console.log("[CHART] Final getLineChartData result:", {
		proceduresCount: procedures.length,
		procedures: procedures,
		visualAcuityDataCount: visualAcuityData.length,
		iopDataCount: iopData.length,
		cmtDataCount: cmtData.length,
	});

	return {
		procedures,
		visualAcuityData,
		iopData,
		cmtData,
	};
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to update condition map with merged date ranges
 */
function updateConditionMap(
	map: Map<string, { start: string; end: string }>,
	condition: string,
	start: string,
	end: string
): void {
	if (!condition || !start || !end) return;

	const existing = map.get(condition);
	if (!existing) {
		map.set(condition, { start, end });
	} else {
		if (start < existing.start) existing.start = start;
		if (end > existing.end) existing.end = end;
	}
}

