import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, message, Button, Space } from 'antd';
import { ReloadOutlined, TeamOutlined } from '@ant-design/icons';
import request from '../../utils/request';

const InterviewerMappingList: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await request.get('/requisitions');
      const sorted = (res || []).sort((a: any, b: any) => {
        const aActive = a.status === 'open' || a.status === '招聘中' ? 0 : 1;
        const bActive = b.status === 'open' || b.status === '招聘中' ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return (a.department || '').localeCompare(b.department || '');
      });
      setData(sorted);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const columns = [
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => {
        const active = v === 'open' || v === '招聘中';
        return <Tag color={active ? 'green' : 'default'}>{active ? '招聘中' : (v || '-')}</Tag>;
      },
    },
    { title: '二级部门', dataIndex: 'department', key: 'department', width: 120 },
    { title: '三级部门', dataIndex: 'department_3rd', key: 'department_3rd', width: 120, render: (v: string) => v || '-' },
    { title: '招聘岗位', dataIndex: 'title', key: 'title', width: 160 },
    { title: '城市', dataIndex: 'city', key: 'city', width: 80, render: (v: string) => v || '-' },
    {
      title: '业务一面面试官', dataIndex: 'biz_interviewer', key: 'biz_interviewer', width: 130,
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : <Tag>-</Tag>,
    },
    { title: 'HR二面', dataIndex: 'hr_interviewer', key: 'hr_interviewer', width: 130, render: (v: string) => v || '-' },
    { title: '终面', dataIndex: 'final_interviewer', key: 'final_interviewer', width: 130, render: (v: string) => v || '-' },
    { title: '招聘人数', dataIndex: 'headcount', key: 'headcount', width: 80 },
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <TeamOutlined />
            <span>面试官映射表</span>
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>从飞书同步</Button>
        }
      >
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default InterviewerMappingList;
