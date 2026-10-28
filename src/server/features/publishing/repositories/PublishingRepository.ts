import {
  getConnection,
  getConnectionById,
  replaceConnection,
  disconnect,
  setProductionEnvironment,
  rewrapToken,
} from "./publishingConnections";
import {
  getProposal,
  listProposals,
  saveProposal,
} from "./publishingProposals";
import { beginExecution } from "./beginExecution";
import { checkpoint } from "./checkpoint";
import { getLatestExecution, recoverOpportunity } from "./recoverOpportunity";
import {
  getInstallation,
  listInstallationRepositoryIds,
  listInstallations,
  revokeInstallation,
  saveInstallation,
} from "./githubAppInstallations";
import { markReverted } from "./markReverted";
import { claimTicket, completeTicket, getTicket } from "./opportunityTickets";
import {
  listApproverCandidates,
  listApproverUserIds,
  membersIn,
  replaceApprovers,
} from "./publishingApprovers";

export const PublishingRepository = {
  getConnection,
  getConnectionById,
  replaceConnection,
  disconnect,
  setProductionEnvironment,
  rewrapToken,
  listProposals,
  getProposal,
  saveProposal,
  beginExecution,
  checkpoint,
  getLatestExecution,
  recoverOpportunity,
  markReverted,
  claimTicket,
  completeTicket,
  getTicket,
  saveInstallation,
  listInstallations,
  listInstallationRepositoryIds,
  getInstallation,
  revokeInstallation,
  listApproverUserIds,
  listApproverCandidates,
  membersIn,
  replaceApprovers,
};
