import React, { useEffect, useState } from 'react';
import { Table, Button, Space, message, Tag, Modal, Select, Input, Form, Radio, Typography, Card, Divider } from 'antd';
import { ReloadOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import request from '../../utils/request';
import { useAuth } from '../../contexts/AuthContext';

const { TextArea } = Input;
const { Text } = Typography;

const statusConfig: Record<string, { color: string; text: string }> = {
  scheduled: { color: 'processing', text: '待面试' },
  completed: { color: 'success', text: '已完成' },
  cancelled: { color: 'default', text: '已取消' },
};

const resultLabels: Record<string, { color: string; text: string }> = {
  passed: { color: 'success', text: '通过' },
  failed: { color: 'error', text: '不通过' },
};

const InterviewsList: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [nameKeyword, setNameKeyword] = useState('');
  const [evalModalVisible, setEvalModalVisible] = useState(false);
  const [evalRecord, setEvalRecord] = useState<any>(null);
  const [evalRound, setEvalRound] = useState<1 | 2>(1);
  const [evalForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const { user } = useAuth();

  const fetchInterviews = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (nameKeyword.trim()) params.name = nameKeyword.trim();
      const res = await request.get('/interviews', { params });
      setData(res || []);
    } catch {
      message.error('获取面试列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInterviews(); }, [statusFilter, nameKeyword]);

  // 打开一面评价弹窗
  const handleEvalRound1 = (record: any) => {
    setEvalRecord(record);
    setEvalRound(1);
    evalForm.resetFields();
    setEvalModalVisible(true);
  };

  // 打开二面评价弹窗
  const handleEvalRound2 = (record: any) => {
    setEvalRecord(record);
    setEvalRound(2);
    evalForm.resetFields();
    setEvalModalVisible(true);
  };

  // 提交评价
  const handleSubmitEval = async () => {
    try {
      const values = await evalForm.validateFields();
      setSubmitting(true);
      await request.post(`/interviews/${evalRecord.id}/evaluate`, {
        evaluation: values.evaluation || '',
        result: values.result || '',
        round: evalRound,
      });
      message.success(`第${evalRound}面评价已提交`);
      setEvalModalVisible(false);
      fetchInterviews();
    } catch (e: any) {
      if (e.response) {
        message.error(e.response.data?.detail || '提交失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 查看评价（弹窗展示两个面的评价）
  const handleViewEval = (record: any) => {
    const content = (
      <div>
        {/* 一面评价 */}
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 16 }}>一面评价</Text>
          {record.evaluation ? (
            <>
              <div style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 12, borderRadius: 6, marginTop: 8 }}>
                {record.evaluation}
              </div>
              {record.result && (
                <div style={{ marginTop: 8 }}>
                  <Text strong>结果：</Text>
                  <Tag color={record.result === 'passed' ? 'success' : 'error'}>
                    {record.result === 'passed' ? '通过' : '不通过'}
                  </Tag>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#999', marginTop: 8 }}>暂未填写</div>
          )}
        </div>
        <Divider />
        {/* 二面评价 */}
        <div>
          <Text strong style={{ fontSize: 16 }}>二面评价</Text>
          {record.evaluation2 ? (
            <>
              <div style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 12, borderRadius: 6, marginTop: 8 }}>
                {record.evaluation2}
              </div>
              {record.result2 && (
                <div style={{ marginTop: 8 }}>
                  <Text strong>结果：</Text>
                  <Tag color={record.result2 === 'passed' ? 'success' : 'error'}>
                    {record.result2 === 'passed' ? '通过' : '不通过'}
                  </Tag>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#999', marginTop: 8 }}>暂未填写</div>
          )}
        </div>
      </div>
    );

    Modal.info({
      title: `${record.resume?.candidate_name || record.interviewer || ''} - 面试评价`,
      width: 560,
      content,
    });
  };

  const columns = [
    { title: '候选人', key: 'candidate', width: 110,
      render: (_: any, record: any) => record.resume?.candidate_name || record.interviewer || '未知' },
    { title: '岗位', key: 'position', width: 160,
      render: (_: any, record: any) => record.position?.title || record.interviewer || '未知岗位' },
    { title: '面试官', key: 'interviewer', width: 120,
      render: (_: any, record: any) => record.comments || record.interviewer || '待分配' },
    {
      title: '一面结果', key: 'result1', width: 100,
      render: (_: any, record: any) => {
        if (!record.result || record.result === 'pending') return <Tag>待评价</Tag>;
        const cfg = resultLabels[record.result];
        return <Tag color={cfg?.color}>{cfg?.text || record.result}</Tag>;
      }
    },
    {
      title: '二面结果', key: 'result2', width: 100,
      render: (_: any, record: any) => {
        const v = record.result2;
        if (!v || v === 'pending') return <Tag>待评价</Tag>;
        const cfg = resultLabels[v];
        return <Tag color={cfg?.color}>{cfg?.text || v}</Tag>;
      }
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => {
        const cfg = statusConfig[v] || { color: 'default', text: v };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      }
    },
    {
      title: '操作', key: 'action', width: 260, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          {/* 一面评价按钮：待面试状态可填写 */}
          {record.status === 'scheduled' && (
            <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => handleEvalRound1(record)}>
              一面评价
            </Button>
          )}
          {/* 二面评价按钮：一面已完成且二面待评价 */}
          {record.status === 'completed' && (!record.result2 || record.result2 === 'pending') && (
            <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => handleEvalRound2(record)}>
              二面评价
            </Button>
          )}
          {/* 查看评价按钮：有评价内容可查看 */}
          {(record.evaluation || record.evaluation2) && (
            <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewEval(record)}>
              查看评价
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card
        title="面试管理"
        extra={
          <Space>
            <Input.Search
              placeholder="搜索候选人姓名"
              allowClear
              style={{ width: 200 }}
              value={nameKeyword}
              onChange={e => setNameKeyword(e.target.value)}
              onSearch={v => setNameKeyword(v)}
            />
            <Select placeholder="状态筛选" allowClear style={{ width: 120 }} value={statusFilter} onChange={v => setStatusFilter(v)}>
              <Select.Option value="scheduled">待面试</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
              <Select.Option value="cancelled">已取消</Select.Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={fetchInterviews}>刷新</Button>
          </Space>
        }
      >
        <Table dataSource={data} columns={columns} rowKey="id" loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      {/* 评价弹窗（一面/二面共用） */}
      <Modal
        title={`填写第${evalRound}面评价 - ${evalRecord?.resume?.candidate_name || evalRecord?.interviewer || ''}`}
        open={evalModalVisible}
        onOk={handleSubmitEval}
        onCancel={() => setEvalModalVisible(false)}
        confirmLoading={submitting}
        okText={`提交第${evalRound}面评价`}
        width={520}
      >
        <Form form={evalForm} layout="vertical">
          <Form.Item
            name="evaluation"
            label={`第${evalRound}面评价`}
            rules={[{ required: true, message: `请填写第${evalRound}面评价` }]}
          >
            <TextArea rows={6} placeholder={`请填写面试官对候选人的第${evalRound}面评价...`} />
          </Form.Item>
          <Form.Item name="result" label={`第${evalRound}面结果`} rules={[{ required: true, message: '请选择面试结果' }]}>
            <Radio.Group>
              <Radio value="passed">
                <span style={{ color: '#52c41a' }}>✅ 通过</span>
              </Radio>
              <Radio value="failed">
                <span style={{ color: '#ff4d4f' }}>❌ 不通过</span>
              </Radio>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InterviewsList;
