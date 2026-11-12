import { useState, useEffect, useMemo } from "react";
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getProviderConfigStatus,
} from "../services/notificationService.js";

/**
 * Unified In-App Notification Center & Channel Delivery Audit Drawer
 * Shows live notifications across Doctor, Hospital, and Patient roles,
 * plus honest delivery telemetry for SMS / Email / WhatsApp adapters.
 */
export default function NotificationCenter({ activeRoleFilter = "all" }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [roleTab, setRoleTab] = useState(activeRoleFilter);

  useEffect(() => {
    setRoleTab(activeRoleFilter);
  }, [activeRoleFilter]);

  useEffect(() => {
    const unsub = subscribeToNotifications((list) => {
      setNotifications(Array.isArray(list) ? list : []);
    });
    return unsub;
  }, []);

  const providers = useMemo(() => getProviderConfigStatus(), []);

  const filtered = useMemo(() => {
    if (roleTab === "all") return notifications;
    return notifications.filter((n) => n.recipientRole === roleTab || n.recipientRole === "all");
  }, [notifications, roleTab]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div className="rlh-notif-center">
      <button
        type="button"
        className={`rlh-notif-trigger ${unreadCount > 0 ? "has-unread" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Open Real-Time Notification Feed"
        title="Real-Time In-App Notifications & Delivery Status"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span className="rnt-label">Alerts</span>
        {unreadCount > 0 && <span className="rnt-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="rlh-notif-popover" role="region" aria-label="In-App Notifications">
          <div className="rnp-header">
            <div>
              <strong>Real-Time In-App Notification Feed</strong>
              <span className="rnp-sub">Live event bus synced across Doctor, Hospital &amp; Patient modules</span>
            </div>
            <div className="rnp-header-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="rnp-mark-btn"
                  onClick={() => markAllNotificationsRead(roleTab)}
                >
                  Mark read
                </button>
              )}
              <button type="button" className="rnp-close-btn" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
          </div>

          {/* Honest Channel Provider Status Bar */}
          <div className="rnp-provider-bar">
            <span className="rpb-pill active">● In-App: Active</span>
            <span className={`rpb-pill ${providers.sms.configured ? "active" : "unconfigured"}`}>
              {providers.sms.configured ? "● SMS: Active" : "○ SMS: Not Configured"}
            </span>
            <span className={`rpb-pill ${providers.email.configured ? "active" : "unconfigured"}`}>
              {providers.email.configured ? "● Email: Active" : "○ Email: Not Configured"}
            </span>
            <span className={`rpb-pill ${providers.whatsapp.configured ? "active" : "unconfigured"}`}>
              {providers.whatsapp.configured ? "● WhatsApp: Active" : "○ WhatsApp: Not Configured"}
            </span>
          </div>

          {/* Role Filter Pills */}
          <div className="rnp-tabs">
            {[
              { id: "all", label: "All Roles" },
              { id: "doctor", label: "Doctor" },
              { id: "hospital", label: "Hospital" },
              { id: "patient", label: "Patient" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`rnp-tab-btn ${roleTab === tab.id ? "active" : ""}`}
                onClick={() => setRoleTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notification Feed */}
          <div className="rnp-list">
            {filtered.length === 0 ? (
              <div className="rnp-empty">
                <p>No live notifications recorded yet for this view. Create, dispatch, accept, or reject a referral to see real-time alerts here.</p>
              </div>
            ) : (
              filtered.map((n) => (
                <div
                  key={n.id}
                  className={`rnp-item ${n.read ? "read" : "unread"}`}
                  onClick={() => !n.read && markNotificationRead(n.id)}
                >
                  <div className="rni-top">
                    <div className="rni-badges">
                      <span className={`rni-role role-${n.recipientRole}`}>{n.recipientRole}</span>
                      {n.referralId && <span className="rni-ref">{n.referralId}</span>}
                      {n.isDemoData && <span className="rni-demo">Demo</span>}
                    </div>
                    <span className="rni-time">{formatTime(n.createdAt)}</span>
                  </div>
                  <strong className="rni-title">{n.title}</strong>
                  <p className="rni-msg">{n.message}</p>

                  {/* Per-channel delivery transparency */}
                  {Array.isArray(n.channelDeliveries) && n.channelDeliveries.length > 0 && (
                    <div className="rni-channels">
                      {n.channelDeliveries.map((cd, idx) => (
                        <span
                          key={idx}
                          className={`rni-ch ${cd.sent ? "sent" : "skipped"}`}
                          title={cd.reason || cd.status}
                        >
                          {cd.channel.toUpperCase()}: {cd.sent ? "Delivered" : "Skipped (Unconfigured)"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

