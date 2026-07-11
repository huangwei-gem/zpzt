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

const PositionMappings: React.FC = () => {
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
      if (search) params.raw_name = search;
      const res = await request.get('/position-mappings', { params });
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
        await request.put(`/position-mappings/${editing.id}`, values);
        message.success('更新成功');
      } else {
        await request.post('/position-mappings', values);
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
      await request.delete(`/position-mappings/${id}`);
      message.success('删除成功');
      fetchData();
    } catch {
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '原始岗位名', dataIndex: 'raw_name', key: 'raw_name' },
    { title: '标准岗位名', dataIndex: 'mapped_name', key: 'mapped_name' },
    {
      title: '操作',
      key: 'action',
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
      title="岗位名称映射"
      extra={
        <Space>
          <Input.Search
            placeholder="搜索原始岗位名"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={fetchData}
            style={{ width: 200 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新增映射</Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />
      <Modal
        title={editing ? '编辑映射' : '新增映射'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="raw_name" label="原始岗位名" rules={[{ required: true, message: '请输入' }]}>
            <Input placeholder="如：招生专员（劳动者方向）" />
          </Form.Item>
          <Form.Item name="mapped_name" label="标准岗位名" rules={[{ required: true, message: '请输入' }]}>
            <Input placeholder="如：招商专员（地招）" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default PositionMappings;
