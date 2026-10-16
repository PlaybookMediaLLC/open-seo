import { completeRun } from "./completeMeasurement";
import { confirmDeployment } from "./confirmDeployment";
import { listSignals, recordSignal } from "./deploymentSignals";
import {
  get,
  getExecutionHistory,
  getForExecution,
  hasOverlappingChanges,
  list,
} from "./experimentReads";
import { recordPullStatus, register } from "./experimentRegistration";
import { failRun, startRun } from "./measurementRuns";

export const ExperimentRepository = {
  list,
  get,
  getForExecution,
  getExecutionHistory,
  register,
  recordPullStatus,
  confirmDeployment,
  recordSignal,
  listSignals,
  startRun,
  completeRun,
  failRun,
  hasOverlappingChanges,
};
