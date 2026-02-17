"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE";

interface UseRealtimeOptions<T extends { id: string }> {
  table: string;
  filter?: string; // e.g. "user_id=eq.abc123"
  onInsert?: (record: T) => void;
  onUpdate?: (record: T) => void;
  onDelete?: (oldRecord: T) => void;
}

/**
 * Subscribe to Supabase Realtime changes on a table.
 * Automatically cleans up the subscription on unmount.
 */
export function useRealtime<T extends { id: string }>({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeOptions<T>) {
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete });
  callbacksRef.current = { onInsert, onUpdate, onDelete };

  useEffect(() => {
    const supabase = createClient();
    const channelName = `realtime-${table}-${filter || "all"}`;

    const channelConfig: Record<string, string> = {
      event: "*",
      schema: "public",
      table,
    };
    if (filter) {
      channelConfig.filter = filter;
    }

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as any,
        channelConfig,
        (payload: any) => {
          const eventType = payload.eventType as RealtimeEvent;
          if (eventType === "INSERT" && callbacksRef.current.onInsert) {
            callbacksRef.current.onInsert(payload.new as T);
          } else if (eventType === "UPDATE" && callbacksRef.current.onUpdate) {
            callbacksRef.current.onUpdate(payload.new as T);
          } else if (eventType === "DELETE" && callbacksRef.current.onDelete) {
            callbacksRef.current.onDelete(payload.old as T);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter]);
}
