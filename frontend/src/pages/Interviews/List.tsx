import React, { useEffect, useState } from 'react';
import { Table, Button, Space, message, Tag, Modal, Tooltip, Select } from 'antd';
import { PlusOutlined, DeleteOutlined, PlayCircleOutlined, EyeOutlined } from '@ant-design/icons';
import request from '../../utils/request';
import { useNavigate } from 'react-router-dom';

const InterviewsList: React.FC = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const navigate = useNavigate();

  const fetchInterviews = async () => {
    setLoading(true);
    try {
      const res = await request.get('/interviews');
      setData(res);
    } catch (error) {
      message.error('获取面试列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, []);

  const filteredData = statusFilter ? (data as any[]).filter((i) => i?.status === statusFilter) : data;

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条面试记录吗？此操作不可恢复。',
      okText: '确认',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await request.delete(`/interviews/${id}`);
          message.success('删除成功');
          fetchInterviews();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const columns = [
    { 
      title: '候选人', 
      dataIndex: ['resume', 'candidate_name'], 
      key: 'candidate_name',
      render: (text: string) => <span style={{ fontWeight: 500, color: '#0F172A' }}>{text || '未知'}</span>
    },
    { 
      title: '岗位', 
      dataIndex: ['position', 'title'], 
      key: 'position',
      render: (text: string) => <span style={{ color: '#64748B' }}>{text || '未知'}</span>
    },
    { title: '面试官', dataIndex: 'interviewer', key: 'interviewer' },
    { 
      title: '面试时间', 
      dataIndex: 'interview_time', 
      key: 'interview_time',
      sorter: (a: any, b: any) => {
        const at = a?.interview_time ? new Date(a.interview_time).getTime() : 0;
        const bt = b?.interview_time ? new Date(b.interview_time).getTime() : 0;
        return at - bt;
      },
      render: (time: string) => time ? new Date(time).toLocaleString() : '-'
    },
    { 
      title: '总分', 
      key: 'total_score',
      render: (_, record: any) => {
        if (!record.scores) return '-';
        const values = Object.values(record.scores) as number[];
        if (values.length === 0) return '-';
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = (sum / values.length).toFixed(1);
        return <span style={{ fontWeight: 600, color: '#0F172A' }}>{avg}</span>;
      }
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => {
        const map: Record<string, {text: string, color: string}> = {
          scheduled: { text: '待面试', color: 'blue' },
          completed: { text: '已完成', color: 'green' },
          cancelled: { text: '已取消', color: 'default' }
        };
        const info = map[status] || { text: status, color: 'default' };
        return <Tag color={info.color} style={{ border: 'none' }}>{info.text}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record: any) => {
        // Check if interview is pending confirmation (has scores but status not completed)
        const isPendingConfirmation = record.status !== 'completed' && 
                                      (record.result === 'pending' && record.scores && Object.keys(record.scores).length > 0);
                                      
        return (
        <Space size="small">
          {record.status !== 'completed' && !isPendingConfirmation && (
            <Tooltip title="开始面试">
              <Button type="text" icon={<PlayCircleOutlined style={{ color: '#3B82F6' }} />} onClick={() => navigate(`/interviews/${record.id}/score`)} />
            </Tooltip>
          )}
          
          {(record.status === 'completed' || isPendingConfirmation) && (
             <Tooltip title={isPendingConfirmation ? "确认结果" : "查看结果"}>
               <Button type="text" icon={<EyeOutlined style={{ color: isPendingConfirmation ? '#F59E0B' : '#10B981' }} />} onClick={() => navigate(`/interviews/${record.id}/result`)} />
             </Tooltip>
          )}
          <Tooltip title="删除">
            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
          </Tooltip>
        </Space>
      )},
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <Select
          placeholder="筛选状态"
          allowClear
          value={statusFilter}
          onChange={(val) => setStatusFilter(val)}
          style={{ width: 160 }}
          options={[
            { value: 'scheduled', label: '待面试' },
            { value: 'completed', label: '已完成' },
            { value: 'cancelled', label: '已取消' },
          ]}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/resumes')}>安排面试</Button>
      </div>
      <Table 
        columns={columns} 
        dataSource={filteredData} 
        loading={loading} 
        rowKey="id" 
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />
    </div>
  );
};

export default InterviewsList;
