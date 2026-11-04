import {
  RequestRecord,
  WorkflowConfig,
  UserProfile,
  AdminWorkFormData,
  ApprovalStepState,
  ApprovalHistoryItem,
  AttachmentItem,
} from '../types/index';
import { canUserAccessCompany } from './companyAccess';

export function createNewRequestRecord(params: {
  id: string;
  formType: RequestRecord['formType'];
  formData: AdminWorkFormData;
  requester: UserProfile;
  workflowConfig: WorkflowConfig;
  users: UserProfile[];
  attachments?: AttachmentItem[];
  comment?: string;
  signatureDataUrl?: string;
}): RequestRecord {
  const { id, formType, formData, requester, workflowConfig, users, attachments = [], comment, signatureDataUrl } = params;
  const now = new Date().toISOString();

  // Build approval steps from workflowConfig stages
  const approvalSteps: ApprovalStepState[] = workflowConfig.stages.map((stage, index) => {
    // Resolve user by explicit assignedUserId or role
    const assignedUser = stage.assignedUserId
      ? users.find((u) => u.id === stage.assignedUserId)
      : users.find((u) => u.role === stage.assignedRole && u.companyId === workflowConfig.companyId) ||
        users.find((u) => u.role === stage.assignedRole);

    return {
      stageId: stage.id,
      stageNumber: stage.stageNumber,
      stageName: stage.name,
      assignedUserId: assignedUser?.id || stage.assignedUserId || '',
      assignedUserName: assignedUser?.name || stage.name,
      assignedRole: stage.assignedRole || assignedUser?.role || 'Approver',
      status: index === 0 ? 'Pending' : 'Waiting',
    };
  });

  const firstStep = approvalSteps[0];
  const finalStep = approvalSteps[approvalSteps.length - 1];

  const enrichedFormData: AdminWorkFormData = {
    ...formData,
    requesterSignatureName: requester.name,
    requesterSignatureDate: now,
    requesterSignatureDataUrl: signatureDataUrl || requester.signatureDataUrl,
  };

  const initialHistory: ApprovalHistoryItem = {
    id: `hist-${Date.now()}-1`,
    stepNumber: 0,
    actionByUserId: requester.id,
    actionByName: requester.name,
    actionByRole: requester.role,
    action: 'Submitted',
    dateTime: now,
    comments: comment || 'Request submitted.',
    version: 1,
  };

  return {
    id,
    formType,
    companyId: workflowConfig.companyId,
    title: formData.workDescription.slice(0, 50) || `${formType} - ${requester.name}`,
    requesterId: requester.id,
    requesterName: requester.name,
    requesterRole: requester.role,
    department: formData.department || requester.department,
    createdAt: now,
    updatedAt: now,
    status: 'Pending Approval',
    currentStageIndex: 0,
    currentApproverId: firstStep?.assignedUserId,
    currentApproverName: firstStep?.assignedUserName,
    firstApproverName: firstStep?.assignedUserName,
    finalApproverName: finalStep?.assignedUserName,
    workflowVersion: workflowConfig.version,
    documentVersion: 1,
    workflowConfig,
    approvalSteps,
    approvalHistory: [initialHistory],
    attachments,
    formData: enrichedFormData,
    versionSnapshots: [
      {
        version: 1,
        updatedAt: now,
        updatedBy: requester.name,
        formData: enrichedFormData,
        changeNote: 'Initial Submission',
      },
    ],
  };
}

