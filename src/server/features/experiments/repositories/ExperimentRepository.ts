import { completeRun } from "./completeMeasurement";
import { confirmDeployment } from "./confirmDeployment";
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
  startRun,
  completeRun,
  failRun,
  hasOverlappingChanges,
};
