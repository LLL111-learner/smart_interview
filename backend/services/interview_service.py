"""Interview flow service."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field

from services.llm_service import LLMServiceInstance
from services.rag_service import RAGServiceInstance
from utils.prompt_templates import (
    ANALYZE_ANSWER_PROMPT,
    FOLLOW_UP_PROMPT,
    INTERVIEWER_SYSTEM_PROMPT,
    STAGE_PROMPTS,
    get_interview_type_prompt,
    get_position_label,
    get_position_prompt,
)

logger = logging.getLogger(__name__)

INTERVIEW_TYPE_STAGE_SEQUENCES = {
    "comprehensive": ["intro", "basic", "project", "scenario", "reverse_question", "summary"],
    "technical": ["intro", "basic", "scenario", "reverse_question", "summary"],
    "project": ["intro", "project", "basic", "scenario", "reverse_question", "summary"],
    "pressure": ["intro", "basic", "project", "scenario", "reverse_question", "summary"],
}

INTERVIEW_TYPE_STAGE_MIN_QUESTIONS = {
    "comprehensive": {"intro": 1, "basic": 2, "project": 2, "scenario": 1, "reverse_question": 1, "summary": 1},
    "technical": {"intro": 1, "basic": 3, "scenario": 2, "reverse_question": 1, "summary": 1},
    "project": {"intro": 1, "project": 3, "basic": 1, "scenario": 1, "reverse_question": 1, "summary": 1},
    "pressure": {"intro": 1, "basic": 3, "project": 2, "scenario": 2, "reverse_question": 1, "summary": 1},
}

INTERVIEW_TYPE_STAGE_HINTS = {
    "comprehensive": {
        "intro": "先了解背景，再自然过渡到岗位相关经历。",
        "basic": "优先围绕基础知识、原理理解和实际经验深挖。",
        "project": "重点深挖项目职责边界、方案取舍、难点处理和结果指标。",
        "scenario": "关注分析过程、排查路径、风险意识和技术取舍。",
        "reverse_question": "观察候选人对岗位、团队和业务的理解深度。",
        "summary": "简洁收尾，保持专业感。",
    },
    "technical": {
        "intro": "快速完成开场，把时间留给技术能力评估。",
        "basic": "多问原理、边界条件、实现细节和性能取舍。",
        "project": "项目追问尽量回到技术方案和关键设计。",
        "scenario": "围绕真实技术场景持续追问分析过程。",
        "reverse_question": "引导候选人关注技术团队和工程实践。",
        "summary": "简洁总结技术表现。",
    },
    "project": {
        "intro": "尽快把话题引到候选人最有代表性的项目。",
        "basic": "基础问题围绕项目里真正用到的知识展开。",
        "project": "优先深挖项目背景、职责、方案、难点、收益和复盘。",
        "scenario": "围绕项目里出现过或可能出现的问题展开。",
        "reverse_question": "引导候选人从项目和业务视角提问。",
        "summary": "总结项目表达、ownership 和复盘能力。",
    },
    "pressure": {
        "intro": "快速建立节奏，问题可以更直接。",
        "basic": "遇到模糊回答时及时要求具体化。",
        "project": "对职责不清、成果不明的内容连续追问。",
        "scenario": "重点观察候选人在压力下的分析和表达稳定性。",
        "reverse_question": "保持严谨但不过度攻击性。",
        "summary": "简洁收尾，不做安抚式评价。",
    },
}

INTERVIEW_TYPE_FOLLOW_UP_RULES = {
    "comprehensive": {"short_answer_threshold": 50, "force_follow_up_stages": {"basic", "project", "scenario"}},
    "technical": {"short_answer_threshold": 70, "force_follow_up_stages": {"basic", "scenario"}},
    "project": {"short_answer_threshold": 60, "force_follow_up_stages": {"project", "scenario"}},
    "pressure": {"short_answer_threshold": 90, "force_follow_up_stages": {"basic", "project", "scenario"}},
}

LLM_ANALYSIS_ENABLED_STAGES = {"basic", "project", "scenario"}
RAG_ENABLED_STAGES = {"basic", "project", "scenario"}
RAG_TOP_K_BY_STAGE = {"basic": 1, "project": 2, "scenario": 1}

GREETING_SET = {"你好", "您好", "hi", "hello", "好的", "ok", "可以", "在的"}

POSITION_KEYWORD_HINTS = {
    "java_backend": ["spring", "springboot", "mysql", "redis", "jvm", "事务", "索引", "缓存", "并发", "mq"],
    "web_frontend": ["react", "vue", "typescript", "javascript", "性能", "打包", "首屏", "hooks", "状态管理", "工程化"],
    "embedded": ["c", "c++", "rtos", "串口", "i2c", "spi", "中断", "驱动", "arm", "调试"],
    "python_algorithm": ["python", "算法", "复杂度", "特征", "模型", "训练", "召回", "精度", "数据清洗", "优化"],
    "software_testing": ["测试用例", "自动化", "接口测试", "回归", "缺陷", "覆盖率", "性能测试", "质量", "mock", "pytest"],
    "devops": ["linux", "docker", "k8s", "kubernetes", "ci/cd", "发布", "监控", "日志", "告警", "回滚"],
}


@dataclass
class FollowUpAnalysis:
    keywords: list[str] = field(default_factory=list)
    signals: list[str] = field(default_factory=list)
    missing_points: list[str] = field(default_factory=list)
    follow_up_worthy: bool = False
    follow_up_direction: str = ""
    confidence: float = 0.0
    reason: str = ""
    source: str = "rule"


@dataclass
class ReplyPlan:
    chat_history: list[dict[str, str]]
    system_prompt: str
    is_valid_answer: bool


class InterviewService:
    async def start_interview(self, session) -> str:
        system_prompt = self._build_system_prompt(session)
        opening_instruction = self._build_stage_instruction("intro", session)
        try:
            return await LLMServiceInstance.chat(
                messages=[{"role": "user", "content": opening_instruction}],
                system_prompt=system_prompt,
            )
        except Exception as exc:
            logger.error("Generate opening failed: %s", exc)
            return "你好，我们开始模拟面试。请先做一个简短的自我介绍，并说明你的目标岗位和相关项目经历。"

    async def process_answer(self, session, user_answer: str) -> str:
        plan = await self.prepare_reply(session, user_answer)
        try:
            reply = await LLMServiceInstance.chat(messages=plan.chat_history, system_prompt=plan.system_prompt)
            if plan.is_valid_answer:
                session.current_question_index += 1
            return reply
        except Exception as exc:
            logger.error("Generate reply failed: %s", exc)
            if not plan.is_valid_answer:
                return "你的回答还不够具体。请结合当前问题补充更多细节，比如职责、方案、过程和结果。"
            return "我想继续围绕你刚才提到的内容追问，不过当前生成追问时出现了问题。请再具体展开一下。"

    async def prepare_reply(self, session, user_answer: str) -> ReplyPlan:
        current_stage = session.current_stage
        is_valid_answer = self.is_meaningful_answer(user_answer, current_stage)
        chat_history = self._build_chat_history(session.messages)
        system_prompt = self._build_system_prompt(session)

        if not is_valid_answer:
            instruction = self._build_retry_instruction(current_stage, session)
        else:
            analysis = await self._analyze_answer(user_answer, session)
            should_follow_up = self._should_follow_up(user_answer, session, analysis)
            should_advance = self.should_advance_stage(session)

            if should_follow_up and not should_advance:
                instruction = self._build_follow_up_instruction(current_stage, session, user_answer, analysis)
            elif should_advance:
                next_stage = self._get_next_stage(current_stage, session)
                if next_stage:
                    session.current_stage = next_stage
                    instruction = self._build_stage_instruction(next_stage, session)
                else:
                    instruction = self._build_stage_instruction("summary", session)
            else:
                instruction = self._build_stage_instruction(current_stage, session)

        rag_context = await self._build_rag_context(session, user_answer, is_valid_answer)
        chat_history.append({"role": "user", "content": user_answer})
        chat_history.append({"role": "system", "content": instruction + rag_context})
        return ReplyPlan(chat_history=chat_history, system_prompt=system_prompt, is_valid_answer=is_valid_answer)

    def is_meaningful_answer(self, answer: str, stage: str = "") -> bool:
        text = self._normalize_text(answer)
        if not text or self._is_greeting(text):
            return False

        # Opening answers are often concise but still meaningful.
        # Use a lower threshold so short self-intros or direct factual answers
        # are not rejected too aggressively.
        min_chars = 10 if stage == "intro" else 8
        return len(text) >= min_chars

    async def _analyze_answer(self, user_answer: str, session) -> FollowUpAnalysis:
        rule_result = self._analyze_answer_with_rules(user_answer, session)
        if not self._should_use_llm_analysis(user_answer, session, rule_result):
            return rule_result

        llm_result = await self._analyze_answer_with_llm(user_answer, session)
        if llm_result and (llm_result.follow_up_worthy or llm_result.keywords or llm_result.missing_points):
            return self._merge_analysis(rule_result, llm_result)
        return rule_result

    def _should_use_llm_analysis(self, user_answer: str, session, rule_result: FollowUpAnalysis) -> bool:
        stage = session.current_stage
        answer_len = len(self._normalize_text(user_answer))
        if stage not in LLM_ANALYSIS_ENABLED_STAGES:
            return False
        if answer_len < 35:
            return False
        return bool(rule_result.keywords or rule_result.missing_points or rule_result.signals)

    async def _analyze_answer_with_llm(self, user_answer: str, session) -> FollowUpAnalysis | None:
        prompt = ANALYZE_ANSWER_PROMPT.format(
            position_type=get_position_label(session.position_type),
            interview_type=self._get_interview_type(session),
            stage=session.current_stage,
            user_answer=user_answer,
        )
        try:
            data = await LLMServiceInstance.chat_json(
                messages=[{"role": "user", "content": prompt}],
                system_prompt="你是面试追问分析器，只输出合法 JSON。",
                temperature=0.2,
                max_tokens=350,
            )
            return FollowUpAnalysis(
                keywords=self._clean_string_list(data.get("keywords")),
                signals=self._clean_string_list(data.get("signals")),
                missing_points=self._clean_string_list(data.get("missing_points")),
                follow_up_worthy=bool(data.get("follow_up_worthy")),
                follow_up_direction=self._clean_string(data.get("follow_up_direction")),
                confidence=self._safe_confidence(data.get("confidence")),
                reason=self._clean_string(data.get("reason")),
                source="llm",
            )
        except Exception as exc:
            logger.warning("LLM answer analysis failed: %s", exc)
            return None

    def _analyze_answer_with_rules(self, user_answer: str, session) -> FollowUpAnalysis:
        text = self._normalize_text(user_answer)
        lowered = text.lower()

        matched_keywords = [keyword for keyword in POSITION_KEYWORD_HINTS.get(session.position_type, []) if keyword.lower() in lowered]

        generic_signals = []
        for signal in ["负责", "优化", "设计", "排查", "上线", "性能", "并发", "稳定性", "提升", "压测"]:
            if signal in text:
                generic_signals.append(signal)

        missing_points = []
        if any(token in text for token in ["负责", "做了", "参与了"]) and not any(
            token in text for token in ["结果", "%", "提升", "降低", "ms", "qps"]
        ):
            missing_points.append("缺少结果指标或效果说明")
        if any(token in text for token in ["优化", "解决", "排查"]) and not any(
            token in text for token in ["原因", "方案", "步骤", "怎么做"]
        ):
            missing_points.append("缺少具体处理过程")
        if session.current_stage == "project" and not any(token in text for token in ["我负责", "我的职责", "我做", "我主导"]):
            missing_points.append("缺少个人职责边界")

        follow_up_direction = ""
        if missing_points:
            follow_up_direction = missing_points[0]
        elif matched_keywords:
            follow_up_direction = f"围绕 {matched_keywords[0]} 继续深挖原理或实战细节"
        elif generic_signals:
            follow_up_direction = f"围绕 {generic_signals[0]} 继续深挖具体做法"

        confidence = 0.2
        if matched_keywords:
            confidence += 0.35
        if generic_signals:
            confidence += 0.2
        if missing_points:
            confidence += 0.2

        return FollowUpAnalysis(
            keywords=matched_keywords[:5],
            signals=generic_signals[:5],
            missing_points=missing_points[:3],
            follow_up_worthy=bool(matched_keywords or generic_signals or missing_points),
            follow_up_direction=follow_up_direction,
            confidence=min(confidence, 0.9),
            reason="基于岗位关键词和回答缺失点的规则分析",
            source="rule",
        )

    def _merge_analysis(self, rule_result: FollowUpAnalysis, llm_result: FollowUpAnalysis) -> FollowUpAnalysis:
        keywords = self._dedupe(rule_result.keywords + llm_result.keywords)[:5]
        signals = self._dedupe(rule_result.signals + llm_result.signals)[:5]
        missing_points = self._dedupe(rule_result.missing_points + llm_result.missing_points)[:3]
        return FollowUpAnalysis(
            keywords=keywords,
            signals=signals,
            missing_points=missing_points,
            follow_up_worthy=llm_result.follow_up_worthy or rule_result.follow_up_worthy,
            follow_up_direction=llm_result.follow_up_direction or rule_result.follow_up_direction,
            confidence=max(rule_result.confidence, llm_result.confidence),
            reason=llm_result.reason or rule_result.reason,
            source="hybrid",
        )

    def _should_follow_up(self, answer: str, session, analysis: FollowUpAnalysis) -> bool:
        interview_type = self._get_interview_type(session)
        rules = INTERVIEW_TYPE_FOLLOW_UP_RULES[interview_type]
        current_stage = session.current_stage
        answer_len = len(self._normalize_text(answer))

        if analysis.follow_up_worthy and analysis.confidence >= 0.45:
            return True
        if analysis.missing_points and current_stage in rules["force_follow_up_stages"]:
            return True
        if analysis.keywords and current_stage in rules["force_follow_up_stages"]:
            return True
        return answer_len < rules["short_answer_threshold"]

    def should_advance_stage(self, session) -> bool:
        current_stage = session.current_stage
        interview_type = self._get_interview_type(session)
        min_questions = INTERVIEW_TYPE_STAGE_MIN_QUESTIONS[interview_type].get(current_stage, 2)
        valid_answers = [
            msg
            for msg in (session.messages or [])
            if msg.role == "candidate" and msg.stage == current_stage and self.is_meaningful_answer(msg.content, current_stage)
        ]
        return len(valid_answers) >= min_questions

    async def _build_rag_context(self, session, user_answer: str, is_valid_answer: bool) -> str:
        if not is_valid_answer:
            return ""
        stage = session.current_stage
        if stage not in RAG_ENABLED_STAGES:
            return ""
        normalized_answer = self._normalize_text(user_answer)
        if len(normalized_answer) < 28:
            return ""
        rule_analysis = self._analyze_answer_with_rules(user_answer, session)
        if not rule_analysis.keywords:
            return ""
        top_k = RAG_TOP_K_BY_STAGE.get(stage, 1)
        try:
            relevant_docs = await RAGServiceInstance.search(query=user_answer, position_type=session.position_type, top_k=top_k)
            if relevant_docs:
                return "\n\n补充参考知识:\n" + "\n---\n".join(relevant_docs)
        except Exception as exc:
            logger.warning("RAG search failed: %s", exc)
        return ""

    def _build_retry_instruction(self, stage: str, session) -> str:
        stage_label = {
            "intro": "自我介绍",
            "basic": "技术基础",
            "project": "项目经历",
            "scenario": "场景分析",
            "reverse_question": "反问环节",
        }.get(stage, "当前问题")
        mode_hint = self._get_stage_hint(stage, session)
        return (
            f"候选人的回答还不够具体，请继续围绕“{stage_label}”要求其补充。"
            f"优先要求他说清楚职责、方案、过程和结果。{mode_hint}"
        )

    def _build_follow_up_instruction(self, stage: str, session, user_answer: str, analysis: FollowUpAnalysis) -> str:
        stage_instruction = self._build_stage_instruction(stage, session)
        mode_hint = self._get_stage_hint(stage, session)
        analysis_summary = self._format_analysis_summary(analysis)
        return (
            f"{stage_instruction}\n"
            f"{mode_hint}\n"
            f"{analysis_summary}\n"
            f"{FOLLOW_UP_PROMPT.format(user_answer=user_answer, stage=stage)}"
        )

    def _build_stage_instruction(self, stage: str, session) -> str:
        base_prompt = STAGE_PROMPTS.get(stage, "")
        return f"{base_prompt}\n{self._get_stage_hint(stage, session)}"

    def _get_stage_hint(self, stage: str, session) -> str:
        return INTERVIEW_TYPE_STAGE_HINTS[self._get_interview_type(session)].get(stage, "")

    def _get_next_stage(self, current_stage: str, session) -> str | None:
        sequence = INTERVIEW_TYPE_STAGE_SEQUENCES[self._get_interview_type(session)]
        try:
            index = sequence.index(current_stage)
            if index < len(sequence) - 1:
                return sequence[index + 1]
        except ValueError:
            return None
        return None

    def _build_chat_history(self, messages) -> list[dict[str, str]]:
        history = []
        for msg in messages or []:
            history.append({"role": "assistant" if msg.role == "interviewer" else "user", "content": msg.content})
        return history

    def _build_system_prompt(self, session) -> str:
        interview_type = self._get_interview_type(session)
        return INTERVIEWER_SYSTEM_PROMPT.format(
            position_type=get_position_label(session.position_type),
            difficulty=session.difficulty,
            interview_type=interview_type,
            position_prompt=get_position_prompt(session.position_type),
            interview_type_prompt=get_interview_type_prompt(interview_type),
        )

    def _get_interview_type(self, session) -> str:
        interview_type = getattr(session, "interview_type", "comprehensive") or "comprehensive"
        return interview_type if interview_type in INTERVIEW_TYPE_STAGE_SEQUENCES else "comprehensive"

    def _normalize_text(self, text: str) -> str:
        return re.sub(r"\s+", " ", (text or "")).strip()

    def _is_greeting(self, text: str) -> bool:
        return re.sub(r"\s+", "", text.lower()) in GREETING_SET

    def _clean_string_list(self, value) -> list[str]:
        if not isinstance(value, list):
            return []
        cleaned = []
        for item in value:
            text = self._clean_string(item)
            if text:
                cleaned.append(text)
        return cleaned[:5]

    def _clean_string(self, value) -> str:
        if value is None:
            return ""
        return str(value).strip()

    def _safe_confidence(self, value) -> float:
        try:
            confidence = float(value)
        except (TypeError, ValueError):
            return 0.0
        return max(0.0, min(1.0, confidence))

    def _format_analysis_summary(self, analysis: FollowUpAnalysis) -> str:
        lines = [f"追问分析来源: {analysis.source}"]
        if analysis.keywords:
            lines.append("关键词: " + "、".join(analysis.keywords))
        if analysis.signals:
            lines.append("有效信号: " + "、".join(analysis.signals))
        if analysis.missing_points:
            lines.append("待补充点: " + "；".join(analysis.missing_points))
        if analysis.follow_up_direction:
            lines.append("建议追问方向: " + analysis.follow_up_direction)
        return "\n".join(lines)

    def _dedupe(self, values: list[str]) -> list[str]:
        seen = set()
        result = []
        for value in values:
            if value and value not in seen:
                seen.add(value)
                result.append(value)
        return result


InterviewServiceInstance = InterviewService()
