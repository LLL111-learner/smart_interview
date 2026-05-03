import { Card, Tag, Typography } from 'antd';

const { Title, Text } = Typography;

interface Dimension {
  dimension: string;
  score: number;
  comment: string;
}

interface ScoreCardProps {
  /** 总分 */
  score: number;
  /** 等级：优秀/良好/一般/需改进 */
  level: string;
  /** 各维度评分 */
  dimensions: Dimension[];
}

/** 根据分数获取颜色 */
function getScoreColor(score: number): string {
  if (score >= 90) return '#52c41a'; // 绿色
  if (score >= 70) return '#1677ff'; // 蓝色
  if (score >= 60) return '#fa8c16'; // 橙色
  return '#f5222d'; // 红色
}

/** 根据等级获取 Tag 颜色 */
function getLevelColor(level: string): string {
  switch (level) {
    case '优秀':
      return 'green';
    case '良好':
      return 'blue';
    case '一般':
      return 'orange';
    case '需改进':
      return 'red';
    default:
      return 'default';
  }
}

/**
 * 评分卡片组件
 * - 大数字显示总分 + 颜色编码
 * - 等级标签
 * - 维度简要统计
 */
function ScoreCard({ score, level, dimensions }: ScoreCardProps) {
  const scoreColor = getScoreColor(score);
  const highestDim = [...dimensions].sort((a, b) => b.score - a.score)[0];
  const lowestDim = [...dimensions].sort((a, b) => a.score - b.score)[0];

  return (
    <Card
      style={{
        textAlign: 'center',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
      bodyStyle={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {/* 总分 */}
      <div>
        <Title
          level={1}
          style={{
            color: scoreColor,
            fontSize: 72,
            lineHeight: 1,
            marginBottom: 0,
          }}
        >
          {score}
        </Title>
        <Text type="secondary" style={{ fontSize: 16 }}>
          总分(满分100)
        </Text>
      </div>

      {/* 等级标签 */}
      <Tag
        color={getLevelColor(level)}
        style={{ fontSize: 16, padding: '4px 16px' }}
      >
        {level}
      </Tag>

      {/* 维度统计摘要 */}
      <div style={{ width: '100%', marginTop: 16, textAlign: 'left' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <Text type="secondary">最强维度</Text>
          <Text strong style={{ color: '#52c41a' }}>
            {highestDim?.dimension} ({highestDim?.score}分)
          </Text>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <Text type="secondary">最弱维度</Text>
          <Text strong style={{ color: '#fa8c16' }}>
            {lowestDim?.dimension} ({lowestDim?.score}分)
          </Text>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Text type="secondary">评估维度数</Text>
          <Text strong>{dimensions.length} 个</Text>
        </div>
      </div>
    </Card>
  );
}

export default ScoreCard;
