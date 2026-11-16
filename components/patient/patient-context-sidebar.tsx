"use client";

import * as React from "react";
import { useState } from "react";
import {
	ChevronUp,
	ChevronDown,
	PanelLeftClose,
	PanelLeftOpen,
	Stethoscope,
	FileText,
} from "lucide-react";
import { PatientClinicalSummary } from "@/types/patient";

interface PatientContextSidebarProps {
	clinicalSummary: PatientClinicalSummary | null;
	sidebarWidth: number;
	setSidebarWidth: (width: number) => void;
	mobileOpen: boolean;
	setMobileOpen: (open: boolean) => void;
	resizing: boolean;
	startResize: (e: React.PointerEvent<HTMLDivElement>) => void;
}

interface ParsedEyeSummary {
	title: string;
	sections: ParsedEyeSection[];
	rawFallback?: string;
}

interface ParsedEyeSection {
	heading: string;
	content: string;
}

export function PatientContextSidebar({
	clinicalSummary,
	sidebarWidth,
	setSidebarWidth,
	mobileOpen,
	setMobileOpen,
	resizing,
	startResize,
}: PatientContextSidebarProps) {
	// Sidebar collapsed/expanded state on desktop
	const [isCollapsed, setIsCollapsed] = useState(false);

	// Accordion states for each section
	const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
		be: true,
		re: true,
		le: true,
		note: true,
	});

	const toggleSection = (key: string) => {
		setExpandedSections((prev) => ({
			...prev,
			[key]: !prev[key],
		}));
	};

	// Parse structured summary texts
	const parseEyeText = (text: string): ParsedEyeSummary => {
		if (!text) return { title: "", sections: [] };

		const trimmed = text.trim();
		// Look for standard headings: CURRENT STATUS, COURSE, DETAILS, PLAN, etc.
		const headingRegex = /(CURRENT STATUS|COURSE|DETAILS|PLAN|IMPRESSION|DIAGNOSIS):\s*/gi;
		const matches: { heading: string; index: number; length: number }[] = [];

		let match: RegExpExecArray | null;
		while ((match = headingRegex.exec(trimmed)) !== null) {
			matches.push({
				heading: match[1].toUpperCase(),
				index: match.index,
				length: match[0].length,
			});
		}

		if (matches.length === 0) {
			// No standard labeled headings; check for title line or return raw
			const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
			if (lines.length > 1) {
				return {
					title: lines[0],
					sections: [{ heading: "SUMMARY", content: lines.slice(1).join(" ") }],
				};
			}
			return {
				title: "",
				sections: [],
				rawFallback: trimmed,
			};
		}

		// First part before first match is the eye disease/title (e.g. AMD · High myopia · PCV)
		const title = trimmed.substring(0, matches[0].index).trim().replace(/^[-–—•\s]+|[-–—•\s]+$/g, "");

		const sections: ParsedEyeSection[] = [];
		for (let i = 0; i < matches.length; i++) {
			const current = matches[i];
			const next = matches[i + 1];
			const contentStart = current.index + current.length;
			const contentEnd = next ? next.index : trimmed.length;
			const content = trimmed.substring(contentStart, contentEnd).trim();

			sections.push({
				heading: current.heading,
				content,
			});
		}

		return {
			title,
			sections,
		};
	};

	const beData = React.useMemo(() => {
		if (!clinicalSummary?.beSummary) return null;
		return parseEyeText(clinicalSummary.beSummary);
	}, [clinicalSummary?.beSummary]);

	const reData = React.useMemo(() => {
		if (!clinicalSummary?.reSummary) return null;
		return parseEyeText(clinicalSummary.reSummary);
	}, [clinicalSummary?.reSummary]);

	const leData = React.useMemo(() => {
		if (!clinicalSummary?.leSummary) return null;
		return parseEyeText(clinicalSummary.leSummary);
	}, [clinicalSummary?.leSummary]);

	const hasAnyData = Boolean(
		beData || reData || leData || clinicalSummary?.clinicalNote
	);

	// Collapsed sidebar rail view (Desktop)
	if (isCollapsed) {
		return (
			<aside
				className="hidden lg:flex w-12 shrink-0 border-r border-[#cde1ef] dark:border-border bg-white dark:bg-card flex-col items-center py-3 select-none transition-all duration-200 z-20 shadow-xs"
				title="Expand Patient Context"
			>
				<button
					onClick={() => setIsCollapsed(false)}
					className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
					aria-label="Expand sidebar"
					title="Expand Patient Context sidebar"
				>
					<PanelLeftOpen className="w-5 h-5 text-[#1176bc]" />
				</button>

				<div
					onClick={() => setIsCollapsed(false)}
					className="mt-8 flex-1 flex flex-col items-center cursor-pointer group"
				>
					<div className="rotate-90 origin-center whitespace-nowrap text-xs font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400 group-hover:text-[#1176bc] transition-colors flex items-center gap-2 mt-12">
						<Stethoscope className="w-3.5 h-3.5 text-[#1176bc] -rotate-90 inline-block" />
						<span>Patient Context</span>
					</div>

					<div className="mt-auto flex flex-col items-center gap-2 pb-4 text-[10px] text-muted-foreground font-semibold">
						<span className="w-2 h-2 rounded-full bg-[#00897b]" title="Bilateral" />
						<span className="w-2 h-2 rounded-full bg-[#0288d1]" title="Right Eye" />
						<span className="w-2 h-2 rounded-full bg-[#8e24aa]" title="Left Eye" />
					</div>
				</div>
			</aside>
		);
	}

	return (
		<aside
			style={{ ["--sw" as string]: `${sidebarWidth}px` }}
			className={`relative w-full lg:w-[var(--sw)] shrink-0 border-b lg:border-b-0 lg:border-r border-[#e2edf5] dark:border-border bg-white dark:bg-[#0c1322] flex flex-col ${
				resizing ? "" : "transition-all duration-200"
			} ${
				mobileOpen
					? "block max-h-[420px] lg:max-h-none h-auto lg:h-full shadow-lg lg:shadow-none"
					: "hidden lg:flex lg:h-full"
			}`}
		>
			{/* Top Header */}
			<div className="px-5 py-3.5 border-b border-[#e2edf5] dark:border-border flex items-center justify-between shrink-0 bg-white dark:bg-card">
				<div className="flex items-center gap-2.5">
					<Stethoscope className="w-4 h-4 text-[#1176bc] shrink-0" />
					<div>
						<div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
							PATIENT CONTEXT
						</div>
						<div className="text-[15px] font-black text-[#0f2d4a] dark:text-slate-100 tracking-tight leading-tight">
							Clinical Status &amp; Course
						</div>
					</div>
				</div>

				<div className="flex items-center gap-1">
					{/* Desktop: Collapse sidebar completely */}
					<button
						onClick={() => setIsCollapsed(true)}
						className="hidden lg:flex p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
						title="Collapse sidebar to mini bar"
						aria-label="Collapse sidebar"
					>
						<PanelLeftClose className="w-4 h-4" />
					</button>

					{/* Mobile: Close drawer */}
					<button
						onClick={() => setMobileOpen(false)}
						className="lg:hidden text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border bg-muted/40 font-medium"
					>
						Close
					</button>
				</div>
			</div>

			{/* Sidebar Accordion Content Area (Divider-separated, borderless cards) */}
			<div className="flex-1 overflow-y-auto box-scroll px-5 py-4 divide-y divide-[#e2edf5] dark:divide-slate-800/80">
				{!hasAnyData ? (
					<div className="text-xs text-muted-foreground px-4 py-6 text-center">
						No clinical summary or notes recorded for this patient.
					</div>
				) : (
					<>
						{/* 1. BILATERAL · BE */}
						{beData && (
							<AccordionSection
								badgeColor="bg-[#00897b]"
								badgeText="BILATERAL · BE"
								textColor="text-[#00897b]"
								isExpanded={expandedSections.be}
								onToggle={() => toggleSection("be")}
								title={beData.title}
								sections={beData.sections}
								rawFallback={beData.rawFallback}
								isFirst
							/>
						)}

						{/* 2. RIGHT EYE · RE */}
						{reData && (
							<AccordionSection
								badgeColor="bg-[#0288d1]"
								badgeText="RIGHT EYE · RE"
								textColor="text-[#0288d1]"
								isExpanded={expandedSections.re}
								onToggle={() => toggleSection("re")}
								title={reData.title}
								sections={reData.sections}
								rawFallback={reData.rawFallback}
							/>
						)}

						{/* 3. LEFT EYE · LE */}
						{leData && (
							<AccordionSection
								badgeColor="bg-[#8e24aa]"
								badgeText="LEFT EYE · LE"
								textColor="text-[#8e24aa]"
								isExpanded={expandedSections.le}
								onToggle={() => toggleSection("le")}
								title={leData.title}
								sections={leData.sections}
								rawFallback={leData.rawFallback}
							/>
						)}

						{/* 4. CLINICAL NOTE */}
						{clinicalSummary?.clinicalNote && (
							<div className="py-4">
								<button
									onClick={() => toggleSection("note")}
									data-no-hover
									className="w-full flex items-center justify-between text-left group bg-transparent hover:bg-transparent"
								>
									<div className="flex items-center gap-2">
										<FileText className="w-3.5 h-3.5 text-[#1176bc]" />
										<span className="text-[12px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
											CLINICAL NOTE
										</span>
									</div>
									<div className="text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
										{expandedSections.note ? (
											<ChevronUp className="w-4 h-4" />
										) : (
											<ChevronDown className="w-4 h-4" />
										)}
									</div>
								</button>
								{expandedSections.note && (
									<div className="pt-2 text-[13px] leading-relaxed font-medium text-slate-800 dark:text-slate-100">
										{clinicalSummary.clinicalNote}
									</div>
								)}
							</div>
						)}
					</>
				)}
			</div>

			{/* Drag handle: resize sidebar width (Desktop) */}
			<div
				onPointerDown={startResize}
				onDoubleClick={() => setSidebarWidth(440)}
				role="separator"
				aria-orientation="vertical"
				title="Drag to resize (double-click to reset)"
				className={`hidden lg:block absolute top-0 -right-1 h-full w-2 z-30 cursor-col-resize touch-none transition-colors ${
					resizing ? "bg-primary/60" : "hover:bg-primary/40"
				}`}
			/>
		</aside>
	);
}

