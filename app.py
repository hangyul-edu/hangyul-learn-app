from __future__ import annotations

import os

import httpx
import streamlit as st

API_BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")

GRAMMAR_OPTIONS = {
    "현재 공손 표현": "polite_present",
    "과거": "past",
    "미래": "future",
    "높임": "honorific",
    "이유/원인": "causal",
    "대조": "contrast",
}

SITUATIONS = ["daily_life", "travel", "restaurant"]
MODE_OPTIONS = {
    "새 추천": "fresh",
    "같은 상황의 비슷한 문장": "similar",
    "같은 상황의 다른 문법": "different_grammar",
    "더 어려운 문장": "harder",
    "더 쉬운 문장": "easier",
}

st.set_page_config(page_title="Korean Sentence Platform", page_icon="📘", layout="wide")
st.title("Korean Sentence Platform")
st.caption("상황, 문법, 수준 흐름을 바탕으로 한국어 문장을 추천합니다.")

with st.sidebar:
    st.header("학습 설정")
    user_id = st.text_input("사용자 ID", value="steven")
    situation = st.selectbox("상황", options=SITUATIONS)
    grammar_label = st.selectbox("문법 포인트", options=list(GRAMMAR_OPTIONS.keys()))


def get_profile(selected_user_id: str) -> dict:
    with httpx.Client(timeout=10.0) as client:
        response = client.get(f"{API_BASE_URL}/users/{selected_user_id}/profile")
        response.raise_for_status()
        return response.json()


def request_sentence(selected_user_id: str, selected_situation: str, grammar_focus: str, mode: str, previous_sentence: str | None = None) -> dict:
    payload = {
        "user_id": selected_user_id,
        "situation": selected_situation,
        "grammar_focus": grammar_focus,
        "mode": mode,
        "previous_sentence": previous_sentence,
    }
    with httpx.Client(timeout=10.0) as client:
        response = client.post(f"{API_BASE_URL}/recommendations", json=payload)
        response.raise_for_status()
        return response.json()


def submit_feedback(selected_user_id: str, was_helpful: bool, requested_direction: str | None) -> dict:
    payload = {
        "user_id": selected_user_id,
        "was_helpful": was_helpful,
        "requested_direction": requested_direction,
    }
    with httpx.Client(timeout=10.0) as client:
        response = client.post(f"{API_BASE_URL}/users/feedback", json=payload)
        response.raise_for_status()
        return response.json()


try:
    profile = get_profile(user_id)
    c1, c2, c3 = st.columns(3)
    c1.metric("현재 레벨", profile["level"])
    c2.metric("성공 횟수", profile["successful_answers"])
    c3.metric("실패 횟수", profile["unsuccessful_answers"])
except Exception as exc:
    st.error(f"프로필을 불러오지 못했습니다: {exc}")
    st.stop()

if "last_result" not in st.session_state:
    st.session_state.last_result = None

col_a, col_b = st.columns([1, 2])
with col_a:
    st.subheader("추천 요청")
    selected_mode_label = st.radio("추천 방식", options=list(MODE_OPTIONS.keys()))
    if st.button("문장 추천 받기", type="primary"):
        try:
            result = request_sentence(
                selected_user_id=user_id,
                selected_situation=situation,
                grammar_focus=GRAMMAR_OPTIONS[grammar_label],
                mode=MODE_OPTIONS[selected_mode_label],
                previous_sentence=st.session_state.last_result["sentence"] if st.session_state.last_result else None,
            )
            st.session_state.last_result = result
        except Exception as exc:
            st.error(f"추천 요청 실패: {exc}")

with col_b:
    st.subheader("추천 결과")
    if st.session_state.last_result:
        result = st.session_state.last_result
        st.markdown(f"### {result['sentence']}")
        st.write(result["translation"])
        st.info(result["explanation"])
        st.write(f"문법 포인트: `{result['grammar_focus']}`")
        st.write(f"추천 수준: `{result['target_level']}`")

        st.divider()
        st.subheader("이번 추천은 어땠나요?")
        fb1, fb2 = st.columns(2)
        with fb1:
            if st.button("도움이 됐어요"):
                feedback = submit_feedback(user_id, True, MODE_OPTIONS[selected_mode_label])
                st.success(f"{feedback['previous_level']} → {feedback['new_level']}")
                st.caption(feedback["reason"])
        with fb2:
            if st.button("너무 어려웠어요"):
                feedback = submit_feedback(user_id, False, "easier")
                st.warning(f"{feedback['previous_level']} → {feedback['new_level']}")
                st.caption(feedback["reason"])

        st.divider()
        st.subheader("빠른 다음 추천")
        q1, q2, q3, q4 = st.columns(4)
        for col, label in zip(
            [q1, q2, q3, q4],
            ["같은 상황의 비슷한 문장", "같은 상황의 다른 문법", "더 어려운 문장", "더 쉬운 문장"],
        ):
            with col:
                if st.button(label):
                    mode = MODE_OPTIONS[label]
                    result = request_sentence(
                        selected_user_id=user_id,
                        selected_situation=situation,
                        grammar_focus=GRAMMAR_OPTIONS[grammar_label],
                        mode=mode,
                        previous_sentence=st.session_state.last_result["sentence"],
                    )
                    st.session_state.last_result = result
                    st.rerun()
    else:
        st.write("왼쪽에서 조건을 선택하고 문장을 추천받아 보세요.")
