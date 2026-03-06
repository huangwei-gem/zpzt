import React, { useEffect, useState } from 'react';
import { Table, Button, Space, message, Tag, Modal, Tooltip, Typography, Form, Select, Upload, Input, DatePicker, InputNumber, Card } from 'antd';
import { PlusOutlined, EyeOutlined, TeamOutlined, DeleteOutlined, UploadOutlined, ReloadOutlined, CloseCircleOutlined, SearchOutlined, UndoOutlined, AppstoreOutlined, BarsOutlined, SolutionOutlined } from '@ant-design/icons';
import request from '../../utils/request';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

import { useAuth } from '../../contexts/AuthContext';

const ResumesList: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [positions, setPositions] = useState([]);
  const [questionBanks, setQuestionBanks] = useState([]);
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [interviewModalVisible, setInterviewModalVisible] = useState(false);
  const [interviewRecord, setInterviewRecord] = useState<any>(null);
  
  const [fileList, setFileList] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  const [form] = Form.useForm();
  const [interviewForm] = Form.useForm();
  
  const navigate = useNavigate();

  const [searchName, setSearchName] = useState('');
  const [searchStatus, setSearchStatus] = useState<string | undefined>(undefined);

  const fetchResumes = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (searchName) params.candidate_name = searchName;
      if (searchStatus) params.status = searchStatus;

      // 如果是面试官，只显示被指派给自己的简历
      if (user?.role === 'interviewer') {
        params.reviewer_id = user.id;
      }

      const res = await request.get('/resumes', { params });
      setData(res);
    } catch (error) {
      message.error('获取简历列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchPositions = async () => {
    try {
      const res = await request.get('/positions');
      setPositions(res);
    } catch (error) {
      console.error('获取岗位列表失败');
    }
  };

  const fetchQuestionBanks = async () => {
    try {
      const res = await request.get('/question-banks');
      setQuestionBanks(res);
    } catch (error) {
      console.error('获取题库列表失败');
    }
  };

  const [interviewers, setInterviewers] = useState([]);

  const fetchInterviewers = async () => {
    try {
      const res = await request.get('/auth/interviewers');
      setInterviewers(res);
    } catch (error) {
      console.error('获取面试官列表失败');
    }
  };

  useEffect(() => {
    fetchResumes();
    fetchPositions();
    fetchQuestionBanks();
    fetchInterviewers();
  }, []);

  const handleSearch = () => {
    fetchResumes();
  };

  const handleReset = () => {
    setSearchName('');
    setSearchStatus(undefined);
    // Use a timeout or effect to trigger fetch after state update, or pass params directly
    // Here we'll just call fetch with empty params manually to be safe/quick
    setLoading(true);
    request.get('/resumes')
      .then(res => setData(res))
      .catch(() => message.error('获取简历列表失败'))
      .finally(() => setLoading(false));
  };

  const handleCreateInterviewClick = (record: any) => {
    setInterviewRecord(record);
    interviewForm.resetFields();
    interviewForm.setFieldsValue({
      // interviewer: '面试官', // No longer defaulting to string
      question_count: 5
    });
    setInterviewModalVisible(true);
  };

  const handleInterviewOk = async () => {
    try {
      const values = await interviewForm.validateFields();
      setSubmitting(true);
      
      const res = await request.post('/interviews', {
        resume_id: interviewRecord.id,
        position_id: interviewRecord.position_id,
        interviewer: '面试小组', // Placeholder for backward compatibility
        panel_members: values.panel_members,
        interview_time: values.interview_time ? values.interview_time.toISOString() : new Date().toISOString(),
        question_bank_ids: values.question_bank_ids,
        question_count: values.question_count
      });
      
      message.success('面试安排成功');
      setInterviewModalVisible(false);
      navigate(`/interviews/${res.id}/score`);
    } catch (error) {
      message.error('安排面试失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = (id: string) => {
    Modal.confirm({
      title: '确认淘汰',
      content: '确定要淘汰这份简历吗？',
      okText: '确认',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await request.put(`/resumes/${id}`, { status: 'rejected' });
          message.success('已标记为淘汰');
          fetchResumes();
        } catch (error) {
          message.error('操作失败');
        }
      },
    });
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这份简历吗？此操作不可恢复。',
      okText: '确认',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await request.delete(`/resumes/${id}`);
          message.success('删除成功');
          fetchResumes();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleReparse = (record: any) => {
    Modal.confirm({
      title: '重新解析简历',
      content: '将重新调用 AI 解析该简历，并覆盖现有解析结果。',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await request.post(`/resumes/${record.id}/reparse`);
          message.success('已开始重新解析');
          fetchResumes();
        } catch (error) {
          message.error('重新解析失败');
        }
      },
    });
  };

  const handleRestore = (id: string) => {
    Modal.confirm({
      title: '确认恢复',
      content: '确定要恢复这份简历吗？恢复后状态将变为“待评审”。',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await request.put(`/resumes/${id}`, { status: 'pending_review' });
          message.success('已恢复简历状态');
          fetchResumes();
        } catch (error) {
          message.error('操作失败');
        }
      },
    });
  };

  const handleUploadClick = () => {
    form.resetFields();
    setFileList([]);
    setIsModalVisible(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (fileList.length === 0) {
        message.error('请上传简历文件');
        return;
      }

      setSubmitting(true);
      
      // Determine if single or batch upload
      if (fileList.length === 1) {
        const formData = new FormData();
        formData.append('position_id', values.position_id);
        formData.append('file', fileList[0]);
        await request.post('/resumes', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        message.success('简历上传成功，AI正在解析中...');
      } else {
        const formData = new FormData();
        formData.append('position_id', values.position_id);
        fileList.forEach(file => {
          formData.append('files', file);
        });
        await request.post('/resumes/batch', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        message.success(`成功上传 ${fileList.length} 份简历，AI正在解析中...`);
      }

      setIsModalVisible(false);
      fetchResumes();
    } catch (error) {
      message.error('上传失败');
    } finally {
      setSubmitting(false);
    }
  };

  const uploadProps = {
    onRemove: (file: any) => {
      setFileList((prev) => {
        const index = prev.indexOf(file);
        const newFileList = prev.slice();
        newFileList.splice(index, 1);
        return newFileList;
      });
    },
    beforeUpload: (file: any) => {
      setFileList((prev) => [...prev, file]);
      return false;
    },
    fileList,
    multiple: true
  };

  const columns = [
    { 
      title: '候选人', 
      dataIndex: 'candidate_name', 
      key: 'candidate_name',
      render: (text: string) => <span style={{ fontWeight: 500, color: '#0F172A' }}>{text || '解析中...'}</span>
    },
    { title: '联系方式', dataIndex: 'contact', key: 'contact' },
    { title: '应聘岗位', dataIndex: ['position', 'title'], key: 'position' },
    { 
      title: '匹配度', 
      dataIndex: 'match_score', 
      key: 'match_score', 
      sorter: (a: any, b: any) => a.match_score - b.match_score,
      render: (score: number) => (
        <span style={{ 
          color: score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444',
          fontWeight: 600 
        }}>
          {score > 0 ? `${score}分` : '-'}
        </span>
      )
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string, record: any) => {
        if (record?.parse_status === 'failed') {
          const tag = <Tag color="error">解析失败</Tag>;
          return record?.parse_error ? <Tooltip title={record.parse_error}>{tag}</Tooltip> : tag;
        }
        if (record?.parse_status === 'processing') {
          return <Tag color="processing">解析中</Tag>;
        }
        let color = 'default';
        let text = status;
        switch(status) {
          case 'pending_screening': color = 'processing'; text = '解析中'; break;
          case 'pending_review': color = 'warning'; text = '待评审'; break;
          case 'pending_dept_review': color = 'cyan'; text = '待部门评审'; break;
          case 'pending_hr_decision': color = 'purple'; text = '待HR决策'; break;
          case 'auto_rejected_pending_review': color = 'orange'; text = 'AI建议淘汰'; break;
          case 'pending_interview': color = 'geekblue'; text = '待面试'; break;
          case 'waitlist': color = 'gold'; text = '备选'; break;
          case 'completed': color = 'success'; text = '已完成'; break;
          case 'rejected': color = 'error'; text = '已淘汰'; break;
          default: break;
        }
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record: any) => {
        // 面试官只能查看和评审
        if (user?.role === 'interviewer') {
          return (
            <Space size="small">
              <Button type="primary" icon={<EyeOutlined />} onClick={() => navigate(`/resumes/${record.id}`)}>
                查看并评审
              </Button>
            </Space>
          );
        }

        // HR和管理员的操作
        // 只有初审通过（pending_interview）才能安排面试
        const canScheduleInterview = record.status === 'pending_interview';
        // 可以进行评审操作的状态
        const canReview = ['pending_review', 'pending_dept_review', 'pending_hr_decision', 'auto_rejected_pending_review'].includes(record.status);

        return (
          <Space size="small">
            <Tooltip title="查看详情">
              <Button type="text" icon={<EyeOutlined style={{ color: '#3B82F6' }} />} onClick={() => navigate(`/resumes/${record.id}`)} />
            </Tooltip>
            {/* Only Admin and HR can schedule interviews - only after initial review passed */}
            {(user?.role === 'admin' || user?.role === 'hr') && canScheduleInterview && (
              <Tooltip title="安排面试">
                <Button type="text" icon={<TeamOutlined style={{ color: '#10B981' }} />} onClick={() => handleCreateInterviewClick(record)} />
              </Tooltip>
            )}
            {/* 如果可以评审，显示评审入口提示 */}
            {(user?.role === 'admin' || user?.role === 'hr') && canReview && (
              <Tooltip title="进入评审">
                <Button type="text" icon={<SolutionOutlined style={{ color: '#8B5CF6' }} />} onClick={() => navigate(`/resumes/${record.id}`)} />
              </Tooltip>
            )}
            {record.status === 'rejected' && (
              <Tooltip title="恢复">
                 <Button type="text" icon={<UndoOutlined />} onClick={() => handleRestore(record.id)} />
              </Tooltip>
            )}
            {(user?.role === 'admin' || user?.role === 'hr') && (
              <Tooltip title="重新解析">
                <Button
                  type="text"
                  icon={<ReloadOutlined />}
                  onClick={() => handleReparse(record)}
                  disabled={record?.parse_status === 'processing'}
                />
              </Tooltip>
            )}
            {record.status !== 'rejected' && record.status !== 'completed' && (
              <Tooltip title="淘汰">
                 <Button type="text" danger icon={<CloseCircleOutlined />} onClick={() => handleReject(record.id)} />
              </Tooltip>
            )}
            <Tooltip title="删除">
              <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>
            {user?.role === 'interviewer' ? '我的待评审' : '简历管理'}
          </Title>
          <Text type="secondary">
            {user?.role === 'interviewer' ? '被指派给您的待评审简历' : '管理候选人简历及面试流程'}
          </Text>
        </div>
        <Space>
          {user?.role !== 'interviewer' && (
            <>
              <Tooltip title="看板视图">
                <Button icon={<AppstoreOutlined />} onClick={() => navigate('/resumes/kanban')} />
              </Tooltip>
              <Button icon={<ReloadOutlined />} onClick={fetchResumes}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleUploadClick} size="large" style={{ borderRadius: '8px' }}>上传简历</Button>
            </>
          )}
          {user?.role === 'interviewer' && (
            <Button icon={<ReloadOutlined />} onClick={fetchResumes}>刷新</Button>
          )}
        </Space>
      </div>

      {user?.role !== 'interviewer' && (
        <Card style={{ marginBottom: 24, borderRadius: '8px' }} bodyStyle={{ padding: '24px' }}>
          <Form layout="inline">
            <Form.Item label="候选人">
              <Input
                placeholder="请输入姓名"
                value={searchName}
                onChange={e => setSearchName(e.target.value)}
                style={{ width: 200 }}
                allowClear
              />
            </Form.Item>
            <Form.Item label="状态">
              <Select
                placeholder="请选择状态"
                value={searchStatus}
                onChange={val => setSearchStatus(val)}
                style={{ width: 150 }}
                allowClear
              >
                <Select.Option value="pending_screening">解析中</Select.Option>
                <Select.Option value="pending_review">待评审</Select.Option>
                <Select.Option value="pending_dept_review">待部门评审</Select.Option>
                <Select.Option value="pending_hr_decision">待HR决策</Select.Option>
                <Select.Option value="auto_rejected_pending_review">AI建议淘汰</Select.Option>
                <Select.Option value="pending_interview">待面试</Select.Option>
                <Select.Option value="waitlist">备选</Select.Option>
                <Select.Option value="completed">已完成</Select.Option>
                <Select.Option value="rejected">已淘汰</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
                <Button onClick={handleReset}>重置</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      )}

      <Table 
        columns={columns} 
        dataSource={data} 
        loading={loading} 
        rowKey="id" 
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />

      {/* Upload Modal */}
      <Modal
        title="上传简历"
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        confirmLoading={submitting}
        width={500}
        centered
        destroyOnClose
        okText="上传"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 24 }}
        >
          <Form.Item
            name="position_id"
            label="应聘岗位"
            rules={[{ required: true, message: '请选择应聘岗位' }]}
          >
            <Select placeholder="请选择应聘岗位" size="large">
              {positions.map((pos: any) => (
                <Select.Option key={pos.id} value={pos.id}>{pos.title}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="file"
            label="简历文件"
            rules={[{ required: true, message: '请上传简历文件' }]}
            extra="支持批量上传 PDF, Word, Txt 格式"
          >
            <Upload {...uploadProps} maxCount={10}>
              <Button icon={<UploadOutlined />} size="large">选择文件（可多选）</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* Interview Modal */}
      <Modal
        title="安排面试"
        open={interviewModalVisible}
        onOk={handleInterviewOk}
        onCancel={() => setInterviewModalVisible(false)}
        confirmLoading={submitting}
        width={600}
        centered
        destroyOnClose
        okText="生成面试题"
        cancelText="取消"
      >
        <Form
          form={interviewForm}
          layout="vertical"
          style={{ marginTop: 24 }}
        >
          <Form.Item
            name="panel_members"
            label="面试官"
            rules={[{ required: true, message: '请选择面试官' }]}
            extra="选择参与此次面试的面试官（可多选）"
          >
            <Select 
              mode="multiple"
              placeholder="选择面试官" 
              size="large"
              style={{ width: '100%' }}
            >
              {interviewers.map((user: any) => (
                <Select.Option key={user.id} value={user.id}>{user.full_name || user.email}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="interview_time"
            label="面试时间"
          >
            <DatePicker showTime style={{ width: '100%' }} size="large" />
          </Form.Item>

          <Form.Item
            name="question_bank_ids"
            label="参考题库"
            extra="选择题库后，AI 将参考题库内容生成更精准的面试题"
          >
            <Select 
              mode="multiple" 
              placeholder="选择参考题库" 
              size="large"
              style={{ width: '100%' }}
            >
              {questionBanks.map((qb: any) => (
                <Select.Option key={qb.id} value={qb.id}>{qb.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="question_count"
            label="生成题目数量"
            initialValue={5}
          >
            <InputNumber min={1} max={20} size="large" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ResumesList;
