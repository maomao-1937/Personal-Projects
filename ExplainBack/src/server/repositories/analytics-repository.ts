import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import type { AnalyticsEventName } from "@/lib/domain";

export interface AnalyticsEvent {
  id: string;
  sessionId: string | null;
  conceptId: string | null;
  eventName: AnalyticsEventName;
  properties: Record<string, unknown>;
  createdAt: string;
}

interface AnalyticsEventRow {
  id: string;
  session_id: string | null;
  concept_id: string | null;
  event_name: AnalyticsEventName;
  properties_json: string;
  created_at: string;
}

function mapEvent(row: AnalyticsEventRow): AnalyticsEvent {
  return {
    id: row.id,
    sessionId: row.session_id,
    conceptId: row.concept_id,
    eventName: row.event_name,
    properties: JSON.parse(row.properties_json) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

export function createAnalyticsRepository(db: Database.Database) {
  return {
    record(input: {
      eventName: AnalyticsEventName;
      sessionId?: string | null;
      conceptId?: string | null;
      properties?: Record<string, unknown>;
    }): AnalyticsEvent {
      const id = randomUUID();
      db.prepare(
        `INSERT INTO analytics_events (
          id, session_id, concept_id, event_name, properties_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        input.sessionId ?? null,
        input.conceptId ?? null,
        input.eventName,
        JSON.stringify(input.properties ?? {}),
        new Date().toISOString(),
      );

      return mapEvent(
        db.prepare("SELECT * FROM analytics_events WHERE id = ?").get(id) as AnalyticsEventRow,
      );
    },

    listForSession(sessionId: string): AnalyticsEvent[] {
      return (
        db
          .prepare(
            "SELECT * FROM analytics_events WHERE session_id = ? ORDER BY created_at ASC",
          )
          .all(sessionId) as AnalyticsEventRow[]
      ).map(mapEvent);
    },
  };
}

