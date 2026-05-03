"""Interview scoring service driven primarily by the LLM."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any

from schemas.report import (
    DimensionScore,
    ExpressionSummary,
    InterviewReport,
    LearningResource,
    QuestionReview,
    TrainingDay,
)
from services.llm_service import LLMServiceInstance

logger = logging.getLogger(__name__)

DIMENSIONS = [
    "technical_accuracy",
    "knowledge_depth",
    "logic_expression",
    "position_match",
    "project_experience",
    "language_fluency",
    "confidence",
]

DIMENSION_CN = {
    "technical_accuracy": "技术正确性",
    "knowledge_depth": "知识深度",
    "logic_expression": "逻辑表达",
    "position_match": "岗位匹配度",
    "project_experience": "项目经验",
    "language_fluency": "语言流畅度",
    "confidence": "自信度",
}

CN_TO_DIMENSION = {value: key for key, value in DIMENSION_CN.items()}

LEVEL_THRESHOLDS = {
    "优秀": 85,
    "良好": 70,
    "合格": 55,
    "待提升": 0,
}

DIMENSION_WEIGHTS = {
    "technical_accuracy": 0.25,
    "knowledge_depth": 0.15,
    "logic_expression": 0.15,
    "position_match": 0.15,
    "project_experience": 0.15,
    "language_fluency": 0.08,
    "confidence": 0.07,
}

POSITION_LABELS = {
    "java_backend": "Java后端",
    "web_frontend": "Web前端",
    "embedded": "嵌入式",
    "python_algorithm": "Python算法",
    "software_testing": "软件测试",
    "devops": "DevOps",
}

POSITION_RESOURCES: dict[str, dict[str, tuple[str, str, str]]] = {
    "java_backend": {
        "technical_accuracy": ("Java 并发与 JVM 高频题", "article", "强化 JVM、并发、事务和缓存一致性。"),
        "knowledge_depth": ("Spring Boot 与数据库实战", "course", "补齐框架原理、索引和高并发场景。"),
        "project_experience": ("后端项目复盘模板", "practice", "梳理项目背景、决策依据和业务结果。"),
    },
    "web_frontend": {
        "technical_accuracy": ("JavaScript / TypeScript 核心机制", "article", "加强异步、原型链和浏览器机制。"),
        "knowledge_depth": ("React 工程化专题", "course", "补齐状态管理、构建和性能优化。"),
        "project_experience": ("前端项目讲解模板", "practice", "突出复杂交互、性能优化和业务收益。"),
    },
    "embedded": {
        "technical_accuracy": ("嵌入式 C 与外设通信专项", "article", "巩固 C 语言、寄存器、中断和外设协议。"),
        "knowledge_depth": ("ARM / RTOS 学习路线", "course", "补齐启动流程、任务调度和驱动分层。"),
        "project_experience": ("STM32 项目拆解练习", "practice", "训练项目结构、调试过程和优化结果表达。"),
    },
    "python_algorithm": {
        "technical_accuracy": ("算法题刷题路线", "practice", "围绕高频题型建立稳定解题路径。"),
        "knowledge_depth": ("机器学习基础专题", "course", "补齐训练、评估和特征工程基础。"),
        "project_experience": ("算法项目答辩模板", "practice", "讲清数据流、模型选择和结果分析。"),
    },
    "software_testing": {
        "technical_accuracy": ("测试理论与用例设计", "article", "补齐边界值、等价类和场景测试。"),
        "knowledge_depth": ("自动化测试框架实践", "course", "训练接口自动化与持续集成。"),
        "project_experience": ("测试项目复盘清单", "practice", "突出质量收益、缺陷闭环和风险控制。"),
    },
    "devops": {
        "technical_accuracy": ("Linux / Docker / CI-CD 速查", "article", "围绕部署链路搭建完整基础。"),
        "knowledge_depth": ("Kubernetes 与云原生实战", "course", "补齐编排、服务治理和监控告警。"),
        "project_experience": ("运维项目表达模板", "practice", "强化稳定性、交付效率和故障处理案例。"),
    },
}

GENERAL_RESOURCES = {
    "logic_expression": ("STAR 回答法训练", "article", "解决回答发散、结构不清的问题。"),
    "language_fluency": ("口语表达练习", "practice", "针对停顿、重复和语速做专项训练。"),
    "confidence": ("模拟面试复盘清单", "practice", "通过复盘和重复练习降低紧张感。"),
}

POSITION_TASKS = {
    "java_backend": {
        "technical_accuracy": ["复习 JVM、并发、事务和缓存一致性。", "准备 5 个高频技术问题的标准答案。"],
        "knowledge_depth": ["梳理 Spring、MySQL、Redis 的核心原理。", "补充索引优化和高并发案例。"],
        "project_experience": ["重写一个项目的 STAR 版本。", "补充线上问题排查与优化结果。"],
    },
    "web_frontend": {
        "technical_accuracy": ["复习 JS 核心机制和浏览器渲染流程。", "准备性能优化和兼容性案例。"],
        "knowledge_depth": ["梳理 React/Vue 工程化方案。", "补充状态管理和组件设计案例。"],
        "project_experience": ["重写前端项目难点与收益表达。", "补充复杂交互和指标提升案例。"],
    },
    "embedded": {
        "technical_accuracy": ["复习 C 语言、寄存器、volatile 和中断机制。", "梳理 UART/I2C/SPI 高频问题。"],
        "knowledge_depth": ["梳理 ARM 启动流程和 RTOS 调度。", "补充驱动分层和硬件调试思路。"],
        "project_experience": ["复盘一个 STM32 或单片机项目。", "补充功耗、稳定性和排障过程。"],
    },
    "python_algorithm": {
        "technical_accuracy": ["补做 8 道高频算法题。", "总结常见数据结构与复杂度分析。"],
        "knowledge_depth": ["整理模型训练与评估流程。", "补充特征工程和误差分析案例。"],
        "project_experience": ["重写算法项目答辩稿。", "补充数据清洗和效果提升细节。"],
    },
    "software_testing": {
        "technical_accuracy": ["梳理用例设计方法和接口测试思路。", "准备自动化框架设计案例。"],
        "knowledge_depth": ["补齐质量度量、稳定性策略和 CI 集成。", "梳理缺陷分析与风险控制案例。"],
        "project_experience": ["复盘一个测试项目。", "补充质量收益和闭环结果。"],
    },
    "devops": {
        "technical_accuracy": ["复习 Linux、Docker、网络和发布流程。", "准备 CI/CD 和容器编排案例。"],
        "knowledge_depth": ["梳理 K8s 核心概念和监控告警链路。", "补充容量规划和故障演练案例。"],
        "project_experience": ["复盘一个运维或平台项目。", "补充稳定性和效率提升指标。"],
    },
}

GENERIC_TASKS = {
    "technical_accuracy": ["补做 10 道高频题并记录错误原因。"],
    "knowledge_depth": ["把相关知识点整理成一张思维导图。"],
    "logic_expression": ["每道题先列 3 个关键词，再口头作答。"],
    "position_match": ["对照目标岗位 JD，补齐缺失知识点。"],
    "project_experience": ["准备 1 分钟版和 3 分钟版项目讲解。"],
    "language_fluency": ["做 10 分钟录音练习，关注停顿和重复。"],
    "confidence": ["连续做两轮模拟问答，训练脱稿表达。"],
}

GREETING_SET = {"你好", "您好", "hi", "hello", "ok", "好的", "收到", "在吗"}

QUESTION_REVIEW_SYSTEM_PROMPT = """
你是资深技术面试评委。你需要根据岗位类型、面试阶段、面试官问题、候选人回答和表达分析结果，
判断候选人的技术正确性、知识深度、逻辑严谨性和岗位匹配度。

