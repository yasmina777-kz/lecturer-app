import type { AvatarId } from "../types/auth";
import { PortraitMentor } from "./PortraitMentor";

export type AvatarState = "hidden" | "speaking" | "idle" | "thinking";

/** Existing profiles and lessons retain their IDs; all use the current landing-page mentor. */
export function AvatarPlayer({
  state = "idle",
  compact = false,
}: {
  state?: AvatarState;
  style?: string;
  compact?: boolean;
  avatarId?: AvatarId;
}) {
  if (state === "hidden") return null;
  return <PortraitMentor state={state} compact={compact} />;
}
