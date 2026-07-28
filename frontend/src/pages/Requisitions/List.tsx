import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, InputNumber,
  Select, message, Popconfirm, Row, Col, Typography
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined,
  ReloadOutlined, SearchOutlined,
  ThunderboltOutlined, LoadingOutlined
} from '@ant-design/icons';
import request from '../../utils/request';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const statusConfig: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  pending: { color: 'processing', text: '待审批' },
  approved: { color: 'success', text: '已批准' },
  rejected: { color: 'error', text: '已驳回' },
  closed: { color: 'default', text: '已关闭' },
  open: { color: 'processing', text: '招聘中' },
  paused: { color: 'orange', text: '暂停' },
  cancelled: { color: 'default', text: '已终止' },
};

const urgencyConfig: Record<string, { color: string; text: string }> = {
  low: { color: 'default', text: '低' },
  medium: { color: 'blue', text: '中' },
  high: { color: 'orange', text: '高' },
  urgent: { color: 'red', text: '紧急' },
};

const RequisitionsList: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  const [searchDept, setSearchDept] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const [syncLoading, setSyncLoading] = useState(false);

  const handleSyncFromAnnual = async () => {
    Modal.confirm({
      title: '从飞书年度招聘需求表导入',
      content: '将自动从飞书多维表格同步年度招聘需求数据到系统，已有需求会更新，新增需求自动创建。',
      okText: '开始导入',
      cancelText: '取消',
      onOk: async () => {
        setSyncLoading(true);
        try {
          const res = await request.post('/requisitions/sync-from-annual') as any;
          if (res.ok) {
            message.success(res.message);
            fetchData();
          } else {
            message.error(res.detail || '导入失败');
          }
        } catch (e: any) {
          message.error(e.response?.data?.detail || '导入失败');
        } finally {
          setSyncLoading(false);
        }
      },
    });
  };

  const handleAIJD = async (id: string) => {
    setAiLoading(id);
    try {
      const res = await request.post(`/requisitions/${id}/ai-jd`) as any;
      if (res && !res.detail) {
        message.success('AI已生成岗位描述和要求');
        fetchData();
      } else {
        message.error(res?.detail || 'AI生成失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'AI生成失败');
    } finally {
      setAiLoading(null);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (searchDept) params.department = searchDept;
      if (filterStatus) params.status = filterStatus;
      const res = await request.get('/requisitions', { params });
      setData(res || []);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [searchDept, filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ headcount: 1, urgency: 'medium', employment_type: 'full_time' });
    setModalVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        expected_date: values.expected_date ? values.expected_date.toISOString() : null,
      };
      if (editing) {
        await request.put(`/requisitions/${editing.id}`, payload);
        message.success('更新成功');
      } else {
        await request.post('/requisitions', payload);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (e: any) {
      if (e.response) message.error(e.response.data?.detail || '操作失败');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await request.post(`/requisitions/${id}/approve`);
      message.success('已批准');
      fetchData();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '操作失败');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await request.post(`/requisitions/${id}/reject`);
      message.success('已驳回');
      fetchData();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await request.delete(`/requisitions/${id}`);
      message.success('已删除');
      fetchData();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '删除失败');
    }
  };

  const columns = [
    { title: '岗位名称', dataIndex: 'title', key: 'title', width: 180 },
    { title: '部门', dataIndex: 'department', key: 'department', width: 120 },
    { title: '新增HC数', dataIndex: 'headcount', key: 'headcount', width: 80 },
    {
      title: '紧急程度', dataIndex: 'urgency', key: 'urgency', width: 100,
      render: (v: string) => {
        const c = urgencyConfig[v] || { color: 'default', text: v };
        return <Tag color={c.color}>{c.text}</Tag>;
      }
    },
    {
      title: '薪资范围', dataIndex: 'salary_range', key: 'salary_range', width: 120,
      render: (v: string) => v || '-'
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (v: string) => {
        const c = statusConfig[v] || { color: 'default', text: v };
        return <Tag color={c.color}>{c.text}</Tag>;
      }
    },
    {
      title: '操作', key: 'action', width: 200, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          {record.status === 'pending' && (
            <>
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleApprove(record.id)}>批准</Button>
              <Button type="link" size="small" danger icon={<CloseOutlined />} onClick={() => handleReject(record.id)}>驳回</Button>
            </>
          )}
          <Button type="link" size="small" icon={aiLoading === record.id ? <LoadingOutlined /> : <ThunderboltOutlined />} onClick={() => handleAIJD(record.id)}>AI生成JD</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card
        title="人力需求管理"
        extra={
          <Space wrap>
            <Input placeholder="搜索部门" prefix={<SearchOutlined />} value={searchDept} onChange={e => setSearchDept(e.target.value)} onPressEnter={fetchData} style={{ width: 160 }} allowClear />
            <Select placeholder="状态筛选" allowClear style={{ width: 130 }} value={filterStatus} onChange={v => setFilterStatus(v)}>
              {Object.entries(statusConfig).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>提报需求</Button>
            <Button icon={<ReloadOutlined />} loading={syncLoading} onClick={handleSyncFromAnnual}>从年度需求导入</Button>
          </Space>
        }
      >
        <Table dataSource={data} columns={columns} rowKey="id" loading={loading}
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <Modal title={editing ? '编辑需求' : '提报人力需求'} open={modalVisible} onCancel={() => setModalVisible(false)}
        onOk={handleSubmit} width={720} destroyOnClose>
        <div style={{ padding: '8px 0' }}>
        <Form form={form} layout="vertical">
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="title" label="岗位名称" rules={[{ required: true, message: '请输入岗位名称' }]}>
                <Input placeholder="如：高级前端工程师" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department" label="部门" rules={[{ required: true, message: '请输入部门' }]}>
                <Input placeholder="如：技术部" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item name="headcount" label="招聘人数" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="employment_type" label="用工类型">
                <Select>
                  <Option value="full_time">全职</Option>
                  <Option value="part_time">兼职</Option>
                  <Option value="intern">实习</Option>
                  <Option value="contract">外包</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="urgency" label="紧急程度">
                <Select>
                  {Object.entries(urgencyConfig).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item name="salary_range" label="薪资范围">
                <Input placeholder="如：15-25K" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="reporting_to" label="汇报对象">
                <Input placeholder="如：技术总监" />
              </Form.Item>
            </Col>
            <Col span={12} />
          </Row>
          <Form.Item name="description" label="岗位描述" style={{ marginBottom: 8 }}>
            <TextArea rows={3} placeholder="岗位职责描述" />
          </Form.Item>
          <Form.Item name="requirements" label="任职要求" style={{ marginBottom: 8 }}>
            <TextArea rows={3} placeholder="学历、经验、技能等要求" />
          </Form.Item>
          <Form.Item name="channel_plan" label="渠道规划">
            <TextArea rows={2} placeholder="招聘渠道计划" />
          </Form.Item>
        </Form>
        </div>
      </Modal>
    </div>
  );
};

export default RequisitionsList;