严格要求：
1. 必须基于回答内容本身判断，不能因为字数多就给高分。
2. 如果回答存在明显空泛、回避、概念混淆、缺少工程细节，要明确指出。
3. 只输出 JSON，不要输出任何额外解释。
4. 分数范围均为 0-100。

输出 JSON 结构：
{
  "score": 0,
  "technical_accuracy": 0,
  "knowledge_depth": 0,
  "logic_expression": 0,
  "position_match": 0,
  "project_experience": 0,
  "comment": "",
  "suggestions": "",
  "evidence": ["..."],
  "issues": ["..."]
}
"""

INTERVIEW_SUMMARY_SYSTEM_PROMPT = """
你是技术面试总评专家。请基于逐题评分结果和表达分析结果，输出整场面试总评。
总评必须强调技术正确性、知识深度和岗位匹配度，不能只按表达流畅度评分。
只输出 JSON。

输出 JSON 结构：
{
  "dimensions": {
    "technical_accuracy": {"score": 0, "comment": ""},
    "knowledge_depth": {"score": 0, "comment": ""},
    "logic_expression": {"score": 0, "comment": ""},
    "position_match": {"score": 0, "comment": ""},
    "project_experience": {"score": 0, "comment": ""},
    "language_fluency": {"score": 0, "comment": ""},
    "confidence": {"score": 0, "comment": ""}
  },
  "total_score": 0,
  "level": "",
  "overall_comment": "",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "suggestions": ["..."]
}
"""


@dataclass
class QuestionPair:
    question: str
    answer: str
    stage: str
    expression_metrics: dict[str, Any] | None


class ScoringService:
    async def score_interview(
        self,
        session_messages: list,
        position_type: str,
        session_id: int = 0,
        expression_data: dict[str, Any] | None = None,
    ) -> InterviewReport:
        candidate_messages = [message for message in session_messages if getattr(message, "role", "") == "candidate"]
        if not candidate_messages:
            return self._empty_report(session_id, position_type)
        if self._is_low_content_interview(candidate_messages):
            return self._low_content_report(session_id, position_type, candidate_messages)

        expression_summary = expression_data or self._aggregate_expression_data(candidate_messages)
        question_pairs = self._build_question_pairs(session_messages)
        question_reviews = await self._build_question_reviews(question_pairs, position_type, expression_summary)

        summary_payload = await self._build_summary_with_llm(
            position_type=position_type,
            question_reviews=question_reviews,
            expression_summary=expression_summary,
        )
        scores = self._scores_from_summary(summary_payload, question_reviews, expression_summary)

        total_score = self._safe_score(
            summary_payload.get("total_score"),
            sum(scores[key] * DIMENSION_WEIGHTS[key] for key in DIMENSIONS),
        )
        level = self._pick_level(summary_payload.get("level"), total_score)
        strengths, weaknesses = self._merge_strengths_weaknesses(summary_payload, scores)

        return InterviewReport(
            session_id=session_id,
            position_type=position_type,
            total_score=round(total_score, 1),
            level=level,
            dimensions=[
                DimensionScore(
                    dimension=DIMENSION_CN[key],
                    score=round(scores[key], 1),
                    weight=DIMENSION_WEIGHTS[key],
                    comment=self._dimension_comment(summary_payload, key, scores[key]),
                )
                for key in DIMENSIONS
            ],
            question_reviews=question_reviews,
            strengths=strengths,
            weaknesses=weaknesses,
            overall_comment=self._overall_comment(summary_payload, scores, total_score, position_type),
            suggestions=self._suggestions(summary_payload, scores),
            resources=self._generate_resources(scores, position_type),
            training_plan=self._generate_training_plan(scores, position_type),
            expression_summary=self._build_expression_summary(expression_summary),
        )

    async def _build_question_reviews(
        self,
        question_pairs: list[QuestionPair],
        position_type: str,
        expression_summary: dict[str, Any] | None,
    ) -> list[QuestionReview]:
        reviews: list[QuestionReview] = []
        for pair in question_pairs:
            payload = await self._review_question_with_llm(pair, position_type, expression_summary)
            reviews.append(
                QuestionReview(
                    question=pair.question[:200],
                    answer_summary=self._truncate(pair.answer, 220),
                    score=self._safe_score(payload.get("score"), self._fallback_question_score(pair.answer)),
                    comment=self._string(payload.get("comment")) or "回答覆盖了部分关键点，但仍有继续展开空间。",
                    suggestions=self._string(payload.get("suggestions")) or "补充原理、步骤、权衡和结果指标。",
                    technical_accuracy=self._safe_score(payload.get("technical_accuracy"), 65.0),
                    knowledge_depth=self._safe_score(payload.get("knowledge_depth"), 65.0),
                    logic_expression=self._safe_score(payload.get("logic_expression"), 65.0),
                    position_match=self._safe_score(payload.get("position_match"), 65.0),
                    evidence=self._string_list(payload.get("evidence"))[:4],
                    issues=self._string_list(payload.get("issues"))[:4],
                )
            )
        return reviews

    async def _review_question_with_llm(
        self,
        pair: QuestionPair,
        position_type: str,
        expression_summary: dict[str, Any] | None,
    ) -> dict[str, Any]:
        prompt = {
            "position_type": position_type,
            "position_label": POSITION_LABELS.get(position_type, position_type),
            "stage": pair.stage,
            "question": pair.question,
            "answer": pair.answer,
            "expression_metrics": pair.expression_metrics or {},
            "interview_expression_summary": expression_summary or {},
        }
        try:
            return await LLMServiceInstance.chat_json(
                messages=[{"role": "user", "content": json.dumps(prompt, ensure_ascii=False)}],
                system_prompt=QUESTION_REVIEW_SYSTEM_PROMPT,
                temperature=0.2,
                max_tokens=900,
            )
        except Exception as exc:
            logger.warning("Question review LLM call failed: %s", exc)
            return self._fallback_question_review(pair.answer)

    async def _build_summary_with_llm(
        self,
        position_type: str,
        question_reviews: list[QuestionReview],
        expression_summary: dict[str, Any] | None,
    ) -> dict[str, Any]:
        payload = {
            "position_type": position_type,
            "position_label": POSITION_LABELS.get(position_type, position_type),
            "question_reviews": [review.model_dump() for review in question_reviews],
            "expression_summary": expression_summary or {},
        }
        try:
            return await LLMServiceInstance.chat_json(
                messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
                system_prompt=INTERVIEW_SUMMARY_SYSTEM_PROMPT,
                temperature=0.2,
                max_tokens=1500,
            )
        except Exception as exc:
            logger.warning("Interview summary LLM call failed: %s", exc)
            return {}

    def _scores_from_summary(
        self,
        summary_payload: dict[str, Any],
        question_reviews: list[QuestionReview],
        expression_summary: dict[str, Any] | None,
    ) -> dict[str, float]:
        dimension_payload = summary_payload.get("dimensions")
        base = self._fallback_dimension_scores(question_reviews, expression_summary)
        if not isinstance(dimension_payload, dict):
            return base

        scores = dict(base)
        for key in DIMENSIONS:
            item = dimension_payload.get(key)
            if isinstance(item, dict):
                scores[key] = self._safe_score(item.get("score"), base[key])
        return scores

    def _fallback_dimension_scores(
        self,
        question_reviews: list[QuestionReview],
        expression_summary: dict[str, Any] | None,
    ) -> dict[str, float]:
        if not question_reviews:
            return {key: 60.0 for key in DIMENSIONS}
        avg_question = sum(item.score for item in question_reviews) / len(question_reviews)
        technical_accuracy = sum(item.technical_accuracy for item in question_reviews) / len(question_reviews)
        knowledge_depth = sum(item.knowledge_depth for item in question_reviews) / len(question_reviews)
        logic_expression = sum(item.logic_expression for item in question_reviews) / len(question_reviews)
        position_match = sum(item.position_match for item in question_reviews) / len(question_reviews)
        project_experience = min(100.0, (position_match * 0.4) + (knowledge_depth * 0.2) + (avg_question * 0.4))
        language_fluency = self._score_language_fluency(expression_summary)
        confidence = self._score_confidence(expression_summary)
        return {
            "technical_accuracy": round(technical_accuracy, 1),
            "knowledge_depth": round(knowledge_depth, 1),
            "logic_expression": round(logic_expression, 1),
            "position_match": round(position_match, 1),
            "project_experience": round(project_experience, 1),
            "language_fluency": round(language_fluency, 1),
            "confidence": round(confidence, 1),
        }

    def _dimension_comment(self, summary_payload: dict[str, Any], key: str, fallback_score: float) -> str:
        dimensions = summary_payload.get("dimensions")
        if isinstance(dimensions, dict):
            item = dimensions.get(key)
            if isinstance(item, dict) and self._string(item.get("comment")):
                return self._string(item.get("comment"))
        name = DIMENSION_CN[key]
        if fallback_score >= 85:
            return f"{name}表现优秀，回答成熟且有说服力。"
        if fallback_score >= 70:
            return f"{name}整体良好，但还可以补充更多工程细节。"
        if fallback_score >= 55:
            return f"{name}具备基础，但仍需针对性训练。"
        return f"{name}偏弱，建议优先补齐。"

    def _overall_comment(
        self,
        summary_payload: dict[str, Any],
        scores: dict[str, float],
        total_score: float,
        position_type: str,
    ) -> str:
        if self._string(summary_payload.get("overall_comment")):
            return self._string(summary_payload.get("overall_comment"))
        weak_keys = [DIMENSION_CN[key] for key, value in sorted(scores.items(), key=lambda item: item[1]) if value < 70]
        strong_keys = [DIMENSION_CN[key] for key, value in sorted(scores.items(), key=lambda item: item[1], reverse=True) if value >= 80]
        position_label = POSITION_LABELS.get(position_type, position_type)
        if total_score >= 85:
            return f"整体表现优秀，已经具备较强的 {position_label} 岗位面试竞争力。优势主要体现在：{'、'.join(strong_keys[:3]) or '回答稳定'}。"
        if total_score >= 70:
            return f"整体表现良好，已经具备岗位基础。当前最需要继续提升的维度是：{'、'.join(weak_keys[:3]) or '表达细节'}。"
        return f"当前面试表现还有明显提升空间，建议优先补强：{'、'.join(weak_keys[:3]) or '核心知识和表达能力'}。"

    def _suggestions(self, summary_payload: dict[str, Any], scores: dict[str, float]) -> list[str]:
        suggestions = self._string_list(summary_payload.get("suggestions"))
        if suggestions:
            return suggestions[:5]
        weak_keys = [key for key, value in sorted(scores.items(), key=lambda item: item[1]) if value < 70]
        if not weak_keys:
            return ["当前表现较稳定，建议继续进行岗位化模拟面试，保持答题节奏和项目表达质量。"]
        return [f"优先提升{DIMENSION_CN[key]}，围绕目标岗位做针对性训练。" for key in weak_keys[:3]]

    def _merge_strengths_weaknesses(
        self,
        summary_payload: dict[str, Any],
        scores: dict[str, float],
    ) -> tuple[list[str], list[str]]:
        strengths = self._string_list(summary_payload.get("strengths"))
        weaknesses = self._string_list(summary_payload.get("weaknesses"))
        if not strengths:
            strengths = [f"{DIMENSION_CN[key]}较强，当前得分 {value:.0f}。" for key, value in scores.items() if value >= 80]
        if not weaknesses:
            weaknesses = [f"{DIMENSION_CN[key]}偏弱，当前得分 {value:.0f}。" for key, value in scores.items() if value < 70]
        if not strengths:
            strengths = ["回答态度较稳定，具备继续提升的基础。"]
        if not weaknesses:
            weaknesses = ["当前没有明显短板，建议保持岗位化训练。"]
        return strengths[:5], weaknesses[:5]

    def _generate_resources(self, scores: dict[str, float], position_type: str) -> list[LearningResource]:
        resource_map = dict(POSITION_RESOURCES.get(position_type, POSITION_RESOURCES["web_frontend"]))
        resource_map.update(GENERAL_RESOURCES)
        resources: list[LearningResource] = []
        seen: set[str] = set()
        for key, value in sorted(scores.items(), key=lambda item: item[1]):
            if value >= 75 or key not in resource_map:
                continue
            title, resource_type, description = resource_map[key]
            if title in seen:
                continue
            seen.add(title)
            resources.append(LearningResource(title=title, type=resource_type, description=description, url=""))
        return resources

    def _generate_training_plan(self, scores: dict[str, float], position_type: str) -> list[TrainingDay]:
        sorted_dims = sorted(scores.items(), key=lambda item: item[1])
        if not sorted_dims:
            return []
        position_tasks = POSITION_TASKS.get(position_type, POSITION_TASKS["web_frontend"])
        plan: list[TrainingDay] = []
        for day_num in range(1, 8):
            focus_dim, focus_score = sorted_dims[(day_num - 1) % len(sorted_dims)]
            tasks = list(position_tasks.get(focus_dim, [])) + GENERIC_TASKS.get(focus_dim, [])
            limit = 1 if focus_score >= 75 else 2 if focus_score >= 60 else 3
            plan.append(
                TrainingDay(
                    day=day_num,
                    title=f"Day {day_num}: {DIMENSION_CN.get(focus_dim, focus_dim)}专项训练",
                    tasks=tasks[:limit],
                )
            )
        return plan

    def _aggregate_expression_data(self, candidate_messages: list) -> dict[str, Any] | None:
        parsed: list[dict[str, Any]] = []
        for message in candidate_messages:
            raw = getattr(message, "expression_metrics", None)
            if not raw:
                continue
            try:
                item = json.loads(raw) if isinstance(raw, str) else raw
            except json.JSONDecodeError:
                continue
            if isinstance(item, dict):
                parsed.append(item)
        if not parsed:
            return None

        def avg(key: str, default: float) -> float:
            values = [float(item.get(key, default)) for item in parsed if item.get(key) is not None]
            return sum(values) / len(values) if values else default

        confidence_labels = [self._string(item.get("confidence_label")) for item in parsed if self._string(item.get("confidence_label"))]
        emotion_labels = [self._string(item.get("emotion_label")) for item in parsed if self._string(item.get("emotion_label"))]
        comments = [self._string(item.get("comment")) for item in parsed if self._string(item.get("comment"))]
        sources = [self._string(item.get("analysis_source")) for item in parsed if self._string(item.get("analysis_source"))]
        return {
            "speech_rate": avg("speech_rate", 200.0),
            "pause_ratio": avg("pause_ratio", 0.15),
            "fluency_score": avg("fluency_score", 0.75),
            "confidence": avg("confidence", 0.75),
            "clarity_score": avg("clarity_score", 0.7),
            "emotion_stability": avg("emotion_stability", 0.75),
            "sample_count": len(parsed),
            "confidence_label": confidence_labels[-1] if confidence_labels else "",
            "emotion_label": emotion_labels[-1] if emotion_labels else "",
            "analysis_source": sources[-1] if sources else "",
            "comment": comments[-1] if comments else "",
        }

    def _build_expression_summary(self, expression_summary: dict[str, Any] | None) -> ExpressionSummary | None:
        if not expression_summary:
            return None
        return ExpressionSummary(
            speech_rate=round(float(expression_summary.get("speech_rate", 0.0)), 1),
            pause_ratio=round(float(expression_summary.get("pause_ratio", 0.0)), 3),
            fluency_score=round(float(expression_summary.get("fluency_score", 0.0)) * 100, 1),
            confidence=round(float(expression_summary.get("confidence", 0.0)) * 100, 1),
            sample_count=int(expression_summary.get("sample_count", 0)),
            clarity_score=round(float(expression_summary.get("clarity_score", 0.0)) * 100, 1),
            emotion_stability=round(float(expression_summary.get("emotion_stability", 0.0)) * 100, 1),
            confidence_label=self._string(expression_summary.get("confidence_label")),
            emotion_label=self._string(expression_summary.get("emotion_label")),
            analysis_source=self._string(expression_summary.get("analysis_source")),
            comment=self._string(expression_summary.get("comment")),
        )

    def _score_language_fluency(self, expression_summary: dict[str, Any] | None) -> float:
        if not expression_summary:
            return 75.0
        score = float(expression_summary.get("fluency_score", 0.75)) * 100
        speech_rate = float(expression_summary.get("speech_rate", 200))
        pause_ratio = float(expression_summary.get("pause_ratio", 0.15))
        clarity = float(expression_summary.get("clarity_score", 0.7)) * 100
        if speech_rate < 120 or speech_rate > 350:
            score -= 8
        if pause_ratio > 0.3:
            score -= 12
        score = (score * 0.7) + (clarity * 0.3)
        return self._safe_score(score, 75.0)

    def _score_confidence(self, expression_summary: dict[str, Any] | None) -> float:
        if not expression_summary:
            return 75.0
        confidence = float(expression_summary.get("confidence", 0.75)) * 100
        stability = float(expression_summary.get("emotion_stability", 0.75)) * 100
        return self._safe_score((confidence * 0.7) + (stability * 0.3), 75.0)

    def _build_question_pairs(self, messages: list) -> list[QuestionPair]:
        pairs: list[QuestionPair] = []
        items = list(messages)
        index = 0
        while index < len(items):
            current = items[index]
            if getattr(current, "role", "") != "interviewer":
                index += 1
                continue
            if index + 1 >= len(items) or getattr(items[index + 1], "role", "") != "candidate":
                index += 1
                continue
            answer_message = items[index + 1]
            question = self._normalize_text(getattr(current, "content", ""))
            answer = self._normalize_text(getattr(answer_message, "content", ""))
            if question and answer:
                pairs.append(
                    QuestionPair(
                        question=question,
                        answer=answer,
                        stage=getattr(answer_message, "stage", "") or getattr(current, "stage", ""),
                        expression_metrics=self._parse_expression_metrics(getattr(answer_message, "expression_metrics", None)),
                    )
                )
            index += 2
        return pairs

    def _parse_expression_metrics(self, raw: Any) -> dict[str, Any] | None:
        if not raw:
            return None
        if isinstance(raw, dict):
            return raw
        if isinstance(raw, str):
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                return None
            return payload if isinstance(payload, dict) else None
        return None

    def _fallback_question_review(self, answer: str) -> dict[str, Any]:
        score = self._fallback_question_score(answer)
        return {
            "score": score,
            "technical_accuracy": min(100.0, score),
            "knowledge_depth": max(40.0, score - 3),
            "logic_expression": min(100.0, score + 2),
            "position_match": max(40.0, score - 2),
            "project_experience": max(35.0, score - 4),
            "comment": "回答具备一定信息量，但缺少 LLM 深度评审时只能给出保守分数。",
            "suggestions": "补充原理、边界条件、个人职责和结果指标。",
            "evidence": [],
            "issues": [],
        }

    def _fallback_question_score(self, answer: str) -> float:
        text = self._normalize_text(answer)
        answer_len = len(text)
        keyword_hits = len(re.findall(r"[A-Za-z_]{2,}|[\u4e00-\u9fff]{2,}", text))
        score = 45 + min(answer_len, 220) * 0.12 + min(keyword_hits, 20) * 0.8
        if answer_len < 25:
            score -= 10
        return self._safe_score(score, 60.0)

    def _is_low_content_interview(self, candidate_messages: list) -> bool:
        texts = [self._normalize_text(getattr(msg, "content", "")) for msg in candidate_messages if getattr(msg, "content", "").strip()]
        if not texts:
            return True
        total_chars = sum(len(text) for text in texts)
        if len(texts) <= 1 and total_chars < 30:
            return True
        meaningful = [text for text in texts if len(text) >= 12 and not self._is_greeting(text)]
        return not meaningful or total_chars < 80

    def _low_content_report(self, session_id: int, position_type: str, candidate_messages: list) -> InterviewReport:
        total_chars = sum(len(self._normalize_text(msg.content)) for msg in candidate_messages if getattr(msg, "content", "").strip())
        base_score = 20.0 if total_chars < 20 else 35.0
        expression_summary = self._aggregate_expression_data(candidate_messages)
        return InterviewReport(
            session_id=session_id,
            position_type=position_type,
            total_score=base_score,
            level="待提升",
            dimensions=[
                DimensionScore(
                    dimension=DIMENSION_CN[key],
                    score=base_score,
                    weight=DIMENSION_WEIGHTS[key],
                    comment="回答内容过少，当前无法形成有效评估。",
                )
                for key in DIMENSIONS
            ],
            question_reviews=[],
            strengths=[],
            weaknesses=[
                "有效回答内容不足，无法准确评估岗位能力。",
                "建议至少完成自我介绍、基础问题和项目问题三个阶段。",
            ],
            overall_comment="本次面试有效内容不足，系统判定为低信息量练习。请继续完成更完整的模拟面试后再查看报告。",
            suggestions=[
                "先完成一轮完整模拟面试，再查看能力报告。",
                "回答时尽量补充技术原理、项目细节和个人贡献。",
            ],
            resources=[],
            training_plan=[],
            expression_summary=self._build_expression_summary(expression_summary),
        )

    def _empty_report(self, session_id: int, position_type: str) -> InterviewReport:
        return InterviewReport(
            session_id=session_id,
            position_type=position_type,
            total_score=0.0,
            level="待提升",
            dimensions=[],
            question_reviews=[],
            strengths=[],
            weaknesses=[],
            overall_comment="当前会话还没有候选人回答，无法生成报告。",
            suggestions=["请先完成一轮模拟面试。"],
            resources=[],
            training_plan=[],
            expression_summary=None,
        )

    def _pick_level(self, llm_level: Any, total_score: float) -> str:
        label = self._string(llm_level)
        if label in LEVEL_THRESHOLDS:
            return label
        for name, threshold in LEVEL_THRESHOLDS.items():
            if total_score >= threshold:
                return name
        return "待提升"

    def _safe_score(self, value: Any, default: float) -> float:
        try:
            number = float(value)
        except (TypeError, ValueError):
            number = float(default)
        return max(0.0, min(100.0, round(number, 1)))

    def _string(self, value: Any) -> str:
        return str(value).strip() if value is not None else ""

    def _string_list(self, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [self._string(item) for item in value if self._string(item)]

    def _normalize_text(self, text: str) -> str:
        return re.sub(r"\s+", " ", (text or "")).strip()

    def _is_greeting(self, text: str) -> bool:
        return re.sub(r"\s+", "", text.lower()) in GREETING_SET

    def _truncate(self, text: str, limit: int) -> str:
        content = self._normalize_text(text)
        return content if len(content) <= limit else f"{content[: limit - 1]}…"


ScoringServiceInstance = ScoringService()
