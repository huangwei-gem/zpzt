import { useEffect, useState } from 'react';
import { Card, Row, Col, List, Avatar, Typography, Spin, message, Table, Tag, Progress, Statistic, Tabs, Select, Empty, Button, Space } from 'antd';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, LineChart, Line,
} from 'recharts';
import { 
  UserOutlined, FileTextOutlined, TeamOutlined,
  ArrowUpOutlined, ClockCircleOutlined, ArrowDownOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
  RiseOutlined, FallOutlined, ThunderboltOutlined,
  BellOutlined, RobotOutlined,
} from '@ant-design/icons';
import request from '../../utils/request';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import '../../dashboard.css';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

interface TrendData {
  date: string;
  count: number;
}

interface DashboardStats {
  active_positions: number;
  pending_resumes: number;
  today_interviews: number;
  trends: {
    active_positions: number;
    pending_resumes: number;
    today_interviews: number;
  };
}

interface Activity {
  id: string;
  title: string;
  time: string;
  status: string;
  avatar_color: string;
  type: string;
}

interface FunnelStage {
  stage: string;
  stage_name: string;
  count: number;
  percentage: number;
}

interface RecruitmentFunnel {
  stages: FunnelStage[];
  total_resumes: number;
  conversion_rate: number;
}

interface PositionAnalytics {
  id: string;
  title: string;
  department: string;
  status: string;
  total_resumes: number;
  pending_screening: number;
  pending_interview: number;
  interview_completed: number;
  offer_sent: number;
  hired: number;
  rejected: number;
  avg_match_score: number | null;
  avg_processing_days: number | null;
  conversion_rate: number;
}

interface InterviewerStats {
  id: string;
  name: string;
  total_interviews: number;
  completed_interviews: number;
  pending_interviews: number;
  completion_rate: number;
  avg_score: number | null;
  score_std: number | null;
  consistency_rating: string;
}

interface TimelineDataPoint {
  date: string;
  resumes_received: number;
  interviews_scheduled: number;
  interviews_completed: number;
  offers_sent: number;
  hires: number;
}

interface OverviewMetrics {
  total_positions: number;
  active_positions: number;
  total_resumes: number;
  pending_resumes: number;
  total_interviews: number;
  completed_interviews: number;
  total_offers: number;
  accepted_offers: number;
  avg_time_to_hire: number | null;
  avg_match_score: number | null;
  interview_pass_rate: number;
  offer_accept_rate: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];


// Animated number counter with easing
const AnimatedCounter: React.FC<{
  value: number;
  duration?: number;
  suffix?: string;
  decimals?: number;
}> = ({ value, duration = 1200, suffix = "", decimals = 0 }) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = value * eased;
      setDisplay(decimals > 0 ? current : Math.round(current));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value, duration, decimals]);

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString();
  return <span className="dash-num">{formatted}{suffix}</span>;
};

