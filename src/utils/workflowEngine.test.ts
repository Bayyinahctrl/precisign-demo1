import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNewRequestRecord,
  approveRequestStage,
  returnRequestForCorrection,
  resubmitCorrectedRequest,
  rejectRequest,
  directorOverrideApprove,
} from './workflowEngine';
import { UserProfile, WorkflowConfig, AdminWorkFormData } from '../types/index';

const sampleUsers: UserProfile[] = [
  {
    id: 'user-anzar',
    name: 'Anzar',
    email: 'anzar@precision-eg.com',
    role: 'Admin',
    department: 'Admin',
    initials: 'AN',
    avatarColor: '#10b981',
    companyId: 'PEW',
    signatureStyleText: 'Anzar',
  },
  {
    id: 'user-shekar',
    name: 'Shekar',
    email: 'shekar@precision-eg.com',
    role: 'General Manager',
    department: 'Management',
    initials: 'SH',
    avatarColor: '#8b5cf6',
    companyId: 'PEW',
    signatureStyleText: 'Shekar',
  },
  {
    id: 'user-afzal',
    name: 'Afzal Kazi',
    email: 'afzal.kazi@precision-eg.com',
    role: 'Director',
    department: 'Management',
    initials: 'AK',
    avatarColor: '#6366f1',
    companyId: 'PEW',
    signatureStyleText: 'Afzal Kazi',
  },
];

const sampleWorkflowConfig: WorkflowConfig = {
  id: 'wf-pew-admin-work',
  formType: 'Admin Work Request',
  companyId: 'PEW',
  version: 1,
  preventSelfApproval: true,
  allowDirectorOverride: true,
  reminderDays: 2,
  escalationDays: 5,
  rejectionBehavior: 'archive',
  returnBehavior: 'restart_workflow',
  stages: [
    {
      id: 'stg-1',
      stageNumber: 1,
      name: 'GM Approval',
      assignedRole: 'General Manager',
      assignedUserId: 'user-shekar',
      isFinalApproval: false,
      canReject: true,
      canReturnForCorrection: true,
      mapsToDocumentSignature: false,
    },
    {
      id: 'stg-2',
      stageNumber: 2,
      name: 'Director Approval',
      assignedRole: 'Director',
      assignedUserId: 'user-afzal',
      isFinalApproval: true,
      canReject: true,
      canReturnForCorrection: true,
      mapsToDocumentSignature: true,
    },
  ],
};

const sampleFormData: AdminWorkFormData = {
  dateOfRequest: '03 Nov 2026',
  companyId: 'PEW',
  companyName: 'PEW - Precision Engineering Works',
  requesterId: 'user-anzar',
  requesterName: 'Anzar',
  department: 'Admin',
  priority: 'Urgent',
  workDescription: 'Renovation of the main meeting room (carpet replacement, painting and lighting upgrade).',
  documents: {
    onlineDocumentChamber: true,
    physicalDocumentChamber: false,
    companyDocumentAjeer: false,
    employeeSalaryCertificate: false,
    permanentEmploymentVisa: false,
    workVisitVisa: false,
    businessVisitVisa: false,
    agencyWakala: false,
    others: false,
    othersDescription: '',
  },
  requesterSignatureName: 'Anzar',
};

