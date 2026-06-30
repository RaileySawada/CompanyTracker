import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  getVisitorId,
  removeVisitorPresence,
  subscribeVisitorPresence,
  updateVisitorPresence,
  type VisitorPresence,
} from "../lib/visitorPresence";

const HEARTBEAT_MS = 10000;
const FALLBACK_VISITOR = {
  id: "local",
  color: "#2563eb",
  initials: "ME",
};

export function VisitorTracker() {
  const [presence, setPresence] = useState<VisitorPresence>({
    count: 1,
    visitors: [FALLBACK_VISITOR],
  });
  const visibleVisitors = useMemo(
    () => (presence.visitors.length > 0 ? presence.visitors : [FALLBACK_VISITOR]),
    [presence.visitors],
  );
  const shownAvatarCount = Math.min(3, visibleVisitors.length);
  const extraVisitors = Math.max(0, presence.count - shownAvatarCount);
  const label = `${presence.count} ${presence.count === 1 ? "person" : "people"} viewing now`;

  useEffect(() => {
    const visitorId = getVisitorId();
    let isMounted = true;

    async function heartbeat() {
      try {
        const nextPresence = await updateVisitorPresence(visitorId);

        if (isMounted) {
          setPresence(nextPresence);
        }
      } catch {
        if (isMounted) {
          setPresence({
            count: 1,
            visitors: [FALLBACK_VISITOR],
          });
        }
      }
    }

    void heartbeat();
    const heartbeatId = window.setInterval(heartbeat, HEARTBEAT_MS);
    const unsubscribe = subscribeVisitorPresence((nextPresence) => {
      if (isMounted) {
        setPresence(nextPresence.count > 0 ? nextPresence : { count: 1, visitors: [FALLBACK_VISITOR] });
      }
    });

    return () => {
      isMounted = false;
      window.clearInterval(heartbeatId);
      unsubscribe();
      void removeVisitorPresence(visitorId);
    };
  }, []);

  return (
    <aside className="visitor-tracker" aria-label={label}>
      <div className="visitor-stack" aria-hidden="true">
        {visibleVisitors.slice(0, shownAvatarCount).map((visitor) => (
          <span
            className="visitor-avatar"
            key={visitor.id}
            style={{ "--visitor-color": visitor.color } as CSSProperties}
          >
            {visitor.initials}
          </span>
        ))}
        {extraVisitors > 0 ? <span className="visitor-overflow">+{extraVisitors}</span> : null}
      </div>
      <strong>{presence.count}</strong>
      <span>{presence.count === 1 ? "person" : "people"} viewing now</span>
    </aside>
  );
}