export function approveRequestStage(params: {
  request: RequestRecord;
  actingUser: UserProfile;
  comment?: string;
  signatureDataUrl?: string;
}): { success: boolean; error?: string; updatedRequest?: RequestRecord } {
  const { request, actingUser, comment, signatureDataUrl } = params;

  // 1. Allowed workflow state
  if (request.status !== 'Pending Approval') {
    return { success: false, error: `Request cannot be approved in '${request.status}' state.` };
  }

  const currentStep = request.approvalSteps[request.currentStageIndex];
  if (!currentStep) {
    return { success: false, error: 'No active approval stage found.' };
  }

  // 2. Authorization check: must be assigned approver
  const isAssigned = currentStep.assignedUserId === actingUser.id;
  if (!isAssigned) {
    return {
      success: false,
      error: `Unauthorized: This stage is assigned to ${currentStep.assignedUserName}.`,
    };
  }

  // 3. Valid company context
  if (!canUserAccessCompany(actingUser, request.companyId)) {
    return { success: false, error: 'Unauthorized: User does not have access to this company entity.' };
  }

  // 4. Prevent self approval check
  if (request.workflowConfig?.preventSelfApproval && request.requesterId === actingUser.id) {
    return {
      success: false,
      error: 'Self-approval is prohibited by organization policy.',
    };
  }

  // 5. Require confirmed signer identity
  const effectiveSignerName = actingUser.name?.trim();
  if (!effectiveSignerName) {
    return { success: false, error: 'Signer identity is required for approval.' };
  }

  const now = new Date().toISOString();
  const nextStageIndex = request.currentStageIndex + 1;
  const isFinalStage = nextStageIndex >= request.approvalSteps.length;

  // Clone steps and update current
  const updatedSteps = request.approvalSteps.map((step, idx) => {
    if (idx === request.currentStageIndex) {
      return {
        ...step,
        status: 'Approved' as const,
        actionDate: now,
        comments: comment?.trim() || undefined,
        signatureDataUrl: signatureDataUrl || actingUser.signatureDataUrl,
      };
    }
    if (idx === nextStageIndex && !isFinalStage) {
      return {
        ...step,
        status: 'Pending' as const,
      };
    }
    return step;
  });

  const newHistoryItem: ApprovalHistoryItem = {
    id: `hist-${Date.now()}-${request.approvalHistory.length + 1}`,
    stepNumber: request.currentStageIndex + 1,
    actionByUserId: actingUser.id,
    actionByName: actingUser.name,
    actionByRole: actingUser.role,
    action: 'Approved',
    dateTime: now,
    comments: comment?.trim() || 'Checked and approved.',
    version: request.documentVersion,
  };

  const updatedFormData: AdminWorkFormData = { ...request.formData };
  // Check if this stage maps to document signature or is final stage
  const currentStageConfig = request.workflowConfig?.stages?.[request.currentStageIndex];
  if (isFinalStage || currentStageConfig?.mapsToDocumentSignature) {
    updatedFormData.approvalAuthoritySignatureName = actingUser.name;
    updatedFormData.approvalAuthoritySignatureDate = now;
    updatedFormData.approvalAuthoritySignatureDataUrl =
      signatureDataUrl || actingUser.signatureDataUrl;
  }

  const nextApprover = !isFinalStage ? updatedSteps[nextStageIndex] : undefined;

  const updatedRequest: RequestRecord = {
    ...request,
    updatedAt: now,
    status: isFinalStage ? 'Approved' : 'Pending Approval',
    currentStageIndex: isFinalStage ? request.currentStageIndex : nextStageIndex,
    currentApproverId: nextApprover?.assignedUserId,
    currentApproverName: nextApprover?.assignedUserName,
    approvalSteps: updatedSteps,
    approvalHistory: [...request.approvalHistory, newHistoryItem],
    formData: updatedFormData,
  };

  return { success: true, updatedRequest };
}

export function returnRequestForCorrection(params: {
  request: RequestRecord;
  actingUser: UserProfile;
  reason: string;
}): { success: boolean; error?: string; updatedRequest?: RequestRecord } {
  const { request, actingUser, reason } = params;

  if (!reason || !reason.trim()) {
    return { success: false, error: 'A clear reason is required to return for correction.' };
  }

  if (request.status !== 'Pending Approval') {
    return { success: false, error: `Cannot return request in '${request.status}' state.` };
  }

  const currentStep = request.approvalSteps[request.currentStageIndex];
  if (currentStep?.assignedUserId !== actingUser.id && actingUser.role !== 'Director') {
    return { success: false, error: 'Only the assigned approver or Director can return for correction.' };
  }

  if (!canUserAccessCompany(actingUser, request.companyId)) {
    return { success: false, error: 'Unauthorized: User does not have access to this company entity.' };
  }

  const now = new Date().toISOString();

  const newHistoryItem: ApprovalHistoryItem = {
    id: `hist-${Date.now()}-${request.approvalHistory.length + 1}`,
    stepNumber: request.currentStageIndex + 1,
    actionByUserId: actingUser.id,
    actionByName: actingUser.name,
    actionByRole: actingUser.role,
    action: 'Returned for Correction',
    dateTime: now,
    comments: reason.trim(),
    version: request.documentVersion,
  };

  const updatedRequest: RequestRecord = {
    ...request,
    updatedAt: now,
    status: 'Returned for Correction',
    approvalHistory: [...request.approvalHistory, newHistoryItem],
  };

  return { success: true, updatedRequest };
}

