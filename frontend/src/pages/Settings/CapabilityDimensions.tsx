import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Space, Modal, Form, Input, message,
  Typography, Popconfirm
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined
} from '@ant-design/icons';
import request from '../../utils/request';

const { Text } = Typography;
const { TextArea } = Input;

const CapabilityDimensions: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.position_name = search;
      const res = await request.get('/capability-dimensions', { params });
      setData(res || []);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = () => {
    setEditing(null);
    form.resetFields();
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
      if (editing) {
        await request.put(`/capability-dimensions/${editing.id}`, values);
        message.success('更新成功');
      } else {
        await request.post('/capability-dimensions', values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(e.response?.data?.detail || '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await request.delete(`/capability-dimensions/${id}`);
      message.success('删除成功');
      fetchData();
    } catch {
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '岗位名称', dataIndex: 'position_name', key: 'position_name', width: 200 },
    {
      title: '能力维度要求',
      dataIndex: 'full_text',
      key: 'full_text',
      ellipsis: true,
      render: (v: string) => (
        <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: v }}>
          {v ? v.substring(0, 80) + '...' : '-'}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="能力维度管理"
      extra={
        <Space>
          <Input.Search
            placeholder="搜索岗位名称"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={fetchData}
            style={{ width: 200 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新增</Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 15 }}
      />
      <Modal
        title={editing ? '编辑能力维度' : '新增能力维度'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="position_name" label="岗位名称" rules={[{ required: true, message: '请输入' }]}>
            <Input placeholder="如：大客户经理" />
          </Form.Item>
          <Form.Item name="full_text" label="能力维度要求" rules={[{ required: true, message: '请输入' }]}>
            <TextArea rows={8} placeholder="完整的能力维度描述文本..." />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default CapabilityDimensions;
