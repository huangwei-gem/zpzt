import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Button, Space, Tag, Modal, Input, Select, message,
  Typography, Row, Col, Spin, Empty, Statistic, Badge, Tooltip,
  Avatar, Divider, Progress
} from 'antd';
import {
  ThunderboltOutlined, LoadingOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, UserOutlined, PlusOutlined,
  FileTextOutlined, SearchOutlined, RobotOutlined, ClockCircleOutlined,
  BellOutlined
} from '@ant-design/icons';
import request from '../../utils/request';

// 安全取值：兼容字段可能是对象或标量
function safeStr(v: any, fallback: string = ''): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') return v.overall || v.recommend || v.text || JSON.stringify(v);
  return String(v);
}
function safeScore(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v) return v.score || 0;
  return 0;
}
function safeAiResultKey(v: any): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v) return v.recommend || v.level || 'pending';
  return 'pending';
}

const statusConfig: Record<string, { color: string; text: string; bg: string }> = {
  pending: { color: 'processing', text: '待审核', bg: '#E0F2FE' },
  approved: { color: 'success', text: '已入库', bg: '#DCFCE7' },
  rejected: { color: 'error', text: '已淘汰', bg: '#FEE2E2' },
};

const aiResultConfig: Record<string, { color: string; text: string }> = {
  '通过': { color: 'success', text: '通过' },
  '不通过': { color: 'error', text: '不通过' },
  '待定': { color: 'warning', text: '待定' },
  'pending': { color: 'default', text: '未分析' },
  'shortlisted': { color: 'success', text: '已入库' },
  'rejected': { color: 'error', text: '已淘汰' },
};

