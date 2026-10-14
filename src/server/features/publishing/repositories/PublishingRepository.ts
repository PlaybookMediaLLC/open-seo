import {
  getConnection,
  getConnectionById,
  replaceConnection,
  disconnect,
} from "./publishingConnections";
import {
  getProposal,
  listProposals,
  saveProposal,
} from "./publishingProposals";
import { beginExecution } from "./beginExecution";
import { checkpoint } from "./checkpoint";
import { getLatestExecution, recoverOpportunity } from "./recoverOpportunity";

export const PublishingRepository = {
  getConnection,
  getConnectionById,
  replaceConnection,
  disconnect,
  listProposals,
  getProposal,
  saveProposal,
  beginExecution,
  checkpoint,
  getLatestExecution,
  recoverOpportunity,
};
