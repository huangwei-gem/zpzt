import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Card, Row, Col, Typography, Spin, message, Table, Tag, Space, Button, Input, Select, Tooltip } from 'antd';
import {
  SyncOutlined, ReloadOutlined, SearchOutlined, ClearOutlined,
  TeamOutlined, UserOutlined, FileTextOutlined, ScheduleOutlined,
  RiseOutlined, CheckCircleOutlined, GiftOutlined, PercentageOutlined,
  HomeOutlined, ClockCircleOutlined, ThunderboltOutlined,
  FileProtectOutlined, ToolOutlined,
  AuditOutlined, SafetyOutlined, SettingOutlined, MailOutlined,
  BookOutlined, LinkOutlined, BarChartOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import request from '../../utils/request';
import '../../dashboard.css';

const { Title, Text } = Typography;

interface FunnelStage {
  name: string;
  count: number;
}

interface DivisionData {
  name: string;
  hrbp: string;
  active_positions: number;
  total_headcount: number;
  total_resumes: number;
  scheduled_interviews: number;
  interview_pass_rate: number;
  hired: number;
  funnel: { stages: FunnelStage[] };
}

interface OverviewData {
  active_positions: number;
  total_headcount: number;
  total_resumes: number;
  scheduled_interviews: number;
  push_conversion_rate: number;
  interview_pass_rate: number;
  offers: number;
  offer_conversion_rate: number;
  hired: number;
  hire_conversion_rate: number;
  pending_onboarding: number;
  last_updated: string;
}

interface DashboardOverview {
  overview: OverviewData;
  funnel: { stages: FunnelStage[] };
  divisions: DivisionData[];
}

interface PositionDetail {
  division: string;
  hrbp: string;
  position: string;
  headcount: number;
  total_resumes: number;
  first_interview: number;
  first_pass: number;
  second_pass: number;
  third_pass: number;
  pass_rate: string;
  offers: number;
  hired: number;
  notes: string;
  status: string;
}

interface ModuleStat {
  key: string;
  label: string;
  count: number;
  sub: string;
}

const funnelColors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

/* ==================== 菜单模块指标卡片配置 ==================== */
const MODULE_DEFS: { key: string; label: string; icon: React.ReactNode; color: string; link?: string }[] = [
  { key: 'requisitions',    label: '需求管理',    icon: <FileProtectOutlined />,         color: '#3B82F6', link: '/requisitions' },
  { key: 'positions',       label: '岗位管理',    icon: <ToolOutlined />,                color: '#10B981', link: '/positions' },
  { key: 'resumes',         label: '简历管理',    icon: <FileTextOutlined />,            color: '#F59E0B', link: '/resumes' },
  { key: 'interviews',      label: '面试管理',    icon: <ScheduleOutlined />,            color: '#EC4899', link: '/interviews' },
  { key: 'onboarding',      label: '入职管理',    icon: <HomeOutlined />,                 color: '#06B6D4', link: '/onboarding' },
  { key: 'probation',       label: '试用期管理',  icon: <SafetyOutlined />,              color: '#84CC16', link: '/probation' },
  { key: 'reports',         label: '招聘日报',    icon: <BarChartOutlined />,            color: '#6366F1', link: '/daily-report' },
  { key: 'users',           label: '用户管理',    icon: <TeamOutlined />,                 color: '#F97316', link: '/users' },
];

/* ==================== 旧 KPI 定义保持不变（用于总体概览横条） ==================== */
const KPI_DEFS = [
  { key: 'active_positions', label: '在招岗位', icon: <TeamOutlined />, accent: 'dash-accent-blue', glow: 'dash-glow-blue' },
  { key: 'total_headcount', label: '在招人数', icon: <UserOutlined />, accent: 'dash-accent-green', glow: 'dash-glow-green' },
  { key: 'total_resumes', label: '简历推送', icon: <FileTextOutlined />, accent: 'dash-accent-purple', glow: 'dash-glow-purple' },
  { key: 'scheduled_interviews', label: '安排面试', icon: <ScheduleOutlined />, accent: 'dash-accent-amber', glow: 'dash-glow-amber' },
  { key: 'push_conversion_rate', label: '推送转化率', icon: <RiseOutlined />, accent: 'dash-accent-red', glow: 'dash-glow-red' },
  { key: 'interview_pass_rate', label: '面试通过率', icon: <CheckCircleOutlined />, accent: 'dash-accent-purple', glow: 'dash-glow-purple' },
  { key: 'offers', label: '发放Offer', icon: <GiftOutlined />, accent: 'dash-accent-pink', glow: 'dash-glow-red' },
  { key: 'offer_conversion_rate', label: 'Offer转化率', icon: <PercentageOutlined />, accent: 'dash-accent-cyan', glow: 'dash-glow-blue' },
  { key: 'hired', label: '已入职', icon: <HomeOutlined />, accent: 'dash-accent-lime', glow: 'dash-glow-green' },
  { key: 'hire_conversion_rate', label: '入职转化率', icon: <ThunderboltOutlined />, accent: 'dash-accent-cyan', glow: 'dash-glow-blue' },
  { key: 'pending_onboarding', label: '待入职', icon: <ClockCircleOutlined />, accent: 'dash-accent-amber', glow: 'dash-glow-amber' },
] as const;

/* ==================== 工具函数 ==================== */
function getKpiValue(od: OverviewData | undefined, key: string): number | string {
  if (!od) return '-';
  const v = (od as any)[key];
  return v !== undefined && v !== null ? v : '-';
}

function formatTime(iso: string | undefined) {
  if (!iso) return '加载中';
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  } catch { return iso; }
}

