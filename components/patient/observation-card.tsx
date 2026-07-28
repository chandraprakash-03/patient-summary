import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { LucideIcon } from "lucide-react"

interface ObservationCardProps {
  title: string
  summary: string
  icon: LucideIcon
  badgeCount?: number
  children: React.ReactNode
}

export function ObservationCard({
  title,
  summary,
  icon: Icon,
  badgeCount,
  children,
}: ObservationCardProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="group relative hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300 cursor-pointer border bg-card/80 backdrop-blur-sm overflow-hidden">
          {/* Subtle top gradient line that reveals on hover */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          <CardContent className="p-5 flex items-start gap-4">
            <div className="bg-primary/10 p-2.5 rounded-full text-primary shadow-inner">
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-[15px] truncate text-foreground group-hover:text-primary transition-colors">{title}</h3>
                {badgeCount !== undefined && badgeCount > 0 && (
                  <span className="inline-flex items-center justify-center bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {badgeCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {summary}
              </p>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[95vw] w-full max-h-[90vh] flex flex-col overflow-hidden bg-background/95 backdrop-blur-md">
        <DialogHeader className="flex-shrink-0 border-b pb-4">
          <DialogTitle className="text-2xl flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
              <Icon className="h-6 w-6" />
            </div>
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="pt-4 overflow-y-auto min-h-0 box-scroll">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
