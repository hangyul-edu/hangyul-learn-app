import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Screen } from "../components/layout/Screen";
import { Button } from "../components/ui/kit";
import { Field, TextField } from "../components/ui/Field";
import { userApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { ProfileImageType } from "../lib/types";

const AVATARS = [
  { key: "AVATAR_01", emoji: "🦊", bg: "#fde68a" },
  { key: "AVATAR_02", emoji: "🐨", bg: "#bfdbfe" },
  { key: "AVATAR_03", emoji: "🐣", bg: "#fecdd3" },
];

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
  const [avatarKey, setAvatarKey] = useState("AVATAR_01");
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function checkNick() {
    if (nickname.trim().length < 2) {
      setCheckMsg({ ok: false, text: "2자 이상 입력해 주세요." });
      return;
    }
    setChecking(true);
    setCheckToken(null);
    try {
      const res = await userApi.checkNickname(nickname.trim());
      if (res.available && res.check_token) {
        setCheckToken(res.check_token);
        setCheckMsg({ ok: true, text: "사용할 수 있는 닉네임이에요!" });
      } else {
        setCheckMsg({ ok: false, text: "이미 사용 중인 닉네임이에요." });
      }
    } catch (e) {
      setCheckMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setChecking(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
    if (!checkToken) {
      toast.error("닉네임 중복확인을 먼저 해주세요.");
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

  return (
    <Screen title="프로필 설정" topBar>
      <div className="stack" style={{ gap: 20 }}>
        <div className="center">
          <div
            className="avatar"
            style={{
              width: 96,
              height: 96,
              margin: "8px auto",
              fontSize: 46,
              background: imageType === "CUSTOM" ? "#eee" : AVATARS.find((a) => a.key === avatarKey)?.bg,
            }}
          >
            {imageType === "CUSTOM" && customUrl ? (
              <img src={customUrl} alt="" />
            ) : imageType === "AVATAR" ? (
              AVATARS.find((a) => a.key === avatarKey)?.emoji
            ) : (
              "🙂"
            )}
          </div>
          <h2 style={{ fontSize: 21 }}>어떻게 불러드릴까요?</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>친구들에게 보여질 닉네임이에요</p>
        </div>

        <Field label="닉네임" error={checkMsg && !checkMsg.ok ? checkMsg.text : null} hint={checkMsg?.ok ? checkMsg.text : "2~20자"}>
          <div style={{ display: "flex", gap: 8 }}>
            <TextField
              placeholder="닉네임"
              value={nickname}
              maxLength={20}
              onChange={(e) => {
                setNickname(e.target.value);
                setCheckToken(null);
                setCheckMsg(null);
              }}
            />
            <Button variant="secondary" size="sm" style={{ height: 50, whiteSpace: "nowrap" }} loading={checking} onClick={checkNick}>
              중복확인
            </Button>
          </div>
        </Field>

        <div>
          <div className="field__label" style={{ marginBottom: 10 }}>프로필 이미지</div>
          <div className="row" style={{ gap: 12 }}>
            {AVATARS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => {
                  setImageType("AVATAR");
                  setAvatarKey(a.key);
                }}
                className="avatar"
                style={{
                  width: 60,
                  height: 60,
                  fontSize: 30,
                  background: a.bg,
                  outline: imageType === "AVATAR" && avatarKey === a.key ? "3px solid var(--brand-500)" : "none",
                  cursor: "pointer",
                }}
              >
                {a.emoji}
              </button>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="avatar"
              style={{ width: 60, height: 60, fontSize: 22, background: "var(--surface-3)", color: "var(--ink-2)", outline: imageType === "CUSTOM" ? "3px solid var(--brand-500)" : "none" }}
            >
              {uploading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : "＋"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          </div>
        </div>

        <Button size="lg" block loading={busy} onClick={submit}>
          다음
        </Button>
      </div>
    </Screen>
  );
}
