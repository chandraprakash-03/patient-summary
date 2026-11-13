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
import {
	addYears,
	addMonths,
	differenceInDays,
	parseISO,
	subYears,
	subMonths,
	subDays,
} from "date-fns";

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
 * Parsed duration breakdown components
 */
interface ParsedDuration {
	years: number;
	months: number;
	weeks: number;
	days: number;
}

/**
 * Parses duration strings like "8 years, 11 months, 1 week, 3 days", "3 years", "6 months", "18 days"
 */
function parseDurationString(duration?: string): ParsedDuration {
	if (!duration || typeof duration !== "string") {
		return { years: 0, months: 0, weeks: 0, days: 0 };
	}
	const clean = duration.trim().toLowerCase();
	if (clean === "" || clean === "no data" || clean === "applanation" || clean === "0") {
		return { years: 0, months: 0, weeks: 0, days: 0 };
	}

	const yearsMatch = clean.match(/(\d+)\s*y(?:ear)?s?/i);
	const monthsMatch = clean.match(/(\d+)\s*m(?:onth)?s?/i);
	const weeksMatch = clean.match(/(\d+)\s*w(?:eek)?s?/i);
	const daysMatch = clean.match(/(\d+)\s*d(?:ay)?s?/i);

	const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 0;
	const months = monthsMatch ? parseInt(monthsMatch[1], 10) : 0;
	const weeks = weeksMatch ? parseInt(weeksMatch[1], 10) : 0;
	const days = daysMatch ? parseInt(daysMatch[1], 10) : 0;

	return {
		years: isNaN(years) ? 0 : years,
		months: isNaN(months) ? 0 : months,
		weeks: isNaN(weeks) ? 0 : weeks,
		days: isNaN(days) ? 0 : days,
	};
}

/**
 * Calculates the onset date given a visit date and an optional recorded duration.
 * If duration is present, onset = visitDate - givenDuration.
 * If duration does not exist, onset = visitDate.
 */
export function calculateOnsetDate(visitDate: Date, durationStr?: string): Date {
	let onset = new Date(visitDate.getTime());
	const parsed = parseDurationString(durationStr);
	if (parsed.years > 0) onset = subYears(onset, parsed.years);
	if (parsed.months > 0) onset = subMonths(onset, parsed.months);
	const totalDays = parsed.weeks * 7 + parsed.days;
	if (totalDays > 0) onset = subDays(onset, totalDays);
	return onset;
}

/**
 * Formats the duration between two dates into "years, months, weeks and days".
 * Only non-zero components are included (e.g. "11 years, 2 months, 3 weeks, 6 days").
 */
export function formatDurationBreakdown(startDate: Date, endDate: Date): string {
	if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
		return "0 days";
	}

	let cur = new Date(startDate.getTime());
	let years = 0;
	while (true) {
		const nextYear = addYears(cur, 1);
		if (nextYear <= endDate) {
			years++;
			cur = nextYear;
		} else {
			break;
		}
	}

	let months = 0;
	while (true) {
		const nextMonth = addMonths(cur, 1);
		if (nextMonth <= endDate) {
			months++;
			cur = nextMonth;
		} else {
			break;
		}
	}

	const remainingDays = differenceInDays(endDate, cur);
	const weeks = Math.floor(remainingDays / 7);
	const days = remainingDays % 7;

	const parts: string[] = [];
	if (years > 0) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
	if (months > 0) parts.push(`${months} ${months === 1 ? "month" : "months"}`);
	if (weeks > 0) parts.push(`${weeks} ${weeks === 1 ? "week" : "weeks"}`);
	if (days > 0 || parts.length === 0) parts.push(`${days} ${days === 1 ? "day" : "days"}`);

	return parts.join(", ");
}

/**
 * Parse duration strings into approximate days for comparison/sorting if needed
 */
function parseDurationToDays(duration: string): number {
	if (!duration) return 0;
	const p = parseDurationString(duration);
	return p.years * 365 + p.months * 30 + p.weeks * 7 + p.days;
}

