"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/app-header";
import {
	getPatientListDetails,
	PatientListItem,
} from "@/lib/services/patient-data.service";
import {
	Search,
	User,
	Calendar,
	ArrowRight,
	Activity,
	FileText,
	Filter,
	Eye,
	CheckCircle2,
	Clock,
} from "lucide-react";
import { format, parseISO } from "date-fns";

export default function Home() {
	const router = useRouter();
	const [patients, setPatients] = useState<PatientListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [filterTab, setFilterTab] = useState<"all" | "multiVisit" | "recent">("all");

	useEffect(() => {
		const loadData = async () => {
			try {
				const list = await getPatientListDetails();
				setPatients(list);
			} catch (error) {
				console.error("Failed to load patient details:", error);
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, []);

	// Format date safely
	const formatDate = (dateStr?: string) => {
		if (!dateStr) return "—";
		try {
			// If already DD-MMM-YYYY or similar
			if (dateStr.includes("-") && dateStr.length === 11) {
				return dateStr;
			}
			return format(parseISO(dateStr), "dd-MMM-yyyy");
		} catch {
			return dateStr;
		}
	};

	// Filtered patients based on search and tab
	const filteredPatients = useMemo(() => {
		let result = [...patients];

		// Filter tab
		if (filterTab === "multiVisit") {
			result = result.filter(
				(p) => (p.totalVisit || p.visitCount || 0) > 5
			);
		} else if (filterTab === "recent") {
			result = result.filter((p) => Boolean(p.lastVisit));
		}

		// Search query (matches UID or MR)
		if (searchQuery.trim()) {
			const query = searchQuery.trim().toLowerCase();
			result = result.filter(
				(p) =>
					p.uid.toLowerCase().includes(query) ||
					(p.mrNo && p.mrNo.toLowerCase().includes(query))
			);
		}

		return result;
	}, [patients, filterTab, searchQuery]);

	// Summary statistics
	const totalVisitsCount = useMemo(() => {
		return patients.reduce(
			(sum, p) => sum + (p.totalVisit || p.visitCount || 0),
			0
		);
	}, [patients]);

	return (
		<div className="min-h-screen bg-[#dcebf5] dark:bg-background flex flex-col">
			{/* Top Header */}
			<AppHeader />

			{/* Main Dashboard Container */}
			<main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

				{/* Top Hero Banner & Quick KPI Metrics */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{/* KPI 1: Total Patients */}
					<div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-card border border-border shadow-xs flex items-center justify-between">
						<div className="space-y-1">
							<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Registered Patients
							</span>
							<h3 className="text-2xl font-bold text-foreground tracking-tight">
								{loading ? "…" : patients.length}
							</h3>
							<p className="text-xs text-muted-foreground">
								Active clinical eye profiles
							</p>
						</div>
						<div className="w-12 h-12 rounded-xl bg-[#1176bc]/10 text-[#1176bc] flex items-center justify-center shrink-0">
							<User className="w-6 h-6" />
						</div>
					</div>

					{/* KPI 2: Total Longitudinal Visits */}
					<div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-card border border-border shadow-xs flex items-center justify-between">
						<div className="space-y-1">
							<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Longitudinal Visits
							</span>
							<h3 className="text-2xl font-bold text-[#1176bc] tracking-tight">
								{loading ? "…" : totalVisitsCount}
							</h3>
							<p className="text-xs text-muted-foreground">
								Documented consultations & exams
							</p>
						</div>
						<div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
							<Activity className="w-6 h-6" />
						</div>
					</div>

					{/* KPI 3: Monitoring & Status */}
					<div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-card border border-border shadow-xs flex items-center justify-between">
						<div className="space-y-1">
							<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Clinical Analytics
							</span>
							<h3 className="text-2xl font-bold text-foreground tracking-tight">
								eyeNotes EMR
							</h3>
							<p className="text-xs text-muted-foreground flex items-center gap-1.5">
								<span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
								<span>System operational &amp; synced</span>
							</p>
						</div>
						<div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
							<Eye className="w-6 h-6" />
						</div>
					</div>
				</div>

				{/* Table Dashboard Card */}
				<div className="rounded-xl border border-border bg-white dark:bg-card shadow-xs overflow-hidden flex flex-col">

					{/* Dashboard Header Bar: Title + Search & Filter Controls */}
					<div className="px-5 py-4 border-b border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-muted/20">
						<div className="space-y-0.5">
							<div className="flex items-center gap-2">
								<h2 className="text-base font-bold text-foreground tracking-tight">
									Patient Directory
								</h2>
								<Badge
									variant="secondary"
									className="text-xs font-semibold px-2.5 py-0.5 rounded-full border border-border/70"
								>
									{filteredPatients.length} Patients
								</Badge>
							</div>
							<p className="text-xs text-muted-foreground">
								Select any patient record to launch the clinical dashboard &amp; structural progression timeline
							</p>
						</div>

						{/* Search & Filter Inputs */}
						<div className="flex items-center gap-2.5 flex-wrap">
							{/* Live Search Input */}
							<div className="relative min-w-[220px] sm:min-w-[280px]">
								<Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
								<input
									type="text"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder="Search UID or MR number…"
									className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#1176bc]/30 focus:border-[#1176bc] transition-all"
								/>
								{searchQuery && (
									<button
										onClick={() => setSearchQuery("")}
										className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground font-semibold"
									>
										×
									</button>
								)}
							</div>

							{/* Filter Pills */}
							<div className="inline-flex rounded-lg p-0.5 bg-muted/60 border border-border/70">
								<button
									onClick={() => setFilterTab("all")}
									className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
										filterTab === "all"
											? "bg-[#1176bc] text-white shadow-xs"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									All
								</button>
								<button
									onClick={() => setFilterTab("multiVisit")}
									className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
										filterTab === "multiVisit"
											? "bg-[#1176bc] text-white shadow-xs"
											: "text-muted-foreground hover:text-foreground"
									}`}
									title="Patients with more than 5 documented visits"
								>
									&gt; 5 Visits
								</button>
							</div>
						</div>
					</div>

					{/* Loading State */}
					{loading ? (
						<div className="py-24 flex flex-col items-center justify-center gap-3">
							<div className="animate-spin rounded-full h-9 w-9 border-b-2 border-[#1176bc]" />
							<p className="text-xs text-muted-foreground font-medium">
								Loading patient records from database…
							</p>
						</div>
					) : filteredPatients.length === 0 ? (
						/* Empty State */
						<div className="py-20 text-center flex flex-col items-center justify-center gap-2">
							<User className="w-10 h-10 text-muted-foreground/40 mb-1" />
							<h4 className="text-sm font-semibold text-foreground">
								No patients found
							</h4>
							<p className="text-xs text-muted-foreground max-w-sm">
								No patient records match your current search query "{searchQuery}".
							</p>
							{searchQuery && (
								<button
									onClick={() => setSearchQuery("")}
									className="mt-2 text-xs font-semibold text-[#1176bc] hover:underline"
								>
									Clear Search
								</button>
							)}
						</div>
					) : (
						/* Medical Dashboard Table */
						<div className="overflow-x-auto box-scroll">
							<table className="w-full text-left border-collapse">
								<thead>
									<tr className="border-b border-border/80 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										<th className="py-3 px-5">Patient UID</th>
										<th className="py-3 px-4">MR Number</th>
										<th className="py-3 px-4">Visit Count</th>
										<th className="py-3 px-4">Initial Visit</th>
										<th className="py-3 px-4">Latest Visit</th>
										<th className="py-3 px-4">Status</th>
										<th className="py-3 px-5 text-right">Action</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border/60 text-xs font-medium">
									{filteredPatients.map((patient, idx) => {
										const visitCount =
											patient.totalVisit || patient.visitCount || 1;

										return (
											<tr
												key={patient.uid}
												onClick={() => router.push(`/uid/${patient.uid}`)}
												className="hover:bg-[#1176bc]/[0.05] transition-colors cursor-pointer group"
											>
												{/* Patient UID with User Avatar */}
												<td className="py-3.5 px-5">
													<div className="flex items-center gap-3">
														<div className="w-9 h-9 rounded-full bg-[#1176bc]/10 text-[#1176bc] border border-[#1176bc]/20 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
															<User className="w-4 h-4" />
														</div>
														<div className="min-w-0">
															<span className="font-bold text-foreground tracking-tight block">
																{patient.uid}
															</span>
															<span className="text-[11px] text-muted-foreground">
																Patient #{idx + 1}
															</span>
														</div>
													</div>
												</td>

												{/* MR Number */}
												<td className="py-3.5 px-4 font-mono">
													{patient.mrNo ? (
														<span className="inline-flex items-center px-2.5 py-1 rounded-md bg-muted/60 border border-border/80 text-foreground font-semibold text-xs shadow-2xs">
															MR: {patient.mrNo}
														</span>
													) : (
														<span className="text-muted-foreground/60">—</span>
													)}
												</td>

												{/* Total Visits Badge */}
												<td className="py-3.5 px-4">
													<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
														<Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
														<span>{visitCount} {visitCount === 1 ? "Visit" : "Visits"}</span>
													</span>
												</td>

												{/* Initial Visit Date */}
												<td className="py-3.5 px-4 text-muted-foreground font-mono">
													<div className="flex items-center gap-1.5">
														<Calendar className="w-3.5 h-3.5 text-muted-foreground/60" />
														<span>{formatDate(patient.firstVisit)}</span>
													</div>
												</td>

												{/* Latest Visit Date */}
												<td className="py-3.5 px-4 font-mono font-semibold text-foreground">
													<div className="flex items-center gap-1.5">
														<Calendar className="w-3.5 h-3.5 text-[#1176bc]" />
														<span>{formatDate(patient.lastVisit)}</span>
													</div>
												</td>

												{/* Status Chip */}
												<td className="py-3.5 px-4">
													<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
														<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
														<span>Monitored</span>
													</span>
												</td>

												{/* View Records CTA Button */}
												<td className="py-3.5 px-5 text-right">
													<Link
														href={`/uid/${patient.uid}`}
														onClick={(e) => e.stopPropagation()}
														className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#1176bc] text-white shadow-2xs hover:bg-[#0e639e] group-hover:shadow-xs transition-all"
													>
														<span>View Records</span>
														<ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
													</Link>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}

					{/* Dashboard Footer */}
					<div className="px-5 py-3 border-t border-border/70 bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
						<span>Showing {filteredPatients.length} of {patients.length} patient records</span>
						<span className="font-medium text-[#1176bc]">eyeNotes Longitudinal Suite</span>
					</div>
				</div>
			</main>
		</div>
	);
}
