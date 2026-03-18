import React, { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, message, Tooltip, Typography, Popconfirm, InputNumber, Divider } from 'antd';
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

const testTypeLabels: Record<string, { label: string; color: string }> = {
  algorithm: { label: '算法', color: 'blue' },
  choice: { label: '选择题', color: 'green' },
  essay: { label: '简答题', color: 'orange' },
};

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
  const [questionBanks, setQuestionBanks] = useState<any[]>([]);
  const [testType, setTestType] = useState<string>('algorithm');

  const fetchList = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await request.get('/coding-tests');
      setData(res);
    } catch (e) {
      if (!silent) message.error('获取笔试列表失败');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchQuestionBanks = async () => {
    try {
      const res = await request.get('/question-banks');
      setQuestionBanks(res || []);
    } catch (e) {
      console.error('获取题库列表失败');
    }
  };

  useEffect(() => {
    fetchList();
    fetchQuestionBanks();
  }, []);

  useEffect(() => {
    const hasGenerating = data.some(item => 
      item.test_type !== 'algorithm' && item.question_generation_status === 'generating'
    );
    if (!hasGenerating) return;
    
    const timer = setInterval(() => {
      fetchList(true);
    }, 3000);
    return () => clearInterval(timer);
  }, [data]);

  const handleCreate = () => {
    form.resetFields();
    setEditingId(null);
    setStarterCodeLanguage('javascript');
    setTestType('algorithm');
    form.setFieldsValue({
      leetcode_url: '',
      test_type: 'algorithm',
      language: 'javascript',
      difficulty: 'intermediate',
      status: 'draft',
      starter_code: starterCodeByLanguage.javascript,
      test_cases: JSON.stringify(defaultTestCases, null, 2),
      duration_minutes: 60,
      question_count: 10,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      
      let testCases: any[] = [];
      if (values.test_type === 'algorithm') {
        try {
          testCases = values.test_cases ? JSON.parse(values.test_cases) : [];
        } catch (e) {
          message.error('测试用例 JSON 格式不正确');
          setSubmitting(false);
          return;
        }
      }
      
      const payload: any = {
        title: values.title,
        description: values.description,
        test_type: values.test_type,
        difficulty: values.difficulty,
        duration_minutes: values.duration_minutes,
        status: values.status,
      };

      if (values.test_type === 'algorithm') {
        payload.language = values.language;
        payload.starter_code = values.starter_code;
        payload.test_cases = testCases;
        payload.time_limit_ms = values.time_limit_ms;
        payload.memory_limit_mb = values.memory_limit_mb;
      } else {
        payload.question_bank_id = values.question_bank_id;
      }

      if (editingId) {
        await request.put(`/coding-tests/${editingId}`, payload);
        message.success('更新成功');
        setOpen(false);
        fetchList();
      } else {
        const created = await request.post('/coding-tests', payload);
        message.success('创建成功，正在生成题目...');
        setOpen(false);
        fetchList();
        
        if (values.test_type !== 'algorithm' && values.question_bank_id) {
          try {
            await request.post(`/coding-tests/${created.id}/generate-questions`, null, {
              params: {
                question_bank_id: values.question_bank_id,
                test_type: values.test_type,
                count: values.question_count || 10,
              },
            });
            fetchList();
          } catch (e) {
            console.error('生成题目失败', e);
          }
        }
      }
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

  const handleTestTypeChange = (type: string) => {
    setTestType(type);
    form.setFieldsValue({ test_type: type });
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
      const type = res.test_type || 'algorithm';
      setTestType(type);
      const lang = res.language || 'javascript';
      setStarterCodeLanguage(lang);
      form.resetFields();
      form.setFieldsValue({
        leetcode_url: '',
        title: res.title,
        description: res.description,
        test_type: type,
        difficulty: res.difficulty || 'intermediate',
        language: lang,
        status: res.status || 'draft',
        time_limit_ms: res.time_limit_ms ?? 3000,
        memory_limit_mb: res.memory_limit_mb ?? 256,
        starter_code: res.starter_code || starterCodeByLanguage[lang] || '',
        test_cases: JSON.stringify(res.test_cases || [], null, 2),
        question_bank_id: res.question_bank_id,
        duration_minutes: res.duration_minutes || 60,
        question_count: res.questions?.length || 10,
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
      dataIndex: 'test_type',
      key: 'test_type',
      render: (type: string) => {
        const info = testTypeLabels[type] || { label: type, color: 'default' };
        return <Tag color={info.color} style={{ border: 'none' }}>{info.label}</Tag>;
      },
    },
    { title: '语言', dataIndex: 'language', key: 'language', render: (v: string) => v || '-' },
    {
      title: '时长',
      dataIndex: 'duration_minutes',
      key: 'duration_minutes',
      render: (v: number) => v ? `${v}分钟` : '-',
    },
    {
      title: '题目状态',
      dataIndex: 'question_generation_status',
      key: 'question_generation_status',
      render: (s: string, record: any) => {
        if (record.test_type === 'algorithm') {
          return <Tag color="green" style={{ border: 'none' }}>已完成</Tag>;
        }
        const map: any = {
          pending: { text: '等待生成', color: 'default' },
          generating: { text: '生成中', color: 'processing' },
          completed: { text: '已完成', color: 'green' },
          failed: { text: '生成失败', color: 'red' },
        };
        const info = map[s] || { text: s || '等待生成', color: 'default' };
        return <Tag color={info.color} style={{ border: 'none' }}>{info.text}</Tag>;
      },
    },
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
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                render: (s: string) => {
                  const map: any = {
                    submitted: { text: '已提交', color: 'blue' },
                    evaluating: { text: '评价中', color: 'processing' },
                    evaluated: { text: '已评价', color: 'green' },
                  };
                  const info = map[s] || { text: s, color: 'default' };
                  return <Tag color={info.color} style={{ border: 'none' }}>{info.text}</Tag>;
                },
              },
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
                  {selectedSubmission.language && <Tag style={{ border: 'none' }}>{selectedSubmission.language}</Tag>}
                  <Tag color={selectedSubmission.passed ? 'green' : 'red'} style={{ border: 'none' }}>
                    {selectedSubmission.passed ? '通过' : '未通过'}
                  </Tag>
                  <Text type="secondary">得分 {selectedSubmission.score ?? 0}</Text>
                </Space>

                {selectedSubmission.code && (
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
                )}

                {selectedSubmission.answers && (
                  <div>
                    <Text strong>答题详情</Text>
                    <div style={{ marginTop: 8 }}>
                      {selectedTest?.questions?.map((q: any, i: number) => {
                        const userAnswer = selectedSubmission.answers.find((a: any) => a.question_id === q.id);
                        const isCorrect = userAnswer?.answer === q.correct_answer;
                        const isChoice = selectedTest?.test_type === 'choice';
                        const isEssay = selectedTest?.test_type === 'essay';
                        
                        const evaluation = selectedSubmission.run_result?.evaluations?.find((e: any) => e.question_id === q.id);
                        const questionScore = evaluation?.score;
                        const maxScore = evaluation?.max_score || q.max_score || 10;
                        
                        return (
                          <Card 
                            key={i} 
                            size="small" 
                            style={{ 
                              marginBottom: 12, 
                              borderLeft: `4px solid ${isChoice ? (isCorrect ? '#10B981' : '#EF4444') : (questionScore !== undefined ? (questionScore >= maxScore * 0.6 ? '#10B981' : '#EF4444') : '#9CA3AF')}`,
                              backgroundColor: isChoice ? (isCorrect ? '#F0FDF4' : '#FEF2F2') : (questionScore !== undefined ? (questionScore >= maxScore * 0.6 ? '#F0FDF4' : '#FEF2F2') : '#F9FAFB')
                            }}
                          >
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text strong>{i + 1}. {q.question}</Text>
                                {isEssay && questionScore !== undefined && (
                                  <Tag color={questionScore >= maxScore * 0.6 ? 'green' : 'orange'} style={{ border: 'none' }}>
                                    得分: {questionScore}/{maxScore}
                                  </Tag>
                                )}
                              </div>
                              
                              {isChoice && q.options && (
                                <div style={{ marginTop: 8 }}>
                                  {q.options.map((opt: any) => {
                                    const isUserChoice = userAnswer?.answer === opt.label;
                                    const isCorrectOption = q.correct_answer === opt.label;
                                    
                                    return (
                                      <div 
                                        key={opt.label}
                                        style={{
                                          padding: '4px 8px',
                                          marginBottom: 4,
                                          borderRadius: 4,
                                          backgroundColor: isCorrectOption ? '#DCFCE7' : (isUserChoice && !isCorrect ? '#FEE2E2' : 'transparent'),
                                          border: isCorrectOption ? '1px solid #10B981' : (isUserChoice && !isCorrect ? '1px solid #EF4444' : '1px solid transparent')
                                        }}
                                      >
                                        <Space>
                                          <Text strong>{opt.label}.</Text>
                                          <Text>{opt.text}</Text>
                                          {isCorrectOption && <Tag color="green" style={{ marginLeft: 8, border: 'none' }}>正确答案</Tag>}
                                          {isUserChoice && !isCorrect && <Tag color="red" style={{ marginLeft: 8, border: 'none' }}>你的选择</Tag>}
                                        </Space>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              
                              {!isChoice && (
                                <div style={{ marginTop: 8 }}>
                                  <div style={{ marginBottom: 8 }}>
                                    <Text type="secondary">用户答案：</Text>
                                    <Text>{userAnswer?.answer || '未作答'}</Text>
                                  </div>
                                  {q.reference_answer && (
                                    <div>
                                      <Text type="secondary">参考答案：</Text>
                                      <Text type="success">{q.reference_answer}</Text>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {q.explanation && (
                                <div style={{ marginTop: 8, padding: '8px 12px', backgroundColor: '#F3F4F6', borderRadius: 4 }}>
                                  <Text type="secondary">解析：{q.explanation}</Text>
                                </div>
                              )}
                            </Space>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(selectedTest?.test_type === 'algorithm' || selectedTest?.test_type === 'essay') && (
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
                )}
              </Space>
            </Card>
          )}
        </Space>
      </Modal>

      <Modal
        title={editingId ? '编辑笔试' : '创建笔试'}
        open={open}
        onOk={handleSave}
        onCancel={() => setOpen(false)}
        okText={editingId ? '保存' : '创建'}
        cancelText="取消"
        confirmLoading={submitting}
        width={820}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="test_type" label="笔试类型" rules={[{ required: true }]}>
            <Select onChange={handleTestTypeChange}>
              <Select.Option value="algorithm">算法题</Select.Option>
              <Select.Option value="choice">选择题</Select.Option>
              <Select.Option value="essay">简答题</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="例如：前端开发笔试" />
          </Form.Item>
          
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="笔试说明（可选）" />
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
            <Form.Item name="duration_minutes" label="时长(分钟)" style={{ flex: 1 }}>
              <InputNumber min={10} max={180} style={{ width: '100%' }} />
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

          {testType === 'algorithm' && (
            <>
              <Divider>算法题设置</Divider>
              
              <Form.Item name="leetcode_url" label="力扣题目链接">
                <Space.Compact style={{ width: '100%' }}>
                  <Input placeholder="https://leetcode.cn/problems/two-sum/" />
                  <Button icon={<ImportOutlined />} onClick={importFromLeetCode} loading={importingLeetcode}>一键导入</Button>
                </Space.Compact>
              </Form.Item>
              
              <Form.Item name="language" label="语言">
                <Select
                  options={[
                    { value: 'javascript', label: 'JavaScript' },
                    { value: 'python', label: 'Python' },
                    { value: 'java', label: 'Java' },
                  ]}
                  onChange={handleLanguageChange}
                />
              </Form.Item>
              
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
            </>
          )}

          {(testType === 'choice' || testType === 'essay') && (
            <>
              <Divider>题目设置</Divider>
              
              <Space style={{ width: '100%' }} size="large">
                <Form.Item name="question_bank_id" label="题库" rules={[{ required: true, message: '请选择题库' }]} style={{ flex: 1 }}>
                  <Select placeholder="请选择题库">
                    {questionBanks.map((bank: any) => (
                      <Select.Option key={bank.id} value={bank.id}>{bank.name}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item name="question_count" label="题目数量" style={{ flex: 1 }}>
                  <InputNumber min={1} max={50} style={{ width: '100%' }} />
                </Form.Item>
              </Space>
              
              <div style={{ color: '#64748B', fontSize: 13 }}>
                创建后将自动从题库随机抽取题目。如题库中没有对应类型的题目，将抽取题库中的所有题目。
              </div>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default CodingTestsList;