export function resubmitCorrectedRequest(params: {
  request: RequestRecord;
  actingUser: UserProfile;
  updatedFormData: AdminWorkFormData;
  changeNote?: string;
  signatureDataUrl?: string;
}): { success: boolean; error?: string; updatedRequest?: RequestRecord } {
  const { request, actingUser, updatedFormData, changeNote, signatureDataUrl } = params;

  if (request.status !== 'Returned for Correction') {
    return { success: false, error: 'Only returned requests can be resubmitted.' };
  }

  if (request.requesterId !== actingUser.id) {
    return { success: false, error: 'Only the original requester can resubmit this request.' };
  }

  const now = new Date().toISOString();
  const nextVersion = request.documentVersion + 1;

  // Reset steps based on workflow policy: restart workflow from stage 0
  const resetSteps: ApprovalStepState[] = request.approvalSteps.map((step, idx) => ({
    ...step,
    status: idx === 0 ? 'Pending' : 'Waiting',
    actionDate: undefined,
    comments: undefined,
    signatureDataUrl: undefined,
  }));

  const enrichedFormData: AdminWorkFormData = {
    ...updatedFormData,
    requesterSignatureName: actingUser.name,
    requesterSignatureDate: now,
    requesterSignatureDataUrl: signatureDataUrl || actingUser.signatureDataUrl,
    approvalAuthoritySignatureName: undefined,
    approvalAuthoritySignatureDate: undefined,
    approvalAuthoritySignatureDataUrl: undefined,
  };

  const newHistoryItem: ApprovalHistoryItem = {
    id: `hist-${Date.now()}-${request.approvalHistory.length + 1}`,
    stepNumber: 0,
    actionByUserId: actingUser.id,
    actionByName: actingUser.name,
    actionByRole: actingUser.role,
    action: 'Submitted',
    dateTime: now,
    comments: changeNote ? `Resubmitted: ${changeNote.trim()}` : `Resubmitted Version ${nextVersion}`,
    version: nextVersion,
  };

  const firstStep = resetSteps[0];

  const updatedRequest: RequestRecord = {
    ...request,
    documentVersion: nextVersion,
    updatedAt: now,
    status: 'Pending Approval',
    currentStageIndex: 0,
    currentApproverId: firstStep?.assignedUserId,
    currentApproverName: firstStep?.assignedUserName,
    approvalSteps: resetSteps,
    approvalHistory: [...request.approvalHistory, newHistoryItem],
    formData: enrichedFormData,
    versionSnapshots: [
      ...request.versionSnapshots,
      {
        version: nextVersion,
        updatedAt: now,
        updatedBy: actingUser.name,
        formData: enrichedFormData,
        changeNote: changeNote?.trim() || `Version ${nextVersion} corrections`,
      },
    ],
  };

  return { success: true, updatedRequest };
}

