import { PermissionType } from '../../gen/permissions';

export const REQUIRED_PERMISSION_TYPES = [
  PermissionType.PERMISSION_TYPE_MICROPHONE,
  PermissionType.PERMISSION_TYPE_ACCESSIBILITY,
] as const;

export const SETTINGS_PERMISSION_POLL_INTERVAL_MS = 500;
export const SETTINGS_PERMISSION_POLL_TIMEOUT_MS = 30_000;
export const ACCESSIBILITY_PERMISSION_POLL_INTERVAL_MS = 700;
