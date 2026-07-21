import { useCallback, useRef, useState } from "react";
import { useBlocker, useNavigate } from "react-router-dom";
import {
  ProfilePlaceholder,
  CharacterAvatar,
  CharacterArt,
  CameraIcon,
  AVATAR_KEYS,
  avatarLabel,
  avatarBg,
  type AvatarKey,
} from "../components/brand/ProfileAssets";
import { UnsavedChangesModal } from "../components/UnsavedChangesModal";
import { userApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { ProfileImageType } from "../lib/types";

/**
 * Profile edit ("프로필 변경") — reuses the profile-registration visual system
 * (.setupp__*) but pre-fills the current profile and gates a Save button that
 * only enables for validated changes. Image source is exclusive: uploading a
 * photo (CUSTOM) supersedes a selected character (AVATAR) and vice-versa.
 */
export function EditProfile() {
  const nav = useNavigate();
  const toast = useToast();
  const { me, setMe } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState(me?.nickname ?? "");
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
      setCheckMsg({ ok: true, text: "현재 사용 중인 닉네임이에요." });
      return;
    }
    if (trimmed.length < 2) {
      setCheckMsg({ ok: false, text: "2자 이상 입력해 주세요." });
      return;
    }
    setChecking(true);
    setCheckToken(null);
    try {
      const res = await userApi.checkNickname(trimmed);
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
      toast.success("저장했어요");
      nav("/profile");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const showCustom = imageType === "CUSTOM" && !!customUrl;
  const showChar = !showCustom && imageType === "AVATAR";

  return (
    <div className="screen setupp">
      <div className="setupp__scroll">
        <div className="setupp__inner">
          <button
            className="setupp__back"
            onClick={() => { if (!busy) nav("/profile"); }}
            disabled={busy}
            aria-label="뒤로"
          >
            <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <h1 className="setupp__title">프로필 변경</h1>

          {/* Profile image */}
          <div className="setupp__label">프로필 이미지</div>
          <div className="setupp__preview">
            <div
              className="setupp__preview-circle"
              style={showChar ? { background: avatarBg(avatarKey) } : undefined}
              role="img"
              aria-label={
                showCustom
                  ? "프로필 이미지: 업로드한 사진"
                  : showChar
                    ? `프로필 이미지: ${avatarLabel(avatarKey)}`
                    : "프로필 이미지: 기본 이미지"
              }
            >
              {showCustom ? (
                <img src={customUrl!} alt="" className="setupp__preview-img" />
              ) : showChar ? (
                <span className="setupp__preview-char">
                  <CharacterArt variant={avatarKey} fill="80%" />
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
              const selected = showChar && avatarKey === key;
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
              placeholder="닉네임을 입력하세요"
              aria-label="닉네임"
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
              aria-label="닉네임 변경 확인"
            >
              {checking ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : "변경하기"}
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
            aria-label={canSave ? "저장하기" : "변경 사항이 없거나 닉네임 확인이 필요해 저장할 수 없어요"}
          >
            {busy ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} /> : "저장하기"}
          </button>
        </div>
      </div>

      <UnsavedChangesModal
        open={blocker.state === "blocked"}
        title="프로필 변경을 종료할까요?"
        subtitle="저장하지 않고 나가면 변경사항이 사라져요"
        cancelLabel="취소"
        onContinue={() => blocker.reset?.()}
        onLeave={() => {
          leavingRef.current = true; // discard the draft and proceed with the blocked nav
          blocker.proceed?.();
        }}
      />
    </div>
  );
}