export function getDiseases(patientData: PatientData, currentDate: Date = new Date()): Disease[] {
	const candidatesMap = new Map<
		string,
		Array<{ visitDate: Date; rawDuration: string; onsetDate: Date }>
	>();

	const ignoreList = [
		"remarks",
		"remark",
		"identification marks",
		"identification mark",
		"id marks",
		"id mark",
		"others",
	];

	const addCandidate = (name: string, visitDateStr: string, rawDuration: string) => {
		const trimmed = name.trim();
		if (!trimmed || ignoreList.includes(trimmed.toLowerCase())) {
			return;
		}

		let visitDate: Date | null = null;
		const isoDate = parseToISODate(visitDateStr);
		if (isoDate) {
			try {
				visitDate = parseISO(isoDate);
			} catch {
				visitDate = null;
			}
		}

		if (!visitDate || isNaN(visitDate.getTime())) {
			visitDate = new Date(currentDate.getTime());
		}

		const onsetDate = calculateOnsetDate(visitDate, rawDuration);
		const existing = candidatesMap.get(trimmed) || [];
		existing.push({ visitDate, rawDuration, onsetDate });
		candidatesMap.set(trimmed, existing);
	};

	// 1. Primary: check root patient summary (patientData.p?.s)
	if (patientData.p?.s && patientData.p.s.h) {
		const rootDiseases = patientData.p.s.h
			.split(";")
			.map((d) => d.trim())
			.filter((d) => d !== "");
		const rootDurations = patientData.p.s.d
			? patientData.p.s.d.split(";").map((d) => d.trim())
			: [];

		const pDateStr =
			patientData.p.l ||
			patientData.p.f ||
			(patientData.visits && patientData.visits.length > 0
				? patientData.visits[patientData.visits.length - 1].d
				: "");

		rootDiseases.forEach((disease, index) => {
			addCandidate(disease, pDateStr, rootDurations[index] || "");
		});
	}

	// 2. Secondary & Fallback: scan visits (oldest first)
	const sortedVisits = [...(patientData.visits || [])].sort((a, b) =>
		a.d.localeCompare(b.d)
	);

	sortedVisits.forEach((visit) => {
		const raw = visit.raw_fields || {};
		const rawHistory = raw.historydesc_241;
		const rawDuration = raw.duration_243;
		const rawResult = raw.resultvalue_242; // "1;1;0"

		const diseasesStr = rawHistory || (visit.s && visit.s.h) || "";
		const durationsStr = rawDuration || (visit.s && visit.s.d) || "";

		if (diseasesStr) {
			const diseases = diseasesStr
				.split(";")
				.map((d) => d.trim())
				.filter((d) => d !== "");

			const durations = durationsStr
				? durationsStr.split(";").map((d) => d.trim())
				: [];

			const results = rawResult
				? rawResult.split(";").map((r) => r.trim())
				: [];

			diseases.forEach((disease, index) => {
				const trimmed = disease.trim();
				// If rawResult is present, skip explicitly ruled-out ("0" or "NO") conditions
				if (
					results.length > index &&
					(results[index] === "0" || results[index]?.toUpperCase() === "NO")
				) {
					return;
				}

				addCandidate(trimmed, visit.d, durations[index] || "");
			});
		}
	});

	// 3. For each disease, pick the best record (earliest onset date = longest total duration)
	const result: Disease[] = [];
	candidatesMap.forEach((records, name) => {
		if (records.length === 0) return;

		let best = records[0];
		for (let i = 1; i < records.length; i++) {
			if (records[i].onsetDate < best.onsetDate) {
				best = records[i];
			}
		}

		const formattedDuration = formatDurationBreakdown(best.onsetDate, currentDate);
		result.push({
			name,
			date: formattedDuration,
		});
	});

	return result;
}





/**
 * Helper to normalize eye code to standard 0=RE, 1=LE, 2=BE, 5=Oral
 */
