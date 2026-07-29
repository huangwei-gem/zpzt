import React, { useEffect, useState } from 'react';
import {
  Card, Table, Button, Space, Modal, Form, Input, Tag, message,
  Typography, Popconfirm, Tooltip, Select
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined, UserOutlined
} from '@ant-design/icons';
import request from '../../utils/request';

const { Text, Title } = Typography;

interface Contact {
  open_id: string;
  name: string;
  email?: string;
  department?: string;
  mobile?: string;
  title?: string;
  updated_at?: string;
}

const FeishuContacts: React.FC = () => {
  const [data, setData] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');

  const fetchData = async (keyword?: string) => {
    setLoading(true);
    try {
      const params: any = {};
      if (keyword) params.name = keyword;
      const res = await request.get('/feishu-contacts', { params });
      setData(res || []);
    } catch {
      message.error('加载联系人失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(searchText); }, []);

  const handleSearch = () => {
    fetchData(searchText);
  };

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Contact) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      email: record.email || '',
      department: record.department || '',
      mobile: record.mobile || '',
      title: record.title || '',
    });
    setModalVisible(true);
  };

  const handleDelete = async (open_id: string) => {
    try {
      await request.delete(`/feishu-contacts/${open_id}`);
      message.success('已删除');
      fetchData(searchText);
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await request.put(`/feishu-contacts/${editing.open_id}`, values);
        message.success('更新成功');
      } else {
        // 新建时自动生成 open_id（用 uuid 前缀）
        const openId = 'ou_' + Math.random().toString(36).substring(2, 15);
        await request.post('/feishu-contacts', { ...values, open_id: openId });
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData(searchText);
    } catch {
      // 表单验证失败时不提示
    }
  };

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 140,
      render: (name: string) => (
        <Space>
          <UserOutlined style={{ color: '#3B82F6' }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: 'Open ID',
      dataIndex: 'open_id',
      key: 'open_id',
      width: 340,
      render: (id: string) => (
        <Text copyable style={{ fontSize: 12, fontFamily: 'monospace' }}>{id}</Text>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 240,
      render: (email: string) => email || <Text type="secondary">-</Text>,
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 200,
      render: (dept: string) => dept || <Text type="secondary">-</Text>,
    },
    {
      title: '职位',
      dataIndex: 'title',
      key: 'title',
      width: 160,
      render: (title: string) => title || <Text type="secondary">-</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: Contact) => (
        <Space>
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          </Tooltip>
          <Popconfirm
            title="确认删除此联系人？"
            description="删除后将无法通过此 open_id 发送飞书消息"
            onConfirm={() => handleDelete(record.open_id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Title level={4} style={{ margin: 0 }}>
            <UserOutlined style={{ marginRight: 8 }} />
            飞书联系人管理
          </Title>
          <Space>
            <Input.Search
              placeholder="搜索姓名..."
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={handleSearch}
              style={{ width: 240 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => fetchData(searchText)}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              添加联系人
            </Button>
          </Space>
        </div>

        <Table
          dataSource={data}
          columns={columns}
          rowKey="open_id"
          loading={loading}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 个联系人` }}
          locale={{ emptyText: '暂无联系人数据' }}
          size="middle"
        />

        <div style={{ marginTop: 16, background: '#f6f8fa', padding: '12px 16px', borderRadius: 8 }}>
          <Text type="secondary">
            💡 这些联系人用于面试官提醒等飞书消息推送。手动添加时请确保 Open ID 准确。
          </Text>
        </div>
      </Card>

      <Modal
        title={editing ? '编辑联系人' : '添加联系人'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText={editing ? '保存' : '创建'}
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="如：张三" />
          </Form.Item>
          <Form.Item
            name="open_id"
            label={editing ? 'Open ID（不可修改）' : 'Open ID（自动生成）'}
          >
            <Input
              disabled={!!editing}
              placeholder="新建时自动生成"
            />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="如：zhangsan@company.com" />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input placeholder="如：AI创新事业部" />
          </Form.Item>
          <Form.Item name="title" label="职位">
            <Input placeholder="如：HRBP" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default FeishuContacts;
