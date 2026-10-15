import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { CameraIcon } from "../components/brand/ProfileAssets";
import { userApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { Spinner } from "../components/ui/Spinner";
import { NicknameField, ProfileImagePicker } from "../components/profile/ProfileForm";
import { useNicknameCheck, useProfileImage } from "../hooks/useProfileForm";

export function SetupProfile() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const toast = useToast();
  const { setMe } = useAuth();
  const nick = useNicknameCheck();
  const image = useProfileImage({ type: "AVATAR", avatarKey: "AVATAR_01", customUrl: null });
  const [busy, setBusy] = useState(false);
  const checkToken = nick.checkToken;
  const canSubmit = !!checkToken && !busy && !image.uploading;

  async function submit() {
    if (!canSubmit) {
      if (!checkToken) toast.error(t("profileSetup.checkFirst"));
      return;
    }
    setBusy(true);
    try {
      const me = await userApi.registerProfile({
        nickname: nick.trimmed,
        nickname_check_token: checkToken,
        ...image.payload(),
      });
      setMe(me);
      nav("/setup/onboarding", { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen setupp">
      <div className="setupp__scroll">
        <div className="setupp__inner">
          <h1 className="setupp__title">{t("profileSetup.setupTitle")}</h1>
          <p className="setupp__subtitle">{t("profileSetup.setupSubtitle")}</p>

          {/* The preview always shows what will be saved (same placement as
              Edit Profile's preview). */}
          <ProfileImagePicker image={image} emptyLabel={t("profileSetup.previewA11y")} camera={<CameraIcon />} />

          <NicknameField
            value={nick.nickname}
            onChange={nick.change}
            placeholder={t("profileSetup.nicknamePlaceholderSetup")}
            checkLabel="profileSetup.checkDuplicate"
            checkA11y="profileSetup.checkDuplicateA11y"
            checkDisabled={nick.checking || nick.trimmed.length < 2}
            checking={nick.checking}
            onCheck={nick.check}
            message={nick.message}
          />

          <div className="setupp__spacer" />

          <button
            type="button"
            className="setupp__submit"
            onClick={submit}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
            aria-label={t(canSubmit ? "profileSetup.start" : "profileSetup.startBlockedA11y")}
          >
            {busy ? <Spinner size={22} stroke={2.5} /> : t("profileSetup.start")}
          </button>
        </div>
      </div>
    </div>
  );
}
