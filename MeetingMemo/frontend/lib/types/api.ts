export interface RedeemResponse {
  authenticated: true;
  remaining_redemptions: number;
  expires_at: string;
}

export interface AccessSessionResponse {
  authenticated: true;
  session_id: string;
  expires_at: string;
}

export interface Meeting {
  id: string;
  title: string;
  meeting_at: string | null;
  timezone: string;
  source: string;
  language: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface MeetingListResponse {
  items: Meeting[];
}

export interface TranscriptUpdateResponse {
  meeting_id: string;
  segment_count: number;
}

export interface MeetingCreateInput {
  title: string;
  meeting_at: string | null;
  timezone: string;
  language: string;
}

export interface TranscriptSegment {
  id: string;
  sequence: number;
  start_ms: number | null;
  end_ms: number | null;
  speaker: string | null;
  text: string;
}

export interface MeetingDetail extends Meeting {
  segments: TranscriptSegment[];
}

export type Confidence = "high" | "medium" | "low";

export interface SummaryTopic {
  title: string;
  summary: string;
  source_segment_ids: string[];
}

export interface SummaryDecision {
  text: string;
  source_segment_ids: string[];
  confidence: Confidence;
}

export interface SummaryActionItem {
  task: string;
  owner: string | null;
  due_date: string | null;
  source_segment_ids: string[];
  confidence: Confidence;
}

export interface SummaryOpenQuestion {
  text: string;
  source_segment_ids: string[];
}

export interface SummaryPayload {
  summary_version: "1.0";
  headline: string;
  topics: SummaryTopic[];
  decisions: SummaryDecision[];
  action_items: SummaryActionItem[];
  open_questions: SummaryOpenQuestion[];
  quality_flags: string[];
}

export interface SummaryVersion {
  id: string;
  meeting_id: string;
  version: number;
  schema_version: string;
  content: SummaryPayload;
  quality_flags: string[];
  status: string;
  parent_version_id: string | null;
  created_source: string;
  created_at: string;
}

export interface SummaryListResponse {
  items: SummaryVersion[];
}

export interface JobError {
  code: string;
  message: string;
}

export type ProcessingJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface ProcessingJob {
  id: string;
  meeting_id: string;
  job_type: string;
  status: ProcessingJobStatus;
  attempts: number;
  max_attempts: number;
  error: JobError | null;
  created_at: string;
  updated_at: string;
}

export type IntegrationState = "configured" | "not_configured";

export interface IntegrationsResponse {
  slack: { status: IntegrationState };
  email: { status: IntegrationState };
  zoom: { status: IntegrationState };
  google_meet: { status: IntegrationState };
}

export interface DeliveryResponse {
  id: string;
  summary_version_id: string;
  channel: "slack" | "email";
  status: "pending" | "succeeded" | "failed" | "unknown";
  receipt: Record<string, unknown>;
  error: JobError | null;
  created_at: string;
  updated_at: string;
}

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    trace_id?: string;
  };
}
