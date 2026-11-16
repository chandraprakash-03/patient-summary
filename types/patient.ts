// Patient data type definitions

export interface PatientSummary {
	re: string;
	le: string;
	be: string;
}

export interface PatientClinicalSummary {
	uid: string;
	visitCount: number;
	firstVisit: string;
	lastVisit: string;
	mrNo: string;
	reSummary: string;
	leSummary: string;
	beSummary: string;
	clinicalNote: string;
	createdAt: string;
}

export interface PatientWithClinicalSummary {
	patientData: PatientData;
	clinicalSummary: PatientClinicalSummary | null;
}

export interface PatientListItem {
	uid: string;
	totalVisit?: number;
	visitCount?: number;
	firstVisit?: string;
	lastVisit?: string;
	mrNo?: string;
}

export interface PatientInfo {
	uid: string;
	mr: string;
	v: number; // number of visits
	f: string; // first visit date
	l: string; // last visit date
	dept?: string; // department
	name?: string; // patient name
	age?: number | string; // age in years
	sex?: string; // M / F / Other
	uhid?: string; // hospital unique ID
	s?: {
		h?: string; // systemic illnesses
		d?: string; // durations
	};
}

export interface VisionData {
	sph?: string;
	cyl?: string;
	ax?: string;
	va?: string;
	ucva?: string;
	ph?: string;
	Glasses?: string;
	UCVA?: string;
	"With Spectacles"?: string;
	"UCVA With PH"?: string;
	None?: string;
	[key: string]: any;
}

export interface VisualAcuity {
	vis?: VisionData | VisionData[];
	dist?: VisionData[] | { va?: string[]; sph?: string[]; ucva?: string[]; ax?: string[] };
	nr?: VisionData[] | { va?: string[]; sph?: string[] };
	reading_dist?: Array<{ rd_d?: string; rd_cm?: string; near_pd?: string }>;
	special_tests?: Record<string, string>;
	refraction_extras?: Record<string, string>;
	dynamic_retinoscopy?: Record<string, string>;
	rem?: { bdv?: string; bnv?: string; cyclo?: string };
	prev_glasses?: unknown[];
}

export interface AnteriorSegment {
	ac?: string | string[]; // anterior chamber
	ir?: string | string[]; // iris
	cj?: string | string[]; // conjunctiva
	pu?: string | string[]; // pupil
	lens?: string | string[];
	co?: string | string[]; // cornea
	lid?: string | string[]; // eyelids
	rem?: string;
}

export interface AnteriorSegmentEnriched {
	at?: AnteriorSegment;
	norm?: Record<string, string[]>;
	rem?: string;
	ac?: string | string[];
	ir?: string | string[];
	cj?: string | string[];
	pu?: string | string[];
	lens?: string | string[];
	co?: string | string[];
	lid?: string | string[];
}

export interface OcularMotility {
	om?: string | string[];
	cr?: string | string[];
	gl?: string | string[];
	norm?: Record<string, string[]>;
}

export interface Fundus {
	me?: string | string[]; // media
	di?: string | string[]; // disc
	ve?: string | string[]; // vessels
	br?: string | string[]; // background retina
	mf?: string | string[]; // macula foveal reflex
	uf?: string | string[]; // undilated fundus
	rem?: string | string[];
	norm?: Record<string, string[]>;
	id?: string | string[];
}

export interface Medication {
	name?: string;
	dos?: string; // dosage
	eye?: number | string; // 1=RE, 2=LE, 3=BE, 5=oral, or "RE", "LE", "BE", "Oral"
	fre?: number | string; // frequency
	start?: string; // start date
	end?: string; // end date
	dur?: number; // duration in days
	route?: string; // route of administration (Drops, Tablet, etc.)
	route_id?: string;
	start_date?: string;
}

// Procedure detail with clinical metadata
export interface ProcedureDetail {
	eye: string; // "RE", "LE", "BE", "UNSCOPED"
	laser_type?: string;
	procedure_type?: string;
	surgery_name?: string;
	surgery_type?: string;
	primary_procedure?: string;
	procedure_name?: string;
	Injection_name?: string;
	status?: string; // "DONE" | "ADVISED"
	implant?: string;
	iol_power?: string;
	iol_position?: string;
	site?: string;
	section?: string;
	theatre?: string;
	surgeon?: string;
	surgery_date?: string;
	generic_suture_name?: string;
	generic_suture_type?: string;
	generic_suture_mat?: string;
	remarks?: string;
	subprocedure?: string;
	sub?: string;
	name?: string;
	fact_kind?: string;
	lens_code?: string;
}