test('Scenario A: Anzar submits -> Shekar approves -> Afzal approves', () => {
  const anzar = sampleUsers[0];
  const shekar = sampleUsers[1];
  const afzal = sampleUsers[2];

  // 1. Anzar submits
  const req = createNewRequestRecord({
    id: 'PEW-AW-2026-0018',
    formType: 'Admin Work Request',
    formData: sampleFormData,
    requester: anzar,
    workflowConfig: sampleWorkflowConfig,
    users: sampleUsers,
    comment: 'Request submitted.',
  });

  assert.equal(req.status, 'Pending Approval');
  assert.equal(req.currentApproverId, 'user-shekar');
  assert.equal(req.approvalSteps.length, 2);
  assert.equal(req.approvalSteps[0].status, 'Pending');
  assert.equal(req.approvalSteps[1].status, 'Waiting');
  assert.equal(req.formData.requesterSignatureName, 'Anzar');
  assert.equal(req.formData.approvalAuthoritySignatureName, undefined);

  // 2. Unauthorized user cannot approve Shekar's stage
  const badAttempt = approveRequestStage({
    request: req,
    actingUser: afzal,
  });
  assert.equal(badAttempt.success, false);
  assert.match(badAttempt.error || '', /Unauthorized/);

  // 3. Shekar approves
  const shekarApproval = approveRequestStage({
    request: req,
    actingUser: shekar,
    comment: 'Checked and approved.',
  });
  assert.equal(shekarApproval.success, true);
  const afterShekar = shekarApproval.updatedRequest!;
  assert.equal(afterShekar.status, 'Pending Approval');
  assert.equal(afterShekar.currentStageIndex, 1);
  assert.equal(afterShekar.currentApproverId, 'user-afzal');
  assert.equal(afterShekar.approvalSteps[0].status, 'Approved');
  assert.equal(afterShekar.approvalSteps[1].status, 'Pending');
  assert.equal(afterShekar.formData.approvalAuthoritySignatureName, undefined);

  // 4. Afzal approves final stage
  const afzalApproval = approveRequestStage({
    request: afterShekar,
    actingUser: afzal,
    comment: 'Director approved.',
  });
  assert.equal(afzalApproval.success, true);
  const finalReq = afzalApproval.updatedRequest!;
  assert.equal(finalReq.status, 'Approved');
  assert.equal(finalReq.approvalSteps[1].status, 'Approved');
  assert.equal(finalReq.formData.approvalAuthoritySignatureName, 'Afzal Kazi');
  assert.equal(finalReq.approvalHistory.length, 3); // Submitted + Shekar + Afzal
});

test('Scenario B: Return for correction and resubmission creates version 2', () => {
  const anzar = sampleUsers[0];
  const shekar = sampleUsers[1];

  const req = createNewRequestRecord({
    id: 'PEW-AW-2026-0019',
    formType: 'Admin Work Request',
    formData: sampleFormData,
    requester: anzar,
    workflowConfig: sampleWorkflowConfig,
    users: sampleUsers,
  });

  // Return without reason must fail
  const noReason = returnRequestForCorrection({
    request: req,
    actingUser: shekar,
    reason: '',
  });
  assert.equal(noReason.success, false);

  // Return with valid reason
  const returned = returnRequestForCorrection({
    request: req,
    actingUser: shekar,
    reason: 'Please attach the quotation and specify scope.',
  });
  assert.equal(returned.success, true);
  assert.equal(returned.updatedRequest?.status, 'Returned for Correction');

  // Resubmit by original requester with changes
  const resubmitted = resubmitCorrectedRequest({
    request: returned.updatedRequest!,
    actingUser: anzar,
    updatedFormData: {
      ...sampleFormData,
      workDescription: 'Updated: Meeting room renovation with vendor quotes attached.',
    },
    changeNote: 'Attached vendor quotes and refined scope',
  });

  assert.equal(resubmitted.success, true);
  const v2 = resubmitted.updatedRequest!;
  assert.equal(v2.documentVersion, 2);
  assert.equal(v2.status, 'Pending Approval');
  assert.equal(v2.currentStageIndex, 0);
  assert.equal(v2.currentApproverId, 'user-shekar');
  assert.equal(v2.versionSnapshots.length, 2);
});

