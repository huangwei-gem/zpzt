import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, Space, Spin, Tag, Typography, message, Table, Radio, Checkbox, InputNumber } from 'antd';
import { useParams } from 'react-router-dom';
import { PlayCircleOutlined, SendOutlined, ClockCircleOutlined } from '@ant-design/icons';
import request from '../../utils/request';
import CodeEditor from '../../components/CodeEditor';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const testTypeLabels: Record<string, { label: string; color: string }> = {
  algorithm: { label: '算法笔试', color: 'blue' },
  choice: { label: '选择题', color: 'green' },
  essay: { label: '简答题', color: 'orange' },
};

const PublicCodingTest: React.FC = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [test, setTest] = useState<any>(null);
  const [code, setCode] = useState('');
  const [runResult, setRunResult] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [form] = Form.useForm();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const storageKey = useMemo(() => (token ? `codingtest:${token}:code` : ''), [token]);
  const answersKey = useMemo(() => (token ? `codingtest:${token}:answers` : ''), [token]);

  const fetchTest = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await request.get(`/public/coding-tests/${token}`);
      setTest(res);
      
      if (res.test_type === 'algorithm') {
        const saved = storageKey ? localStorage.getItem(storageKey) : null;
        setCode(saved || res.starter_code || '');
      } else {
        const savedAnswers = answersKey ? localStorage.getItem(answersKey) : null;
        if (savedAnswers) {
          setAnswers(JSON.parse(savedAnswers));
        }
      }
      
      if (res.duration_minutes) {
        setTimeLeft(res.duration_minutes * 60);
      }
    } catch (e) {
      message.error('笔试链接无效或已关闭');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTest();
  }, [token]);

  useEffect(() => {
    if (!storageKey || test?.test_type !== 'algorithm') return;
    localStorage.setItem(storageKey, code || '');
  }, [storageKey, code, test?.test_type]);

  useEffect(() => {
    if (!answersKey || test?.test_type === 'algorithm') return;
    localStorage.setItem(answersKey, JSON.stringify(answers));
  }, [answersKey, answers, test?.test_type]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          if (prev === 1) {
            message.warning('时间到，正在自动提交...');
            handleSubmit(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRun = async () => {
    if (!token) return;
    if (!code.trim()) {
      message.error('请先填写代码');
      return;
    }
    setRunning(true);
    try {
      const res = await request.post(`/public/coding-tests/${token}/run`, {
        code,
        language: test?.language || 'javascript',
      });
      setRunResult(res);
      message.success(res.passed ? '全部用例通过' : '部分用例未通过');
    } catch (e) {
      message.error('运行失败');
    } finally {
      setRunning(false);
    }
  };

  const fetchSubmission = async (submissionId: string) => {
    if (!token) return;
    const res = await request.get(`/public/coding-tests/${token}/submissions/${submissionId}`);
    setSubmission(res);
    return res;
  };

  const handleSubmit = async (isAutoSubmit = false) => {
    if (!token) return;
    
    const testType = test?.test_type || 'algorithm';
    
    if (testType === 'algorithm' && !code.trim()) {
      message.error('请先填写代码');
      return;
    }
    
    if (testType === 'choice' || testType === 'essay') {
      const questions = test?.questions || [];
      const unanswered = questions.filter((q: any) => !answers[q.id] || answers[q.id].trim() === '');
      
      if (unanswered.length > 0) {
        if (isAutoSubmit) {
          message.warning(`时间到，还有 ${unanswered.length} 道题目未作答`);
        } else {
          message.error(`还有 ${unanswered.length} 道题目未作答，请完成所有题目后再提交`);
          return;
        }
      }
    }
    
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      
      let endpoint = `/public/coding-tests/${token}/submit`;
      let payload: any = {
        candidate_name: values.candidate_name,
        candidate_email: values.candidate_email,
      };
      
      if (testType === 'algorithm') {
        payload.code = code;
        payload.language = test?.language || 'javascript';
      } else if (testType === 'choice') {
        endpoint = `/public/coding-tests/${token}/submit-choice`;
        payload.answers = Object.entries(answers).map(([questionId, answer]) => ({
          question_id: questionId,
          answer,
        }));
      } else if (testType === 'essay') {
        endpoint = `/public/coding-tests/${token}/submit-essay`;
        payload.answers = Object.entries(answers).map(([questionId, answer]) => ({
          question_id: questionId,
          answer,
        }));
      }
      
      const res = await request.post(endpoint, payload);
      setSubmission(res);
      message.success('提交成功');
      
      if (storageKey) localStorage.removeItem(storageKey);
      if (answersKey) localStorage.removeItem(answersKey);
      setTimeLeft(0);
    } catch (e) {
      if ((e as any)?.errorFields) return;
      message.error('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitClick = () => handleSubmit(false);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const resultRows = useMemo(() => {
    const results = runResult?.results || submission?.run_result?.results || [];
    return results.map((r: any) => ({ ...r, key: r.index }));
  }, [runResult, submission]);

  if (loading && !test) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!test) return null;

  const testType = test.test_type || 'algorithm';
  const typeInfo = testTypeLabels[testType] || { label: '笔试', color: 'default' };

  const renderQuestions = () => {
    const questions = test.questions || [];
    
    return questions.map((q: any, index: number) => (
      <Card key={q.id} size="small" style={{ marginBottom: 16, borderRadius: 12 }} title={`第 ${index + 1} 题`}>
        <Paragraph style={{ marginBottom: 16 }}>{q.question}</Paragraph>
        
        {testType === 'choice' && (
          <>
            {q.is_multiple ? (
              <Checkbox.Group
                value={answers[q.id]?.split(',') || []}
                onChange={(vals) => handleAnswerChange(q.id, (vals as string[]).join(','))}
              >
                <Space direction="vertical">
                  {q.options?.map((opt: any) => (
                    <Checkbox key={opt.label} value={opt.label}>
                      {opt.label}. {opt.text}
                    </Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            ) : (
              <Radio.Group
                value={answers[q.id]}
                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
              >
                <Space direction="vertical">
                  {q.options?.map((opt: any) => (
                    <Radio key={opt.label} value={opt.label}>
                      {opt.label}. {opt.text}
                    </Radio>
                  ))}
                </Space>
              </Radio.Group>
            )}
            {q.is_multiple && <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>（多选题）</Text>}
          </>
        )}
        
        {testType === 'essay' && (
          <TextArea
            rows={6}
            value={answers[q.id] || ''}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            placeholder="请输入您的答案..."
          />
        )}
      </Card>
    ));
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <Card style={{ borderRadius: 16 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Title level={3} style={{ marginBottom: 4 }}>{test.title}</Title>
              <Space>
                <Tag color={typeInfo.color} style={{ border: 'none' }}>{typeInfo.label}</Tag>
                <Tag style={{ border: 'none' }}>{test.difficulty || 'intermediate'}</Tag>
                {testType === 'algorithm' && (
                  <Tag style={{ border: 'none' }}>{(test.language || 'javascript').toUpperCase()}</Tag>
                )}
              </Space>
            </div>
            {timeLeft !== null && timeLeft > 0 && (
              <Tag icon={<ClockCircleOutlined />} color={timeLeft < 300 ? 'red' : 'blue'} style={{ fontSize: 16, padding: '4px 12px' }}>
                剩余时间: {formatTime(timeLeft)}
              </Tag>
            )}
          </div>

          {test.description && (
            <Card size="small" style={{ background: '#F8FAFC', borderRadius: 12 }}>
              <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{test.description}</Paragraph>
            </Card>
          )}

          <Form form={form} layout="inline">
            <Form.Item name="candidate_name" rules={[{ required: true, message: '请输入姓名' }]}>
              <Input placeholder="姓名" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="candidate_email" rules={[{ required: true, message: '请输入邮箱' }]}>
              <Input placeholder="邮箱" style={{ width: 260 }} />
            </Form.Item>
          </Form>

          {testType === 'algorithm' && (
            <>
              <div>
                <Space style={{ marginBottom: 12 }}>
                  <Button icon={<PlayCircleOutlined />} onClick={handleRun} loading={running}>运行用例</Button>
                  <Button type="primary" icon={<SendOutlined />} onClick={onSubmitClick} loading={submitting}>提交作答</Button>
                  {(runResult || submission?.run_result) && (
                    <Space>
                      <Tag color={(runResult?.passed ?? submission?.run_result?.passed) ? 'green' : 'red'} style={{ border: 'none' }}>
                        {(runResult?.passed ?? submission?.run_result?.passed) ? '通过' : '未通过'}
                      </Tag>
                      <Text type="secondary">得分 {(runResult?.score ?? submission?.run_result?.score) ?? 0}</Text>
                    </Space>
                  )}
                </Space>

                <CodeEditor
                  value={code}
                  onChange={setCode}
                  language={test?.language || 'javascript'}
                  height={420}
                />
              </div>

              {(runResult?.error || submission?.run_result?.error) && (
                <Card size="small" style={{ borderRadius: 12 }} title="运行错误">
                  <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{runResult?.error || submission?.run_result?.error}</Paragraph>
                </Card>
              )}

              {resultRows.length > 0 && (
                <Card size="small" style={{ borderRadius: 12 }} title="测试用例结果">
                  <Table
                    dataSource={resultRows}
                    pagination={false}
                    columns={[
                      { title: '#', dataIndex: 'index', width: 60 },
                      {
                        title: '状态',
                        dataIndex: 'ok',
                        width: 90,
                        render: (ok: boolean) => ok ? <Tag color="green" style={{ border: 'none' }}>通过</Tag> : <Tag color="red" style={{ border: 'none' }}>失败</Tag>,
                      },
                      { title: '输入', dataIndex: 'input', render: (v: any) => <Text code>{JSON.stringify(v)}</Text> },
                      { title: '期望', dataIndex: 'expected', render: (v: any) => <Text code>{JSON.stringify(v)}</Text> },
                      { title: '实际', dataIndex: 'actual', render: (v: any) => <Text code>{JSON.stringify(v)}</Text> },
                    ]}
                  />
                </Card>
              )}
            </>
          )}

          {(testType === 'choice' || testType === 'essay') && (
            <>
              {renderQuestions()}
              
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <Button type="primary" size="large" icon={<SendOutlined />} onClick={onSubmitClick} loading={submitting}>
                  提交作答
                </Button>
              </div>
              
              {submission && (
                <Card size="small" style={{ borderRadius: 12, marginTop: 16, textAlign: 'center' }}>
                  <Space direction="vertical">
                    <Tag color={submission.passed ? 'green' : 'red'} style={{ fontSize: 16, padding: '4px 12px' }}>
                      {submission.passed ? '通过' : '未通过'}
                    </Tag>
                    <Text>得分: {submission.score}</Text>
                  </Space>
                </Card>
              )}
            </>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default PublicCodingTest;