export function normalizeEyeCode(eye: any): number | null {
	if (eye === undefined || eye === null) return null;
	if (typeof eye === "number") {
		if (eye === 1) return 0; // RE
		if (eye === 2) return 1; // LE
		if (eye === 3) return 2; // BE
		if (eye === 5) return 5; // Oral
		return eye;
	}
	const s = String(eye).trim().toUpperCase();
	if (s === "RE" || s === "1" || s === "OD") return 0;
	if (s === "LE" || s === "2" || s === "OS") return 1;
	if (s === "BE" || s === "3" || s === "OU") return 2;
	if (s === "ORAL" || s === "5") return 5;
	return null;
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
 * Extract observation value from raw_fields with fallback to structured as/fu/at objects
 */
export function extractObservationValue(
	visit: any,
	section: string,
	eyeIndex: number
): string | null {
	const raw = visit.raw_fields || {};
	const isRE = eyeIndex === 0;
	let val: string | null = null;

	// 1. Primary: Extract from raw_fields
	switch (section) {
		case "anterior_chamber":
			val = isRE ? raw.anteriorchamber_re_86 : raw.anteriorchamber_le_87;
			break;
		case "iris":
			val = isRE ? raw.iris_re_90 : raw.iris_le_91;
			break;
		case "conjunctiva":
			val = isRE ? raw.conjunctiva_re_78 : raw.conjunctiva_le_79;
			break;
		case "pupil":
			val = isRE ? raw.pupil_re_94 : raw.pupil_le_95;
			break;
		case "lens":
			val = isRE ? raw.lens_re_98 : raw.lens_le_99;
			break;
		case "media":
			val = isRE ? raw.media_re_125 : raw.media_le_126;
			break;
		case "disc":
			val = isRE ? raw.disc_re_129 : raw.disc_le_130;
			break;
		case "vessels":
			val = isRE ? raw.vessels_re_133 : raw.vessels_le_134;
			break;
		case "background_retina":
			val = isRE ? raw.backgroundretina_re_137 : raw.backgroundretina_le_138;
			break;
		case "foveal_reflex":
			val = isRE ? raw.maculafovealreflex_re_141 : raw.maculafovealreflex_le_142;
			break;
		case "undilated_fundus":
			val = isRE ? raw.undilatedfundus_re_114 : raw.undilatedfundus_le_115;
			break;
	}

	if (val && typeof val === "string") {
		const trimmed = val.trim();
		if (trimmed !== "" && trimmed !== "-" && trimmed !== "0") {
			return trimmed;
		}
	}

	// Check raw normality flag if text is empty
	const isNormalFlag = isRE
		? section === "anterior_chamber"
			? raw.is_anteriorchamber_re_normal_88
			: section === "conjunctiva"
			? raw.is_conjunctiva_re_normal_80
			: section === "pupil"
			? raw.is_pupil_re_normal_96
			: section === "lens"
			? raw.is_lens_re_normal_100
			: section === "iris"
			? raw.is_iris_re_normal_92
			: section === "disc"
			? raw.is_disc_re_normal_131
			: section === "vessels"
			? raw.is_vessels_re_normal_135
			: section === "background_retina"
			? raw.is_backgroundretina_re_normal_139
			: section === "foveal_reflex"
			? raw.is_maculafovealreflex_re_normal_143
			: section === "undilated_fundus"
			? raw.is_undilatedfundus_re_normal_116
			: null
		: section === "anterior_chamber"
		? raw.is_anteriorchamber_le_normal_89
		: section === "conjunctiva"
		? raw.is_conjunctiva_le_normal_81
		: section === "pupil"
		? raw.is_pupil_le_normal_97
		: section === "lens"
		? raw.is_lens_le_normal_101
		: section === "iris"
		? raw.is_iris_le_normal_93
		: section === "disc"
		? raw.is_disc_le_normal_132
		: section === "vessels"
		? raw.is_vessels_le_normal_136
		: section === "background_retina"
		? raw.is_backgroundretina_le_normal_140
		: section === "foveal_reflex"
		? raw.is_maculafovealreflex_le_normal_144
		: section === "undilated_fundus"
		? raw.is_undilatedfundus_le_normal_117
		: null;

	if (isNormalFlag === "1" || isNormalFlag === 1) {
		return "Normal";
	}

	// 2. Secondary & Fallback: Structured JSON objects
	if (["anterior_chamber", "iris", "conjunctiva", "pupil", "lens"].includes(section)) {
		const fieldKey =
			section === "anterior_chamber"
				? "ac"
				: section === "iris"
				? "ir"
				: section === "conjunctiva"
				? "cj"
				: section === "pupil"
				? "pu"
				: "lens";

		const asObj = visit.as?.at || visit.as || visit.at;
		if (asObj) {
			let v = asObj[fieldKey];
			if (Array.isArray(v)) {
				v =
					eyeIndex === 2
						? v[0] === v[1]
							? v[0]
							: `${v[0]} / ${v[1]}`
						: v[eyeIndex] || v[0];
			}
			if (v && typeof v === "string" && v.trim() !== "" && v.trim() !== "-") {
				return v.trim();
			}
		}
	} else {
		// Posterior segment / Fundus (fu)
		const fieldKey =
			section === "background_retina"
				? "br"
				: section === "foveal_reflex"
				? "mf"
				: section === "media"
				? "me"
				: section === "disc"
				? "di"
				: section === "vessels"
				? "ve"
				: section === "undilated_fundus"
				? visit.fu?.uf
					? "uf"
					: "rem"
				: "";

		if (fieldKey && visit.fu) {
			let v = visit.fu[fieldKey];
			if (Array.isArray(v)) {
				v =
					eyeIndex === 2
						? v[0] === v[1]
							? v[0]
							: `${v[0]} / ${v[1]}`
						: v[eyeIndex] || v[0];
			}
			if (v && typeof v === "string" && v.trim() !== "" && v.trim() !== "-") {
				return v.trim();
			}
		}
	}

	return null;
}

/**
 * Build gantt data from visit observations
 */
export function getGanttData(
	patientData: PatientData,
	section: string,
	eyeIndex: number
): GanttData[] {
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
		const value = extractObservationValue(visit, section, eyeIndex);

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
		const currentDiagnoses = new Set<string>();

		// 1. Check raw_fields.diagnosisname + eyepartid_152
		const raw = visit.raw_fields || {};
		if (raw.diagnosisname) {
			const names = raw.diagnosisname.split(";").map((s: string) => s.trim()).filter(Boolean);
			const eyes = (raw.eyepartid_152 || "").split(";").map((s: string) => s.trim());
			names.forEach((name: string, i: number) => {
				const eye = normalizeEyeCode(eyes[i] || eyes[0]);
				if (eye === eyeIndex || eye === 2 || eyeIndex === 2 || eye === null) {
					const normalized = normalizeConditionName(name);
					if (normalized) currentDiagnoses.add(normalized);
				}
			});
		}

		// 2. Check diag_rem
		if (visit.diag_rem && Array.isArray(visit.diag_rem)) {
			visit.diag_rem.forEach((rem: any) => {
				const remEye = normalizeEyeCode(rem.eye);
				if (remEye === eyeIndex || remEye === 2 || eyeIndex === 2 || remEye === null) {
					if (rem.text && rem.text.trim()) {
						const normalized = normalizeConditionName(rem.text.trim());
						if (normalized) currentDiagnoses.add(normalized);
					}
				}
			});
		}

		// 3. Fallback: visit.diag array
		if (visit.diag && Array.isArray(visit.diag)) {
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
	});

	diagTracker.forEach((tracking, diag) => {
		updateConditionMap(diagMap, diag, tracking.start, tracking.lastSeen);
	});

	return Array.from(diagMap.entries())
		.map(([task, { start, end }]) => ({ task, start, end }))
		.filter((d) => d.start && d.end);
}