// Procedure structure supporting new enriched format + legacy
export interface NewProcedureStructure {
	Las?: (ProcedureDetail[] | ProcedureDetail[][] | null)[]; // Lasers [RE, LE, BE]
	inj?: (ProcedureDetail[] | ProcedureDetail[][] | null)[]; // Injections [RE, LE, BE]
	surg?: (ProcedureDetail[] | ProcedureDetail[][] | null)[]; // Surgeries [RE, LE, BE]
	opt?: any[]; // Advised / optional procedures
	advise?: {
		procedure?: (ProcedureDetail[] | ProcedureDetail[][] | null)[];
		laser?: (ProcedureDetail[] | ProcedureDetail[][] | null)[];
		injection?: (ProcedureDetail[] | ProcedureDetail[][] | null)[];
		[key: string]: any;
	};
	done?: {
		surgery?: (ProcedureDetail[] | ProcedureDetail[][] | null)[];
		laser?: (ProcedureDetail[] | ProcedureDetail[][] | null)[];
		injection?: (ProcedureDetail[] | ProcedureDetail[][] | null)[];
		[key: string]: any;
	};
	counseling?: Record<string, string>;
	anesthesia?: Record<string, string>;
	sittings?: Record<string, string>;
	[key: string]: any;
}

export interface Investigation {
	iop?: string | string[]; // intraocular pressure
	sp?: {
		r?: string; // special investigation report
		e?: string[]; // extracted values [RE, LE]
	};
	routine_labs?: Record<string, string>;
	cct?: string | string[];
	gen?: any;
	scans?: any;
}

export interface FollowUp {
	adv?: string; // advice / interval
	uf?: string | string[];
	loc?: string; // hospital location
	date?: string; // next visit date
	place?: string;
	placename?: string;
}

export interface SystemicHistory {
	h?: string; // history (semicolon-separated)
	d?: string; // duration (semicolon-separated)
	p?: string; // presence polarity ("POS;POS")
	neg_h?: string; // ruled-out conditions
}

export interface Opinion {
	ref?: string; // referral/opinion
	cl?: string; // clinic
	oc?: string; // opinion completion remarks
	dept?: string;
	ctype?: string;
	oc_status?: string;
	comm_desc?: string;
	rem?: string;
}

export interface Visit {
	v: number; // visit number
	d: string; // date (YYYY-MM-DD)
	t?: string; // time (HH:mm:ss)
	c: string; // consultation type (Initial, F1, F2, etc.)
	diag?: (string | string[])[]; // diagnosis [RE, LE, BE]
	vi?: VisualAcuity;
	at?: AnteriorSegment;
	as?: AnteriorSegmentEnriched;
	om?: OcularMotility;
	fu?: Fundus;
	m?: Medication[];
	pr?: NewProcedureStructure; // Enriched + legacy procedure format
	inv?: Investigation;
	fup?: FollowUp;
	s?: SystemicHistory;
	op?: Opinion;
	adv?: {
		txt?: string;
		lens?: string;
		prim?: string;
		[key: string]: any;
	};
	comp?: (string | string[])[][];
	link?: Record<string, string>;
	raw_fields?: Record<string, string>;
	diag_rem?: Array<{ d: string; eye: string; text: string }>;
	treatments?: any[];
	counseling?: Record<string, string>;
	anesthesia?: Record<string, string>;
	sittings?: Record<string, string>;
	medical_rx?: Record<string, string>;
	social_habits?: Record<string, string>;
	immunization?: Record<string, string>;
	oh?: Record<string, string>;
	ocular_hx_extras?: Record<string, string>;
}

export interface PatientData {
	p: PatientInfo;
	visits: Visit[];
}

// Chart data types
export interface TimeDataPoint {
	x: string; // date
	y: number;
}

export interface VADataPoint {
	x: string; // date
	y: string; // visual acuity string (e.g., "6/18")
	yNumeric: number; // numeric value for plotting
	nv: string | null; // near vision
	sph: string | null; // spherical value from nr data
	visData: Record<string, string> | null; // all key-value pairs from vis object for the selected eye
}

export interface ProcedureData {
	date: string;
	type: "injection" | "laser" | "surgery" | "procedure";
	name: string;
	color: string;
	count?: number;
}

export interface ChartData {
	procedures: ProcedureData[];
	visualAcuityData: VADataPoint[];
	iopData: TimeDataPoint[];
	cmtData: TimeDataPoint[];
}

export interface MetricConfig {
	name: string;
	color: string;
	colorLight?: string;
	colorDark?: string;
	min: number;
	max: number;
	step?: number;
	yAxisId: string;
}

export interface GanttData {
	task: string;
	start: string;
	end: string;
	dosage?: string;
}

export interface Disease {
	name: string;
	date: string;
}

export interface ProcedureItem {
	type: string;
	item: string;
}
