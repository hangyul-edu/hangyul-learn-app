import { useCallback, useRef, useState } from "react";
import { useBlocker, useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import {
  ProfilePlaceholder,
  CharacterAvatar,
  characterArtSrc,
  characterArtStyle,
  AVATAR_KEYS,
  avatarLabelKey,
  avatarBg,
  type AvatarKey,
} from "../components/brand/ProfileAssets";
import { UnsavedChangesModal } from "../components/UnsavedChangesModal";
import { userApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { ProfileImageType } from "../lib/types";
/* Group 8159 (290:13289) — AME-006's own camera glyph, 20.2128 x 16 in Gray 4. */
import icCamera from "../assets/brand/ic-camera.svg";
import { SuccessModal } from "../components/SuccessModal";
import { FailModal } from "../components/FailModal";
import icModalSuccess from "../assets/brand/ic-modal-success.svg";
import { Spinner } from "../components/ui/Spinner";
import { BackChevronIcon } from "../components/brand/Glyphs";

/**
 * Profile edit ("프로필 변경") — reuses the profile-registration visual system
 * (.setupp__*) but pre-fills the current profile and gates a Save button that
 * only enables for validated changes. Image source is exclusive: uploading a
 * photo (CUSTOM) supersedes a selected character (AVATAR) and vice-versa.
 */
export function EditProfile() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const toast = useToast();
  /* Save outcome, shown as an AME-006 modal rather than a toast. */
  const [result, setResult] = useState<null | "saved" | "failed">(null);
  const { me, setMe } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState(me?.nickname ?? "");
  const nicknameRef = useRef(nickname);
  nicknameRef.current = nickname;
  const [checkToken, setCheckToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const initialType: ProfileImageType = me?.profile_image_type ?? "NONE";
  const [imageType, setImageType] = useState<ProfileImageType>(initialType);
  const [avatarKey, setAvatarKey] = useState<AvatarKey>((me?.avatar_key as AvatarKey) ?? "AVATAR_01");
  const [customUrl, setCustomUrl] = useState<string | null>(
    me?.profile_image_type === "CUSTOM" ? me?.profile_image_url ?? null : null,
  );
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const trimmed = nickname.trim();
  const nickChanged = trimmed !== (me?.nickname ?? "");
  const imageChanged =
    imageType !== initialType ||
    (imageType === "AVATAR" && avatarKey !== me?.avatar_key) ||
    (imageType === "CUSTOM" && customUrl !== me?.profile_image_url);
  const anyChanged = nickChanged || imageChanged;
  // A changed nickname needs a passing duplicate check; an unchanged one is fine.
  const nickOk = !nickChanged || !!checkToken;
  const canSave = !!me && anyChanged && nickOk && !busy && !uploading && !checking;

  // Unsaved-changes guard. Block EVERY in-app exit path while there are edits
  // (header back, browser/hardware back, swipe-back, programmatic pop) via the
  // data router; the modal is driven by the blocker's state. A deliberate exit
  // (successful save, or tapping 나가기) sets leavingRef to bypass the guard.
  const leavingRef = useRef(false);
  const blocker = useBlocker(
    useCallback(
      ({
        currentLocation,
        nextLocation,
      }: {
        currentLocation: { pathname: string };
        nextLocation: { pathname: string };
      }) => anyChanged && !leavingRef.current && currentLocation.pathname !== nextLocation.pathname,
      [anyChanged],
    ),
  );

  function onNicknameChange(v: string) {
    setNickname(v);
    // Any edit invalidates a prior successful check.
    setCheckToken(null);
    setCheckMsg(null);
  }

  async function checkNick() {
    if (checking) return;
    if (!nickChanged) {
      setCheckMsg({ ok: true, text: t("profileSetup.nicknameCurrent") });
      return;
    }
    if (trimmed.length < 2) {
      setCheckMsg({ ok: false, text: t("profileSetup.nicknameTooShort") });
      return;
    }
    setChecking(true);
    setCheckToken(null);
    try {
      const res = await userApi.checkNickname(trimmed);
      // The token is bound to the exact nickname checked; if it was edited
      // while the check was in flight, this verdict is for a stale value.
      if (nicknameRef.current.trim() !== trimmed) return;
      if (res.available && res.check_token) {
        setCheckToken(res.check_token);
        setCheckMsg({ ok: true, text: t("profileSetup.nicknameAvailable") });
      } else {
        setCheckMsg({ ok: false, text: t("profileSetup.nicknameTaken") });
      }
    } catch (e) {
      setCheckMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setChecking(false);
    }
  }

  function selectCharacter(key: AvatarKey) {
    // Character selection supersedes any unsaved uploaded photo.
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

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        profile_image_type: imageType,
        avatar_key: imageType === "AVATAR" ? avatarKey : null,
        profile_image_url: imageType === "CUSTOM" ? customUrl : null,
      };
      if (nickChanged) {
        body.nickname = trimmed;
        body.nickname_check_token = checkToken;
      }
      const updated = await userApi.updateProfile(body);
      setMe(updated);
      leavingRef.current = true; // saved → deliberate exit, don't trip the guard
      // AME-006 confirms the save with a modal (2231:24627), not a toast; the
      // navigation happens when the user acknowledges it.
      setResult("saved");
    } catch (e) {
      // 2231:24634 — the failure is a modal too. errorMessage() is kept for the
      // console/telemetry path but the user-facing copy is Figma's.
      console.error("[profile] save failed", errorMessage(e));
      setResult("failed");
    } finally {
      setBusy(false);
    }
  }

  const showCustom = imageType === "CUSTOM" && !!customUrl;
  const showChar = !showCustom && imageType === "AVATAR";

  return (
    <div className="screen setupp setupp--edit">
      <div className="setupp__scroll">
        <div className="setupp__inner">
          <button
            className="setupp__back"
            onClick={() => { if (!busy) nav("/profile"); }}
            disabled={busy}
            aria-label={t("common.back")}
          >
            <BackChevronIcon />
          </button>

          <h1 className="setupp__title">{t("profileSetup.editTitle")}</h1>

          {/* Profile image */}
          <div className="setupp__label">{t("profileSetup.imageLabel")}</div>
          <div className="setupp__preview">
            <div
              className="setupp__preview-circle"
              style={showChar ? { background: avatarBg(avatarKey) } : undefined}
              role="img"
              aria-label={
                showCustom
                  ? t("profileSetup.imageUploadedA11y")
                  : showChar
                    ? t("profileSetup.imageCharacterA11y", { name: t(avatarLabelKey(avatarKey)) })
                    : t("profileSetup.imageDefaultA11y")
              }
            >
              {showCustom ? (
                <img src={customUrl!} alt="" className="setupp__preview-img" />
              ) : showChar ? (
                <span className="setupp__preview-char">
                  {/* Same ink-centred placement as the 80px picker, scaled to
                      the 120 preview frame. */}
                  <img
                    src={characterArtSrc(avatarKey)}
                    alt=""
                    aria-hidden="true"
                    style={characterArtStyle(avatarKey, 120)}
                  />
                </span>
              ) : (
                <ProfilePlaceholder />
              )}
            </div>
          </div>
          <div className="setupp__photo-wrap">
            <button
              type="button"
              className="setupp__photo"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label={t("profileSetup.choosePhotoA11y")}
            >
              {uploading ? (
                <Spinner size={16} stroke={2} />
              ) : (
                <img className="setupp__photo-ic" src={icCamera} alt="" aria-hidden="true" width={20.2128} height={16} />
              )}
              <span>{t("profileSetup.choosePhoto")}</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          </div>

          {/* Default characters */}
          <div className="setupp__label">{t("profileSetup.characterLabel")}</div>
          <div className="setupp__chars" role="radiogroup" aria-label={t("profileSetup.characterLabel")}>
            {AVATAR_KEYS.map((key) => {
              const selected = showChar && avatarKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  className="setupp__char-btn"
                  role="radio"
                  aria-checked={selected}
                  aria-label={t(avatarLabelKey(key))}
                  onClick={() => selectCharacter(key)}
                >
                  <CharacterAvatar variant={key} selected={selected} />
                </button>
              );
            })}
          </div>

          {/* Nickname */}
          <div className="setupp__label">{t("profileSetup.nicknameLabel")}</div>
          <div className="setupp__nick-row">
            <input
              className="setupp__nick-input"
              placeholder={t("profileSetup.nicknamePlaceholderEdit")}
              aria-label={t("profileSetup.nicknameA11y")}
              value={nickname}
              maxLength={10}
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(e) => onNicknameChange(e.target.value)}
            />
            <button
              type="button"
              className="setupp__nick-btn"
              onClick={checkNick}
              disabled={checking || trimmed.length < 1}
              aria-label={t("profileSetup.changeNicknameA11y")}
            >
              {checking ? <Spinner size={18} stroke={2} /> : t("profileSetup.changeNickname")}
            </button>
          </div>
          <p
            className={`setupp__nick-msg ${checkMsg ? (checkMsg.ok ? "is-ok" : "is-err") : ""}`}
            role="status"
            aria-live="polite"
          >
            {checkMsg?.text ?? ""}
          </p>

          <div className="setupp__spacer" />

          <button
            type="button"
            className="setupp__submit"
            onClick={save}
            disabled={!canSave}
            aria-disabled={!canSave}
            aria-label={t(canSave ? "profileSetup.save" : "profileSetup.saveBlockedA11y")}
          >
            {busy ? <Spinner size={22} stroke={2.5} /> : t("profileSetup.save")}
          </button>
        </div>
      </div>

      {/* 2231:24627 — success. Uses the frame's green badge rather than
          MOR-007's mint one. Acknowledging it leaves for the profile page. */}
      <SuccessModal
        open={result === "saved"}
        icon={icModalSuccess}
        title={t("profileSetup.savedTitle")}
        description={t("profileSetup.savedBody")}
        onClose={() => { setResult(null); nav("/profile"); }}
      />

      {/* 2231:24634 — failure. Stays on the screen so the user can retry. */}
      <FailModal
        open={result === "failed"}
        title={t("profileSetup.saveFailTitle")}
        description={t("profileSetup.saveFailBody").split("\n").map((line, i) => (
          <span key={i} style={{ display: "block" }}>{line}</span>
        ))}
        onClose={() => setResult(null)}
      />

      <UnsavedChangesModal
        open={blocker.state === "blocked"}
        title={t("profileSetup.exitTitle")}
        subtitle={t("profileSetup.exitSubtitle")}
        cancelLabel={t("common.cancel")}
        onContinue={() => blocker.reset?.()}
        onLeave={() => {
          leavingRef.current = true; // discard the draft and proceed with the blocked nav
          blocker.proceed?.();
        }}
      />
    </div>
  );
}
