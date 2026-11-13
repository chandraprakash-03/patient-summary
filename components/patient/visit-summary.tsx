import React, { useMemo, useState, useEffect } from "react";
import { PatientData } from "@/types/patient";
import { Activity, Eye, Droplets, ArrowRight, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pill } from "lucide-react";
import { getLineChartData, getGanttData, getMedicationsGanttData } from "@/lib/utils/data-processing";

interface VisitSummaryProps {
  patientData: PatientData;
}

export function VisitSummary({ patientData }: VisitSummaryProps) {
  const { visits, latestVisit, lastVisit, last5Visits, reData, leData, beData, allProcedures, allDiagnoses, allMedications } = useMemo(() => {
    const sortedVisits = [...(patientData.visits || [])].sort((a, b) => a.d.localeCompare(b.d));
    const last5Visits = sortedVisits.slice(-5);
    const latestVisit = sortedVisits[sortedVisits.length - 1];
    const lastVisit = sortedVisits.length > 1 ? sortedVisits[sortedVisits.length - 2] : null;

    const reData = getLineChartData(patientData, 0);
    const leData = getLineChartData(patientData, 1);
    const beData = getLineChartData(patientData, 2);

    const reDiag = getGanttData(patientData, "diagnosis", 0);
    const leDiag = getGanttData(patientData, "diagnosis", 1);
    const beDiag = getGanttData(patientData, "diagnosis", 2);

    const reMeds = getMedicationsGanttData(patientData, 0);
    const leMeds = getMedicationsGanttData(patientData, 1);
    const beMeds = getMedicationsGanttData(patientData, 2);

    // Combine to get all unique procedures, diagnoses, medications per date
    const allProcedures = [...reData.procedures, ...leData.procedures, ...beData.procedures];
    const allDiagnoses = [...reDiag, ...leDiag, ...beDiag];
    const allMedications = [...reMeds, ...leMeds, ...beMeds];

    return { visits: sortedVisits, latestVisit, lastVisit, last5Visits, reData, leData, beData, allProcedures, allDiagnoses, allMedications };
  }, [patientData]);

  const [visitIndex, setVisitIndex] = useState<number>(0);

  useEffect(() => {
    if (visits && visits.length > 0) {
      setVisitIndex(0);
    }
  }, [visits]);

  if (!visits || visits.length === 0) return null;
  const currentVisit = visits[Math.min(visitIndex, visits.length - 1)];

  const getVAForDate = (date: string, eyeData: any) => {
    const vaPoint = eyeData.visualAcuityData.find((d: any) => d.x === date);
    return vaPoint?.y && vaPoint.y !== "N/A" ? vaPoint.y : "-";
  };

  const getIOPForDate = (date: string, eyeData: any) => {
    const iopPoint = eyeData.iopData.find((d: any) => d.x === date);
    return iopPoint ? `${iopPoint.y}` : "-";
  };

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr.substring(0, 10);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
    } catch {
      return dateStr.substring(0, 10);
    }
  };

  return (
    <div className="space-y-6">
      {/* Single Visit Detail */}
      <div className="bg-card p-5 rounded-xl border shadow-sm flex flex-col gap-4">

        {/* Paginator Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/50">
          <div className="flex gap-2">
            <button
              onClick={() => setVisitIndex(0)}
              disabled={visitIndex === 0}
              className="p-1.5 rounded-full hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors border shadow-sm"
              title="First Visit"
            >
              <ChevronsLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <button
              onClick={() => setVisitIndex(prev => Math.max(0, prev - 1))}
              disabled={visitIndex === 0}
              className="p-1.5 rounded-full hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors border shadow-sm"
              title="Previous Visit"
            >
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="text-sm font-bold text-primary flex items-center gap-2">
              <Activity className="w-4 h-4" /> Visit Details
            </div>
            <div className="text-xs text-muted-foreground font-medium mt-1">
              {formatShortDate(currentVisit.d)}
              <span className="ml-2 bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">
                {visitIndex + 1} of {visits.length}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setVisitIndex(prev => Math.min(visits.length - 1, prev + 1))}
              disabled={visitIndex === visits.length - 1}
              className="p-1.5 rounded-full hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors border shadow-sm"
              title="Next Visit"
            >
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
            <button
              onClick={() => setVisitIndex(visits.length - 1)}
              disabled={visitIndex === visits.length - 1}
              className="p-1.5 rounded-full hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors border shadow-sm"
              title="Last Visit"
            >
              <ChevronsRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Visit Content */}
        {(() => {
          const date = currentVisit.d;
          const procsAtDate = Array.from(new Map(allProcedures.filter(p => p.date === date).map(p => [p.name, p])).values());
          const diagsAtDate = Array.from(new Map(allDiagnoses.filter(d => d.start <= date && d.end >= date).map(d => [d.task, d])).values());
          const medsAtDate = Array.from(new Map(allMedications.filter(m => m.start <= date && m.end >= date).map(m => [m.task, m])).values());

          return (
            <div className="space-y-4">
              {/* VA & IOP */}
              <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-lg border border-border/50 shadow-inner">
                <div>
                  <div className="font-bold text-xs text-muted-foreground uppercase mb-2 tracking-wider flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> VA
                  </div>
                  <div className="space-y-1">
                    {['RE', 'LE', 'BE'].map((eye, i) => {
                      const data = i === 0 ? reData : i === 1 ? leData : beData;
                      const val = getVAForDate(date, data);
                      if (val === "-") return null;
                      return <div key={eye} className="flex justify-between text-xs items-center bg-background/50 px-2 py-1 rounded"><span className="font-medium text-muted-foreground">{eye}</span><span className="font-bold">{val}</span></div>;
                    })}
                    {['RE', 'LE', 'BE'].every((eye, i) => getVAForDate(date, i === 0 ? reData : i === 1 ? leData : beData) === "-") && <div className="text-[11px] text-muted-foreground italic px-1">Not Recorded</div>}
                  </div>
                </div>
                <div>
                  <div className="font-bold text-xs text-muted-foreground uppercase mb-2 tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" /> IOP
                  </div>
                  <div className="space-y-1">
                    {['RE', 'LE', 'BE'].map((eye, i) => {
                      const data = i === 0 ? reData : i === 1 ? leData : beData;
                      const val = getIOPForDate(date, data);
                      if (val === "-") return null;
                      return <div key={eye} className="flex justify-between text-xs items-center bg-background/50 px-2 py-1 rounded"><span className="font-medium text-muted-foreground">{eye}</span><span className="font-bold">{val}</span></div>;
                    })}
                    {['RE', 'LE', 'BE'].every((eye, i) => getIOPForDate(date, i === 0 ? reData : i === 1 ? leData : beData) === "-") && <div className="text-[11px] text-muted-foreground italic px-1">Not Recorded</div>}
                  </div>
                </div>
              </div>

              {/* Procedures */}
              {procsAtDate.length > 0 && (
                <div className="bg-card p-3 rounded-lg border border-border/80 shadow-2xs">
                  <div className="font-bold text-xs text-foreground uppercase mb-2 flex items-center gap-1.5 tracking-wider">
                    <Droplets className="w-3.5 h-3.5 text-primary" /> Procedures
                  </div>
                  <ul className="list-disc pl-4 text-xs space-y-1.5 text-foreground/90">
                    {procsAtDate.map((p, i) => <li key={i} className="leading-tight">{p.name}</li>)}
                  </ul>
                </div>
              )}

              {/* Diagnoses */}
              {diagsAtDate.length > 0 && (
                <div className="bg-card p-3 rounded-lg border border-border/80 shadow-2xs">
                  <div className="font-bold text-xs text-foreground uppercase mb-2 flex items-center gap-1.5 tracking-wider">
                    <Activity className="w-3.5 h-3.5 text-primary" /> Diagnoses
                  </div>
                  <ul className="list-disc pl-4 text-xs space-y-1.5 text-foreground/90">
                    {diagsAtDate.map((d, i) => <li key={i} className="leading-tight">{d.task}</li>)}
                  </ul>
                </div>
              )}

              {/* Medications */}
              {medsAtDate.length > 0 && (
                <div className="bg-card p-3 rounded-lg border border-border/80 shadow-2xs">
                  <div className="font-bold text-xs text-foreground uppercase mb-2 flex items-center gap-1.5 tracking-wider">
                    <Pill className="w-3.5 h-3.5 text-primary" /> Medications
                  </div>
                  <ul className="list-disc pl-4 text-xs space-y-1.5 text-foreground/90">
                    {medsAtDate.map((m, i) => <li key={i} className="leading-tight">{m.task}</li>)}
                  </ul>
                </div>
              )}

              {procsAtDate.length === 0 && diagsAtDate.length === 0 && medsAtDate.length === 0 && (
                <div className="text-sm text-center py-6 text-muted-foreground/60 italic border border-dashed border-muted-foreground/30 rounded-lg">
                  No major events or medications recorded for this visit.
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