test('Director Override bypasses intermediate stages', () => {
  const anzar = sampleUsers[0];
  const afzal = sampleUsers[2];

  const req = createNewRequestRecord({
    id: 'PEW-AW-2026-0020',
    formType: 'Admin Work Request',
    formData: sampleFormData,
    requester: anzar,
    workflowConfig: sampleWorkflowConfig,
    users: sampleUsers,
  });

  const override = directorOverrideApprove({
    request: req,
    directorUser: afzal,
    reason: 'Urgent board meeting scheduled tomorrow morning, expedited.',
  });

  assert.equal(override.success, true);
  assert.equal(override.updatedRequest?.status, 'Approved');
  assert.equal(override.updatedRequest?.formData.approvalAuthoritySignatureName, 'Afzal Kazi');
  assert.equal(override.updatedRequest?.approvalSteps[0].status, 'Bypassed');
  assert.equal(override.updatedRequest?.approvalSteps[1].status, 'Approved');
});

test('Workflow Engine Security: Prevent self-approval when policy prohibits', () => {
  const anzar = sampleUsers[0]; // Requester and Admin
  // Create workflow where first approver is Anzar himself
  const selfApproveConfig: WorkflowConfig = {
    ...sampleWorkflowConfig,
    preventSelfApproval: true,
    stages: [
      {
        id: 'stg-self',
        stageNumber: 1,
        name: 'Admin Approval',
        assignedRole: 'Admin',
        assignedUserId: 'user-anzar',
        isFinalApproval: true,
        canReject: true,
        canReturnForCorrection: true,
        mapsToDocumentSignature: true,
      },
    ],
  };

  const req = createNewRequestRecord({
    id: 'PEW-AW-2026-0021',
    formType: 'Admin Work Request',
    formData: sampleFormData,
    requester: anzar,
    workflowConfig: selfApproveConfig,
    users: sampleUsers,
  });

  const attempt = approveRequestStage({
    request: req,
    actingUser: anzar,
  });

  assert.equal(attempt.success, false);
  assert.match(attempt.error || '', /Self-approval is prohibited/);
});

test('Workflow Engine Security: Director Override disabled by workflow policy', () => {
  const anzar = sampleUsers[0];
  const afzal = sampleUsers[2];

  const noOverrideConfig: WorkflowConfig = {
    ...sampleWorkflowConfig,
    allowDirectorOverride: false,
  };

  const req = createNewRequestRecord({
    id: 'PEW-AW-2026-0022',
    formType: 'Admin Work Request',
    formData: sampleFormData,
    requester: anzar,
    workflowConfig: noOverrideConfig,
    users: sampleUsers,
  });

  const override = directorOverrideApprove({
    request: req,
    directorUser: afzal,
    reason: 'Urgent override attempt',
  });

  assert.equal(override.success, false);
  assert.match(override.error || '', /disabled by workflow policy/);
});

test('Workflow Engine Security: Reject Director Override on non-Pending requests', () => {
  const anzar = sampleUsers[0];
  const afzal = sampleUsers[2];

  const req = createNewRequestRecord({
    id: 'PEW-AW-2026-0023',
    formType: 'Admin Work Request',
    formData: sampleFormData,
    requester: anzar,
    workflowConfig: sampleWorkflowConfig,
    users: sampleUsers,
  });

  // Reject the request first
  const rejected = rejectRequest({
    request: req,
    actingUser: afzal,
    reason: 'Invalid budget category',
  });
  assert.equal(rejected.success, true);

  // Attempt director override on Rejected request
  const overrideAttempt = directorOverrideApprove({
    request: rejected.updatedRequest!,
    directorUser: afzal,
    reason: 'Trying to resurrect after rejection',
  });

  assert.equal(overrideAttempt.success, false);
  assert.match(overrideAttempt.error || '', /cannot be executed on a request in 'Rejected' state/);
});