interface AccordionSectionProps {
	badgeColor: string;
	badgeText: string;
	textColor: string;
	isExpanded: boolean;
	onToggle: () => void;
	title?: string;
	sections: ParsedEyeSection[];
	rawFallback?: string;
	isFirst?: boolean;
}

function AccordionSection({
	badgeColor,
	badgeText,
	textColor,
	isExpanded,
	onToggle,
	title,
	sections,
	rawFallback,
	isFirst = false,
}: AccordionSectionProps) {
	return (
		<div className={isFirst ? "pb-4" : "py-4"}>
			{/* Accordion Header */}
			<button
				onClick={onToggle}
				aria-expanded={isExpanded}
				data-no-hover
				className="w-full flex items-center justify-between text-left group gap-2 bg-transparent hover:bg-transparent"
			>
				<div className="flex items-center gap-2 min-w-0">
					<span className={`w-2 h-2 rounded-full shrink-0 ${badgeColor}`} />
					<span
						className={`text-[12px] font-black uppercase tracking-wider truncate ${textColor}`}
					>
						{badgeText}
					</span>
				</div>

				<div className="text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 shrink-0 transition-colors">
					{isExpanded ? (
						<ChevronUp className="w-4 h-4" />
					) : (
						<ChevronDown className="w-4 h-4" />
					)}
				</div>
			</button>

			{/* Accordion Body */}
			{isExpanded && (
				<div className="pt-2 space-y-3">
					{/* Eye condition title / diagnosis heading */}
					{title && (
						<h4 className="text-[15px] font-black text-[#0f2d4a] dark:text-slate-100 tracking-tight leading-snug">
							{title}
						</h4>
					)}

					{/* Structured Key-Value Sections */}
					{sections.length > 0 ? (
						<div className="space-y-3">
							{sections.map((section, idx) => (
								<div key={idx} className="text-[13px] leading-relaxed text-slate-800 dark:text-slate-100">
									<span className="text-[12px] font-black uppercase tracking-wider text-slate-950 dark:text-white">
										{section.heading}:
									</span>{" "}
									<span className="font-medium text-slate-800 dark:text-slate-100">
										{section.content}
									</span>
								</div>
							))}
						</div>
					) : rawFallback ? (
						<div className="text-[13px] leading-relaxed font-medium text-slate-800 dark:text-slate-100">
							{rawFallback}
						</div>
					) : null}
				</div>
			)}
		</div>
	);
}
