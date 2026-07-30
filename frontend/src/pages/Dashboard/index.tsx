import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Card, Row, Col, Typography, Spin, message, Table, Tag, Space, Button, Input, Select, Tooltip } from 'antd';
import {
  SyncOutlined, ReloadOutlined, SearchOutlined, ClearOutlined,
  TeamOutlined, UserOutlined, FileTextOutlined, ScheduleOutlined,
  RiseOutlined, CheckCircleOutlined, GiftOutlined, PercentageOutlined,
  HomeOutlined, ClockCircleOutlined, ThunderboltOutlined,
  FileProtectOutlined, ToolOutlined,
  AuditOutlined, SafetyOutlined, MailOutlined,
  BookOutlined, BarChartOutlined, ExperimentOutlined, ArrowUpOutlined, ArrowDownOutlined,
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
  id?: number;
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

/* ==================== 菜单模块指标卡片 ==================== */
const MODULE_DEFS: { key: string; label: string; icon: React.ReactNode; color: string; link?: string }[] = [
  { key: 'requisitions',    label: '需求管理',    icon: <FileProtectOutlined />,  color: '#3B82F6', link: '/requisitions' },
  { key: 'positions',       label: '岗位管理',    icon: <ToolOutlined />,         color: '#10B981', link: '/positions' },
  { key: 'resumes',         label: '简历管理',    icon: <FileTextOutlined />,     color: '#F59E0B', link: '/resumes' },
  { key: 'interviews',      label: '面试管理',    icon: <ScheduleOutlined />,    color: '#EC4899', link: '/interviews' },
  { key: 'onboarding',      label: '入职管理',    icon: <HomeOutlined />,         color: '#06B6D4', link: '/onboarding' },
  { key: 'probation',       label: '试用期管理',  icon: <SafetyOutlined />,      color: '#84CC16', link: '/probation' },
  { key: 'reports',         label: '招聘日报',    icon: <BarChartOutlined />,    color: '#6366F1', link: '/daily-report' },
  { key: 'users',           label: '用户管理',    icon: <TeamOutlined />,         color: '#F97316', link: '/users' },
];

/* ==================== 核心指标卡片 ==================== */
const CORE_KPI_DEFS = [
  { key: 'active_positions', label: '在招岗位', icon: <TeamOutlined />, color: '#3B82F6', format: (v: number) => `${v}` },
  { key: 'total_headcount', label: '在招人数', icon: <UserOutlined />, color: '#10B981', format: (v: number) => `${v}` },
  { key: 'total_resumes', label: '简历推送', icon: <FileTextOutlined />, color: '#6366F1', format: (v: number) => `${v}` },
  { key: 'scheduled_interviews', label: '安排面试', icon: <ScheduleOutlined />, color: '#EC4899', format: (v: number) => `${v}` },
  { key: 'offers', label: '发放Offer', icon: <GiftOutlined />, color: '#F59E0B', format: (v: number) => `${v}` },
  { key: 'hired', label: '已入职', icon: <HomeOutlined />, color: '#06B6D4', format: (v: number) => `${v}` },
  { key: 'pending_onboarding', label: '待入职', icon: <ClockCircleOutlined />, color: '#84CC16', format: (v: number) => `${v}` },
  { key: 'push_conversion_rate', label: '推送→面试', icon: <RiseOutlined />, color: '#F97316', format: (v: number) => `${v}%` },
  { key: 'interview_pass_rate', label: '面试通过率', icon: <CheckCircleOutlined />, color: '#8B5CF6', format: (v: number) => `${v}%` },
  { key: 'offer_conversion_rate', label: 'Offer转化率', icon: <PercentageOutlined />, color: '#EC4899', format: (v: number) => `${v}%` },
  { key: 'hire_conversion_rate', label: '入职转化率', icon: <ThunderboltOutlined />, color: '#3B82F6', format: (v: number) => `${v}%` },
] as const;

/* ==================== 动效数字组件 ==================== */
function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const from = startRef.current;
    const to = value;
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // spring-like easing: easeOutBack
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const eased = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) ref.current = requestAnimationFrame(step);
      else { startRef.current = to; }
    };
    ref.current = requestAnimationFrame(step);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [value, duration]);

  return <>{display}</>;
}

/* ==================== 工具函数 ==================== */
function getKpiValue(od: OverviewData | undefined, key: string): number | string {
  if (!od) return 0;
  const v = (od as any)[key];
  return v !== undefined && v !== null ? v : 0;
}

