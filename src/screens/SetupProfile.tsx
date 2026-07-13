import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ProfilePlaceholder,
  CharacterAvatar,
  CameraIcon,
  AVATAR_KEYS,
  avatarLabel,
  type AvatarKey,
} from "../components/brand/ProfileAssets";
import { userApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { ProfileImageType } from "../lib/types";

export function SetupProfile() {
  const nav = useNavigate();
  const toast = useToast();
  const { setMe } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState("");
  const [checkToken, setCheckToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [imageType, setImageType] = useState<ProfileImageType>("AVATAR");
  const [avatarKey, setAvatarKey] = useState<AvatarKey>("AVATAR_01");
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSubmit = !!checkToken && !busy && !uploading;

  async function checkNick() {
    const value = nickname.trim();
    if (value.length < 2) {
      setCheckMsg({ ok: false, text: "2자 이상 입력해 주세요." });
      return;
    }
    if (checking) return;
    setChecking(true);
    setCheckToken(null);
    try {
      const res = await userApi.checkNickname(value);
      if (res.available && res.check_token) {
        setCheckToken(res.check_token);
        setCheckMsg({ ok: true, text: "사용가능한 닉네임입니다." });
      } else {
        setCheckMsg({ ok: false, text: "이미 사용 중인 닉네임이에요." });
      }
    } catch (e) {
      setCheckMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setChecking(false);
    }
  }

  function onNicknameChange(v: string) {
    setNickname(v);
    // Any edit invalidates a prior successful check.
    setCheckToken(null);
    setCheckMsg(null);
  }

  function selectCharacter(key: AvatarKey) {
    setAvatarKey(key);
    setImageType("AVATAR");
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

  async function submit() {
    if (!canSubmit) {
      if (!checkToken) toast.error("닉네임 중복확인을 먼저 해주세요.");
      return;
    }
    setBusy(true);
    try {
      const me = await userApi.registerProfile({
        nickname: nickname.trim(),
        nickname_check_token: checkToken,
        profile_image_type: imageType,
        avatar_key: imageType === "AVATAR" ? avatarKey : null,
        profile_image_url: imageType === "CUSTOM" ? customUrl : null,
      });
      setMe(me);
      nav("/setup/onboarding", { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const showCustom = imageType === "CUSTOM" && !!customUrl;

  return (
    <div className="screen setupp">
      <div className="setupp__scroll">
        <div className="setupp__inner">
          <h1 className="setupp__title">프로필 등록</h1>
          <p className="setupp__subtitle">시작에 앞서 프로필을 등록해볼까요?</p>

          {/* Profile image */}
          <div className="setupp__label">프로필 이미지</div>
          <div className="setupp__preview">
            <div className="setupp__preview-circle" role="img" aria-label="프로필 이미지 미리보기">
              {showCustom ? <img src={customUrl!} alt="" className="setupp__preview-img" /> : <ProfilePlaceholder />}
            </div>
          </div>
          <div className="setupp__photo-wrap">
            <button
              type="button"
              className="setupp__photo"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="사진 선택, 사진 라이브러리 열기"
            >
              {uploading ? (
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              ) : (
                <CameraIcon />
              )}
              <span>사진 선택</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          </div>

          {/* Default characters */}
          <div className="setupp__label">기본 캐릭터 선택</div>
          <div className="setupp__chars" role="radiogroup" aria-label="기본 캐릭터 선택">
            {AVATAR_KEYS.map((key) => {
              const selected = imageType === "AVATAR" && avatarKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  className="setupp__char-btn"
                  role="radio"
                  aria-checked={selected}
                  aria-label={avatarLabel(key)}
                  onClick={() => selectCharacter(key)}
                >
                  <CharacterAvatar variant={key} selected={selected} />
                </button>
              );
            })}
          </div>

          {/* Nickname */}
          <div className="setupp__label">닉네임</div>
          <div className="setupp__nick-row">
            <input
              className="setupp__nick-input"
              placeholder="10자이하로 입력하세요"
              aria-label="닉네임"
              value={nickname}
              maxLength={10}
              onChange={(e) => onNicknameChange(e.target.value)}
            />
            <button
              type="button"
              className="setupp__nick-btn"
              onClick={checkNick}
              disabled={checking || nickname.trim().length < 2}
              aria-label="닉네임 중복확인"
            >
              {checking ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : "중복확인"}
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
            onClick={submit}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
            aria-label={canSubmit ? "시작하기" : "닉네임 중복확인을 완료하면 시작할 수 있어요"}
          >
            {busy ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} /> : "시작하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
