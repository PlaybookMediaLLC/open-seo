import {
  getConnection,
  getConnectionById,
  replaceConnection,
  disconnect,
  setProductionEnvironment,
} from "./publishingConnections";
import {
  getProposal,
  listProposals,
  saveProposal,
} from "./publishingProposals";
import { beginExecution } from "./beginExecution";
import { checkpoint } from "./checkpoint";
import { getLatestExecution, recoverOpportunity } from "./recoverOpportunity";
import { markReverted } from "./markReverted";
import { claimTicket, completeTicket, getTicket } from "./opportunityTickets";

export const PublishingRepository = {
  getConnection,
  getConnectionById,
  replaceConnection,
  disconnect,
  setProductionEnvironment,
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
};