const statusTagMap: Record<string, { color: string; label: string }> = {
  '招聘中': { color: 'success', label: '招聘中' },
  '已完成': { color: 'default', label: '已完成' },
  '已终止': { color: 'error', label: '已终止' },
  '暂停': { color: 'warning', label: '暂停' },
  '草稿': { color: 'default', label: '草稿' },
  'hired': { color: 'processing', label: '已招到' },
};

/* ==================== 组件 ==================== */
const Dashboard: React.FC = () => {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [positions, setPositions] = useState<PositionDetail[]>([]);
  const [moduleStats, setModuleStats] = useState<ModuleStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const prevOverviewRef = useRef<string>('');

  const [filterDivision, setFilterDivision] = useState<string | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [searchPosition, setSearchPosition] = useState('');

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    try {
      const [overviewRes, positionsRes, moduleRes] = await Promise.all([
        request.get('/dashboard/overview'),
        request.get('/dashboard/positions-detail'),
        request.get('/dashboard/module-stats'),
      ]);
      setOverview(overviewRes);
      setPositions(positionsRes);
      setModuleStats(moduleRes?.modules || []);
      const hash = JSON.stringify(overviewRes?.overview || {});
      if (prevOverviewRef.current && prevOverviewRef.current !== hash) {
        setTimeout(() => {}, 500);
      }
      prevOverviewRef.current = hash;
    } catch (e: any) {
      console.error('Dashboard error:', e);
      message.error('获取看板数据失败: ' + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const overviewData = overview?.overview;

  const divisionOptions = useMemo(() => {
    if (!Array.isArray(positions)) return [];
    return Array.from(new Set(positions.map(p => p.division).filter(Boolean))).sort();
  }, [positions]);

  const statusOptions = useMemo(() => {
    if (!Array.isArray(positions)) return [];
    return Array.from(new Set(positions.map(p => p.status).filter(Boolean))).sort();
  }, [positions]);

  const filteredPositions = useMemo(() => {
    if (!Array.isArray(positions)) return [];
    return positions.filter(p => {
      if (filterDivision && p.division !== filterDivision) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      if (searchPosition) {
        const kw = searchPosition.toLowerCase();
        if (!p.position.toLowerCase().includes(kw) && !p.division.toLowerCase().includes(kw)) return false;
      }
      return true;
    });
  }, [positions, filterDivision, filterStatus, searchPosition]);

  const funnelStages = overview?.funnel?.stages || [];
  const maxFunnelCount = Math.max(...funnelStages.map(s => s.count || 0), 1);
  const divisions = overview?.divisions || [];

  const kpiValues = useMemo(() => {
    if (!overviewData) return {};
    const map: Record<string, string | number> = {};
    KPI_DEFS.forEach(def => { map[def.key] = getKpiValue(overviewData, def.key); });
    return map;
  }, [overviewData]);

  // 构建模块指标 map
  const moduleMap = useMemo(() => {
    const map: Record<string, ModuleStat> = {};
    moduleStats.forEach(m => { map[m.key] = m; });
    return map;
  }, [moduleStats]);

  const positionColumns = useMemo(() => [
    { title: '所属事业部', dataIndex: 'division', key: 'division', width: 160 },
    { title: 'HRBP', dataIndex: 'hrbp', key: 'hrbp', width: 80 },
    { title: '在招职位', dataIndex: 'position', key: 'position', width: 180 },
    { title: '在招人数', dataIndex: 'headcount', key: 'headcount', width: 80, align: 'center' as const },
    { title: '简历推送', dataIndex: 'total_resumes', key: 'total_resumes', width: 80, align: 'center' as const },
    { title: '1面', dataIndex: 'first_interview', key: 'first_interview', width: 60, align: 'center' as const },
    { title: '1面通过', dataIndex: 'first_pass', key: 'first_pass', width: 72, align: 'center' as const },
    { title: '2面通过', dataIndex: 'second_pass', key: 'second_pass', width: 72, align: 'center' as const },
    { title: '3面通过', dataIndex: 'third_pass', key: 'third_pass', width: 72, align: 'center' as const },
    { title: '通过率', dataIndex: 'pass_rate', key: 'pass_rate', width: 72, align: 'center' as const },
    { title: 'Offer', dataIndex: 'offers', key: 'offers', width: 64, align: 'center' as const },
    { title: '入职', dataIndex: 'hired', key: 'hired', width: 60, align: 'center' as const },
    {
      title: '备注', dataIndex: 'notes', key: 'notes', width: 140,
      render: (v: string) => v
        ? <Tooltip title={v}><Text type="secondary" ellipsis style={{ fontSize: 12, maxWidth: 120 }}>{v}</Text></Tooltip>
        : <Text type="secondary" style={{ fontSize: 12 }}>-</Text>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' as const,
      render: (s: string) => {
        const mapped = statusTagMap[s];
        return mapped ? <Tag color={mapped.color}>{mapped.label}</Tag> : <Tag>{s}</Tag>;
      },
    },
  ], []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="加载看板数据..." />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="dash-bg-orbs">
        <div className="dash-orb dash-orb-1" />
        <div className="dash-orb dash-orb-2" />
        <div className="dash-orb dash-orb-3" />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ---- 头部 ---- */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 24, padding: '0 4px',
        }}>
          <div className="dash-enter-left">
            <Title level={4} style={{ margin: 0, fontWeight: 700, letterSpacing: '0.3px' }}>
              天鹅到家 · 招聘管理仪表盘
            </Title>
            <Text type="secondary" style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              数据截止：{formatTime(overviewData?.last_updated)}
            </Text>
          </div>
          <Space className="dash-enter-right">
            <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => fetchData(false)}
              style={{ borderRadius: 10 }}
            >
              刷新
            </Button>
          </Space>
        </div>

        {/* ===== 模块指标卡片网格（9 宫格，按菜单模块） ===== */}
        <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>
          {MODULE_DEFS.map((def, idx) => {
            const stat = moduleMap[def.key];
            const count = stat?.count ?? 0;
            const sub = stat?.sub ?? '';
            return (
              <Col xs={12} sm={8} lg={6} xl={Math.floor(24 / MODULE_DEFS.length)} key={def.key}>
                <div
                  className="dash-enter-fade dash-tilt"
                  style={{
                    animationDelay: `${idx * 0.06}s`,
                    cursor: 'pointer',
                    borderRadius: 16,
                    padding: '16px 14px',
                    background: 'rgba(255,255,255,0.78)',
                    backdropFilter: 'blur(12px) saturate(1.3)',
                    WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
                    border: '1px solid rgba(226,232,240,0.5)',
                    transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1), box-shadow 0.3s cubic-bezier(0.32,0.72,0,1)',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                  onClick={() => { if (def.link) window.location.href = def.link; }}
                >
                  {/* 图标 */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${def.color}12`,
                    color: def.color,
                    fontSize: 22,
                    flexShrink: 0,
                  }}>
                    {def.icon}
                  </div>
                  {/* 文字 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 13, color: '#64748B', display: 'block', lineHeight: 1.3 }}>
                      {def.label}
                    </Text>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#0F172A', lineHeight: 1.2, marginTop: 2 }}>
                      <span className="dash-num">{count}</span>
                    </div>
                    {sub && (
                      <Text style={{ fontSize: 11, color: '#94A3B8', display: 'block', lineHeight: 1.2, marginTop: 2 }}>
                        {sub}
                      </Text>
                    )}
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>

        {/* ---- 总体概览横条（保留原样） ---- */}
        <div className="dash-glass dash-enter-up" style={{
          borderRadius: 14, padding: '14px 20px', marginBottom: 20,
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 28px',
        }}>
          <Text strong style={{ fontSize: 14, whiteSpace: 'nowrap' }}>总体概览</Text>
          {KPI_DEFS.map((def, idx) => {
            const val = kpiValues[def.key];
            const isRate = def.key.includes('rate');
            const displayVal = isRate && typeof val === 'number' ? `${val}%` : val;
            return (
              <div key={def.key} className="dash-enter-fade"
                style={{ animationDelay: `${idx * 0.05}s`, display: 'flex', alignItems: 'baseline', gap: 4, whiteSpace: 'nowrap' }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>{def.label}</Text>
                <span className={`dash-num ${def.glow}`}
                  style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}
                >
                  {displayVal}
                </span>
              </div>
            );
          })}
        </div>

        {/* ---- 漏斗 + 事业部 ---- */}
        <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
          <Col xs={24} lg={8}>
            <div className="dash-glass dash-enter-up dash-delay-1"
              style={{ borderRadius: 16, padding: '20px 20px 16px', height: '100%' }}
            >
              <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 16 }}>
                招聘漏斗（全事业部汇总）
              </Text>
              {funnelStages.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {funnelStages.map((stage, idx) => {
                    const firstCount = funnelStages[0]?.count || 1;
                    const relPct = Math.round((stage.count / firstCount) * 100);
                    const barPct = maxFunnelCount > 0 ? Math.round((stage.count / maxFunnelCount) * 100) : 0;
                    return (
                      <div key={stage.name} className="dash-enter-fade" style={{ animationDelay: `${idx * 0.1}s` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                          <span style={{ fontWeight: 500 }}>{stage.name}</span>
                          <Text strong className="dash-num" style={{ color: funnelColors[idx] }}>
                            {stage.count}（{relPct}%）
                          </Text>
                        </div>
                        <div className="dash-funnel-bar" style={{
                          height: 10, background: '#F1F5F9', borderRadius: 6, overflow: 'hidden',
                          animationDelay: `${idx * 0.15}s`,
                        }}>
                          <div style={{
                            width: `${barPct}%`, height: '100%',
                            background: `linear-gradient(90deg, ${funnelColors[idx]}, ${funnelColors[idx]}dd)`,
                            borderRadius: 6, boxShadow: `0 0 8px ${funnelColors[idx]}44`,
                          }} />
                        </div>
                      </div>
                    );
                  })}
                  {funnelStages.length >= 2 && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: '#F8FAFC', borderRadius: 8, fontSize: 12 }}>
                      <Text type="secondary">
                        推送→面试转化率：
                        <Text strong style={{ color: '#3B82F6' }}>{overviewData?.push_conversion_rate ?? 0}%</Text>
                        {' | '}面试通过率：
                        <Text strong style={{ color: '#8B5CF6' }}>{overviewData?.interview_pass_rate ?? 0}%</Text>
                      </Text>
                    </div>
                  )}
                </div>
              ) : (
                <Text type="secondary">暂无数据</Text>
              )}
            </div>
          </Col>

          <Col xs={24} lg={16}>
            <div className="dash-glass dash-enter-up dash-delay-2"
              style={{ borderRadius: 16, padding: '20px 20px 16px', height: '100%' }}
            >
              <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 16 }}>
                事业部分部看板
              </Text>
              {divisions.length ? (
                <Row gutter={[14, 14]}>
                  {divisions.map((div, idx) => (
                    <Col xs={24} sm={12} key={idx}>
                      <div className="dash-tilt" style={{
                        padding: 18, background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                        borderRadius: 12, border: '1px solid #F1F5F9', height: '100%',
                      }}>
                        <div style={{ marginBottom: 10 }}>
                          <Text strong style={{ fontSize: 15 }}>{div.name}</Text>
                          {div.hrbp && <><br /><Text type="secondary" style={{ fontSize: 12 }}>HRBP：{div.hrbp}</Text></>}
                        </div>
                        <Row gutter={[8, 8]}>
                          {[
                            { label: '在招岗位', value: div.active_positions, color: '#3B82F6' },
                            { label: '在招人数', value: div.total_headcount, color: '#10B981' },
                            { label: '简历推送', value: div.total_resumes, color: '#6366F1' },
                          ].map((item, i) => (
                            <Col span={8} key={i} style={{ textAlign: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{item.label}</Text>
                              <div className="dash-num" style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</div>
                            </Col>
                          ))}
                        </Row>
                      </div>
                    </Col>
                  ))}
                </Row>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <Text type="secondary" style={{ fontSize: 14 }}>暂无事业部数据</Text>
                </div>
              )}
            </div>
          </Col>
        </Row>

        {/* ---- 全量岗位明细 ---- */}
        <div className="dash-chart-enter">
          <div className="dash-glass" style={{ borderRadius: 16, padding: '20px', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text strong style={{ fontSize: 14 }}>全量岗位明细汇总</Text>
              <Button size="small" icon={<SyncOutlined />} loading={refreshing} onClick={() => fetchData(false)}
                style={{ borderRadius: 8 }}
              >
                刷新
              </Button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <Space wrap size={[8, 8]}>
                <Input placeholder="搜索职位/事业部..." prefix={<SearchOutlined />}
                  value={searchPosition} onChange={e => setSearchPosition(e.target.value)}
                  style={{ width: 200, borderRadius: 8 }} allowClear
                />
                <Select placeholder="筛选事业部" value={filterDivision}
                  onChange={v => setFilterDivision(v)} allowClear
                  style={{ width: 160, borderRadius: 8 }}
                  options={divisionOptions.map(d => ({ label: d, value: d }))}
                />
                <Select placeholder="筛选状态" value={filterStatus}
                  onChange={v => setFilterStatus(v)} allowClear
                  style={{ width: 140, borderRadius: 8 }}
                  options={statusOptions.map(s => ({ label: s, value: s }))}
                />
                {(filterDivision || filterStatus || searchPosition) && (
                  <Button size="small" icon={<ClearOutlined />}
                    onClick={() => { setFilterDivision(undefined); setFilterStatus(undefined); setSearchPosition(''); }}
                    style={{ borderRadius: 8 }}
                  >
                    清除筛选
                  </Button>
                )}
                <Text type="secondary" className="dash-num" style={{ fontSize: 12 }}>
                  {filteredPositions.length !== positions.length
                    ? `筛选出 ${filteredPositions.length} / 共 ${positions.length} 条`
                    : `共 ${positions.length} 条`}
                </Text>
              </Space>
            </div>

            <div className="dash-table-stagger">
              <Table
                dataSource={filteredPositions}
                columns={positionColumns}
                rowKey={(_, idx) => String(idx)}
                size="small"
                pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条`, showSizeChanger: false }}
                scroll={{ x: 1400 }}
                locale={{ emptyText: '暂无岗位数据' }}
                rowClassName={() => 'dash-num'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
