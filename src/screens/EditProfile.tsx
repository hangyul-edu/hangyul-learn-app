import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Screen } from "../components/layout/Screen";
import { Button } from "../components/ui/kit";
import { Field, TextField } from "../components/ui/Field";
import { userApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { NATIONALITIES } from "../lib/format";
import type { ProfileImageType } from "../lib/types";

const AVATARS = [
  { key: "AVATAR_01", emoji: "🦊", bg: "#fde68a" },
  { key: "AVATAR_02", emoji: "🐨", bg: "#bfdbfe" },
  { key: "AVATAR_03", emoji: "🐣", bg: "#fecdd3" },
];

export function EditProfile() {
  const nav = useNavigate();
  const toast = useToast();
  const { me, setMe } = useAuth();

  const [nickname, setNickname] = useState(me?.nickname ?? "");
  const [checkToken, setCheckToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [imageType, setImageType] = useState<ProfileImageType>(me?.profile_image_type ?? "AVATAR");
  const [avatarKey, setAvatarKey] = useState(me?.avatar_key ?? "AVATAR_01");
  const [nationality, setNationality] = useState(me?.nationality ?? "KR");
  const [busy, setBusy] = useState(false);

  const changed = nickname !== me?.nickname;

  async function check() {
    setChecking(true);
    try {
      const r = await userApi.checkNickname(nickname.trim());
      if (r.available && r.check_token) {
        setCheckToken(r.check_token);
        toast.success("사용 가능한 닉네임이에요");
      } else toast.error("이미 사용 중인 닉네임이에요");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setChecking(false);
    }
  }

  async function save() {
    if (changed && !checkToken) {
      toast.error("닉네임 중복확인을 해주세요");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        profile_image_type: imageType,
        avatar_key: imageType === "AVATAR" ? avatarKey : null,
        profile_image_url: imageType === "CUSTOM" ? me?.profile_image_url : null,
      };
      if (changed) {
        body.nickname = nickname.trim();
        body.nickname_check_token = checkToken;
      }
      let updated = await userApi.updateProfile(body);
      if (nationality !== me?.nationality) updated = await userApi.updateMe({ nationality });
      setMe(updated);
      toast.success("저장했어요");
      nav(-1);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="프로필 편집" back>
      <div className="stack" style={{ gap: 18 }}>
        <div className="center">
          <div className="avatar" style={{ width: 80, height: 80, margin: "0 auto", fontSize: 38, background: AVATARS.find((a) => a.key === avatarKey)?.bg }}>
            {imageType === "CUSTOM" && me?.profile_image_url ? <img src={me.profile_image_url} alt="" /> : AVATARS.find((a) => a.key === avatarKey)?.emoji ?? "🙂"}
          </div>
        </div>
        <div className="row" style={{ gap: 12, justifyContent: "center" }}>
          {AVATARS.map((a) => (
            <button key={a.key} className="avatar" style={{ width: 54, height: 54, fontSize: 26, background: a.bg, outline: imageType === "AVATAR" && avatarKey === a.key ? "3px solid var(--brand-500)" : "none", cursor: "pointer" }} onClick={() => { setImageType("AVATAR"); setAvatarKey(a.key); }}>
              {a.emoji}
            </button>
          ))}
        </div>

        <Field label="닉네임">
          <div style={{ display: "flex", gap: 8 }}>
            <TextField value={nickname} maxLength={20} onChange={(e) => { setNickname(e.target.value); setCheckToken(null); }} />
            {changed && (
              <Button variant="secondary" size="sm" style={{ height: 50, whiteSpace: "nowrap" }} loading={checking} onClick={check}>중복확인</Button>
            )}
          </div>
        </Field>

        <Field label="국적">
          <select className="input" value={nationality} onChange={(e) => setNationality(e.target.value)}>
            {NATIONALITIES.map((n) => (
              <option key={n.code} value={n.code}>{n.flag} {n.label}</option>
            ))}
          </select>
        </Field>

        <div className="card card--flat" style={{ background: "var(--surface-2)" }}>
          <div className="row row--between" style={{ fontSize: 13.5 }}><span className="muted">이름</span><span style={{ fontWeight: 700 }}>{me?.name}</span></div>
          <div className="divider" />
          <div className="row row--between" style={{ fontSize: 13.5 }}><span className="muted">이메일</span><span style={{ fontWeight: 700 }}>{me?.email}</span></div>
          <div className="field__hint" style={{ marginTop: 8 }}>이름과 이메일은 계정 관리에서 변경할 수 있어요.</div>
        </div>

        <Button size="lg" block loading={busy} onClick={save}>저장</Button>
      </div>
    </Screen>
  );
}