export function rejectRequest(params: {
  request: RequestRecord;
  actingUser: UserProfile;
  reason: string;
}): { success: boolean; error?: string; updatedRequest?: RequestRecord } {
  const { request, actingUser, reason } = params;

  if (!reason || !reason.trim()) {
    return { success: false, error: 'A clear reason is required to reject a request.' };
  }

  if (request.status !== 'Pending Approval') {
    return { success: false, error: `Cannot reject request in '${request.status}' state.` };
  }

  const currentStep = request.approvalSteps[request.currentStageIndex];
  if (currentStep?.assignedUserId !== actingUser.id && actingUser.role !== 'Director') {
    return { success: false, error: 'Only the assigned approver or Director can reject.' };
  }

  if (!canUserAccessCompany(actingUser, request.companyId)) {
    return { success: false, error: 'Unauthorized: User does not have access to this company entity.' };
  }

  const now = new Date().toISOString();

  const updatedSteps = request.approvalSteps.map((step, idx) => {
    if (idx === request.currentStageIndex) {
      return {
        ...step,
        status: 'Rejected' as const,
        actionDate: now,
        comments: reason.trim(),
      };
    }
    return step;
  });

  const newHistoryItem: ApprovalHistoryItem = {
    id: `hist-${Date.now()}-${request.approvalHistory.length + 1}`,
    stepNumber: request.currentStageIndex + 1,
    actionByUserId: actingUser.id,
    actionByName: actingUser.name,
    actionByRole: actingUser.role,
    action: 'Rejected',
    dateTime: now,
    comments: reason.trim(),
    version: request.documentVersion,
  };

  const updatedRequest: RequestRecord = {
    ...request,
    updatedAt: now,
    status: 'Rejected',
    currentApproverId: undefined,
    currentApproverName: undefined,
    approvalSteps: updatedSteps,
    approvalHistory: [...request.approvalHistory, newHistoryItem],
  };

  return { success: true, updatedRequest };
}

export function directorOverrideApprove(params: {
  request: RequestRecord;
  directorUser: UserProfile;
  reason: string;
}): { success: boolean; error?: string; updatedRequest?: RequestRecord } {
  const { request, directorUser, reason } = params;

  // 1. Director Override must fail when allowDirectorOverride is false
  if (!request.workflowConfig?.allowDirectorOverride) {
    return { success: false, error: 'Director Override is disabled by workflow policy.' };
  }

  // 2. Director Override must fail when the request is already Approved, Rejected, or Returned
  if (request.status !== 'Pending Approval') {
    return {
      success: false,
      error: `Director Override cannot be executed on a request in '${request.status}' state.`,
    };
  }

  // 3. Require the correct actor (role must be Director)
  if (directorUser.role !== 'Director') {
    return { success: false, error: 'Only an authorized Director can execute an override.' };
  }

  // 4. Require non-empty reason
  if (!reason || !reason.trim()) {
    return { success: false, error: 'A mandatory justification reason is required for Director Override.' };
  }

  // 5. Require valid company context
  if (!canUserAccessCompany(directorUser, request.companyId)) {
    return { success: false, error: 'Unauthorized: Director does not have access to this company entity.' };
  }

  // 6. Explicitly confirmed signer identity
  if (!directorUser.name?.trim()) {
    return { success: false, error: 'Signer identity is required for Director Override.' };
  }

  const now = new Date().toISOString();

  const updatedSteps = request.approvalSteps.map((step, idx) => {
    if (idx < request.currentStageIndex) {
      return step;
    }
    if (step.assignedRole === 'Director' || idx === request.approvalSteps.length - 1) {
      return {
        ...step,
        status: 'Approved' as const,
        actionDate: now,
        comments: `Approved via Director Override: ${reason.trim()}`,
        signatureDataUrl: directorUser.signatureDataUrl,
      };
    }
    return {
      ...step,
      status: 'Bypassed' as const,
      actionDate: now,
      comments: `Bypassed by Director Override`,
    };
  });

  const newHistoryItem: ApprovalHistoryItem = {
    id: `hist-${Date.now()}-${request.approvalHistory.length + 1}`,
    stepNumber: request.currentStageIndex + 1,
    actionByUserId: directorUser.id,
    actionByName: directorUser.name,
    actionByRole: directorUser.role,
    action: 'Director Override',
    dateTime: now,
    comments: `Director Override: ${reason.trim()}`,
    version: request.documentVersion,
  };

  const updatedFormData: AdminWorkFormData = {
    ...request.formData,
    approvalAuthoritySignatureName: directorUser.name,
    approvalAuthoritySignatureDate: now,
    approvalAuthoritySignatureDataUrl: directorUser.signatureDataUrl,
  };

  const updatedRequest: RequestRecord = {
    ...request,
    updatedAt: now,
    status: 'Approved',
    currentApproverId: undefined,
    currentApproverName: undefined,
    approvalSteps: updatedSteps,
    approvalHistory: [...request.approvalHistory, newHistoryItem],
    formData: updatedFormData,
  };

  return { success: true, updatedRequest };
}
