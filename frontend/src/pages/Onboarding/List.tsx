import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, Tag, Modal, Form, Input, DatePicker,
  Select, Switch, message, Popconfirm, Drawer, Descriptions, Row, Col, Statistic, Typography
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  EyeOutlined, HomeOutlined
} from '@ant-design/icons';
import request from '../../utils/request';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const statusConfig: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待入职' },
  in_progress: { color: 'processing', text: '入职中' },
  completed: { color: 'success', text: '已完成' },
  withdrawn: { color: 'error', text: '已放弃' },
};

const OnboardingList: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  const [detailVisible, setDetailVisible] = useState(false);
  const [current, setCurrent] = useState<any>(null);
  const [resumes, setResumes] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { const res = await request.get('/onboarding'); setData(res || []); }
    catch (e) { message.error('加载失败'); }
    finally { setLoading(false); }
  }, []);

  const fetchResumes = useCallback(async () => {
    try { const res = await request.get('/resumes', { params: { limit: 200 } }); setResumes(res || []); }
    catch (e) { }
  }, []);

  useEffect(() => { fetchData(); fetchResumes(); }, [fetchData, fetchResumes]);

  const handleCreate = () => {
    setEditing(null); form.resetFields();
    form.setFieldsValue({ contract_type: 'fixed_term', status: 'pending' });
    setModalVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      onboard_date: record.onboard_date ? dayjs(record.onboard_date) : null,
      orientation_date: record.orientation_date ? dayjs(record.orientation_date) : null,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        onboard_date: values.onboard_date ? values.onboard_date.toISOString() : null,
        orientation_date: values.orientation_date ? values.orientation_date.toISOString() : null,
      };
      if (editing) {
        await request.put(`/onboarding/${editing.id}`, payload);
        message.success('更新成功');
      } else {
        await request.post('/onboarding', payload);
        message.success('创建成功');
      }
      setModalVisible(false); fetchData();
    } catch (e: any) {
      if (e.response) message.error(e.response.data?.detail || '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try { await request.delete(`/onboarding/${id}`); message.success('已删除'); fetchData(); }
    catch (e: any) { message.error(e.response?.data?.detail || '删除失败'); }
  };

  const columns = [
    { title: '姓名', dataIndex: 'candidate_name', key: 'candidate_name', width: 100 },
    { title: '工号', dataIndex: 'employee_id', key: 'employee_id', width: 90, render: (v: string) => v || '-' },
    { title: '部门', dataIndex: 'department', key: 'department', width: 100, render: (v: string) => v || '-' },
    { title: '职位', dataIndex: 'position_title', key: 'position_title', width: 130, render: (v: string) => v || '-' },
    { title: '入职日期', dataIndex: 'onboard_date', key: 'onboard_date', width: 110,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-' },
    { title: '合同', dataIndex: 'contract_signed', key: 'contract_signed', width: 70,
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? '已签' : '未签'}</Tag> },
    { title: '账号', dataIndex: 'accounts_created', key: 'accounts_created', width: 70,
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? '已开' : '未开'}</Tag> },
    { title: '设备', dataIndex: 'equipment_assigned', key: 'equipment_assigned', width: 70,
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? '已配' : '未配'}</Tag> },
    { title: '入职引导', dataIndex: 'orientation_completed', key: 'orientation_completed', width: 90,
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? '已完成' : '未完成'}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => { const c = statusConfig[v] || { color: 'default', text: v }; return <Tag color={c.color}>{c.text}</Tag>; } },
    { title: '操作', key: 'action', width: 170, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setCurrent(record); setDetailVisible(true); }}>详情</Button>
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
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>入职管理</Title>
          <Text type="secondary">管理候选人入职流程及员工信息</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData} size="large" style={{ borderRadius: '8px' }}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} size="large" style={{ borderRadius: '8px' }}>新增入职</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}><div style={{ background: '#F8FAFC', padding: '20px 24px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>入职总数</Text>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#0F172A', marginTop: 4 }}>{data.length}</div>
        </div></Col>
        <Col span={6}><div style={{ background: '#F8FAFC', padding: '20px 24px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>待入职</Text>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#F59E0B', marginTop: 4 }}>{data.filter(r => r.status === 'pending').length}</div>
        </div></Col>
        <Col span={6}><div style={{ background: '#F8FAFC', padding: '20px 24px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>入职中</Text>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#3B82F6', marginTop: 4 }}>{data.filter(r => r.status === 'in_progress').length}</div>
        </div></Col>
        <Col span={6}><div style={{ background: '#F8FAFC', padding: '20px 24px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>已完成</Text>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#10B981', marginTop: 4 }}>{data.filter(r => r.status === 'completed').length}</div>
        </div></Col>
      </Row>

      <Table dataSource={data} columns={columns} rowKey="id" loading={loading}
        scroll={{ x: 1200 }} pagination={{ pageSize: 10, showSizeChanger: true }} />
      <Modal title={editing ? '编辑入职记录' : '新增入职记录'} open={modalVisible}
        onCancel={() => setModalVisible(false)} onOk={handleSubmit} width={720} destroyOnClose>
        <div style={{ padding: '8px 0' }}>
        <Form form={form} layout="vertical">
          <Form.Item name="resume_id" label="关联简历" rules={[{ required: true, message: '请选择简历' }]}>
            <Select showSearch placeholder="选择候选人简历" optionFilterProp="children">
              {resumes.map((r: any) => <Option key={r.id} value={r.id}>{r.candidate_name} - {r.position_title || '未知岗位'}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="candidate_name" label="候选人姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Row gutter={24}>
            <Col span={8}><Form.Item name="employee_id" label="工号"><Input placeholder="如：EMP001" /></Form.Item></Col>
            <Col span={8}><Form.Item name="department" label="部门"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="position_title" label="职位"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={24}>
            <Col span={8}><Form.Item name="onboard_date" label="入职日期"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="contract_type" label="合同类型">
              <Select>
                <Option value="fixed_term">固定期限</Option>
                <Option value="permanent">无固定期限</Option>
                <Option value="intern">实习协议</Option>
                <Option value="outsourcing">外包</Option>
              </Select>
            </Form.Item></Col>
            <Col span={8}><Form.Item name="status" label="状态">
              <Select>{Object.entries(statusConfig).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}</Select>
            </Form.Item></Col>
          </Row>
          {editing && (<Row gutter={24}>
            <Col span={6}><Form.Item name="contract_signed" label="合同已签" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={6}><Form.Item name="accounts_created" label="账号已开" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={6}><Form.Item name="equipment_assigned" label="设备已配" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={6}><Form.Item name="orientation_completed" label="入职引导完成" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>)}
          <Form.Item name="notes" label="备注"><TextArea rows={2} /></Form.Item>
        </Form>
        </div>
      </Modal>
      <Drawer title="入职详情" open={detailVisible} onClose={() => setDetailVisible(false)} width={560}>
        {current && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="姓名">{current.candidate_name}</Descriptions.Item>
            <Descriptions.Item label="工号">{current.employee_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="部门">{current.department || '-'}</Descriptions.Item>
            <Descriptions.Item label="职位">{current.position_title || '-'}</Descriptions.Item>
            <Descriptions.Item label="入职日期">{current.onboard_date ? dayjs(current.onboard_date).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
            <Descriptions.Item label="合同类型">{current.contract_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="合同已签">{current.contract_signed ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="账号已开">{current.accounts_created ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="设备已配">{current.equipment_assigned ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="入职引导">{current.orientation_completed ? '已完成' : '未完成'}</Descriptions.Item>
            <Descriptions.Item label="状态">{statusConfig[current.status]?.text || current.status}</Descriptions.Item>
            <Descriptions.Item label="备注">{current.notes || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default OnboardingList;