function formatTime(iso: string | undefined) {
  if (!iso) return '加载中';
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
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

/* ==================== 骨架屏 Skeleton ==================== */
function DashboardSkeleton() {
  return (
    <div style={{ padding: '24px 0' }}>
      {/* 模块卡片骨架 */}
      <div className="dash-grid-modules" style={{ marginBottom: 20 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div className="dash-skeleton-card" key={i} />
        ))}
      </div>
      {/* 核心指标骨架 */}
      <div className="dash-grid-kpis" style={{ marginBottom: 20 }}>
        {Array.from({ length: 11 }).map((_, i) => (
          <div className="dash-skeleton-mini" key={i} />
        ))}
      </div>
      {/* 两列骨架 */}
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={8}><div className="dash-skeleton-block" style={{ height: 280 }} /></Col>
        <Col xs={24} lg={16}><div className="dash-skeleton-block" style={{ height: 280 }} /></Col>
      </Row>
    </div>
  );
}

/* ==================== 主组件 ==================== */
const Dashboard: React.FC = () => {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [positions, setPositions] = useState<PositionDetail[]>([]);
  const [moduleStats, setModuleStats] = useState<ModuleStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filterDivision, setFilterDivision] = useState<string | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [searchPosition, setSearchPosition] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState<string>(() => sessionStorage.getItem('responsible_person') || '');

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    try {
      const person = sessionStorage.getItem('responsible_person') || '';
      const params = person ? { responsible_person: person } : {};
      const [overviewRes, positionsRes, moduleRes] = await Promise.all([
        request.get('/dashboard/overview', { params }),
        request.get('/dashboard/positions-detail', { params }),
        request.get('/dashboard/module-stats', { params }),
      ]);
      setOverview(overviewRes);
      setPositions(positionsRes);
      setModuleStats(moduleRes?.modules || []);
    } catch (e: any) {
      console.error('Dashboard error:', e);
      message.error('获取看板数据失败: ' + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 监听全局负责人筛选变化后重新加载仪表盘数据
  useEffect(() => {
    const checkPerson = () => {
      const newPerson = sessionStorage.getItem('responsible_person') || '';
      if (newPerson !== responsiblePerson) {
        setResponsiblePerson(newPerson);
        fetchData(false);
      }
    };
    // 轮询检查（无 storage 事件时兜底）
    const timer = setInterval(checkPerson, 2000);
    // storage 事件（跨标签页）
    window.addEventListener('storage', checkPerson);
    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', checkPerson);
    };
  }, [responsiblePerson, fetchData]);

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

  const moduleMap = useMemo(() => {
    const map: Record<string, ModuleStat> = {};
    moduleStats.forEach(m => { map[m.key] = m; });
    return map;
  }, [moduleStats]);

  const positionColumns = useMemo(() => [
    { title: '事业部', dataIndex: 'division', key: 'division', width: 130 },
    { title: 'HRBP', dataIndex: 'hrbp', key: 'hrbp', width: 70 },
    { title: '在招职位', dataIndex: 'position', key: 'position', width: 180 },
    { title: '在招人数', dataIndex: 'headcount', key: 'headcount', width: 70, align: 'center' as const },
    { title: '简历推动', dataIndex: 'total_resumes', key: 'total_resumes', width: 70, align: 'center' as const },
    { title: '1面', dataIndex: 'first_interview', key: 'first_interview', width: 50, align: 'center' as const },
    { title: '1面通过', dataIndex: 'first_pass', key: 'first_pass', width: 62, align: 'center' as const },
    { title: '2面通过', dataIndex: 'second_pass', key: 'second_pass', width: 62, align: 'center' as const },
    { title: '3面通过', dataIndex: 'third_pass', key: 'third_pass', width: 62, align: 'center' as const },
    { title: '通过率', dataIndex: 'pass_rate', key: 'pass_rate', width: 62, align: 'center' as const },
    { title: 'Offer', dataIndex: 'offers', key: 'offers', width: 55, align: 'center' as const },
    { title: '入职', dataIndex: 'hired', key: 'hired', width: 55, align: 'center' as const },
    {
      title: '备注', dataIndex: 'notes', key: 'notes', width: 120,
      render: (v: string) => v
        ? <Tooltip title={v}><Text type="secondary" ellipsis style={{ fontSize: 12, maxWidth: 100 }}>{v}</Text></Tooltip>
        : <Text type="secondary" style={{ fontSize: 12 }}>-</Text>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 70, align: 'center' as const,
      render: (s: string) => {
        const mapped = statusTagMap[s];
        return mapped ? <Tag color={mapped.color}>{mapped.label}</Tag> : <Tag>{s}</Tag>;
      },
    },
  ], []);

  if (loading) {
    return (
      <div className="dash-page">
        <div className="dash-header">
          <div>
            <h2 className="dash-title">仪表盘</h2>
            <Text type="secondary" style={{ fontSize: 13 }}>招聘数据总览</Text>
          </div>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  const allZero = !overviewData || (
    (overviewData as any).active_positions === 0 &&
    (overviewData as any).total_resumes === 0
  );

  /* ====== 空态 ====== */
  if (allZero) {
    return (
      <div className="dash-page">
        <div className="dash-header">
          <div>
            <h2 className="dash-title">仪表盘</h2>
            <Text type="secondary" style={{ fontSize: 13 }}>招聘数据总览</Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()} style={{ borderRadius: 10 }}>刷新</Button>
        </div>
        <div className="dash-empty">
          <div className="dash-empty-icon">📊</div>
          <h3>还没有招聘数据</h3>
          <Text type="secondary">同步飞书数据或录入岗位信息后，这里会展示招聘全貌</Text>
          <Button type="primary" style={{ marginTop: 16, borderRadius: 10, background: '#3B82F6' }}
            onClick={() => window.location.href = '/requisitions'}
          >
            去创建需求
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-page">
      {/* 背景光晕 */}
      <div className="dash-bg-glow" />

      {/* ---- 头部 ---- */}
      <div className="dash-header">
        <div className="dash-header-left">
          <h2 className="dash-title">仪表盘</h2>
          <span className="dash-updated">数据截止 · {formatTime(overviewData?.last_updated)}</span>
        </div>
        <Button
          icon={<ReloadOutlined />}
          loading={refreshing}
          onClick={() => fetchData(false)}
          className="dash-btn-secondary"
        >
          刷新
        </Button>
      </div>

      {/* ==================== 第一部分：模块入口卡片 ==================== */}
      <section className="dash-section">
        <div className="dash-grid-modules">
          {MODULE_DEFS.map((def, idx) => {
            const stat = moduleMap[def.key];
            const count = stat?.count ?? 0;
            const sub = stat?.sub ?? '';
            return (
              <div
                key={def.key}
                className="dash-module-card"
                style={{
                  '--card-color': def.color,
                  animationDelay: `${idx * 0.05}s`,
                } as React.CSSProperties}
                onClick={() => { if (def.link) window.location.href = def.link; }}
              >
                <div className="dash-module-icon" style={{ background: `${def.color}14`, color: def.color }}>
                  {def.icon}
                </div>
                <div className="dash-module-info">
                  <span className="dash-module-label">{def.label}</span>
                  <span className="dash-module-count">
                    <AnimatedNumber value={count} />
                  </span>
                  {sub && <span className="dash-module-sub">{sub}</span>}
                </div>
                {/* 悬浮时的指示光效 */}
                <div className="dash-module-glow" style={{ background: `${def.color}22` }} />
              </div>
            );
          })}
        </div>
      </section>

      {/* ==================== 第二部分：核心指标卡片组 ==================== */}
      <section className="dash-section">
        <div className="dash-grid-kpis">
          {CORE_KPI_DEFS.map((def, idx) => {
            const val = Number(getKpiValue(overviewData, def.key));
            const isRate = def.key.includes('rate');
            return (
              <div
                key={def.key}
                className="dash-kpi-card"
                style={{
                  '--kpi-color': def.color,
                  animationDelay: `${idx * 0.04}s`,
                } as React.CSSProperties}
              >
                <div className="dash-kpi-icon" style={{ color: def.color }}>
                  {def.icon}
                </div>
                <div className="dash-kpi-value">
                  {isRate
                    ? <span className="dash-kpi-num">{val}%</span>
                    : <span className="dash-kpi-num"><AnimatedNumber value={val} /></span>
                  }
                </div>
                <div className="dash-kpi-label">{def.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ==================== 第三部分：漏斗 + 事业部看板 ==================== */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        {/* 漏斗 */}
        <Col xs={24} lg={8}>
          <div className="dash-panel">
            <div className="dash-panel-header">
              <span className="dash-panel-title">招聘漏斗</span>
              <span className="dash-panel-badge">全事业部</span>
            </div>
            {funnelStages.length ? (
              <div className="dash-funnel">
                {funnelStages.map((stage, idx) => {
                  const firstCount = funnelStages[0]?.count || 1;
                  const relPct = Math.round((stage.count / firstCount) * 100);
                  const barPct = maxFunnelCount > 0 ? Math.round((stage.count / maxFunnelCount) * 100) : 0;
                  return (
                    <div key={stage.name} className="dash-funnel-row" style={{ animationDelay: `${idx * 0.08}s` }}>
                      <div className="dash-funnel-label">
                        <span>{stage.name}</span>
                        <span className="dash-funnel-num">{stage.count} ({relPct}%)</span>
                      </div>
                      <div className="dash-funnel-bar-track">
                        <div
                          className="dash-funnel-bar-fill"
                          style={{
                            width: `${barPct}%`,
                            background: `linear-gradient(90deg, ${funnelColors[idx]}, ${funnelColors[idx]}dd)`,
                            boxShadow: `0 0 12px ${funnelColors[idx]}55`,
                            animationDelay: `${0.2 + idx * 0.1}s`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="dash-funnel-summary">
                  <span>推送→面试 <strong>{overviewData?.push_conversion_rate ?? 0}%</strong></span>
                  <span>面试通过率 <strong>{overviewData?.interview_pass_rate ?? 0}%</strong></span>
                  <span>Offer转化 <strong>{overviewData?.offer_conversion_rate ?? 0}%</strong></span>
                </div>
              </div>
            ) : (
              <div className="dash-panel-empty">暂无数据</div>
            )}
          </div>
        </Col>

        {/* 事业部看板 */}
        <Col xs={24} lg={16}>
          <div className="dash-panel">
            <div className="dash-panel-header">
              <span className="dash-panel-title">事业部分部</span>
              <span className="dash-panel-badge">{divisions.length} 个事业部</span>
            </div>
            {divisions.length ? (
              <Row gutter={[12, 12]}>
                {divisions.map((div, idx) => {
                  const divColors = ['#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4'];
                  const ac = divColors[idx % divColors.length];
                  return (
                    <Col xs={24} sm={12} key={idx}>
                      <div className="dash-div-card" style={{ animationDelay: `${idx * 0.06}s` }}>
                        <div className="dash-div-header">
                          <div className="dash-div-dot" style={{ background: ac }} />
                          <div>
                            <div className="dash-div-name">{div.name}</div>
                            {div.hrbp && <div className="dash-div-hrbp">HRBP：{div.hrbp}</div>}
                          </div>
                        </div>
                        <div className="dash-div-metrics">
                          <div className="dash-div-metric">
                            <span className="dash-div-m-val" style={{ color: ac }}>
                              <AnimatedNumber value={div.active_positions} />
                            </span>
                            <span className="dash-div-m-label">在招岗位</span>
                          </div>
                          <div className="dash-div-metric">
                            <span className="dash-div-m-val" style={{ color: '#10B981' }}>
                              <AnimatedNumber value={div.total_headcount} />
                            </span>
                            <span className="dash-div-m-label">在招人数</span>
                          </div>
                          <div className="dash-div-metric">
                            <span className="dash-div-m-val" style={{ color: '#6366F1' }}>
                              <AnimatedNumber value={div.total_resumes} />
                            </span>
                            <span className="dash-div-m-label">简历推送</span>
                          </div>
                          <div className="dash-div-metric">
                            <span className="dash-div-m-val" style={{ color: '#EC4899' }}>
                              <AnimatedNumber value={div.scheduled_interviews} />
                            </span>
                            <span className="dash-div-m-label">面试</span>
                          </div>
                        </div>
                      </div>
                    </Col>
                  );
                })}
              </Row>
            ) : (
              <div className="dash-panel-empty">暂无事业部数据</div>
            )}
          </div>
        </Col>
      </Row>

      {/* ==================== 第四部分：全量岗位明细 ==================== */}
      <section className="dash-section">
        <div className="dash-panel" style={{ marginBottom: 0 }}>
          <div className="dash-panel-header">
            <span className="dash-panel-title">岗位明细</span>
            <Space size={10}>
              <Input
                placeholder="搜索职位/事业部..."
                prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
                value={searchPosition}
                onChange={e => setSearchPosition(e.target.value)}
                className="dash-search-input"
                allowClear
              />
              <Select
                placeholder="事业部"
                value={filterDivision}
                onChange={v => setFilterDivision(v)}
                allowClear
                className="dash-select-mini"
                options={divisionOptions.map(d => ({ label: d, value: d }))}
              />
              <Select
                placeholder="状态"
                value={filterStatus}
                onChange={v => setFilterStatus(v)}
                allowClear
                className="dash-select-mini"
                options={statusOptions.map(s => ({ label: s, value: s }))}
              />
              {(filterDivision || filterStatus || searchPosition) && (
                <Button size="small" icon={<ClearOutlined />}
                  onClick={() => { setFilterDivision(undefined); setFilterStatus(undefined); setSearchPosition(''); }}
                  style={{ borderRadius: 8 }}
                />
              )}
              <Button size="small" icon={<SyncOutlined />} loading={refreshing}
                onClick={() => fetchData(false)} style={{ borderRadius: 8 }}
              />
              <span className="dash-total-badge">
                {filteredPositions.length !== positions.length
                  ? `筛选 ${filteredPositions.length} / ${positions.length}`
                  : `${positions.length} 条`}
              </span>
            </Space>
          </div>

          <Table
            dataSource={filteredPositions}
            columns={positionColumns}
            rowKey={(_, idx) => String(idx)}
            size="small"
            pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条`, showSizeChanger: false }}
            scroll={{ x: 1300 }}
            locale={{ emptyText: '暂无岗位数据' }}
            className="dash-table"
          />
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