test('Workflow Engine Security: Duplicate approval on already Approved request must fail', () => {
  const anzar = sampleUsers[0];
  const shekar = sampleUsers[1];
  const afzal = sampleUsers[2];

  const req = createNewRequestRecord({
    id: 'PEW-AW-2026-0024',
    formType: 'Admin Work Request',
    formData: sampleFormData,
    requester: anzar,
    workflowConfig: sampleWorkflowConfig,
    users: sampleUsers,
  });

  const step1 = approveRequestStage({ request: req, actingUser: shekar });
  assert.equal(step1.success, true);

  const step2 = approveRequestStage({ request: step1.updatedRequest!, actingUser: afzal });
  assert.equal(step2.success, true);
  assert.equal(step2.updatedRequest?.status, 'Approved');

  // Attempting duplicate approval
  const duplicateApproval = approveRequestStage({
    request: step2.updatedRequest!,
    actingUser: afzal,
  });
  assert.equal(duplicateApproval.success, false);
  assert.match(duplicateApproval.error || '', /cannot be approved in 'Approved' state/);
});

test('Workflow Engine Security: Non-Director role cannot execute Director Override', () => {
  const anzar = sampleUsers[0];
  const shekar = sampleUsers[1]; // General Manager, not Director

  const req = createNewRequestRecord({
    id: 'PEW-AW-2026-0025',
    formType: 'Admin Work Request',
    formData: sampleFormData,
    requester: anzar,
    workflowConfig: sampleWorkflowConfig,
    users: sampleUsers,
  });

  const override = directorOverrideApprove({
    request: req,
    directorUser: shekar,
    reason: 'GM attempting override',
  });

  assert.equal(override.success, false);
  assert.match(override.error || '', /Only an authorized Director/);
});

test('Workflow Engine Security: Cross-company action is blocked', () => {
  const anzar = sampleUsers[0];
  const foreignApprover: UserProfile = {
    id: 'user-foreign',
    name: 'Foreign User',
    email: 'foreign@group.com',
    role: 'General Manager',
    department: 'Management',
    initials: 'FU',
    avatarColor: '#f59e0b',
    companyId: 'FSG', // Different company from PEW
  };

  const req = createNewRequestRecord({
    id: 'PEW-AW-2026-0026',
    formType: 'Admin Work Request',
    formData: sampleFormData,
    requester: anzar,
    workflowConfig: sampleWorkflowConfig,
    users: sampleUsers,
  });

  const attempt = approveRequestStage({
    request: req,
    actingUser: foreignApprover,
  });

  assert.equal(attempt.success, false);
  assert.match(attempt.error || '', /Unauthorized/);
});

test('Workflow Engine Security: Resubmitting by someone other than original requester fails', () => {
  const anzar = sampleUsers[0];
  const shekar = sampleUsers[1];

  const req = createNewRequestRecord({
    id: 'PEW-AW-2026-0027',
    formType: 'Admin Work Request',
    formData: sampleFormData,
    requester: anzar,
    workflowConfig: sampleWorkflowConfig,
    users: sampleUsers,
  });

  const returned = returnRequestForCorrection({
    request: req,
    actingUser: shekar,
    reason: 'Clarify details',
  });
  assert.equal(returned.success, true);

  const unauthorizedResubmit = resubmitCorrectedRequest({
    request: returned.updatedRequest!,
    actingUser: shekar, // Shekar is not the requester
    updatedFormData: sampleFormData,
  });

  assert.equal(unauthorizedResubmit.success, false);
  assert.match(unauthorizedResubmit.error || '', /Only the original requester can resubmit/);
});

test('Workflow Engine Security: Reject requires non-empty reason', () => {
  const anzar = sampleUsers[0];
  const afzal = sampleUsers[2];

  const req = createNewRequestRecord({
    id: 'PEW-AW-2026-0028',
    formType: 'Admin Work Request',
    formData: sampleFormData,
    requester: anzar,
    workflowConfig: sampleWorkflowConfig,
    users: sampleUsers,
  });

  const emptyReasonReject = rejectRequest({
    request: req,
    actingUser: afzal,
    reason: '   ',
  });

  assert.equal(emptyReasonReject.success, false);
  assert.match(emptyReasonReject.error || '', /clear reason is required/);
});