/**
 * Normalizes date to YYYY-MM-DD from various formats (DD/MM/YYYY, "Jun 13 2018 12:00AM", ISO)
 */
function parseToISODate(dateStr?: string): string {
	if (!dateStr || typeof dateStr !== "string") return "";
	const trimmed = dateStr.trim();
	if (
		!trimmed ||
		trimmed === "0" ||
		trimmed === "-" ||
		trimmed.toLowerCase() === "null" ||
		trimmed.startsWith("1900") ||
		trimmed.startsWith("1901")
	) {
		return "";
	}

	let iso = "";
	// Format: DD/MM/YYYY
	if (trimmed.includes("/")) {
		const parts = trimmed.split("/");
		if (parts.length === 3) {
			const [d, m, y] = parts;
			if (y.length === 4) {
				iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
			}
		}
	} else if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
		// Format: YYYY-MM-DD
		iso = trimmed.substring(0, 10);
	} else {
		// Format: "Jun 13 2018 12:00AM" or other textual date
		const parsed = Date.parse(trimmed);
		if (!isNaN(parsed)) {
			const d = new Date(parsed);
			const year = d.getFullYear();
			const month = String(d.getMonth() + 1).padStart(2, "0");
			const day = String(d.getDate()).padStart(2, "0");
			iso = `${year}-${month}-${day}`;
		}
	}

	if (iso && (iso.startsWith("1900") || iso.startsWith("1901"))) {
		return "";
	}
	return iso;
}

