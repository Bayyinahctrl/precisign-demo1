import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AdminWorkFormData } from '../../types/index';
import { AdminWorkRequestDocument } from '../document/AdminWorkRequestDocument';
import { SignatureModal } from '../modals/SignatureModal';
import { DocuSignProgressBanner } from './DocuSignProgressBanner';
import { ApprovalJourneyPanel } from '../journey/ApprovalJourneyPanel';
import {
  FileText,
  Clock,
  Printer,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  Send,
  Eye,
  ShieldAlert,
  Paperclip,
  RotateCcw,
  History,
  Check,
  AlertCircle,
  ShieldCheck,
  Building2,
  Download,
} from 'lucide-react';

export const ReviewSignView: React.FC = () => {
  const {
    selectedRequestId,
    companyRequests,
    currentUser,
    approveRequest,
    returnRequest,
    rejectRequestAction,
    directorOverrideAction,
    resubmitRequest,
    setActiveView,
    selectedCompany,
  } = useApp();

  // Find active request
  const request = companyRequests.find((r) => r.id === selectedRequestId) || companyRequests[0];

  const [comment, setComment] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<number>(request ? request.documentVersion : 1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [actionModal, setActionModal] = useState<'return' | 'reject' | 'override' | 'resubmit' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'actions' | 'timeline' | 'attachments'>('actions');
  const [mobileViewTab, setMobileViewTab] = useState<'document' | 'sidebar'>('document');

  // Full correction form state if resubmitting
  const [correctedForm, setCorrectedForm] = useState<AdminWorkFormData>(request ? request.formData : ({} as any));
  const [resubmitChangeNote, setResubmitChangeNote] = useState('Updated specifications and attached requested chamber approvals.');

  if (!request) {
    return (
      <div className="p-12 text-center space-y-4">
        <div className="text-slate-500 text-sm">No request record currently selected.</div>
        <button
          onClick={() => setActiveView('dashboard')}
          className="px-4 py-2 bg-[#365C78] text-white rounded-md text-xs font-semibold"
        >
          Return to Operational Inbox
        </button>
      </div>
    );
  }

  // Active form data according to selected version
  const activeFormData =
    selectedVersion === request.documentVersion
      ? request.formData
      : request.versionSnapshots.find((v) => v.version === selectedVersion)?.formData || request.formData;

  const currentStep = request.approvalSteps[request.currentStageIndex];
  const isAssignedApprover =
    request.status === 'Pending Approval' && currentStep?.assignedUserId === currentUser.id;
  const isRequester = request.requesterId === currentUser.id;
  const isDirector = currentUser.role === 'Director';
  const isReturned = request.status === 'Returned for Correction';

  const handleCopyId = () => {
    navigator.clipboard?.writeText(request.id);
    setActionSuccess('Request ID copied to clipboard');
    setTimeout(() => setActionSuccess(null), 2500);
  };

  const handleDownloadAttachment = (att: any) => {
    if (att.dataUrl) {
      const a = document.createElement('a');
      a.href = att.dataUrl;
      a.download = att.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setActionSuccess(`Downloaded ${att.name}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } else {
      setActionSuccess(`Reference attachment: ${att.name} (${att.sizeFormatted})`);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const handleApproveClick = () => {
    setActionError(null);
    if (!isAssignedApprover && !isDirector) {
      setActionError(`Unauthorized: Stage is assigned to ${currentStep?.assignedUserName}.`);
      return;
    }
    setSignatureModalOpen(true);
  };

  const handleConfirmedApproval = (signatureDataUrl: string) => {
    const result = approveRequest(request.id, comment.trim() || undefined, signatureDataUrl);
    if (result.success) {
      setActionSuccess('Request stage approved and digital signature verified.');
      setComment('');
      setTimeout(() => setActionSuccess(null), 3500);
    } else {
      setActionError(result.error || 'Failed to approve request');
    }
  };

  const handleReturnSubmit = () => {
    if (!actionReason.trim()) {
      setActionError('Reason is required to return document for correction.');
      return;
    }
    const result = returnRequest(request.id, actionReason.trim());
    if (result.success) {
      setActionModal(null);
      setActionReason('');
      setActionSuccess('Request returned to requester for correction.');
      setTimeout(() => setActionSuccess(null), 3500);
    } else {
      setActionError(result.error || 'Failed to return request');
    }
  };

  const handleRejectSubmit = () => {
    if (!actionReason.trim()) {
      setActionError('Reason is required to reject request.');
      return;
    }
    const result = rejectRequestAction(request.id, actionReason.trim());
    if (result.success) {
      setActionModal(null);
      setActionReason('');
      setActionSuccess('Request formally rejected and archived.');
      setTimeout(() => setActionSuccess(null), 3500);
    } else {
      setActionError(result.error || 'Failed to reject request');
    }
  };

  const handleDirectorOverrideSubmit = () => {
    if (!actionReason.trim()) {
      setActionError('Audit justification is required for Director Override.');
      return;
    }
    const result = directorOverrideAction(request.id, actionReason.trim());
    if (result.success) {
      setActionModal(null);
      setActionReason('');
      setActionSuccess('Director Override executed. Request approved by Director.');
      setTimeout(() => setActionSuccess(null), 3500);
    } else {
      setActionError(result.error || 'Director override failed');
    }
  };

  const handleResubmitSubmit = () => {
    const result = resubmitRequest(
      request.id,
      correctedForm,
      resubmitChangeNote.trim(),
      currentUser.signatureDataUrl
    );
    if (result.success) {
      setActionModal(null);
      setActionSuccess('Corrected document resubmitted. Workflow restarted at Stage 1.');
      setSelectedVersion(request.documentVersion + 1);
      setTimeout(() => setActionSuccess(null), 3500);
    } else {
      setActionError(result.error || 'Resubmission failed');
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-[1680px] mx-auto space-y-3 sm:space-y-4">
      {/* Top Breadcrumb & Metadata Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E5E9] no-print">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            onClick={() => setActiveView('dashboard')}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 border border-[#CBD5E1] bg-white hover:bg-[#F5F6F8] text-slate-700 rounded-md text-xs font-semibold transition-colors shadow-xs shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Inbox</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-[#192B3C]">{request.id}</span>
              <button
                onClick={handleCopyId}
                className="text-slate-400 hover:text-[#365C78]"
                title="Copy Request ID"
              >
                <Copy className="w-3 h-3" />
              </button>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                  request.status === 'Approved'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : request.status === 'Returned for Correction'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : request.status === 'Rejected'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-sky-50 text-sky-800 border-sky-200'
                }`}
              >
                {request.status}
              </span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
              <span>{request.formType} (PR#21-001FA)</span>
              <span className="mx-1.5">·</span>
              <span>Submitted by {request.requesterName} ({request.department})</span>
            </div>
          </div>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="lg:hidden flex border border-[#E2E5E9] bg-white rounded-md p-0.5 text-xs w-full sm:w-auto">
          <button
            onClick={() => setMobileViewTab('document')}
            className={`flex-1 sm:flex-none px-3 py-1.5 font-semibold rounded transition-colors ${
              mobileViewTab === 'document' ? 'bg-[#365C78] text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            Document View
          </button>
          <button
            onClick={() => setMobileViewTab('sidebar')}
            className={`flex-1 sm:flex-none px-3 py-1.5 font-semibold rounded transition-colors ${
              mobileViewTab === 'sidebar' ? 'bg-[#365C78] text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            Approval Controls
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-xs text-rose-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-xs text-emerald-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* DocuSign-Style Recipient Tracking & Stepper Banner */}
      <DocuSignProgressBanner
        request={request}
        currentUserId={currentUser.id}
        isAssignedApprover={isAssignedApprover}
        onSignClick={() => setSignatureModalOpen(true)}
      />

      {/* Split Layout: 62% Document Focus + 38% Approval Controls on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ================= LEFT: ORIGINAL A4 DOCUMENT (62%) ================= */}
        <div
          className={`lg:col-span-7 xl:col-span-8 space-y-3 ${
            mobileViewTab === 'sidebar' ? 'hidden lg:block' : 'block'
          }`}
        >
          {/* Document Controls Strip: Version Tabs + Zoom + Fullscreen + Print */}
          <div className="bg-white border border-[#E2E5E9] rounded-md px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs no-print">
            {/* Version Switcher */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium text-[11px]">Version:</span>
              <button
                onClick={() => setSelectedVersion(1)}
                className={`px-2 py-0.5 rounded text-xs font-mono font-semibold transition-colors ${
                  selectedVersion === 1
                    ? 'bg-[#192B3C] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                v1.0 {request.documentVersion === 1 ? '(Current)' : '(Original)'}
              </button>
              {request.documentVersion > 1 && (
                <button
                  onClick={() => setSelectedVersion(request.documentVersion)}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-semibold transition-colors ${
                    selectedVersion === request.documentVersion
                      ? 'bg-[#192B3C] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  v{request.documentVersion}.0 (Resubmitted)
                </button>
              )}
            </div>

            {/* Display tools */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 border border-[#E2E5E9] rounded px-1.5 py-0.5 bg-slate-50">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
                  className="p-1 rounded text-slate-500 hover:bg-slate-200"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono font-semibold text-slate-600 px-1 tabular-nums">
                  {zoomLevel}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                  className="p-1 rounded text-slate-500 hover:bg-slate-200"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-1 px-2.5 py-1 border border-[#CBD5E1] bg-white hover:bg-slate-50 rounded text-xs font-medium text-slate-700 shadow-xs"
                title="Print Official A4 Document"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Print</span>
              </button>

              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 border border-[#CBD5E1] bg-white hover:bg-slate-50 rounded text-slate-600 shadow-xs"
                title={isFullscreen ? 'Exit Full Screen' : 'Expand Full Screen'}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Document Render Container */}
          <div
            className={`printable-area overflow-auto rounded-lg bg-slate-200/80 p-2 sm:p-4 border border-[#E2E5E9] flex justify-center ${
              isFullscreen ? 'fixed inset-2 z-50 bg-slate-900/90 p-4 sm:p-8 max-h-none' : 'max-h-[960px]'
            }`}
          >
            {isFullscreen && (
              <button
                onClick={() => setIsFullscreen(false)}
                className="fixed top-4 right-4 z-50 px-3 py-1.5 bg-[#192B3C] text-white rounded-md text-xs font-semibold flex items-center gap-1 shadow-lg"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Close Full Screen</span>
              </button>
            )}

            <div
              style={{
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out',
              }}
              className="w-full flex justify-center"
            >
              <AdminWorkRequestDocument data={activeFormData} isPrintMode={false} />
            </div>
          </div>
        </div>

        {/* ================= RIGHT: APPROVAL & AUDIT CONTROLS (38%) ================= */}
        <div
          className={`lg:col-span-5 xl:col-span-4 space-y-4 no-print ${
            mobileViewTab === 'document' ? 'hidden lg:block' : 'block'
          }`}
        >
          {/* 1. Primary Approval Action Box */}
          <div className="bg-white border border-[#E2E5E9] rounded-lg p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E5E9] pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#192B3C]">
                  Workflow Action
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Current Stage: <span className="font-semibold text-slate-800">{currentStep?.stageName || 'Completed'}</span>
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                Stage {request.currentStageIndex + 1} of {request.approvalSteps.length}
              </span>
            </div>

            {/* Authorization Scenarios */}
            {request.status === 'Approved' ? (
              <div className="p-3 bg-emerald-50 rounded-md border border-emerald-200 text-xs text-emerald-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Document Fully Approved &amp; Archived</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  All approval authority signatures have been applied and certified on the official form.
                </p>
              </div>
            ) : request.status === 'Rejected' ? (
              <div className="p-3 bg-rose-50 rounded-md border border-rose-200 text-xs text-rose-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>Request Formally Rejected</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  This document has been rejected and closed in the workflow register.
                </p>
              </div>
            ) : isReturned ? (
              <div className="p-3.5 bg-amber-50 rounded-md border border-amber-200 text-xs text-amber-900 space-y-3">
                <div className="flex items-center gap-1.5 font-bold">
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                  <span>Returned for Requester Correction</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {request.approvalHistory.find((h) => h.action === 'Returned for Correction')?.comments
                    ? `Feedback: "${request.approvalHistory.find((h) => h.action === 'Returned for Correction')?.comments}"`
                    : 'The approver requested corrections on this document.'}
                </p>
                {isRequester ? (
                  <button
                    onClick={() => {
                      setCorrectedForm(request.formData);
                      setActionModal('resubmit');
                    }}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold text-xs transition-colors shadow-xs"
                  >
                    Edit &amp; Resubmit Corrected Document
                  </button>
                ) : (
                  <div className="text-[10px] text-amber-700 italic">
                    Awaiting resubmission by original requester ({request.requesterName}).
                  </div>
                )}
              </div>
            ) : isAssignedApprover ? (
              /* ACTIVE ASSIGNED APPROVER ACTIONS */
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Approver Comments / Audit Note (Optional):
                  </label>
                  <textarea
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Enter review notes, compliance remarks, or conditions..."
                    className="w-full px-2.5 py-1.5 text-xs border border-[#E2E5E9] rounded focus:outline-none focus:ring-1 focus:ring-[#365C78]"
                  />
                </div>

                <div className="space-y-2 pt-1">
                  {/* Approve & Sign Button */}
                  <button
                    onClick={handleApproveClick}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#365C78] hover:bg-[#2A4A62] text-white rounded-md text-xs font-bold transition-colors shadow-xs"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve &amp; Sign Document</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Return for Correction Button */}
                    <button
                      onClick={() => setActionModal('return')}
                      className="py-2 px-3 border border-amber-300 bg-amber-50/60 hover:bg-amber-100/60 text-amber-800 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Return</span>
                    </button>

                    {/* Reject Button */}
                    <button
                      onClick={() => setActionModal('reject')}
                      className="py-2 px-3 border border-rose-300 bg-rose-50/60 hover:bg-rose-100/60 text-rose-800 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : isDirector ? (
              /* DIRECTOR OVERRIDE SCENARIO */
              <div className="space-y-3">
                <div className="p-3 bg-[#EBF2F7] rounded-md border border-[#C2D5E3] text-xs text-[#192B3C] space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldAlert className="w-4 h-4 text-[#365C78]" />
                    <span>Director Authority</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Currently assigned to <span className="font-semibold">{currentStep?.assignedUserName}</span> ({currentStep?.assignedRole}). As Director, corporate governance policy authorizes you to sign off with Director Override.
                  </p>
                </div>

                <button
                  onClick={() => setActionModal('override')}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-[#192B3C] hover:bg-[#12202D] text-white rounded-md text-xs font-bold transition-colors shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Execute Director Override</span>
                </button>
              </div>
            ) : (
              /* READ-ONLY / UNAUTHORIZED SCENARIO */
              <div className="p-3 bg-slate-50 rounded-md border border-[#E2E5E9] text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">Read-Only Mode</div>
                <p className="text-[11px] leading-relaxed">
                  Stage {request.currentStageIndex + 1} is assigned to{' '}
                  <strong className="text-slate-900">{currentStep?.assignedUserName}</strong> ({currentStep?.assignedRole}).
                  Only the assigned approver or authorized Director may execute approvals.
                </p>
              </div>
            )}
          </div>

          {/* 2. Detailed Approval Journey & Audit Log */}
          <ApprovalJourneyPanel
            request={request}
            currentUserId={currentUser.id}
          />

          {/* 3. Supporting Document Attachments */}
          <div className="bg-white border border-[#E2E5E9] rounded-lg overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-[#E2E5E9] bg-[#F9FAFB] flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#192B3C] flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-[#365C78]" />
                <span>Supporting Files ({request.attachments.length})</span>
              </h3>
              <span className="text-[10px] text-slate-400">Attachments</span>
            </div>

            <div className="p-4">
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {request.attachments.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400">
                    No attachments uploaded for this request.
                  </div>
                ) : (
                  request.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-2 rounded border border-[#E2E5E9] bg-[#F5F6F8] text-xs"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <Paperclip className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="font-medium text-[#192B3C] truncate">{att.name}</span>
                        <span className="text-[10px] text-slate-400">({att.sizeFormatted})</span>
                      </div>
                      <button
                        onClick={() => handleDownloadAttachment(att)}
                        className="p-1 text-slate-500 hover:text-[#365C78] rounded hover:bg-slate-200"
                        title="Download attachment"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Confirmation Modal */}
      {signatureModalOpen && (
        <SignatureModal
          isOpen={signatureModalOpen}
          onClose={() => setSignatureModalOpen(false)}
          user={currentUser}
          title="Sign & Approve Document"
          confirmLabel="Apply Signature & Confirm Approval"
          onConfirm={handleConfirmedApproval}
        />
      )}

      {/* Action Modal: Return for Correction */}
      {actionModal === 'return' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E5E9] shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#192B3C] flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <span>Return Request for Correction</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Specify what corrections or additional documents the requester must provide:
            </p>
            <textarea
              rows={3}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="e.g. Please update work description and attach Chamber attestation..."
              className="w-full px-3 py-2 text-xs border border-[#E2E5E9] rounded focus:outline-none focus:ring-1 focus:ring-[#365C78]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActionModal(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleReturnSubmit}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded shadow-xs"
              >
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal: Reject Request */}
      {actionModal === 'reject' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E5E9] shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Reject Request Form</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              State the reason for rejecting this request. Rejection terminates the workflow and archives the document:
            </p>
            <textarea
              rows={3}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="e.g. Outside of departmental budget scope / not approved by management..."
              className="w-full px-3 py-2 text-xs border border-[#E2E5E9] rounded focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActionModal(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal: Director Override */}
      {actionModal === 'override' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E5E9] shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#192B3C] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#365C78]" />
              <span>Confirm Director Override Sign-off</span>
            </h3>
            <div className="p-3 bg-amber-50 rounded border border-amber-200 text-xs text-amber-900 leading-relaxed">
              Director Override bypasses intermediate pending stages and applies final sign-off directly to the document.
            </div>
            <textarea
              rows={2}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Audit justification for override (required)..."
              className="w-full px-3 py-2 text-xs border border-[#E2E5E9] rounded focus:outline-none focus:ring-1 focus:ring-[#365C78]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActionModal(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleDirectorOverrideSubmit}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#192B3C] hover:bg-[#12202D] rounded shadow-xs"
              >
                Execute Override Sign-off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal: Resubmit Request */}
      {actionModal === 'resubmit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E5E9] shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="border-b border-[#E2E5E9] pb-3">
              <h3 className="text-sm font-bold text-[#192B3C]">
                Revise &amp; Resubmit Request (Version {request.documentVersion + 1})
              </h3>
              <p className="text-xs text-slate-500">
                Update the document content and provide revision notes for the approvers.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Updated Work Description:
                </label>
                <textarea
                  rows={3}
                  value={correctedForm.workDescription}
                  onChange={(e) =>
                    setCorrectedForm((prev) => ({ ...prev, workDescription: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-[#E2E5E9] rounded focus:outline-none focus:ring-1 focus:ring-[#365C78]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Change Note / Revision Summary:
                </label>
                <input
                  type="text"
                  value={resubmitChangeNote}
                  onChange={(e) => setResubmitChangeNote(e.target.value)}
                  placeholder="e.g. Attached requested commercial registration and clarified scope"
                  className="w-full px-3 py-1.5 border border-[#E2E5E9] rounded focus:outline-none focus:ring-1 focus:ring-[#365C78]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E5E9]">
              <button
                onClick={() => setActionModal(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleResubmitSubmit}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#365C78] hover:bg-[#2A4A62] rounded shadow-xs"
              >
                Submit Revisions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Confirmation Modal */}
      {signatureModalOpen && (
        <SignatureModal
          isOpen={signatureModalOpen}
          user={currentUser}
          title="Sign & Approve Document"
          onClose={() => setSignatureModalOpen(false)}
          onConfirm={(sigUrl) => {
            handleConfirmedApproval(sigUrl);
          }}
        />
      )}
    </div>
  );
};
