import React, { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, message, Tooltip, Typography, Popconfirm } from 'antd';
import { PlusOutlined, LinkOutlined, SendOutlined, StopOutlined, EyeOutlined, EditOutlined, ImportOutlined, DeleteOutlined } from '@ant-design/icons';
import request from '../../utils/request';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeEditor from '../../components/CodeEditor';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

const starterCodeByLanguage: Record<string, string> = {
  javascript: `function solution() {
  return null;
}
`,
  python: `def solution(*args):
  return None
`,
  java: `public class Solution {
  public static Object solution(Object... args) {
    return null;
  }
}
`,
};

const defaultTestCases = [
  { input: [[1, 2, 3], 3], expected: 2 },
  { input: [[1, 2, 3], 2], expected: 1 }
];

const CodingTestsList: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importingLeetcode, setImportingLeetcode] = useState(false);
  const [submissionsOpen, setSubmissionsOpen] = useState(false);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [starterCodeLanguage, setStarterCodeLanguage] = useState('javascript');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await request.get('/coding-tests');
      setData(res);
    } catch (e) {
      message.error('获取笔试列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleCreate = () => {
    form.resetFields();
    setEditingId(null);
    setStarterCodeLanguage('javascript');
    form.setFieldsValue({
      leetcode_url: '',
      language: 'javascript',
      difficulty: 'intermediate',
      status: 'draft',
      starter_code: starterCodeByLanguage.javascript,
      test_cases: JSON.stringify(defaultTestCases, null, 2),
    });
    setOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      let testCases: any[] = [];
      try {
        testCases = values.test_cases ? JSON.parse(values.test_cases) : [];
      } catch (e) {
        message.error('测试用例 JSON 格式不正确');
        setSubmitting(false);
        return;
      }
      const payload = {
        title: values.title,
        description: values.description,
        difficulty: values.difficulty,
        language: values.language,
        starter_code: values.starter_code,
        test_cases: testCases,
        time_limit_ms: values.time_limit_ms,
        memory_limit_mb: values.memory_limit_mb,
        status: values.status,
      };
      if (editingId) {
        await request.put(`/coding-tests/${editingId}`, payload);
        message.success('更新成功');
      } else {
        await request.post('/coding-tests', payload);
        message.success('创建成功');
      }
      setOpen(false);
      fetchList();
    } catch (e) {
      if ((e as any)?.errorFields) return;
      message.error(editingId ? '更新失败' : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLanguageChange = (lang: string) => {
    const current = form.getFieldValue('starter_code');
    const prevTemplate = starterCodeByLanguage[starterCodeLanguage] || '';
    const nextTemplate = starterCodeByLanguage[lang] || '';
    if (!current || current === prevTemplate) {
      form.setFieldsValue({ starter_code: nextTemplate });
    }
    setStarterCodeLanguage(lang);
  };

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/public/coding-tests/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      message.success('链接已复制');
    } catch (e) {
      message.info(url);
    }
  };

  const publish = (id: string) => {
    Modal.confirm({
      title: '发布笔试',
      content: '发布后可将链接发送给候选人进行答题。',
      okText: '发布',
      cancelText: '取消',
      onOk: async () => {
        try {
          await request.post(`/coding-tests/${id}/publish`);
          message.success('已发布');
          fetchList();
        } catch (e) {
          message.error('发布失败');
        }
      },
    });
  };

  const close = (id: string) => {
    Modal.confirm({
      title: '关闭笔试',
      content: '关闭后候选人将无法继续进入答题页面。',
      okText: '关闭',
      cancelText: '取消',
      onOk: async () => {
        try {
          await request.post(`/coding-tests/${id}/close`);
          message.success('已关闭');
          fetchList();
        } catch (e) {
          message.error('关闭失败');
        }
      },
    });
  };

  const openSubmissions = async (record: any) => {
    setSelectedTest(record);
    setSelectedSubmission(null);
    setSubmissionsOpen(true);
    setSubmissionsLoading(true);
    try {
      const res = await request.get(`/coding-tests/${record.id}/submissions`);
      setSubmissions(res || []);
    } catch (e) {
      message.error('获取提交列表失败');
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const openSubmissionDetail = async (submissionId: string) => {
    try {
      const res = await request.get(`/coding-tests/submissions/${submissionId}`);
      setSelectedSubmission(res);
    } catch (e) {
      message.error('获取提交详情失败');
    }
  };

  const handleEdit = async (record: any) => {
    try {
      const res = await request.get(`/coding-tests/${record.id}`);
      setEditingId(record.id);
      const lang = res.language || 'javascript';
      setStarterCodeLanguage(lang);
      form.resetFields();
      form.setFieldsValue({
        leetcode_url: '',
        title: res.title,
        description: res.description,
        difficulty: res.difficulty || 'intermediate',
        language: lang,
        status: res.status || 'draft',
        time_limit_ms: res.time_limit_ms ?? 3000,
        memory_limit_mb: res.memory_limit_mb ?? 256,
        starter_code: res.starter_code || starterCodeByLanguage[lang] || '',
        test_cases: JSON.stringify(res.test_cases || [], null, 2),
      });
      setOpen(true);
    } catch (e) {
      message.error('获取笔试详情失败');
    }
  };

  const importFromLeetCode = async () => {
    const url = form.getFieldValue('leetcode_url');
    if (!url) {
      message.error('请先粘贴力扣题目链接');
      return;
    }
    setImportingLeetcode(true);
    try {
      const res = await request.post('/coding-tests/import/leetcode', { url });
      if (res?.title) form.setFieldsValue({ title: res.title });
      if (res?.description) form.setFieldsValue({ description: res.description });
      if (res?.difficulty) form.setFieldsValue({ difficulty: res.difficulty });
      if (Array.isArray(res?.test_cases)) {
        form.setFieldsValue({ test_cases: JSON.stringify(res.test_cases, null, 2) });
      }
      message.success('已导入题目，可继续修改');
    } catch (e) {
      message.error('导入失败，请检查链接是否可访问');
    } finally {
      setImportingLeetcode(false);
    }
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    {
      title: '类型',
      key: 'type',
      render: () => <Tag color="blue" style={{ border: 'none' }}>算法</Tag>,
    },
    { title: '语言', dataIndex: 'language', key: 'language' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const map: any = {
          draft: { text: '草稿', color: 'default' },
          published: { text: '已发布', color: 'green' },
          closed: { text: '已关闭', color: 'red' },
        };
        const info = map[s] || { text: s, color: 'default' };
        return <Tag color={info.color} style={{ border: 'none' }}>{info.text}</Tag>;
      },
    },
    {
      title: '链接',
      key: 'link',
      render: (_: any, record: any) => (
        <Space size="small">
          <Tooltip title="复制链接">
            <Button type="text" icon={<LinkOutlined />} onClick={() => copyLink(record.public_token)} />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          <Tooltip title="查看提交">
            <Button type="text" icon={<EyeOutlined style={{ color: '#3B82F6' }} />} onClick={() => openSubmissions(record)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          {record.status !== 'published' && record.status !== 'closed' && (
            <Tooltip title="发布">
              <Button type="text" icon={<SendOutlined style={{ color: '#10B981' }} />} onClick={() => publish(record.id)} />
            </Tooltip>
          )}
          {record.status === 'published' && (
            <Tooltip title="关闭">
              <Button type="text" danger icon={<StopOutlined />} onClick={() => close(record.id)} />
            </Tooltip>
          )}
          <Popconfirm title="确定删除此测试？" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleDelete = async (id: string) => {
    try {
      await request.delete(`/coding-tests/${id}`);
      message.success('删除成功');
      fetchList();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的测试');
      return;
    }
    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个测试吗？`,
      okText: '确认',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await Promise.all(selectedRowKeys.map(id => request.delete(`/coding-tests/${id}`)));
          message.success(`成功删除 ${selectedRowKeys.length} 个测试`);
          setSelectedRowKeys([]);
          fetchList();
        } catch (error) {
          message.error('批量删除失败');
        }
      },
    });
  };

  const handleBatchPublish = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要发布的测试');
      return;
    }
    Modal.confirm({
      title: '确认批量发布',
      content: `确定要发布选中的 ${selectedRowKeys.length} 个测试吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await Promise.all(selectedRowKeys.map(id => request.put(`/coding-tests/${id}`, { status: 'published' })));
          message.success(`成功发布 ${selectedRowKeys.length} 个测试`);
          setSelectedRowKeys([]);
          fetchList();
        } catch (error) {
          message.error('批量发布失败');
        }
      },
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          {selectedRowKeys.length > 0 && (
            <>
              <span style={{ lineHeight: '32px' }}>已选 {selectedRowKeys.length} 项</span>
              <Button onClick={handleBatchPublish}>批量发布</Button>
              <Button danger onClick={handleBatchDelete}>批量删除</Button>
              <Button onClick={() => setSelectedRowKeys([])}>取消选择</Button>
            </>
          )}
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>创建笔试</Button>
      </div>

      <Table
        columns={columns as any}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10, showSizeChanger: true }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
      />

      <Modal
        title={selectedTest ? `提交列表：${selectedTest.title}` : '提交列表'}
        open={submissionsOpen}
        onCancel={() => setSubmissionsOpen(false)}
        footer={null}
        width={980}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Table
            loading={submissionsLoading}
            dataSource={submissions}
            rowKey="id"
            pagination={{ pageSize: 8, showSizeChanger: true }}
            columns={[
              { title: '候选人', dataIndex: 'candidate_name', key: 'candidate_name', render: (v: string) => v || '-' },
              { title: '邮箱', dataIndex: 'candidate_email', key: 'candidate_email', render: (v: string) => v || '-' },
              {
                title: '得分',
                key: 'score',
                render: (_: any, r: any) => <Text strong>{r.score ?? 0}</Text>,
              },
              {
                title: '通过',
                key: 'passed',
                render: (_: any, r: any) => r.passed ? <Tag color="green" style={{ border: 'none' }}>通过</Tag> : <Tag color="red" style={{ border: 'none' }}>未通过</Tag>,
              },
              { title: '状态', dataIndex: 'status', key: 'status' },
              {
                title: '操作',
                key: 'action',
                render: (_: any, r: any) => (
                  <Button onClick={() => openSubmissionDetail(r.id)}>查看详情</Button>
                ),
              },
            ]}
          />

          {selectedSubmission && (
            <Card style={{ borderRadius: 12 }}>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Space>
                  <Tag style={{ border: 'none' }}>{selectedSubmission.language}</Tag>
                  <Tag color={selectedSubmission.passed ? 'green' : 'red'} style={{ border: 'none' }}>
                    {selectedSubmission.passed ? '通过' : '未通过'}
                  </Tag>
                  <Text type="secondary">得分 {selectedSubmission.score ?? 0}</Text>
                </Space>

                <div>
                  <Text strong>代码</Text>
                  <div style={{ marginTop: 8 }}>
                    <CodeEditor
                      value={selectedSubmission.code || ''}
                      language={selectedSubmission.language || 'javascript'}
                      height={320}
                      readOnly
                    />
                  </div>
                </div>

                <div>
                  <Text strong>AI 评价</Text>
                  <div style={{ marginTop: 8 }}>
                    {selectedSubmission.ai_evaluation ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedSubmission.ai_evaluation}</ReactMarkdown>
                    ) : (
                      <Text type="secondary">暂未生成</Text>
                    )}
                  </div>
                </div>
              </Space>
            </Card>
          )}
        </Space>
      </Modal>

      <Modal
        title={editingId ? '编辑算法笔试' : '创建算法笔试'}
        open={open}
        onOk={handleSave}
        onCancel={() => setOpen(false)}
        okText={editingId ? '保存' : '创建'}
        cancelText="取消"
        confirmLoading={submitting}
        width={820}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="leetcode_url" label="力扣题目链接">
            <Space.Compact style={{ width: '100%' }}>
              <Input placeholder="https://leetcode.cn/problems/two-sum/" />
              <Button icon={<ImportOutlined />} onClick={importFromLeetCode} loading={importingLeetcode}>一键导入</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="例如：二分查找变体" />
          </Form.Item>
          <Form.Item name="description" label="题目描述" rules={[{ required: true, message: '请输入题目描述' }]}>
            <TextArea rows={6} placeholder="粘贴题目描述（可包含示例/约束/提示）" />
          </Form.Item>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="difficulty" label="难度" style={{ flex: 1 }}>
              <Select
                options={[
                  { value: 'junior', label: '初级' },
                  { value: 'intermediate', label: '中级' },
                  { value: 'senior', label: '高级' },
                ]}
              />
            </Form.Item>
            <Form.Item name="language" label="语言" style={{ flex: 1 }}>
              <Select
                options={[
                  { value: 'javascript', label: 'JavaScript' },
                  { value: 'python', label: 'Python' },
                  { value: 'java', label: 'Java' },
                ]}
                onChange={handleLanguageChange}
              />
            </Form.Item>
            <Form.Item name="status" label="状态" style={{ flex: 1 }}>
              <Select
                options={[
                  { value: 'draft', label: '草稿' },
                  { value: 'published', label: '发布' },
                ]}
              />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="time_limit_ms" label="时限(ms)" style={{ flex: 1 }}>
              <Input placeholder="3000" />
            </Form.Item>
            <Form.Item name="memory_limit_mb" label="内存(MB)" style={{ flex: 1 }}>
              <Input placeholder="256" />
            </Form.Item>
          </Space>
          <Form.Item label="初始代码（必须包含 solution 函数）">
            <Form.Item name="starter_code" noStyle getValueFromEvent={(v) => v}>
              <CodeEditor language={form.getFieldValue('language') || 'javascript'} height={260} />
            </Form.Item>
          </Form.Item>
          <Form.Item name="test_cases" label="测试用例（JSON 数组）" extra="格式：[{ input: [args...], expected: any }, ...]">
            <TextArea rows={6} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CodingTestsList;
