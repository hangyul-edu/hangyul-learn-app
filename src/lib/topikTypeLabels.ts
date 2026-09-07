/**
 * Display labels for the TOPIK question-type picker, per language.
 *
 * Transcribed verbatim from the six dropdown frames:
 *   EN  읽기 1916:25797   듣기 1718:36261   쓰기 1718:36262
 *   KO  읽기 1916:25746   듣기 1718:36264   쓰기 1718:36265
 *
 * These are NOT the API's `title_en` / `title_ko`. Those are *descriptions*: the
 * English one is consumed by the question generator (`topik_generator.py` passes
 * it as `question_type_title` in the LLM prompt), where the long form is
 * deliberate — "Choose the statement that matches the passage" steers generation
 * far better than "Choose the matching content". Figma's are short *UI labels*.
 * Rendering the descriptions in the picker is what made the copy diverge from
 * the design in both languages, so the two are kept apart rather than one being
 * bent to serve both.
 *
 * The whole bracketed label is stored, not just the title, because the prefix is
 * not uniform — in either language, and not even in the same shape:
 *   EN reading/listening `[Type 01]`      EN writing `[Q 51,52]`
 *   KO reading/listening `[유형01]`        KO writing `[51번, 52번 유형]`
 * Korean writing puts 유형 *after* the number and spells each one out, so no
 * single template spans all six frames. A full string also diffs against the
 * frame character for character.
 *
 * Apostrophes are U+0027, matching the rest of the catalog (26 straight, 0
 * curly) and Figma's own export, which escaped exactly these strings.
 *
 * Keyed by the API's `code`. A code missing here falls back to the generic
 * template, so a question type added server-side still renders.
 */
export const TOPIK_TYPE_LABEL_EN: Readonly<Record<string, string>> = {
  // --- 읽기 / Reading — 1916:25797 ---
  reading_01: "[Type 01] Choose the correct grammar",
  reading_02: "[Type 02] Choose the similar meaning",
  reading_03: "[Type 03] Choose the topic",
  reading_04: "[Type 04] Choose the matching content",
  reading_05: "[Type 05] Choose the correct order",
  reading_06: "[Type 06] Choose the correct word",
  reading_07: "[Type 07] Choose the headline's meaning",
  reading_08: "[Type 08] Choose the main content",
  reading_09: "[Type 09] Choose where it fits",
  reading_10: "[Type 10] Choose the character's feeling",
  reading_11: "[Type 11] Choose the writer's attitude",
  reading_12: "[Type 12] Choose the writer's intent",

  // --- 듣기 / Listening — 1718:36261 ---
  listening_01: "[Type 01] Choose the matching picture/chart",
  listening_02: "[Type 02] Choose what comes next",
  listening_03: "[Type 03] Choose the next action",
  listening_04: "[Type 04] Choose the matching content",
  listening_05: "[Type 05] Choose the topic",
  listening_06: "[Type 06] Choose the main idea",
  listening_07: "[Type 07] Choose the situation",
  listening_08: "[Type 08] Choose what comes before/after",
  listening_09: "[Type 09] Choose the speaker's attitude",
  listening_10: "[Type 10] Choose the speaker's intent",
  listening_11: "[Type 11] Choose the participants",

  // --- 쓰기 / Writing — 1718:36262 ---
  writing_51_52: "[Q 51,52] Fill in the blanks",
  writing_53: "[Q 53] Write a data description",
  writing_54: "[Q 54] Write an essay on a topic",
};

export const TOPIK_TYPE_LABEL_KO: Readonly<Record<string, string>> = {
  // --- 읽기 — 1916:25746 ---
  reading_01: "[유형01] 빈칸에 알맞은 문법 고르기",
  reading_02: "[유형02] 의미가 비슷한 말 고르기",
  reading_03: "[유형03] 화제 고르기",
  reading_04: "[유형04] 일치하는 내용 고르기",
  reading_05: "[유형05] 알맞은 순서로 배열한 것 고르기",
  reading_06: "[유형06] 빈칸에 알맞은 말 고르기",
  reading_07: "[유형07] 신문 기사 제목의 의미 고르기",
  reading_08: "[유형08] 중심 내용 고르기",
  reading_09: "[유형09] 문장이 들어갈 위치 고르기",
  reading_10: "[유형10] 인물의 심정 고르기",
  reading_11: "[유형11] 필자의 태도 고르기",
  reading_12: "[유형12] 필자의 의도나 목적 고르기",

  // --- 듣기 — 1718:36264 ---
  listening_01: "[유형01] 일치하는 그림/도표 고르기",
  listening_02: "[유형02] 이어질 말 고르기",
  listening_03: "[유형03] 이어질 행동 고르기",
  listening_04: "[유형04] 일치하는 내용 고르기",
  listening_05: "[유형05] 화제 고르기",
  listening_06: "[유형06] 중심 생각이나 중심 내용 고르기",
  listening_07: "[유형07] 담화 상황 고르기",
  listening_08: "[유형08] 담화 전후의 내용 고르기",
  listening_09: "[유형09] 화자의 태도나 말하는 방식 고르기",
  listening_10: "[유형10] 화자의 의도나 목적 고르기",
  listening_11: "[유형11] 담화 참여자 고르기",

  // --- 쓰기 — 1718:36265 ---
  writing_51_52: "[51번, 52번 유형] 빈칸에 알맞은 말 쓰기",
  writing_53: "[53번 유형] 자료를 설명하는 글 쓰기",
  writing_54: "[54번 유형] 주제에 대해 글 쓰기",
};
