import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { RequestRecord, PriorityLevel } from '../../types/index';
import {
  Inbox,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpDown,
  Plus,
  ArrowRight,
  ExternalLink,
  Clock,
  Check,
  Building,
} from 'lucide-react';
import { CompactApprovalChain } from '../common/CompactApprovalChain';
import { ApprovalJourneyModal } from '../common/ApprovalJourneyModal';
import { ApprovalJourneyPanel } from '../journey/ApprovalJourneyPanel';

export const DashboardView: React.FC = () => {
  const {
    currentUser,
    companyRequests,
    selectedCompany,
    setActiveView,
    requestsFilter,
    setRequestsFilter,
    openReviewRequest,
    setSelectedRequestFormType,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRowId, setExpandedRowId] = useState<string | null>('PEW-AW-2026-0018');
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'priority' | 'id'>('date-desc');
  const [selectedJourneyRequest, setSelectedJourneyRequest] = useState<RequestRecord | null>(null);
  const [internalTab, setInternalTab] = useState<'pending' | 'my' | 'all' | 'returned' | 'approved'>(
    requestsFilter === 'pending'
      ? 'pending'
      : requestsFilter === 'my'
      ? 'my'
      : requestsFilter === 'approved'
      ? 'approved'
      : 'all'
  );

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    requester: true,
    currentApprover: true,
    prioritySla: true,
    status: true,
    createdAt: true,
  });

  // Calculate dynamic KPIs from shared company requests
  const pendingForMeRequests = useMemo(() => {
    return companyRequests.filter(
      (r) => r.status === 'Pending Approval' && r.currentApproverId === currentUser.id
    );
  }, [companyRequests, currentUser]);

  const urgentOrOverdueRequests = useMemo(() => {
    return companyRequests.filter(
      (r) => r.formData.priority === 'Urgent' && r.status === 'Pending Approval'
    );
  }, [companyRequests]);

  const returnedRequests = useMemo(() => {
    return companyRequests.filter((r) => r.status === 'Returned for Correction');
  }, [companyRequests]);

  const approvedRequests = useMemo(() => {
    return companyRequests.filter((r) => r.status === 'Approved');
  }, [companyRequests]);

  const myRequests = useMemo(() => {
    return companyRequests.filter((r) => r.requesterId === currentUser.id);
  }, [companyRequests, currentUser]);

  // Keep internal tab in sync if sidebar filter changed
  React.useEffect(() => {
    if (requestsFilter === 'pending') setInternalTab('pending');
    else if (requestsFilter === 'my') setInternalTab('my');
    else if (requestsFilter === 'approved') setInternalTab('approved');
    else if (requestsFilter === 'all') setInternalTab('all');
  }, [requestsFilter]);

  // Filter & sort requests for the operational table
  const filteredRequests = useMemo(() => {
    let list: RequestRecord[] = [];
    if (internalTab === 'pending') {
      list = pendingForMeRequests;
    } else if (internalTab === 'my') {
      list = myRequests;
    } else if (internalTab === 'returned') {
      list = returnedRequests;
    } else if (internalTab === 'approved') {
      list = approvedRequests;
    } else {
      list = companyRequests;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.formType.toLowerCase().includes(q) ||
          r.requesterName.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.formData.workDescription.toLowerCase().includes(q) ||
          (r.currentApproverName && r.currentApproverName.toLowerCase().includes(q))
      );
    }

    // Sort list
    const sorted = [...list];
    if (sortBy === 'date-desc') {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'date-asc') {
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortBy === 'priority') {
      const order: Record<PriorityLevel, number> = { Urgent: 0, Medium: 1, Low: 2 };
      sorted.sort((a, b) => order[a.formData.priority] - order[b.formData.priority]);
    } else if (sortBy === 'id') {
      sorted.sort((a, b) => a.id.localeCompare(b.id));
    }

    return sorted;
  }, [internalTab, pendingForMeRequests, myRequests, returnedRequests, approvedRequests, companyRequests, searchQuery, sortBy]);

  const getSlaDescription = (priority: PriorityLevel) => {
    switch (priority) {
      case 'Urgent':
        return '< 1 hr (Immediate)';
      case 'Medium':
        return '3 business days';
      case 'Low':
        return '7 business days';
      default:
        return 'Standard';
    }
  };

  return (
    <div className="p-3.5 sm:p-6 md:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Top Section: Operational Status & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E2E5E9]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#192B3C]">
              Operational Inbox
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#EBF2F7] text-[#365C78] border border-[#C2D5E3]">
              {selectedCompany.code}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            Signed-in persona: <strong className="text-[#192B3C]">{currentUser.name}</strong> ({currentUser.role} · {currentUser.department}).
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedRequestFormType('Admin Work Request');
            setActiveView('create-request');
          }}
          className="flex items-center justify-center gap-2 px-3.5 py-2 bg-[#365C78] hover:bg-[#2A4A62] text-white rounded-md text-xs font-semibold shadow-xs transition-colors w-full sm:w-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Request</span>
        </button>
      </div>

      {/* 4 Compact Operational KPI Summaries (Restrained & Linear) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* KPI 1: Awaiting My Action */}
        <button
          onClick={() => {
            setInternalTab('pending');
            setRequestsFilter('pending');
          }}
          className={`p-3.5 rounded-lg border text-left transition-all bg-white flex flex-col justify-between ${
            internalTab === 'pending'
              ? 'border-[#365C78] ring-1 ring-[#365C78]/30 shadow-xs'
              : 'border-[#E2E5E9] hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
              Awaiting My Action
            </span>
            <Inbox className="w-4 h-4 text-[#365C78]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#192B3C] tabular-nums">
              {pendingForMeRequests.length}
            </span>
            <span className="text-[11px] text-slate-400">
              {pendingForMeRequests.length === 1 ? '1 item' : `${pendingForMeRequests.length} items`}
            </span>
          </div>
        </button>

        {/* KPI 2: Urgent Priority Target */}
        <button
          onClick={() => {
            setInternalTab('all');
            setSortBy('priority');
          }}
          className={`p-3.5 rounded-lg border text-left transition-all bg-white flex flex-col justify-between ${
            urgentOrOverdueRequests.length > 0
              ? 'border-rose-300 bg-rose-50/20'
              : 'border-[#E2E5E9] hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wide">
              Urgent Priority Items
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-700 tabular-nums">
              {urgentOrOverdueRequests.length}
            </span>
            <span className="text-[11px] text-rose-600 font-medium">Target: &lt; 1 hour</span>
          </div>
        </button>

        {/* KPI 3: Returned for Correction */}
        <button
          onClick={() => setInternalTab('returned')}
          className={`p-3.5 rounded-lg border text-left transition-all bg-white flex flex-col justify-between ${
            internalTab === 'returned'
              ? 'border-[#365C78] ring-1 ring-[#365C78]/30 shadow-xs'
              : 'border-[#E2E5E9] hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide">
              Returned for Correction
            </span>
            <RotateCcw className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-900 tabular-nums">
              {returnedRequests.length}
            </span>
            <span className="text-[11px] text-amber-700">Needs revision</span>
          </div>
        </button>

        {/* KPI 4: Recently Completed / Total */}
        <button
          onClick={() => {
            setInternalTab('approved');
            setRequestsFilter('approved');
          }}
          className={`p-3.5 rounded-lg border text-left transition-all bg-white flex flex-col justify-between ${
            internalTab === 'approved'
              ? 'border-[#365C78] ring-1 ring-[#365C78]/30 shadow-xs'
              : 'border-[#E2E5E9] hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide">
              Approved &amp; Archived
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-700 tabular-nums">
              {approvedRequests.length}
            </span>
            <span className="text-[11px] text-slate-400">Total: {companyRequests.length}</span>
          </div>
        </button>
      </div>

      {/* Main Operational Table Container */}
      <div className="bg-white border border-[#E2E5E9] rounded-lg overflow-hidden shadow-xs">
        {/* Table Controls Bar: Operational Filter Tabs + Search + Sort + Columns */}
        <div className="p-3 sm:p-3.5 border-b border-[#E2E5E9] flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#F9FAFB]">
          {/* Segmented Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none shrink-0">
            <button
              onClick={() => {
                setInternalTab('pending');
                setRequestsFilter('pending');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                internalTab === 'pending'
                  ? 'bg-[#365C78] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Awaiting Action ({pendingForMeRequests.length})
            </button>
            <button
              onClick={() => {
                setInternalTab('my');
                setRequestsFilter('my');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                internalTab === 'my'
                  ? 'bg-[#365C78] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              My Requests ({myRequests.length})
            </button>
            <button
              onClick={() => setInternalTab('returned')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                internalTab === 'returned'
                  ? 'bg-[#365C78] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Returned ({returnedRequests.length})
            </button>
            <button
              onClick={() => {
                setInternalTab('all');
                setRequestsFilter('all');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                internalTab === 'all'
                  ? 'bg-[#365C78] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              All Requests ({companyRequests.length})
            </button>
            <button
              onClick={() => {
                setInternalTab('approved');
                setRequestsFilter('approved');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                internalTab === 'approved'
                  ? 'bg-[#365C78] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Completed ({approvedRequests.length})
            </button>
          </div>

          {/* Search, Sort & Columns Visibility */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-2.5 py-1 text-xs border border-[#E2E5E9] bg-white rounded-md focus:outline-none focus:ring-1 focus:ring-[#365C78] focus:border-[#365C78] w-full sm:w-48"
              />
            </div>

            {/* Sort Picker */}
            <div className="flex items-center gap-1 border border-[#E2E5E9] rounded-md px-2 py-1 bg-white text-xs shrink-0">
              <ArrowUpDown className="w-3 h-3 text-slate-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="Sort Requests By"
                className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="priority">Priority Order</option>
                <option value="id">Request ID</option>
              </select>
            </div>

            {/* Column Visibility Selector */}
            <div className="relative">
              <button
                onClick={() => setShowColumnsMenu(!showColumnsMenu)}
                className="flex items-center gap-1 px-2.5 py-1 border border-[#E2E5E9] bg-white rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                title="Customize table columns"
              >
                <SlidersHorizontal className="w-3 h-3 text-slate-500" />
                <span className="hidden sm:inline">Columns</span>
                <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
              </button>

              {showColumnsMenu && (
                <div className="absolute right-0 mt-1 w-52 bg-white border border-[#E2E5E9] rounded-md shadow-lg p-2 z-30 space-y-1 text-xs">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Show / Hide Columns
                  </div>
                  {Object.entries(visibleColumns).map(([col, val]) => {
                    const columnLabels: Record<string, string> = {
                      id: 'Request ID & Document',
                      requester: 'Requester',
                      currentApprover: 'Current Approver',
                      prioritySla: 'Priority & Target',
                      status: 'Workflow Status',
                      createdAt: 'Submission Date',
                    };
                    return (
                      <label
                        key={col}
                        className="flex items-center justify-between px-2 py-1 rounded hover:bg-[#F5F6F8] cursor-pointer"
                      >
                        <span>{columnLabels[col] || col}</span>
                        <input
                          type="checkbox"
                          checked={val}
                          onChange={() =>
                            setVisibleColumns((prev) => ({
                              ...prev,
                              [col]: !prev[col as keyof typeof visibleColumns],
                            }))
                          }
                          className="rounded text-[#365C78] focus:ring-[#365C78]"
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Operational Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F5F6F8] border-b border-[#E2E5E9] text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3 w-8"></th>
                {visibleColumns.id && <th className="py-2.5 px-3">Request ID &amp; Document</th>}
                {visibleColumns.requester && <th className="py-2.5 px-3">Requester</th>}
                {visibleColumns.currentApprover && <th className="py-2.5 px-3 min-w-[220px]">Approval Journey &amp; Progress</th>}
                {visibleColumns.prioritySla && <th className="py-2.5 px-3">Priority &amp; Target</th>}
                {visibleColumns.status && <th className="py-2.5 px-3">Workflow Status</th>}
                {visibleColumns.createdAt && <th className="py-2.5 px-3">Submission Date</th>}
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E5E9]">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <p className="font-medium text-slate-600">No requests found</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      No matching records found for the selected tab and filter.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const isExpanded = expandedRowId === req.id;
                  const isUrgent = req.formData.priority === 'Urgent';
                  const isPendingMe =
                    req.status === 'Pending Approval' && req.currentApproverId === currentUser.id;

                  return (
                    <React.Fragment key={req.id}>
                      <tr
                        onClick={() => setExpandedRowId(isExpanded ? null : req.id)}
                        className={`hover:bg-[#F9FAFB] transition-colors cursor-pointer ${
                          isExpanded ? 'bg-[#EBF2F7]/40' : ''
                        }`}
                      >
                        {/* Expand toggle */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedRowId(isExpanded ? null : req.id);
                            }}
                            className="text-slate-400 hover:text-slate-600"
                            aria-label={`Expand details for ${req.id}`}
                          >
                            <ChevronDown
                              className={`w-3.5 h-3.5 transition-transform ${
                                isExpanded ? 'rotate-180 text-[#365C78]' : ''
                              }`}
                            />
                          </button>
                        </td>

                        {/* Request ID + Form */}
                        {visibleColumns.id && (
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-[#192B3C] font-mono tracking-tight flex items-center gap-1.5">
                              <span>{req.id}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-slate-100 text-[#365C78] border border-slate-200">
                                {req.companyId}
                              </span>
                              {req.documentVersion > 1 && (
                                <span className="text-[9px] px-1 rounded bg-slate-200 text-slate-700 font-mono">
                                  v{req.documentVersion}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[220px]">
                              {req.formType} · {req.formData.workDescription.slice(0, 35)}...
                            </div>
                          </td>
                        )}

                        {/* Requester */}
                        {visibleColumns.requester && (
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[#192B3C]">{req.requesterName}</div>
                            <div className="text-[10px] text-slate-500">{req.department}</div>
                          </td>
                        )}

                        {/* Approval Journey & Progress Chain */}
                        {visibleColumns.currentApprover && (
                          <td className="py-2.5 px-3">
                            <CompactApprovalChain
                              request={req}
                              currentUserId={currentUser.id}
                              onOpenDetail={(r) => setSelectedJourneyRequest(r)}
                            />
                          </td>
                        )}

                        {/* Priority & Turnaround Target (Distinguished from Status) */}
                        {visibleColumns.prioritySla && (
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded border inline-block ${
                                  isUrgent
                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                    : req.formData.priority === 'Medium'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {req.formData.priority}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                              Target: {getSlaDescription(req.formData.priority)}
                            </div>
                          </td>
                        )}

                        {/* Workflow Status */}
                        {visibleColumns.status && (
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${
                                req.status === 'Approved'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : req.status === 'Returned for Correction'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : req.status === 'Rejected'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-sky-50 text-sky-800 border-sky-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  req.status === 'Approved'
                                    ? 'bg-emerald-600'
                                    : req.status === 'Returned for Correction'
                                    ? 'bg-amber-600'
                                    : req.status === 'Rejected'
                                    ? 'bg-rose-600'
                                    : 'bg-sky-600'
                                }`}
                              />
                              <span>{req.status}</span>
                            </span>
                          </td>
                        )}

                        {/* Submission Date */}
                        {visibleColumns.createdAt && (
                          <td className="py-2.5 px-3 tabular-nums text-slate-600">
                            <div>
                              {new Date(req.createdAt).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(req.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>
                        )}

                        {/* Primary Action Button */}
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openReviewRequest(req.id);
                            }}
                            className={`px-3 py-1.5 rounded-md font-semibold text-xs transition-colors shadow-xs inline-flex items-center gap-1 ${
                              isPendingMe
                                ? 'bg-[#365C78] hover:bg-[#2A4A62] text-white'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                            }`}
                          >
                            <span>{isPendingMe ? 'Review & Sign' : 'View Document'}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Approval Workflow Stepper & Audit Overview */}
                      {isExpanded && (
                        <tr className="bg-[#F9FAFB] border-b border-[#E2E5E9]">
                          <td colSpan={8} className="p-4 pl-10">
                            <div className="bg-white p-4 rounded-md border border-[#E2E5E9] space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E5E9] pb-3">
                                <div>
                                  <h4 className="text-xs font-bold text-[#192B3C] flex items-center gap-2">
                                    <span>Approval Journey &amp; Recipient Tracking</span>
                                    <span className="text-[10px] font-normal text-slate-500">
                                      (Workflow Config v{req.workflowVersion})
                                    </span>
                                  </h4>
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    Document description: "{req.formData.workDescription}"
                                  </p>
                                </div>

                                <button
                                  onClick={() => openReviewRequest(req.id)}
                                  className="text-xs font-semibold text-[#365C78] hover:text-[#2A4A62] flex items-center gap-1 self-start sm:self-auto"
                                >
                                  <span>Open full review &amp; audit history</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              </div>

                              {/* Detailed Structured Journey Panel */}
                              <ApprovalJourneyPanel
                                request={req}
                                currentUserId={currentUser.id}
                                showDocumentButton={false}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Operational Table Footer */}
        <div className="p-3 border-t border-[#E2E5E9] bg-[#F9FAFB] text-[11px] text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>
            Showing {filteredRequests.length} of {companyRequests.length} requests in {selectedCompany.fullName}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-slate-600 font-medium">Tenant Isolation: Strict {selectedCompany.code}</span>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => setActiveView('archive')}
              className="font-medium text-[#365C78] hover:underline"
            >
              Open Full Searchable Archive Register
            </button>
          </div>
        </div>
      </div>

      {/* Approval Journey Inspection Modal */}
      <ApprovalJourneyModal
        request={selectedJourneyRequest}
        isOpen={Boolean(selectedJourneyRequest)}
        onClose={() => setSelectedJourneyRequest(null)}
        onOpenDocument={openReviewRequest}
        currentUserId={currentUser.id}
      />
    </div>
  );
};
