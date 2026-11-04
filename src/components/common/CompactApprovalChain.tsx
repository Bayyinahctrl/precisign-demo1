import React, { useState } from 'react';
import { RequestRecord } from '../../types/index';
import { buildApprovalJourney, JourneyMilestone } from '../../utils/approvalJourney';
import { Check, RotateCcw, XCircle, ArrowRight, CornerDownRight, ShieldCheck, ChevronRight } from 'lucide-react';

interface CompactApprovalChainProps {
  request: RequestRecord;
  currentUserId?: string;
  onOpenDetail?: (request: RequestRecord) => void;
  maxVisible?: number;
  showProgressText?: boolean;
}

export const CompactApprovalChain: React.FC<CompactApprovalChainProps> = ({
  request,
  currentUserId,
  onOpenDetail,
  maxVisible = 3,
  showProgressText = true,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const journey = buildApprovalJourney(request, currentUserId);
  const { milestones, stageCounts, responsibility } = journey;

  // Split milestones for compact overflow display
  const totalMilestones = milestones.length;
  const visibleMilestones = totalMilestones > maxVisible ? milestones.slice(0, maxVisible) : milestones;
  const overflowCount = totalMilestones - visibleMilestones.length;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenDetail) {
      onOpenDetail(request);
    }
  };

  const getMilestoneIcon = (milestone: JourneyMilestone) => {
    switch (milestone.status) {
      case 'completed':
      case 'submitted':
        return <Check className="w-2.5 h-2.5 stroke-[2.5]" />;
      case 'returned':
        return <RotateCcw className="w-2.5 h-2.5 stroke-[2.5]" />;
      case 'rejected':
        return <XCircle className="w-2.5 h-2.5 stroke-[2.5]" />;
      case 'bypassed':
        return <ShieldCheck className="w-2.5 h-2.5 stroke-[2.5]" />;
      case 'current':
        return <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />;
      default:
        return <span className="text-[9px] font-semibold">{milestone.participantInitials}</span>;
    }
  };

  const getMilestoneStyle = (milestone: JourneyMilestone) => {
    switch (milestone.status) {
      case 'completed':
      case 'submitted':
        return 'bg-emerald-600 text-white border-emerald-600 shadow-2xs';
      case 'returned':
        return 'bg-amber-500 text-white border-amber-500 ring-2 ring-amber-200';
      case 'rejected':
        return 'bg-rose-600 text-white border-rose-600';
      case 'bypassed':
        return 'bg-slate-400 text-white border-slate-400';
      case 'current':
        return milestone.isAssignedToCurrentUser
          ? 'bg-[#365C78] text-white border-[#192B3C] ring-2 ring-[#365C78]/40 ring-offset-1 font-bold'
          : 'bg-[#365C78] text-white border-[#365C78] ring-2 ring-sky-200';
      case 'waiting':
      default:
        return 'bg-slate-100 text-slate-400 border-slate-200';
    }
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as any);
        }
      }}
      aria-label={`Approval Journey for ${request.id}: ${responsibility.headline}. ${stageCounts.summaryText}`}
      className="group inline-flex flex-col gap-1 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#365C78] rounded p-1 -m-1 transition-colors hover:bg-slate-100/70"
    >
      {/* Horizontal Participant Avatar Chain */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center">
          {visibleMilestones.map((m, idx) => {
            const isLast = idx === visibleMilestones.length - 1 && overflowCount === 0;

            return (
              <React.Fragment key={m.id}>
                {/* Participant Node */}
                <div
                  title={`${m.participantName} (${m.participantRole}) — ${m.statusLabel}`}
                  className={`relative flex items-center justify-center w-5 h-5 rounded-full border text-[9px] transition-transform group-hover:scale-105 shrink-0 select-none ${getMilestoneStyle(
                    m
                  )}`}
                >
                  {getMilestoneIcon(m)}

                  {/* Tiny action dot if user action needed */}
                  {m.isAssignedToCurrentUser && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 ring-1 ring-white" />
                  )}
                </div>

                {/* Connecting Line */}
                {!isLast && (
                  <div
                    className={`w-2.5 sm:w-3.5 h-[1.5px] transition-colors ${
                      m.status === 'completed' || m.status === 'submitted'
                        ? 'bg-emerald-500'
                        : m.status === 'returned'
                        ? 'bg-amber-400'
                        : 'bg-slate-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* Overflow Badge */}
          {overflowCount > 0 && (
            <div
              title={`${overflowCount} additional upcoming participant${overflowCount > 1 ? 's' : ''}`}
              className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 border border-slate-300 text-[9px] font-bold text-slate-700 ml-1 shrink-0"
            >
              +{overflowCount}
            </div>
          )}
        </div>

        {/* Quick progress indicator pill */}
        {showProgressText && (
          <span
            className={`text-[10px] font-mono font-medium px-1.5 py-0.2 rounded border transition-colors ${
              responsibility.variant === 'completed'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : responsibility.variant === 'action_needed'
                ? 'bg-sky-50 text-[#192B3C] font-semibold border-sky-300 ring-1 ring-sky-300/40'
                : responsibility.variant === 'returned'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : responsibility.variant === 'rejected'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            {stageCounts.completedStages}/{stageCounts.totalStages}
          </span>
        )}
      </div>

      {/* Responsibility Status Line */}
      <div className="flex items-center gap-1 text-[11px] leading-tight">
        <span
          className={`font-medium truncate max-w-[210px] ${
            responsibility.variant === 'action_needed'
              ? 'text-[#365C78] font-bold'
              : responsibility.variant === 'returned'
              ? 'text-amber-800 font-semibold'
              : responsibility.variant === 'rejected'
              ? 'text-rose-700 font-semibold'
              : responsibility.variant === 'completed'
              ? 'text-emerald-700 font-medium'
              : 'text-slate-700'
          }`}
        >
          {responsibility.headline}
        </span>
        <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </div>
  );
};
