import { useRef, type ReactNode } from "react";
import { useTranslation, type TranslationKey } from "../../i18n";
import {
  AVATAR_KEYS,
  CharacterAvatar,
  ProfilePlaceholder,
  avatarBg,
  avatarLabelKey,
  characterArtSrc,
  characterArtStyle,
} from "../brand/ProfileAssets";
import { Spinner } from "../ui/Spinner";
import type { NicknameMessage, useProfileImage } from "../../hooks/useProfileForm";

/**
 * The profile image section of registration and edit (.setupp__*): the
 * 120px preview of what will be saved — the uploaded photo, or the selected
 * character on its own tint — the photo button and the character grid.
 */
export function ProfileImagePicker({
  image,
  emptyLabel,
  camera,
}: {
  image: ReturnType<typeof useProfileImage>;
  /** The preview's accessible name with no image yet. */
  emptyLabel: string;
  /** The photo button's glyph (each screen's own export). */
  camera: ReactNode;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const { showCustom, showChar, avatarKey } = image;
  return (
    <>
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
                : emptyLabel
          }
        >
          {showCustom ? (
            <img src={image.customUrl!} alt="" className="setupp__preview-img" />
          ) : showChar ? (
            <span className="setupp__preview-char">
              {/* Same ink-centred placement as the 80px picker, scaled to the
                  120 preview frame. */}
              <img src={characterArtSrc(avatarKey)} alt="" aria-hidden="true" style={characterArtStyle(avatarKey, 120)} />
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
          disabled={image.uploading}
          aria-label={t("profileSetup.choosePhotoA11y")}
        >
          {image.uploading ? <Spinner size={16} stroke={2} /> : camera}
          <span>{t("profileSetup.choosePhoto")}</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={image.onFile} />
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
              onClick={() => image.selectCharacter(key)}
            >
              <CharacterAvatar variant={key} selected={selected} />
            </button>
          );
        })}
      </div>
    </>
  );
}

/** The nickname row: the input, its check button and the verdict line. */
export function NicknameField({
  value,
  onChange,
  placeholder,
  checkLabel,
  checkA11y,
  checkDisabled,
  checking,
  onCheck,
  message,
  inputProps,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  checkLabel: TranslationKey;
  checkA11y: TranslationKey;
  checkDisabled: boolean;
  checking: boolean;
  onCheck: () => void;
  message: NicknameMessage | null;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="setupp__label">{t("profileSetup.nicknameLabel")}</div>
      <div className="setupp__nick-row">
        <input
          className="setupp__nick-input"
          placeholder={placeholder}
          aria-label={t("profileSetup.nicknameA11y")}
          value={value}
          maxLength={10}
          {...inputProps}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="setupp__nick-btn" onClick={onCheck} disabled={checkDisabled} aria-label={t(checkA11y)}>
          {checking ? <Spinner size={18} stroke={2} /> : t(checkLabel)}
        </button>
      </div>
      <p className={`setupp__nick-msg ${message ? (message.ok ? "is-ok" : "is-err") : ""}`} role="status" aria-live="polite">
        {message?.text ?? ""}
      </p>
    </>
  );
}
