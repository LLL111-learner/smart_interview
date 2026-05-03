import ReactECharts from 'echarts-for-react';

interface RadarChartProps {
  /** 各维度得分数组 */
  data: number[];
  /** 维度名称数组 */
  labels: string[];
  /** 图表标题 */
  title?: string;
  /** 对比数据（可选，支持多组数据） */
  compareData?: number[];
  /** 对比数据名称 */
  compareName?: string;
}

/**
 * 雷达图组件
 * - 使用 echarts-for-react 渲染
 * - 支持单组或多组数据对比
 * - 配色美观，自适应容器大小
 */
function RadarChart({
  data,
  labels,
  title,
  compareData,
  compareName,
}: RadarChartProps) {
  /** 构建指标配置 */
  const indicators = labels.map((name) => ({
    name,
    max: 100,
  }));

  /** 构建系列数据 */
  const seriesData: {
    value: number[];
    name: string;
    areaStyle: { opacity: number };
    lineStyle: { width: number };
  }[] = [
    {
      value: data,
      name: title || '当前得分',
      areaStyle: { opacity: 0.2 },
      lineStyle: { width: 2 },
    },
  ];

  // 如果有对比数据
  if (compareData) {
    seriesData.push({
      value: compareData,
      name: compareName || '历史对比',
      areaStyle: { opacity: 0.1 },
      lineStyle: { width: 2 },
    });
  }

  const option = {
    color: ['#1677ff', '#52c41a', '#fa8c16'],
    tooltip: {
      trigger: 'item' as const,
    },
    legend: {
      data: seriesData.map((s) => s.name),
      bottom: 0,
    },
    radar: {
      indicator: indicators,
      shape: 'polygon' as const,
      radius: '65%',
      splitNumber: 5,
      axisName: {
        color: '#666',
        fontSize: 12,
      },
      splitArea: {
        areaStyle: {
          color: ['#fff', '#f9fafb', '#f0f2f5', '#e8eaed', '#dfe1e5'],
        },
      },
      splitLine: {
        lineStyle: {
          color: '#e8e8e8',
        },
      },
    },
    series: [
      {
        type: 'radar',
        data: seriesData,
        emphasis: {
          lineStyle: {
            width: 3,
          },
        },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 300, width: '100%' }}
      opts={{ renderer: 'svg' }}
    />
  );
}

export default RadarChart;
