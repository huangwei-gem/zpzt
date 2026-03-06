import React, { useEffect, useState } from 'react';
import { Card, Typography, Spin, message, Tag, Avatar, Button } from 'antd';
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import request from '../../utils/request';
import { useNavigate } from 'react-router-dom';
import { UserOutlined, UnorderedListOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const STAGES = {
  new: '新简历',
  screening: '筛选中',
  dept_review: '部门评审',
  hr_decision: 'HR决策',
  interview: '面试中',
  offer: '待发Offer',
  hired: '已录用',
  waitlist: '备选池',
  rejected: '已淘汰'
};

const STAGE_COLORS = {
  new: 'blue',
  screening: 'cyan',
  dept_review: 'geekblue',
  hr_decision: 'purple',
  interview: 'geekblue',
  offer: 'purple',
  hired: 'green',
  waitlist: 'gold',
  rejected: 'red'
};

interface ResumeCardProps {
  resume: any;
  id: string;
}

const ResumeCard = ({ resume, id }: ResumeCardProps) => {
  const navigate = useNavigate();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: id, data: { resume } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
    marginBottom: 8,
    background: '#fff',
    padding: 12,
    borderRadius: 8,
    border: '1px solid #f0f0f0',
    boxShadow: isDragging ? '0 5px 15px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.05)'
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={() => navigate(`/resumes/${resume.id}`)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text strong>{resume.candidate_name}</Text>
        <Tag color={resume.match_score >= 80 ? 'green' : resume.match_score >= 60 ? 'orange' : 'red'}>
          {resume.match_score}%
        </Tag>
      </div>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
        {resume.position?.title}
      </Text>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <Text type="secondary" style={{ fontSize: 12 }}>{resume.parsed_data?.years_of_experience || 0}年</Text>
         <Avatar size="small" icon={<UserOutlined />} />
      </div>
    </div>
  );
};

const DroppableColumn = ({ id, items, title }: { id: string, items: any[], title: string }) => {
  const { setNodeRef } = useSortable({ id });

  return (
    <div style={{ 
      background: '#f5f5f5', 
      padding: 12, 
      borderRadius: 8, 
      width: 280,
      minHeight: 500,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong>{title}</Text>
        <Tag>{items.length}</Tag>
      </div>
      <SortableContext id={id} items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} style={{ flex: 1 }}>
          {items.map((resume) => (
            <ResumeCard key={resume.id} id={resume.id} resume={resume} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
};

const KanbanBoard: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Record<string, any[]>>({
    new: [],
    screening: [],
    dept_review: [],
    hr_decision: [],
    interview: [],
    offer: [],
    hired: [],
    waitlist: [],
    rejected: []
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    setLoading(true);
    try {
      const res = await request.get('/resumes/kanban');
      // Group by stage
      const grouped: Record<string, any[]> = {
        new: [], screening: [], dept_review: [], hr_decision: [], interview: [], offer: [], hired: [], waitlist: [], rejected: []
      };

      (res as any[]).forEach(r => {
        const stage = r.stage || 'new';
        if (grouped[stage]) {
          grouped[stage].push(r);
        } else {
          // Fallback if stage is unknown
          grouped['new'].push(r);
        }
      });
      setItems(grouped);
    } catch (error) {
      message.error('获取看板数据失败');
    } finally {
      setLoading(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Find source and dest containers
    let sourceContainer: string | undefined;
    let destContainer: string | undefined;

    // Helper to find container
    const findContainer = (id: string) => {
      if (id in items) return id;
      return Object.keys(items).find(key => items[key].find(i => i.id === id));
    };

    sourceContainer = findContainer(activeId);
    destContainer = findContainer(overId);

    if (!sourceContainer || !destContainer || sourceContainer === destContainer) {
      return;
    }
    
    // Optimistic update
    const activeItem = items[sourceContainer].find(i => i.id === activeId);
    
    setItems(prev => {
      const sourceItems = [...prev[sourceContainer]];
      const destItems = [...prev[destContainer]];
      
      const itemIndex = sourceItems.findIndex(i => i.id === activeId);
      sourceItems.splice(itemIndex, 1);
      destItems.push({ ...activeItem, stage: destContainer });
      
      return {
        ...prev,
        [sourceContainer]: sourceItems,
        [destContainer]: destItems
      };
    });

    // API update
    try {
      await request.put(`/resumes/${activeId}`, { stage: destContainer });
      message.success('状态更新成功');
    } catch (error) {
      message.error('更新失败');
      fetchResumes(); // Revert on error
    }
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const sourceContainer = Object.keys(items).find(key => items[key].find(i => i.id === activeId));
    const destContainer = (overId in items) ? overId : Object.keys(items).find(key => items[key].find(i => i.id === overId));

    if (!sourceContainer || !destContainer || sourceContainer === destContainer) {
      return;
    }

    // Move item in UI only for visual feedback (optional, handled by DragEnd mainly for simple Kanban)
  };

  if (loading && !activeId) {
     return <div style={{ textAlign: 'center', marginTop: 50 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>招聘看板</Title>
          <Text type="secondary">拖拽卡片以更新候选人状态</Text>
        </div>
        <Button icon={<UnorderedListOutlined />} onClick={() => navigate('/resumes')}>列表视图</Button>
      </div>
      
      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCorners} 
        onDragStart={handleDragStart} 
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 24 }}>
          {Object.keys(STAGES).map(stageKey => (
            <DroppableColumn 
              key={stageKey} 
              id={stageKey} 
              title={STAGES[stageKey as keyof typeof STAGES]} 
              items={items[stageKey]} 
            />
          ))}
        </div>
        
        <DragOverlay>
          {activeId ? (
             <div style={{ 
               padding: 12, 
               background: '#fff', 
               borderRadius: 8, 
               boxShadow: '0 5px 15px rgba(0,0,0,0.15)',
               border: '1px solid #1890ff',
               width: 280
             }}>
               Dragging...
             </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default KanbanBoard;
