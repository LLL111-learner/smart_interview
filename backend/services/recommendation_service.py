"""Learning recommendation service."""

from __future__ import annotations

from services.scoring_service import DIMENSION_CN

RESOURCE_DATABASE = {
    "java_backend": {
        "technical_accuracy": [{"title": "Java 并发与 JVM 高频题", "type": "article", "description": "集中复习并发、JVM、集合和线程池。", "url": ""}],
        "knowledge_depth": [{"title": "Spring Boot + MySQL 深入实践", "type": "course", "description": "补齐框架原理、事务、索引和缓存。", "url": ""}],
        "project_experience": [{"title": "后端项目表达模板", "type": "practice", "description": "按 STAR 结构复盘项目亮点和指标。", "url": ""}],
    },
    "web_frontend": {
        "technical_accuracy": [{"title": "JavaScript / TypeScript 核心机制", "type": "article", "description": "补齐异步、原型链和类型系统知识。", "url": ""}],
        "knowledge_depth": [{"title": "React 工程化专题", "type": "course", "description": "补齐状态管理、性能优化和构建流程。", "url": ""}],
        "project_experience": [{"title": "前端项目讲解模板", "type": "practice", "description": "强化复杂交互、性能优化和业务结果表达。", "url": ""}],
    },
    "embedded": {
        "technical_accuracy": [{"title": "嵌入式 C 与外设通信专项", "type": "article", "description": "复习 C 语言、寄存器、中断和串口通信。", "url": ""}],
        "knowledge_depth": [{"title": "ARM / RTOS 系统化学习路线", "type": "course", "description": "补齐启动流程、调度机制和驱动分层。", "url": ""}],
        "project_experience": [{"title": "STM32 项目复盘模板", "type": "practice", "description": "训练如何讲清项目架构、调试过程和优化结果。", "url": ""}],
    },
    "python_algorithm": {
        "technical_accuracy": [{"title": "算法题刷题清单", "type": "practice", "description": "围绕高频题型建立稳定解题路径。", "url": ""}],
        "knowledge_depth": [{"title": "机器学习基础专题", "type": "course", "description": "补齐模型训练、评估与优化基础。", "url": ""}],
        "project_experience": [{"title": "算法项目答辩模板", "type": "practice", "description": "讲清数据流程、模型选择和结果分析。", "url": ""}],
    },
    "software_testing": {
        "technical_accuracy": [{"title": "测试理论与用例设计", "type": "article", "description": "补齐边界值、等价类与场景测试。", "url": ""}],
        "knowledge_depth": [{"title": "自动化测试框架实践", "type": "course", "description": "训练接口自动化与持续集成。", "url": ""}],
        "project_experience": [{"title": "测试项目复盘清单", "type": "practice", "description": "突出质量收益、缺陷闭环和风险控制。", "url": ""}],
    },
    "devops": {
        "technical_accuracy": [{"title": "Linux / Docker / CI-CD 速查", "type": "article", "description": "围绕部署链路搭建完整基础。", "url": ""}],
        "knowledge_depth": [{"title": "Kubernetes 与云原生实践", "type": "course", "description": "补齐编排、服务治理和监控告警。", "url": ""}],
        "project_experience": [{"title": "运维项目表达模板", "type": "practice", "description": "强化稳定性、交付效率和故障处理案例。", "url": ""}],
    },
}

GENERAL_RESOURCES = {
    "logic_expression": [{"title": "STAR 回答法", "type": "article", "description": "解决回答发散、结构不清的问题。", "url": ""}],
    "language_fluency": [{"title": "口语表达练习", "type": "practice", "description": "针对停顿、重复和语速做专项训练。", "url": ""}],
    "confidence": [{"title": "模拟面试复盘清单", "type": "practice", "description": "通过复盘和重复练习降低紧张感。", "url": ""}],
}

