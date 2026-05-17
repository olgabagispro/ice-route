export type IceAnalysisRunDecision = "start" | "reject_in_flight" | "reuse_completed";

interface IceAnalysisRunDecisionInput {
  requestKey: string;
  inFlightRequestKey: string | null;
  completedRequestKey: string | null;
  hasCompletedResult: boolean;
}

export function getIceAnalysisRunDecision({
  requestKey,
  inFlightRequestKey,
  completedRequestKey,
  hasCompletedResult,
}: IceAnalysisRunDecisionInput): IceAnalysisRunDecision {
  if (inFlightRequestKey === requestKey) {
    return "reject_in_flight";
  }

  if (hasCompletedResult && completedRequestKey === requestKey) {
    return "reuse_completed";
  }

  return "start";
}
