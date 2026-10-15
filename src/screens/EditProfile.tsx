import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import type { AvatarKey } from "../components/brand/ProfileAssets";
import { UnsavedChangesModal } from "../components/UnsavedChangesModal";
import { userApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { errorMessage } from "../lib/http";
import type { ProfileImageType } from "../lib/types";
/* Group 8159 (290:13289) — AME-006's own camera glyph, 20.2128 x 16 in Gray 4. */
import icCamera from "../assets/brand/ic-camera.svg";
import { SuccessModal } from "../components/SuccessModal";
import { FailModal } from "../components/FailModal";
import icModalSuccess from "../assets/brand/ic-modal-success.svg";
import { Spinner } from "../components/ui/Spinner";
import { NicknameField, ProfileImagePicker } from "../components/profile/ProfileForm";
import { useNicknameCheck, useProfileImage } from "../hooks/useProfileForm";
import { BackChevronIcon } from "../components/brand/Glyphs";
import { useUnsavedGuard } from "../hooks/useUnsavedGuard";

/**
 * Profile edit ("프로필 변경") — reuses the profile-registration visual system
 * (.setupp__*) but pre-fills the current profile and gates a Save button that
 * only enables for validated changes. Image source is exclusive: uploading a
 * photo (CUSTOM) supersedes a selected character (AVATAR) and vice-versa.
 */
export function EditProfile() {
  const { t } = useTranslation();
  const nav = useNavigate();
  /* Save outcome, shown as an AME-006 modal rather than a toast. */
  const [result, setResult] = useState<null | "saved" | "failed">(null);
  const { me, setMe } = useAuth();
  const savedNickname = me?.nickname ?? "";
  const nick = useNicknameCheck({ initial: savedNickname, current: savedNickname });
  const { trimmed, checkToken, checking } = nick;
  const initialType: ProfileImageType = me?.profile_image_type ?? "NONE";
  const image = useProfileImage({
    type: initialType,
    avatarKey: (me?.avatar_key as AvatarKey) ?? "AVATAR_01",
    customUrl: me?.profile_image_type === "CUSTOM" ? me?.profile_image_url ?? null : null,
  });
  const { imageType, avatarKey, customUrl, uploading } = image;
  const [busy, setBusy] = useState(false);

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
  // (successful save, or tapping 나가기) is let through.
  const guard = useUnsavedGuard(anyChanged);

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = image.payload();
      if (nickChanged) {
        body.nickname = trimmed;
        body.nickname_check_token = checkToken;
      }
      const updated = await userApi.updateProfile(body);
      setMe(updated);
      guard.allowLeave(); // saved → deliberate exit, don't trip the guard
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

          <ProfileImagePicker
            image={image}
            emptyLabel={t("profileSetup.imageDefaultA11y")}
            camera={<img className="setupp__photo-ic" src={icCamera} alt="" aria-hidden="true" width={20.2128} height={16} />}
          />

          <NicknameField
            value={nick.nickname}
            onChange={nick.change}
            placeholder={t("profileSetup.nicknamePlaceholderEdit")}
            checkLabel="profileSetup.changeNickname"
            checkA11y="profileSetup.changeNicknameA11y"
            checkDisabled={checking || trimmed.length < 1}
            checking={checking}
            onCheck={nick.check}
            message={nick.message}
            inputProps={{ autoCapitalize: "none", autoCorrect: "off" }}
          />

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
        open={guard.blocked}
        title={t("profileSetup.exitTitle")}
        subtitle={t("profileSetup.exitSubtitle")}
        cancelLabel={t("common.cancel")}
        onContinue={guard.stay}
        onLeave={guard.leave}
      />
    </div>
  );
}