const ResumeScreeningList: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [resumes, setResumes] = useState<any[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState<string | undefined>();
  const [detailModal, setDetailModal] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      const res = await request.get('/resume-screening', { params });
      setData(res || []);
      const s = { total: (res || []).length, pending: 0, approved: 0, rejected: 0 };
      (res || []).forEach((r: any) => {
        if (r.status === 'pending') s.pending++;
        else if (r.status === 'approved') s.approved++;
        else if (r.status === 'rejected') s.rejected++;
      });
      setStats(s);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus]);

  const fetchResumes = useCallback(async () => {
    try {
      const res = await request.get('/resumes', { params: { pageSize: 500 } });
      setResumes(res || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchResumes(); }, [fetchResumes]);

  const handleAIAnalyze = async (id: string) => {
    setAiLoading(id);
    try {
      const res = await request.post(`/resume-screening/${id}/ai-analyze`) as any;
      if (res && !res.detail) {
        message.success('AI分析完成');
        fetchData();
      } else {
        message.error(res?.detail || 'AI分析失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'AI分析失败');
    } finally {
      setAiLoading(null);
    }
  };

  const handleApprove = async (id: string, name: string) => {
    setActionLoading(id);
    try {
      const res = await request.post(`/resume-screening/${id}/approve`) as any;
      if (res && !res.detail) {
        message.success(`${name} 已入库到人才库`);
        fetchData();
      } else {
        message.error(res?.detail || '操作失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.detail || '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string, name: string) => {
    setActionLoading(id);
    try {
      const res = await request.post(`/resume-screening/${id}/reject`) as any;
      if (res && !res.detail) {
        message.success(`${name} 已淘汰`);
        fetchData();
      } else {
        message.error(res?.detail || '操作失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.detail || '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleNotifyInterviewers = async (id: string, name: string) => {
    setActionLoading(id);
    try {
      const res = await request.post(`/resume-screening/${id}/notify-interviewers`) as any;
      if (res?.ok) {
        message.success(`✅ 已通知面试官: ${name}`);
      } else {
        message.error(res?.detail || '通知失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.detail || '通知失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBatchAnalyze = async () => {
    setBatchAnalyzing(true);
    try {
      const res = await request.post('/resume-screening/batch-analyze') as any;
      if (res && !res.detail) {
        message.success(`批量分析完成: ${res.processed}/${res.total}`);
        fetchData();
      } else {
        message.error(res?.detail || '批量分析失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.detail || '批量分析失败');
    } finally {
      setBatchAnalyzing(false);
    }
  };

  const handleAddFromResume = async () => {
    if (!selectedResumeId) {
      message.warning('请选择一份简历');
      return;
    }
    try {
      const res = await request.post(`/resume-screening/from-resume/${selectedResumeId}`) as any;
      if (res && !res.detail) {
        message.success('已加入初筛队列');
        setAddModalVisible(false);
        setSelectedResumeId(undefined);
        fetchData();
      } else {
        message.error(res?.detail || '添加失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.detail || '添加失败');
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 4) return '#52c41a';
    if (score >= 3) return '#faad14';
    return '#ff4d4f';
  };

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="初筛总数" value={stats.total} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待审核" value={stats.pending} valueStyle={{ color: '#1677ff' }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已入库" value={stats.approved} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已淘汰" value={stats.rejected} valueStyle={{ color: '#ff4d4f' }} prefix={<CloseCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card
        title="简历初筛队列"
        extra={
          <Space>
            <Input
              placeholder="搜索候选人/岗位"
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
            <Select
              placeholder="状态筛选"
              value={filterStatus}
              onChange={setFilterStatus}
              allowClear
              style={{ width: 120 }}
              options={[
                { value: 'pending', label: '待审核' },
                { value: 'approved', label: '已入库' },
                { value: 'rejected', label: '已淘汰' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>添加简历</Button>
            <Button
              type="primary"
              ghost
              icon={batchAnalyzing ? <LoadingOutlined /> : <ThunderboltOutlined />}
              onClick={handleBatchAnalyze}
              loading={batchAnalyzing}
              disabled={stats.pending === 0}
            >
              批量AI分析
            </Button>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : data.length === 0 ? (
          <Empty description="暂无初筛记录" />
        ) : (
          <Row gutter={[16, 16]}>
            {data.map((item: any) => {
              const sc = statusConfig[item.status] || statusConfig.pending;
              const arc = aiResultConfig[safeAiResultKey(item.ai_result)] || aiResultConfig.pending;
              const isPending = item.status === 'pending';
              const ms = safeScore(item.match_score);
              return (
                <Col key={item.id} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    hoverable
                    style={{
                      borderColor: isPending ? '#91caff' : undefined,
                      borderWidth: isPending ? 2 : 1,
                    }}
                    onClick={() => setDetailModal(item)}
                    title={
                      <Space>
                        <Avatar size="small" style={{ backgroundColor: isPending ? '#1677ff' : sc.color === 'success' ? '#52c41a' : '#ff4d4f' }}>
                          {item.candidate_name?.[0] || '?'}
                        </Avatar>
                        <Typography.Text strong>{item.candidate_name}</Typography.Text>
                      </Space>
                    }
                    extra={<Tag color={sc.color}>{sc.text}</Tag>}
                    actions={isPending ? [
                      <Tooltip title="AI分析" key="ai">
                        <Button
                          type="text"
                          icon={aiLoading === item.id ? <LoadingOutlined /> : <ThunderboltOutlined />}
                          onClick={(e) => { e.stopPropagation(); handleAIAnalyze(item.id); }}
                          loading={aiLoading === item.id}
                        />
                      </Tooltip>,
                      <Tooltip title="入库" key="approve">
                        <Button
                          type="text"
                          icon={actionLoading === item.id ? <LoadingOutlined /> : <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                          onClick={(e) => { e.stopPropagation(); handleApprove(item.id, item.candidate_name); }}
                          loading={actionLoading === item.id}
                        />
                      </Tooltip>,
                      <Tooltip title="淘汰" key="reject">
                        <Button
                          type="text"
                          icon={actionLoading === item.id ? <LoadingOutlined /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                          onClick={(e) => { e.stopPropagation(); handleReject(item.id, item.candidate_name); }}
                          loading={actionLoading === item.id}
                        />
                      </Tooltip>,
                    ] : item.status === 'approved' ? [
                      <Tooltip title="通知面试官" key="notify">
                        <Button
                          type="text"
                          icon={actionLoading === item.id ? <LoadingOutlined /> : <BellOutlined />}
                          onClick={(e) => { e.stopPropagation(); handleNotifyInterviewers(item.id, item.candidate_name); }}
                          loading={actionLoading === item.id}
                        />
                      </Tooltip>,
                    ] : undefined}
                  >
                    <div style={{ minHeight: 120 }}>
                      <div style={{ marginBottom: 8 }}>
                        <Tag icon={<RobotOutlined />} color={arc.color}>{arc.text}</Tag>
                        {ms > 0 && (
                          <Tag color={scoreColor(ms)}>
                            匹配度: {ms}/5
                          </Tag>
                        )}
                      </div>
                      {item.position_applied && (
                        <div style={{ marginBottom: 4 }}>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>申请岗位: </Typography.Text>
                          <Typography.Text style={{ fontSize: 12 }}>{item.position_applied}</Typography.Text>
                        </div>
                      )}
                      {item.mapped_position && (
                        <div style={{ marginBottom: 4 }}>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>映射岗位: </Typography.Text>
                          <Typography.Text style={{ fontSize: 12 }}>{item.mapped_position}</Typography.Text>
                        </div>
                      )}
                      <div style={{ marginBottom: 4 }}>
                        {(item.age || item.gender || item.education) && (
                          <Space size={4}>
                            {item.age && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.age}岁</Typography.Text>}
                            {item.gender && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.gender}</Typography.Text>}
                            {item.education && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.education}</Typography.Text>}
                          </Space>
                        )}
                      </div>
                      {item.ai_analysis && (
                        <Typography.Paragraph
                          ellipsis={{ rows: 3 }}
                          style={{ fontSize: 12, color: '#666', marginTop: 8, marginBottom: 0 }}
                        >
                          {safeStr(item.ai_analysis)}
                        </Typography.Paragraph>
                      )}
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Card>

      <Modal
        title="添加简历到初筛队列"
        open={addModalVisible}
        onOk={handleAddFromResume}
        onCancel={() => setAddModalVisible(false)}
        width={500}
      >
        <Select
          placeholder="选择简历"
          value={selectedResumeId}
          onChange={setSelectedResumeId}
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          options={resumes.map((r: any) => ({
            value: r.id,
            label: `${r.candidate_name} - ${r.position_title || r.target_position || '未知岗位'}`,
          }))}
        />
      </Modal>

      <Modal
        title={detailModal ? `候选人 ${detailModal.candidate_name}` : ''}
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={detailModal?.status === 'pending' ? [
          <Button key="reject" danger icon={<CloseCircleOutlined />}
            onClick={() => { handleReject(detailModal.id, detailModal.candidate_name); setDetailModal(null); }}>
            淘汰
          </Button>,
          <Button key="approve" type="primary" icon={<CheckCircleOutlined />}
            onClick={() => { handleApprove(detailModal.id, detailModal.candidate_name); setDetailModal(null); }}>
            入库
          </Button>,
        ] : detailModal?.status === 'approved' ? [
          <Button key="notify" type="primary" icon={<BellOutlined />}
            onClick={() => { handleNotifyInterviewers(detailModal.id, detailModal.candidate_name); }}>
            通知面试官
          </Button>,
        ] : undefined}
        width={700}
      >
        {detailModal && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <Typography.Text type="secondary">申请岗位: </Typography.Text>
                <Typography.Text>{detailModal.position_applied || '无'}</Typography.Text>
              </Col>
              <Col span={12}>
                <Typography.Text type="secondary">映射岗位: </Typography.Text>
                <Typography.Text>{detailModal.mapped_position || '无'}</Typography.Text>
              </Col>
            </Row>
            <Divider />
            <Row gutter={16}>
              <Col span={8}>
                <Typography.Text type="secondary">年龄: </Typography.Text><Typography.Text>{detailModal.age || '未知'}</Typography.Text>
              </Col>
              <Col span={8}>
                <Typography.Text type="secondary">性别: </Typography.Text><Typography.Text>{detailModal.gender || '未知'}</Typography.Text>
              </Col>
              <Col span={8}>
                <Typography.Text type="secondary">学历: </Typography.Text><Typography.Text>{detailModal.education || '未知'}</Typography.Text>
              </Col>
            </Row>
            <Divider />
            <div style={{ marginBottom: 8 }}>
              <Space>
                <Tag color={aiResultConfig[safeAiResultKey(detailModal.ai_result)]?.color}>AI结果: {aiResultConfig[safeAiResultKey(detailModal.ai_result)]?.text}</Tag>
                {safeScore(detailModal.match_score) > 0 && (
                  <Tag color={scoreColor(safeScore(detailModal.match_score))}>匹配度: {safeScore(detailModal.match_score)}/5</Tag>
                )}
              </Space>
            </div>
            {detailModal.ai_analysis ? (
              <pre style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: '#f5f5f5',
                padding: 16,
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.6,
                maxHeight: 400,
                overflowY: 'auto',
              }}>
                {safeStr(detailModal.ai_analysis)}
              </pre>
            ) : (
              <Empty description="暂无AI分析" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                {detailModal.status === 'pending' && (
                  <Button type="primary" icon={<ThunderboltOutlined />}
                    onClick={() => { handleAIAnalyze(detailModal.id); }}>
                    开始AI分析
                  </Button>
                )}
              </Empty>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ResumeScreeningList;