/**
 * Extracts end date from duration description like "30 Day(s) (01/11/2022 to 30/11/2022)" or "30 days"
 */
function parseEndFromDaysDesc(desc?: string, startDate?: string): string {
	if (!desc || typeof desc !== "string") return "";
	// Check for explicit "to DD/MM/YYYY" or "to YYYY-MM-DD"
	const toMatch = desc.match(/to\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
	if (toMatch) {
		const iso = parseToISODate(toMatch[1]);
		if (iso) return iso;
	}

	// Check for "N Day(s)" or "N days"
	const daysMatch = desc.match(/(\d+)\s*day/i);
	if (daysMatch && startDate) {
		const days = parseInt(daysMatch[1], 10);
		if (!isNaN(days) && days > 0) {
			const d = new Date(startDate);
			if (!isNaN(d.getTime())) {
				d.setDate(d.getDate() + days);
				const year = d.getFullYear();
				const month = String(d.getMonth() + 1).padStart(2, "0");
				const day = String(d.getDate()).padStart(2, "0");
				return `${year}-${month}-${day}`;
			}
		}
	}

	return "";
}

/**
 * Parse IOP from raw string (e.g. "16;14", "20.000;0.000", "14")
 * Prioritizes Applanation/GAT if method specifies it, otherwise takes first valid physiological IOP (4-80 mmHg)
 */
function parseIOPFromRaw(valStr?: string, methodStr?: string): number | null {
	if (!valStr || typeof valStr !== "string") return null;
	const tokens = valStr.split(";").map((t) => t.trim()).filter(Boolean);
	const methods = methodStr
		? methodStr.split(";").map((m) => m.trim().toLowerCase())
		: [];

	// If method specifies Applanation/GAT, pick that index
	const applanationIdx = methods.findIndex(
		(m) => m.includes("applanation") || m.includes("gat")
	);
	if (applanationIdx !== -1 && tokens[applanationIdx]) {
		const num = parseFloat(tokens[applanationIdx]);
		if (!isNaN(num) && num >= 4 && num <= 80) return num;
	}

	// Otherwise find first valid non-zero physiological IOP reading (4 to 80 mmHg)
	for (const token of tokens) {
		const num = parseFloat(token);
		if (!isNaN(num) && num >= 4 && num <= 80) {
			return num;
		}
	}
	return null;
}

/**
 * Build medications gantt from visit medications
 */
export function getMedicationsGanttData(
	patientData: PatientData,
	eyeIndex?: number
): GanttData[] {
	const medMap = new Map<
		string,
		{
			start: string;
			end: string;
			dosage: string;
		}
	>();

	// Helper to normalize eye value to number (1=RE, 2=LE, 3=BE, 5=Oral)
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

	const addMedication = (
		drugName: string,
		eyeVal: any,
		dosageVal: string,
		freqVal: string,
		startVal: string,
		endVal: string,
		visitDate: string
	) => {
		const cleanName = drugName.trim();
		if (
			!cleanName ||
			cleanName.toLowerCase() === "null" ||
			cleanName.toLowerCase() === "nil" ||
			cleanName === "-"
		) {
			return;
		}

		const medEye = normalizeEyeValue(eyeVal);

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

		const task = `${cleanName}${eyeLabel}`;
		const dosageStr =
			dosageVal && freqVal
				? `${dosageVal} x ${freqVal}`
				: dosageVal || freqVal || "";

		const start = parseToISODate(startVal) || visitDate;
		const end = parseToISODate(endVal) || visitDate;

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
	};

	(patientData.visits || []).forEach((visit) => {
		const visitDate = visit.d;
		if (!visitDate) return;

		// 1. Primary: Harvest from raw_fields (Category 09)
		const raw = visit.raw_fields;
		if (raw && (raw.drugname || raw.drugname_237 || raw.drugdesc_310)) {
			const rawNames = (
				raw.drugname ||
				raw.drugname_237 ||
				raw.drugdesc_310 ||
				""
			)
				.split(";")
				.map((s: string) => s.trim());
			const rawEyes = (raw.eyepartid_223 || raw.drug_remarks_eye || "")
				.split(";")
				.map((s: string) => s.trim());
			const rawDosages = (raw.dosagedesc_236 || "")
				.split(";")
				.map((s: string) => s.trim());
			const rawFreqs = (raw.freqdesc_227 || "")
				.split(";")
				.map((s: string) => s.trim());
			const rawStarts = (raw.startdate_235 || "")
				.split(";")
				.map((s: string) => s.trim());
			const rawDays = (raw.daysdesc_226 || "")
				.split(";")
				.map((s: string) => s.trim());

			rawNames.forEach((dName: string, i: number) => {
				if (!dName) return;
				const eye = rawEyes[i] || rawEyes[0];
				const dos = rawDosages[i] || rawDosages[0] || "";
				const freq = rawFreqs[i] || rawFreqs[0] || "";
				const st = rawStarts[i] || rawStarts[0] || "";
				const dy = rawDays[i] || rawDays[0] || "";
				const ed = parseEndFromDaysDesc(dy, parseToISODate(st) || visitDate);
				addMedication(dName, eye, dos, freq, st, ed, visitDate);
			});
		}

		// 2. Secondary & Fallback: Harvest from legacy visit.m array
		if (visit.m && Array.isArray(visit.m)) {
			visit.m.forEach((med: Medication) => {
				if (!med || typeof med !== "object") return;
				const drugName = med.name?.trim();
				if (!drugName) return;

				const dosageStr =
					med.dos && med.fre
						? `${med.dos} x ${med.fre}`
						: med.dos
						? med.dos
						: "";

				addMedication(
					drugName,
					med.eye,
					dosageStr,
					"",
					med.start || "",
					med.end || "",
					visitDate
				);
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

		// 2. Extract Visual Acuity - Primary raw_fields, Secondary visit.vi
		let dvVA: string | null = null;
		let nvVA: string | null = null;
		let sphValue: string | null = null;
		let visDataMap: Record<string, string> | null = null;

		const raw = visit.raw_fields;
		if (raw) {
			if (eyeIndex === 0) {
				// Right Eye (RE)
				const rawDist =
					raw.reva_18 || raw.reucva_36 || raw.rephva_19 || raw.reva_349;
				if (rawDist && typeof rawDist === "string" && rawDist !== "-") {
					const firstDist = rawDist.split(";")[0]?.trim();
					if (firstDist && firstDist !== "-") dvVA = decompressVision(firstDist);
				}
				const rawNear = raw.reva_39 || raw.renv_axis_356;
				if (rawNear && typeof rawNear === "string" && rawNear !== "-") {
					const firstNear = rawNear.split(";")[0]?.trim();
					if (firstNear && firstNear !== "-") nvVA = decompressVision(firstNear);
				}
				const rawSph = raw.resp_38 || raw.resp_15 || raw.resp_346;
				if (rawSph && typeof rawSph === "string" && rawSph !== "-") {
					const firstSph = rawSph.split(";")[0]?.trim();
					if (firstSph && isValidSphericalValue(firstSph)) sphValue = firstSph;
				}
			} else if (eyeIndex === 1) {
				// Left Eye (LE)
				const rawDist =
					raw.leva_24 || raw.leucva_20 || raw.lephva_25 || raw.leva_353;
				if (rawDist && typeof rawDist === "string" && rawDist !== "-") {
					const firstDist = rawDist.split(";")[0]?.trim();
					if (firstDist && firstDist !== "-") dvVA = decompressVision(firstDist);
				}
				const rawNear = raw.leva_42 || raw.lenv_axis_357;
				if (rawNear && typeof rawNear === "string" && rawNear !== "-") {
					const firstNear = rawNear.split(";")[0]?.trim();
					if (firstNear && firstNear !== "-") nvVA = decompressVision(firstNear);
				}
				const rawSph = raw.lesp_41 || raw.lesp_21 || raw.lesp_350;
				if (rawSph && typeof rawSph === "string" && rawSph !== "-") {
					const firstSph = rawSph.split(";")[0]?.trim();
					if (firstSph && isValidSphericalValue(firstSph)) sphValue = firstSph;
				}
			} else if (eyeIndex === 2) {
				// Both Eyes (BE)
				const rawDist =
					raw.reva_18 || raw.leva_24 || raw.reucva_36 || raw.leucva_20;
				if (rawDist && typeof rawDist === "string" && rawDist !== "-") {
					const firstDist = rawDist.split(";")[0]?.trim();
					if (firstDist && firstDist !== "-") dvVA = decompressVision(firstDist);
				}
				const rawNear = raw.reva_39 || raw.leva_42;
				if (rawNear && typeof rawNear === "string" && rawNear !== "-") {
					const firstNear = rawNear.split(";")[0]?.trim();
					if (firstNear && firstNear !== "-") nvVA = decompressVision(firstNear);
				}
			}
		}

		// Fallback to visit.vi structured paths
		if (visit.vi) {
			const idx = eyeIndex === 2 ? 0 : eyeIndex;

			// Handle distance vision (dist)
			if (!dvVA && visit.vi.dist) {
				if (Array.isArray(visit.vi.dist)) {
					const obj = visit.vi.dist[idx];
					const rawVA = obj?.va || obj?.ucva || obj?.ph;
					if (rawVA && rawVA !== "-") dvVA = decompressVision(rawVA);
				} else if (typeof visit.vi.dist === "object") {
					const distData = visit.vi.dist as any;
					const rawVA = distData.va?.[idx] || distData.ucva?.[idx];
					if (rawVA && rawVA !== "-") dvVA = decompressVision(rawVA);
				}
			}

			// Handle near vision (nr)
			if (visit.vi.nr) {
				if (Array.isArray(visit.vi.nr)) {
					const obj = visit.vi.nr[idx];
					if (!nvVA && obj?.va && obj.va !== "-") {
						nvVA = decompressVision(obj.va);
					}
					if (!sphValue && obj?.sph && isValidSphericalValue(obj.sph)) {
						sphValue = obj.sph;
					}
				} else if (typeof visit.vi.nr === "object") {
					const nrData = visit.vi.nr as any;
					if (!nvVA) {
						const rawNV = nrData.va?.[idx];
						if (rawNV && rawNV !== "-") nvVA = decompressVision(rawNV);
					}
					if (!sphValue) {
						const rawSph = nrData.sph?.[idx];
						if (
							rawSph &&
							rawSph !== "-" &&
							rawSph !== "" &&
							isValidSphericalValue(rawSph)
						) {
							sphValue = rawSph;
						}
					}
				}
			}

			// Also check vis array for additional VA data
			if (visit.vi.vis && Array.isArray(visit.vi.vis)) {
				const idx = eyeIndex === 2 ? 0 : eyeIndex;
				const visData = visit.vi.vis[idx];
				if (visData && typeof visData === "object") {
					const entries = Object.entries(visData as Record<string, any>);
					if (entries.length > 0) {
						visDataMap = {};
						for (const [key, val] of entries) {
							if (
								val &&
								typeof val === "string" &&
								val !== "-" &&
								val.trim() !== ""
							) {
								visDataMap[key] = decompressVision(val);
							}
						}
						if (Object.keys(visDataMap).length === 0) visDataMap = null;
					}
					if (!dvVA) {
						const ucva =
							(visData as any).UCVA ||
							(visData as any).ucva ||
							(visData as any).va;
						if (ucva && ucva !== "-") dvVA = decompressVision(ucva);
					}
				}
			}
		}

		if (dvVA) {
			const numericValue = convertVAToNumeric(dvVA);
			if (numericValue !== null) {
				visualAcuityData.push({
					x: date,
					y: dvVA,
					yNumeric: numericValue,
					nv: nvVA,
					sph: sphValue,
					visData: visDataMap,
				});
			}
		}

		// 3. Extract IOP: Primary raw_fields, Secondary visit.inv.iop
		let iopValue: number | null = null;
		const rawIOP =
			eyeIndex === 0
				? raw?.revalue_53
				: eyeIndex === 1
				? raw?.levalue_54
				: raw?.revalue_53 || raw?.levalue_54;
		const rawMethod =
			eyeIndex === 0
				? raw?.methodre_51
				: eyeIndex === 1
				? raw?.methodle_52
				: raw?.methodre_51 || raw?.methodle_52;

		if (rawIOP && typeof rawIOP === "string") {
			iopValue = parseIOPFromRaw(rawIOP, rawMethod);
		}

		// Fallback to visit.inv.iop
		if (iopValue === null && visit.inv && visit.inv.iop) {
			const idx = eyeIndex === 2 ? 0 : eyeIndex;
			if (Array.isArray(visit.inv.iop)) {
				const iopStr = visit.inv.iop[idx];
				if (iopStr && iopStr !== "Not Measurable") {
					const parsed = parseFloat(iopStr);
					if (!isNaN(parsed) && parsed > 0 && parsed <= 80) iopValue = parsed;
				}
			} else if (typeof visit.inv.iop === "string") {
				if (visit.inv.iop !== "Not Measurable") {
					const parsed = parseFloat(visit.inv.iop);
					if (!isNaN(parsed) && parsed > 0 && parsed <= 80) iopValue = parsed;
				}
			}
		}

		if (
			iopValue !== null &&
			!isNaN(iopValue) &&
			iopValue > 0 &&
			iopValue <= 80
		) {
			iopData.push({ x: date, y: iopValue });
		}

		// 4. Extract CMT: Primary raw_fields.notes_149, Secondary visit.inv.sp.r / visit.inv.sp.e
		const cmtText =
			raw?.notes_149 || visit.inv?.sp?.r || visit.inv?.sp?.e || "";
		if (cmtText && typeof cmtText === "string") {
			const cmtValues = extractCMTFromText(cmtText);
			const cmtValue =
				eyeIndex === 0
					? cmtValues.RE
					: eyeIndex === 1
					? cmtValues.LE
					: cmtValues.RE || cmtValues.LE;
			if (cmtValue !== null && cmtValue > 0 && cmtValue <= 1500) {
				cmtData.push({ x: date, y: cmtValue });
			}
		}
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