const Dashboard: React.FC = () => {
  const [statsData, setStatsData] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [funnel, setFunnel] = useState<RecruitmentFunnel | null>(null);
  const [positions, setPositions] = useState<PositionAnalytics[]>([]);
  const [interviewers, setInterviewers] = useState<InterviewerStats[]>([]);
  const [timeline, setTimeline] = useState<TimelineDataPoint[]>([]);
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [hrStats, setHrStats] = useState<any>(null);
  const [timelineDays, setTimelineDays] = useState(30);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);

  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const res: any = await request.post('/cron/daily-report');
      if (res?.ok) {
        message.success(`日报生成成功：今日新增 ${res.data.new} 人，入库 ${res.data.approved} 人，人才库共 ${res.data.talentPool} 人`);
      } else {
        message.error(res?.detail || '生成失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.detail || '生成失败');
    } finally {
      setReportLoading(false);
    }
  };

  const handleSendReminder = async () => {
    setReminderLoading(true);
    try {
      const res: any = await request.post('/cron/interview-reminder');
      if (res?.ok) {
        message.success(`提醒发送成功：待处理 ${res.pending} 人`);
      } else {
        message.error(res?.detail || '发送失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.detail || '发送失败');
    } finally {
      setReminderLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    fetchTimelineData(timelineDays);
  }, [timelineDays]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [statsRes, funnelRes, positionsRes, interviewersRes, overviewRes, hrStatsRes] = await Promise.all([
        request.get('/dashboard/stats'),
        request.get('/dashboard/funnel'),
        request.get('/dashboard/positions'),
        request.get('/dashboard/interviewers'),
        request.get('/dashboard/overview'),
        request.get('/dashboard/hr-stats')
      ]);
      
      setStatsData(statsRes.stats);
      setActivities(statsRes.recent_activities);
      setFunnel(funnelRes);
      setPositions(positionsRes.positions);
      setInterviewers(interviewersRes.interviewers);
      setOverview(overviewRes.metrics);
      setHrStats(hrStatsRes);
    } catch (error) {
      console.error(error);
      message.error('获取仪表盘数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAIInsights = async () => {
    setAiLoading(true);
    try {
      const res = await request.get('/dashboard/ai-insights');
      setAiInsights(res);
    } catch (error) {
      console.error('AI insights fetch failed', error);
    } finally {
      setAiLoading(false);
    }
  };

  const fetchTimelineData = async (days: number) => {
    try {
      const res = await request.get(`/dashboard/timeline?days=${days}`);
      setTimeline(res.timeline);
    } catch (error) {
      console.error(error);
    }
  };

  const stats = [
    {
      title: "招聘中岗位",
      value: statsData?.active_positions || 0,
      icon: <UserOutlined style={{ fontSize: '20px', color: '#3B82F6' }} />,
      color: '#EFF6FF',
      trend: statsData?.trends.active_positions || 0
    },
    {
      title: "待筛选简历",
      value: statsData?.pending_resumes || 0,
      icon: <FileTextOutlined style={{ fontSize: '20px', color: '#EF4444' }} />,
      color: '#FEF2F2',
      trend: statsData?.trends.pending_resumes || 0
    },
    {
      title: "今日面试",
      value: statsData?.today_interviews || 0,
      icon: <TeamOutlined style={{ fontSize: '20px', color: '#10B981' }} />,
      color: '#ECFDF5',
      trend: statsData?.trends.today_interviews || 0
    },
  ];

  const defaultTrends = Array.from({ length: 7 }, (_, i) => ({
    date: dayjs().subtract(6 - i, 'day').format('YYYY-MM-DD'),
    count: 0
  }));

  const positionColumns = [
    {
      title: '岗位名称',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: PositionAnalytics) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.department}</Text>
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          'open': 'blue',
          'published': 'green',
          'closed': 'default'
        };
        const textMap: Record<string, string> = {
          'open': '开放中',
          'published': '已发布',
          'closed': '已关闭'
        };
        return <Tag color={colorMap[status] || 'default'}>{textMap[status] || status}</Tag>;
      }
    },
    {
      title: '简历数',
      dataIndex: 'total_resumes',
      key: 'total_resumes',
      sorter: (a: PositionAnalytics, b: PositionAnalytics) => a.total_resumes - b.total_resumes
    },
    {
      title: '待初筛',
      dataIndex: 'pending_screening',
      key: 'pending_screening',
      render: (val: number, record: PositionAnalytics) => (
        <Text type={val > 0 ? 'warning' : 'secondary'}>{val}</Text>
      )
    },
    {
      title: '待面试',
      dataIndex: 'pending_interview',
      key: 'pending_interview',
      render: (val: number) => (
        <Text type={val > 0 ? 'warning' : 'secondary'}>{val}</Text>
      )
    },
    {
      title: '已录用',
      dataIndex: 'hired',
      key: 'hired',
      render: (val: number) => (
        <Text type="success" strong>{val}</Text>
      )
    },
    {
      title: '转化率',
      dataIndex: 'conversion_rate',
      key: 'conversion_rate',
      render: (rate: number) => (
        <Progress
          className="dash-progress-glow"
          percent={rate}
          size="small" 
          format={(percent) => `${percent?.toFixed(1)}%`}
          strokeColor={rate >= 20 ? '#10B981' : rate >= 10 ? '#F59E0B' : '#EF4444'}
        />
      )
    }
  ];

  const interviewerColumns = [
    {
      title: '面试官',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#3B82F6' }} />
          <Text strong>{text}</Text>
        </div>
      )
    },
    {
      title: '总面试数',
      dataIndex: 'total_interviews',
      key: 'total_interviews',
      sorter: (a: InterviewerStats, b: InterviewerStats) => a.total_interviews - b.total_interviews
    },
    {
      title: '已完成',
      dataIndex: 'completed_interviews',
      key: 'completed_interviews'
    },
    {
      title: '完成率',
      dataIndex: 'completion_rate',
      key: 'completion_rate',
      render: (rate: number) => (
        <Progress
          className="dash-progress-glow"
          percent={rate}
          size="small" 
          format={(percent) => `${percent?.toFixed(1)}%`}
          strokeColor={rate >= 80 ? '#10B981' : rate >= 50 ? '#F59E0B' : '#EF4444'}
        />
      )
    },
    {
      title: '平均评分',
      dataIndex: 'avg_score',
      key: 'avg_score',
      render: (score: number | null) => score ? <Text strong>{score.toFixed(1)}</Text> : <Text type="secondary">-</Text>
    },
    {
      title: '评分一致性',
      dataIndex: 'consistency_rating',
      key: 'consistency_rating',
      render: (rating: string) => {
        const colorMap: Record<string, string> = {
          '非常一致': 'success',
          '较为一致': 'warning',
          '波动较大': 'error',
          '数据不足': 'default'
        };
        return <Tag color={colorMap[rating] || 'default'}>{rating}</Tag>;
      }
    }
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '500px', gap: 24 }}>
        <div className="dash-shimmer" style={{ width: 200, height: 32, borderRadius: 8 }} />
        <Row gutter={[24, 24]} style={{ maxWidth: 1200, width: '100%' }}>
          {[0, 1, 2, 3].map(i => (
            <Col xs={24} sm={12} lg={6} key={i}>
              <div className="dash-shimmer" style={{ height: 120, borderRadius: 16 }} />
            </Col>
          ))}
        </Row>
        <div className="dash-shimmer" style={{ width: '100%', maxWidth: 1200, height: 300, borderRadius: 16 }} />
      </div>
    );
  }

  return (
    <div style={{ overflow: 'hidden', position: 'relative' }}>
      <div className="dash-bg-orbs">
        <div className="dash-orb dash-orb-1" />
        <div className="dash-orb dash-orb-2" />
        <div className="dash-orb dash-orb-3" />
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div className="dash-enter-up" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.02em', fontSize: 28 }}>
              数据分析
            </Title>
            <Text type="secondary" style={{ fontSize: 14 }}>招聘数据概览与深度分析</Text>
          </div>
          <Space>
            <Button icon={<FileTextOutlined />} onClick={handleGenerateReport} loading={reportLoading}>
              生成日报
            </Button>
            <Button icon={<BellOutlined />} onClick={handleSendReminder} loading={reminderLoading}>
              发送提醒
            </Button>
          </Space>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <Row gutter={[20, 20]}>
        {stats.map((stat, index) => {
          const accentClasses = ['dash-accent-blue', 'dash-accent-red', 'dash-accent-green', 'dash-accent-purple'];
          const delays = ['dash-delay-1', 'dash-delay-2', 'dash-delay-3', 'dash-delay-4'];
          return (
            <Col xs={24} sm={12} lg={6} key={index}>
              <Card
                bordered={false}
                className={`dash-stat-card dash-tilt dash-metric-glow ${accentClasses[index]} dash-enter-up ${delays[index]}`}
                style={{ height: '100%' }}
                styles={{ body: { padding: 24 } }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>{stat.title}</Text>
                    <div style={{ fontSize: 36, fontWeight: 700, margin: '10px 0 6px', lineHeight: 1, color: '#0F172A', letterSpacing: '-0.02em' }}>
                      <span className={`dash-glow-${['blue','red','green','purple'][index]}`}><AnimatedCounter value={stat.value} /></span>
                    </div>
                    <div className={
                      stat.trend > 0 ? 'dash-trend-up' :
                      stat.trend < 0 ? 'dash-trend-down' : 'dash-trend-flat'
                    }>
                      {stat.trend > 0 ? <ArrowUpOutlined style={{ fontSize: 11 }} /> :
                       stat.trend < 0 ? <ArrowDownOutlined style={{ fontSize: 11 }} /> : null}
                      {stat.trend !== 0 ? `${Math.abs(stat.trend)} 本周新增` : '无变化'}
                    </div>
                  </div>
                  <div className="dash-icon-wrap dash-icon-float" style={{ background: stat.color }}>
                    {stat.icon}
                  </div>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Core Metrics + Funnel */}
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} lg={8}>
          <Card
            title={<span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>核心指标</span>}
            bordered={false}
            className="dash-enter-up dash-delay-5 dash-metric-glow"
            style={{ height: '100%', borderRadius: 16 }}
            styles={{ body: { padding: 20 } }}
          >
            <Row gutter={[16, 20]}>
              <Col span={12}>
                <div style={{ padding: '4px 0' }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>面试通过率</Text>
                  <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, color: overview?.interview_pass_rate && overview.interview_pass_rate >= 50 ? '#10B981' : '#EF4444', letterSpacing: '-0.02em' }}>
                    <AnimatedCounter value={overview?.interview_pass_rate || 0} suffix="%" />
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ padding: '4px 0' }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>平均招聘周期</Text>
                  <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, letterSpacing: '-0.02em' }}>
                    {overview?.avg_time_to_hire ? <><AnimatedCounter value={overview.avg_time_to_hire} suffix="天" /></> : <Text type="secondary">-</Text>}
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ padding: '4px 0' }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>平均匹配分</Text>
                  <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, color: overview?.avg_match_score && overview.avg_match_score >= 70 ? '#10B981' : '#F59E0B', letterSpacing: '-0.02em' }}>
                    {overview?.avg_match_score ? <AnimatedCounter value={overview.avg_match_score} /> : <Text type="secondary">-</Text>}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card
            title={<span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>招聘漏斗</span>}
            bordered={false}
            className="dash-enter-up dash-delay-6 dash-metric-glow"
            style={{ height: '100%', borderRadius: 16 }}
            styles={{ body: { padding: 20 } }}
          >
            {funnel && funnel.stages.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {funnel.stages.map((stage, index) => (
                  <div key={stage.stage} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 80, textAlign: 'right' }}>
                      <Text type="secondary" style={{ fontSize: 13 }}>{stage.stage_name}</Text>
                    </div>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <div
                        className="dash-funnel-bar"
                        style={{
                          width: `${stage.percentage}%`,
                          height: 32,
                          background: `linear-gradient(90deg, ${COLORS[index % COLORS.length]}, ${COLORS[index % COLORS.length]}dd)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          paddingRight: 12,
                          animationDelay: `${0.4 + index * 0.08}s`,
                          minWidth: 60,
                        }}
                      >
                        <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {stage.count}人
                        </span>
                      </div>
                    </div>
                    <div style={{ width: 50, textAlign: 'right' }}>
                      <Text style={{ fontSize: 13, fontWeight: 600, color: COLORS[index % COLORS.length], fontVariantNumeric: 'tabular-nums' }}>
                        {stage.percentage.toFixed(1)}%
                      </Text>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 12, padding: '12px 16px', background: '#F8FAFC', borderRadius: 10, display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 13 }}>总简历数：</Text>
                    <Text strong style={{ fontSize: 15, marginLeft: 4 }}><AnimatedCounter value={funnel.total_resumes} /></Text>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 13 }}>整体转化率：</Text>
                    <Text strong style={{ fontSize: 15, marginLeft: 4, color: '#10B981' }}><AnimatedCounter value={funnel.conversion_rate} decimals={1} suffix="%" /></Text>
                  </div>
                </div>
              </div>
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>
      </Row>

      {/* Timeline Chart */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>时间趋势分析</span>
            <Select value={timelineDays} onChange={setTimelineDays} style={{ width: 120 }} size="small">
              <Option value={7}>近7天</Option>
              <Option value={14}>近14天</Option>
              <Option value={30}>近30天</Option>
              <Option value={60}>近60天</Option>
              <Option value={90}>近90天</Option>
            </Select>
          </div>
        }
        bordered={false}
        className="dash-enter-up dash-delay-7 dash-metric-glow"
        style={{ marginTop: 20, borderRadius: 16 }}
        styles={{ body: { padding: 20 } }}
      >
        <div className="dash-chart-enter" style={{ height: 320, width: '100%', minHeight: 320 }}>
          {timeline.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradResumes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradInterviews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradHires" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748B', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => dayjs(value).format('MM-DD')}
              />
              <YAxis
                tick={{ fill: '#64748B', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 8px 16px -4px rgba(0,0,0,0.1)', fontSize: 13 }}
                labelFormatter={(label) => dayjs(label).format('YYYY年MM月DD日')}
              />
              <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
              <Area type="monotone" dataKey="resumes_received" name="简历接收" stroke="#3B82F6" strokeWidth={2.5} fill="url(#gradResumes)" dot={{ r: 3, fill: '#3B82F6' }} activeDot={{ r: 5 }} animationDuration={1200} />
              <Area type="monotone" dataKey="interviews_scheduled" name="面试安排" stroke="#F59E0B" strokeWidth={2.5} fill="url(#gradInterviews)" dot={{ r: 3, fill: '#F59E0B' }} activeDot={{ r: 5 }} animationDuration={1400} />
              <Area type="monotone" dataKey="interviews_completed" name="面试完成" stroke="#10B981" strokeWidth={2.5} fill="url(#gradCompleted)" dot={{ r: 3, fill: '#10B981' }} activeDot={{ r: 5 }} animationDuration={1600} />
              <Area type="monotone" dataKey="hires" name="入职" stroke="#8B5CF6" strokeWidth={2.5} fill="url(#gradHires)" dot={{ r: 3, fill: '#8B5CF6' }} activeDot={{ r: 5 }} animationDuration={1800} />
            </AreaChart>
          </ResponsiveContainer>
          ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94A3B8' }}>
            暂无趋势数据
          </div>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <Tabs
        defaultActiveKey="positions"
        style={{ marginTop: 20 }}
        className="dash-enter-up dash-delay-8 dash-tabs"
        items={[
          {
            key: 'positions',
            label: '岗位分析',
            children: (
              <Card bordered={false} style={{ borderRadius: 16 }} styles={{ body: { padding: 0 } }}>
                <Table
                  dataSource={positions}
                  columns={positionColumns}
                  className="dash-table-stagger"
                  rowKey="id"
                  pagination={{ pageSize: 8 }}
                  locale={{ emptyText: '暂无岗位数据' }}
                />
              </Card>
            ),
          },
          {
            key: 'interviewers',
            label: '面试官分析',
            children: (
              <Card bordered={false} style={{ borderRadius: 16 }} styles={{ body: { padding: 0 } }}>
                <Table
                  dataSource={interviewers}
                  columns={interviewerColumns}
                  className="dash-table-stagger"
                  rowKey="id"
                  pagination={{ pageSize: 8 }}
                  locale={{ emptyText: '暂无面试官数据' }}
                />
              </Card>
            ),
          },
          {
            key: 'activities',
            label: '最新动态',
            children: (
              <Card bordered={false} style={{ borderRadius: 16 }}>
                <List
                  itemLayout="horizontal"
                  dataSource={activities}
                  locale={{ emptyText: '暂无动态' }}
                  renderItem={item => (
                    <List.Item style={{ padding: '14px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            icon={<UserOutlined />}
                            style={{
                              backgroundColor: item.avatar_color,
                              color: '#fff',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            }}
                          />
                        }
                        title={<span style={{ fontWeight: 500, color: '#0F172A', fontSize: 14 }}>{item.title}</span>}
                        description={
                          <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            <ClockCircleOutlined style={{ color: '#94A3B8' }} />
                            <span style={{ color: '#64748B' }}>{dayjs(item.time).fromNow()}</span>
                            <Tag style={{ marginLeft: 8 }} color={item.avatar_color}>{item.status}</Tag>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* HR Overview */}
      {hrStats && (
        <Card
          title={<span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>招聘全流程概览</span>}
          bordered={false}
          className="dash-enter-up dash-gradient-border"
          style={{ marginTop: 20, borderRadius: 16 }}
          styles={{ body: { padding: 20 } }}
        >
          <Row gutter={[16, 16]}>
            {[
              { title: '需求提报', value: hrStats.requisitions?.total || 0, bg: '#EFF6FF', tags: [{ color: 'processing', text: `${hrStats.requisitions?.pending || 0} 待批` }, { color: 'success', text: `${hrStats.requisitions?.approved || 0} 已批` }] },
              { title: '招聘渠道', value: hrStats.channels?.total || 0, bg: '#F0FDF4', tags: [{ color: 'success', text: `${hrStats.channels?.active || 0} 活跃` }] },
              { title: '人才库', value: hrStats.talent_pool?.total || 0, bg: '#FEF3C7', tags: [{ color: 'success', text: `${hrStats.talent_pool?.available || 0} 可用` }, { color: 'processing', text: `${hrStats.talent_pool?.contacted || 0} 已联系` }] },
              { title: '背调管理', value: hrStats.background_checks?.total || 0, bg: '#FEE2E2', tags: [{ color: 'warning', text: `${hrStats.background_checks?.in_progress || 0} 进行中` }, { color: 'success', text: `${hrStats.background_checks?.completed || 0} 已完成` }] },
              { title: '入职管理', value: hrStats.onboarding?.total || 0, bg: '#EDE9FE', tags: [{ color: 'processing', text: `${hrStats.onboarding?.in_progress || 0} 入职中` }, { color: 'success', text: `${hrStats.onboarding?.completed || 0} 已完成` }] },
              { title: '试用期转正', value: hrStats.probation?.total || 0, bg: '#FCE7F3', tags: [{ color: 'processing', text: `${hrStats.probation?.pending || 0} 试用中` }, { color: 'success', text: `${hrStats.probation?.confirmed || 0} 已转正` }] },
            ].map((item, idx) => (
              <Col xs={12} sm={8} lg={4} key={idx}>
                <div className="dash-mini-card" style={{ background: item.bg }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>{item.title}</Text>
                  <div style={{ fontSize: 28, fontWeight: 700, margin: '6px 0 8px', letterSpacing: '-0.02em' }}>
                    <AnimatedCounter value={item.value} />
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {item.tags.map((tag, ti) => (
                      <Tag key={ti} color={tag.color} style={{ fontSize: 11, margin: 0 }}>{tag.text}</Tag>
                    ))}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* AI Smart Insights */}
      <Card
        title={
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
            <RobotOutlined style={{ marginRight: 8, color: '#6366F1' }} />
            AI 智能洞察
          </span>
        }
        extra={
          <Button
            type="primary"
            size="small"
            loading={aiLoading}
            icon={<ThunderboltOutlined />}
            onClick={fetchAIInsights}
            style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', border: 'none' }}
          >
            生成洞察
          </Button>
        }
        bordered={false}
        className="dash-enter-up dash-gradient-border"
        style={{ marginTop: 20, borderRadius: 16 }}
        styles={{ body: { padding: 20 } }}
      >
        {aiLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: '#94A3B8' }}>AI 正在分析数据并生成洞察...</div>
          </div>
        ) : aiInsights ? (
          <Row gutter={[20, 20]}>
            {aiInsights.summary && (
              <Col span={24}>
                <div style={{
                  background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
                  padding: '16px 20px',
                  borderRadius: 12,
                  borderLeft: '4px solid #6366F1',
                }}>
                  <Text strong style={{ color: '#4338CA', fontSize: 14 }}>总体概览</Text>
                  <div style={{ marginTop: 8, color: '#3730A3', fontSize: 14, lineHeight: 1.8 }}>{aiInsights.summary}</div>
                </div>
              </Col>
            )}
            {aiInsights.bottlenecks && aiInsights.bottlenecks.length > 0 && (
              <Col xs={24} lg={12}>
                <Text strong style={{ color: '#EF4444', display: 'block', marginBottom: 12 }}>⚠ 瓶颈问题</Text>
                {aiInsights.bottlenecks.map((b: any, i: number) => (
                  <div key={i} style={{
                    padding: '10px 14px',
                    marginBottom: 8,
                    background: '#FEF2F2',
                    borderRadius: 8,
                    borderLeft: '3px solid #EF4444',
                  }}>
                    <Text strong style={{ fontSize: 13, color: '#991B1B' }}>{b.area}</Text>
                    <div style={{ fontSize: 13, color: '#7F1D1D', marginTop: 4 }}>{b.description}</div>
                  </div>
                ))}
              </Col>
            )}
            {aiInsights.recommendations && aiInsights.recommendations.length > 0 && (
              <Col xs={24} lg={12}>
                <Text strong style={{ color: '#10B981', display: 'block', marginBottom: 12 }}>✓ 行动建议</Text>
                {aiInsights.recommendations.map((r: any, i: number) => (
                  <div key={i} style={{
                    padding: '10px 14px',
                    marginBottom: 8,
                    background: '#F0FDF4',
                    borderRadius: 8,
                    borderLeft: '3px solid #10B981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <Tag color={r.priority === 'high' ? 'red' : r.priority === 'medium' ? 'orange' : 'green'} style={{ margin: 0, flexShrink: 0 }}>
                      {r.priority === 'high' ? '高' : r.priority === 'medium' ? '中' : '低'}
                    </Tag>
                    <Text style={{ fontSize: 13, color: '#166534' }}>{r.action}</Text>
                  </div>
                ))}
              </Col>
            )}
            {aiInsights.predictions && aiInsights.predictions.length > 0 && (
              <Col span={24}>
                <Text strong style={{ color: '#7C3AED', display: 'block', marginBottom: 12 }}>ὒc 趋势预测</Text>
                <Row gutter={[12, 12]}>
                  {aiInsights.predictions.map((p: any, i: number) => (
                    <Col xs={24} sm={12} lg={8} key={i}>
                      <div style={{
                        padding: '12px 16px',
                        background: '#FDF4FF',
                        borderRadius: 8,
                        border: '1px solid #E9D5FF',
                      }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{p.metric}</Text>
                        <div style={{ fontSize: 14, color: '#6B21A8', marginTop: 4 }}>{p.prediction}</div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Col>
            )}
          </Row>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>
            <RobotOutlined style={{ fontSize: 48, marginBottom: 16, color: '#CBD5E1' }} />
            <div style={{ fontSize: 14 }}>点击“生成洞察”让AI分析当前招聘数据</div>
          </div>
        )}
      </Card>
      </div>
    </div>
  );
};

export default Dashboard;