POSITION_TASKS = {
    "embedded": {
        "technical_accuracy": ["复习 C 语言、寄存器、volatile 和中断机制。", "整理 UART/I2C/SPI 高频问法。"],
        "knowledge_depth": ["梳理 ARM 启动流程和 RTOS 任务调度。", "补充驱动分层和硬件调试思路。"],
        "project_experience": ["复盘一个 STM32 或单片机项目。", "补充功耗、稳定性和排障过程。"],
    },
    "java_backend": {
        "technical_accuracy": ["复习 JVM、并发和事务传播。", "整理集合、线程池和锁相关高频题。"],
        "knowledge_depth": ["梳理 Spring、MySQL、Redis 原理。", "补充缓存一致性和索引优化案例。"],
        "project_experience": ["重写一个后端项目 STAR 版本。", "补充性能优化和线上排障经历。"],
    },
    "web_frontend": {
        "technical_accuracy": ["复习 JS 核心机制和浏览器渲染流程。", "整理性能优化与常见兼容性问题。"],
        "knowledge_depth": ["梳理 React/Vue 工程化方案。", "补充状态管理和组件设计案例。"],
        "project_experience": ["重写前端项目难点与收益表达。", "补充复杂交互和指标提升案例。"],
    },
}

GENERIC_TASKS = {
    "technical_accuracy": ["补做 10 道高频题，并记录错误原因。"],
    "knowledge_depth": ["把相关知识点整理成一张思维导图。"],
    "logic_expression": ["每道题先列 3 个关键词，再口头作答。"],
    "position_match": ["对照目标岗位 JD，补齐缺失知识点。"],
    "project_experience": ["准备一个 1 分钟和一个 3 分钟项目版本。"],
    "language_fluency": ["进行 10 分钟录音练习，关注停顿和重复词。"],
    "confidence": ["连续做两轮模拟问答，训练不看稿表达。"],
}


class RecommendationService:
    async def get_learning_plan(self, scores: dict[str, float], position: str) -> dict:
        weak_dims = {key: value for key, value in scores.items() if value < 70}
        strong_dims = {key: value for key, value in scores.items() if value >= 80}
        sorted_weak = sorted(weak_dims.items(), key=lambda item: item[1])

        summary_lines = [
            f"优先提升 {DIMENSION_CN.get(key, key)}，建议先做基础题和项目表达专项训练。"
            for key, _ in sorted_weak[:3]
        ]
        if not summary_lines:
            summary_lines = ["当前整体表现稳定，建议继续进行岗位化模拟和项目复盘。"]

        return {
            "summary": "\n".join(summary_lines),
            "summary_lines": summary_lines,
            "weak_areas": [DIMENSION_CN.get(key, key) for key, _ in sorted_weak],
            "strong_areas": [DIMENSION_CN.get(key, key) for key in strong_dims],
            "priority": "high" if len(weak_dims) >= 3 else "medium",
        }

    async def get_resources(self, weak_areas: list[str], position: str) -> list[dict]:
        position_resources = RESOURCE_DATABASE.get(position, RESOURCE_DATABASE["web_frontend"])
        selected: list[dict] = []
        for area in weak_areas:
            selected.extend(position_resources.get(area, []))
            selected.extend(GENERAL_RESOURCES.get(area, []))

        deduped: list[dict] = []
        seen = set()
        for item in selected:
            if item["title"] in seen:
                continue
            seen.add(item["title"])
            deduped.append(dict(item))
        return deduped

    async def generate_training_plan(self, scores: dict[str, float], position: str, days: int = 7) -> list[dict]:
        sorted_dims = sorted(scores.items(), key=lambda item: item[1])
        if not sorted_dims:
            return []

        position_tasks = POSITION_TASKS.get(position, POSITION_TASKS["web_frontend"])
        plan = []
        for day in range(1, days + 1):
            focus_dim, focus_score = sorted_dims[(day - 1) % len(sorted_dims)]
            tasks = list(position_tasks.get(focus_dim, [])) + GENERIC_TASKS.get(focus_dim, [])
            if focus_score >= 75:
                tasks = tasks[:1]
                intensity = "低强度"
                duration = "0.5-1 小时"
            elif focus_score >= 60:
                tasks = tasks[:2]
                intensity = "中强度"
                duration = "1-2 小时"
            else:
                tasks = tasks[:3]
                intensity = "高强度"
                duration = "2-3 小时"
            plan.append(
                {
                    "day": day,
                    "focus": DIMENSION_CN.get(focus_dim, focus_dim),
                    "intensity": intensity,
                    "duration": duration,
                    "tasks": tasks[:3],
                }
            )
        return plan


RecommendationServiceInstance = RecommendationService()
