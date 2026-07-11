import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Button, Space, Tag, Modal, message, Typography,
  Row, Col, Spin, Empty, Statistic, Table, Divider, DatePicker
} from 'antd';
import {
  ThunderboltOutlined, LoadingOutlined, ReloadOutlined,
  DeleteOutlined, FileTextOutlined, BarChartOutlined,
  RobotOutlined, CalendarOutlined
} from '@ant-design/icons';
import request from '../../utils/request';
import dayjs from 'dayjs';

const { Text, Paragraph, Title } = Typography;

const DailyReportsList: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [detailModal, setDetailModal] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request.get('/daily-reports');
      setData(res || []);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await request.post('/daily-reports/generate', {
        report_date: selectedDate.format('YYYY-MM-DD'),
        report_type: 'progress',
      }) as any;
      if (res && !res.detail) {
        message.success('日报已生成');
        fetchData();
      } else {
        message.error(res?.detail || '生成失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.detail || '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await request.delete(`/daily-reports/${id}`);
      message.success('已删除');
      fetchData();
    } catch {
      message.error('删除失败');
    }
  };

  const renderStats = (content: string) => {
    try {
      const stats = JSON.parse(content);
      return (
        <Row gutter={16}>
          {Object.entries(stats).map(([key, val]: [string, any]) => (
            <Col key={key} span={6} style={{ marginBottom: 12 }}>
              <Statistic
                title={key.replace(/_/g, ' ')}
                value={val}
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
          ))}
        </Row>
      );
    } catch {
      return <Text type="secondary">无统计数据</Text>;
    }
  };

  const columns = [
    {
      title: '报告日期',
      dataIndex: 'report_date',
      key: 'report_date',
      render: (v: string) => v || '-',
    },
    {
      title: '类型',
      dataIndex: 'report_type',
      key: 'report_type',
      render: (v: string) => {
        const m: Record<string, string> = { progress: '招聘进展', interview_stats: '面试统计', leader_summary: '负责人汇总' };
        return <Tag color="blue">{m[v] || v}</Tag>;
      },
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '生成时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" onClick={() => setDetailModal(record)}>查看</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="招聘日报"
        extra={
          <Space>
            <DatePicker
              value={selectedDate}
              onChange={(d) => d && setSelectedDate(d)}
              allowClear={false}
            />
            <Button
              type="primary"
              icon={generating ? <LoadingOutlined /> : <ThunderboltOutlined />}
              onClick={handleGenerate}
              loading={generating}
            >
              生成日报
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>刷新</Button>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : data.length === 0 ? (
          <Empty description={`暂无日报，点击"生成日报"按钮创建`} />
        ) : (
          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>

      <Modal
        title={detailModal?.title || '日报详情'}
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={null}
        width={800}
      >
        {detailModal && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Text type="secondary">报告日期: </Text>
                <Text strong>{detailModal.report_date}</Text>
              </Col>
              <Col span={8}>
                <Text type="secondary">类型: </Text>
                <Text strong>{detailModal.report_type}</Text>
              </Col>
              <Col span={8}>
                <Text type="secondary">生成时间: </Text>
                <Text strong>{detailModal.created_at ? dayjs(detailModal.created_at).format('MM-DD HH:mm') : '-'}</Text>
              </Col>
            </Row>
            <Divider>统计数据</Divider>
            {detailModal.content && renderStats(detailModal.content)}
            <Divider>
              <Space><RobotOutlined /> AI摘要</Space>
            </Divider>
            {detailModal.stats ? (
              <pre style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: '#f5f5f5',
                padding: 16,
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.8,
              }}>
                {detailModal.stats}
              </pre>
            ) : (
              <Text type="secondary">无AI摘要</Text>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DailyReportsList;
