import { useRef, useState } from "react";
import { userApi } from "../api/endpoints";
import type { AvatarKey } from "../components/brand/ProfileAssets";
import { useTranslation } from "../i18n";
import { errorMessage } from "../lib/http";
import type { ProfileImageType } from "../lib/types";
import { useToast } from "./toast";

export type NicknameMessage = { ok: boolean; text: string };

/**
 * The nickname and its duplicate check. The check returns a token bound to
 * the exact nickname checked; any edit drops it, and a verdict that comes
 * back for a nickname since edited is ignored. `current` (profile edit) is
 * the saved nickname, which needs no check.
 */
export function useNicknameCheck({ initial = "", current }: { initial?: string; current?: string } = {}) {
  const { t } = useTranslation();
  const [nickname, setNickname] = useState(initial);
  const nicknameRef = useRef(nickname);
  nicknameRef.current = nickname;
  const [checkToken, setCheckToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<NicknameMessage | null>(null);
  const trimmed = nickname.trim();

  function change(v: string) {
    setNickname(v);
    // Any edit invalidates a prior successful check.
    setCheckToken(null);
    setMessage(null);
  }

  async function check() {
    if (checking) return;
    if (current !== undefined && trimmed === current) {
      setMessage({ ok: true, text: t("profileSetup.nicknameCurrent") });
      return;
    }
    if (trimmed.length < 2) {
      setMessage({ ok: false, text: t("profileSetup.nicknameTooShort") });
      return;
    }
    const value = trimmed;
    setChecking(true);
    setCheckToken(null);
    try {
      const res = await userApi.checkNickname(value);
      // The token is bound to the exact nickname checked; if it was edited
      // while the check was in flight, this verdict is for a stale value.
      if (nicknameRef.current.trim() !== value) return;
      if (res.available && res.check_token) {
        setCheckToken(res.check_token);
        setMessage({ ok: true, text: t("profileSetup.nicknameAvailable") });
      } else {
        setMessage({ ok: false, text: t("profileSetup.nicknameTaken") });
      }
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) });
    } finally {
      setChecking(false);
    }
  }

  return { nickname, trimmed, change, check, checking, checkToken, message };
}

/**
 * The profile image: a default character or an uploaded photo, exclusively —
 * choosing a character drops an uploaded photo (not just hides it) and
 * uploading a photo supersedes the character.
 */
export function useProfileImage(initial: { type: ProfileImageType; avatarKey: AvatarKey; customUrl: string | null }) {
  const toast = useToast();
  const [imageType, setImageType] = useState<ProfileImageType>(initial.type);
  const [avatarKey, setAvatarKey] = useState<AvatarKey>(initial.avatarKey);
  const [customUrl, setCustomUrl] = useState<string | null>(initial.customUrl);
  const [uploading, setUploading] = useState(false);

  function selectCharacter(key: AvatarKey) {
    setAvatarKey(key);
    setImageType("AVATAR");
    setCustomUrl(null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file || uploading) return;
    setUploading(true);
    try {
      const res = await userApi.uploadImage(file);
      setCustomUrl(res.profile_image_url);
      setImageType("CUSTOM");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  const showCustom = imageType === "CUSTOM" && !!customUrl;
  return {
    imageType,
    avatarKey,
    customUrl,
    uploading,
    selectCharacter,
    onFile,
    showCustom,
    showChar: !showCustom && imageType === "AVATAR",
    /** The image fields of a profile save. */
    payload: () => ({
      profile_image_type: imageType,
      avatar_key: imageType === "AVATAR" ? avatarKey : null,
      profile_image_url: imageType === "CUSTOM" ? customUrl : null,
    }),
  };
}
