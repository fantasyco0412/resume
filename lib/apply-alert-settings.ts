import type { DefaultSettings } from "@/lib/supabase/database.types";

export const DEFAULT_DUPLICATE_APPLY_MONTHS = 1;

export interface ApplyAlertSettings {
  duplicate_apply_alert_enabled: boolean;
  duplicate_apply_months: number;
  hybrid_onsite_alert_enabled: boolean;
}

export const DEFAULT_APPLY_ALERT_SETTINGS: ApplyAlertSettings = {
  duplicate_apply_alert_enabled: false,
  duplicate_apply_months: DEFAULT_DUPLICATE_APPLY_MONTHS,
  hybrid_onsite_alert_enabled: false,
};

export function parseApplyAlertSettings(
  settings: DefaultSettings | null | undefined
): ApplyAlertSettings {
  const raw = settings ?? {};
  const months = Number(raw.duplicate_apply_months);
  return {
    duplicate_apply_alert_enabled: Boolean(raw.duplicate_apply_alert_enabled),
    duplicate_apply_months:
      Number.isFinite(months) && months >= 1 && months <= 24
        ? Math.round(months)
        : DEFAULT_DUPLICATE_APPLY_MONTHS,
    hybrid_onsite_alert_enabled: Boolean(raw.hybrid_onsite_alert_enabled),
  };
}

export function applyAlertSettingsToDefaultSettings(
  current: DefaultSettings | null | undefined,
  alerts: ApplyAlertSettings
): DefaultSettings {
  return {
    ...(current ?? {}),
    duplicate_apply_alert_enabled: alerts.duplicate_apply_alert_enabled,
    duplicate_apply_months: alerts.duplicate_apply_months,
    hybrid_onsite_alert_enabled: alerts.hybrid_onsite_alert_enabled,
  };
}
