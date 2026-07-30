import React, { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Space, Typography, message, Divider, Tag, Tabs, Tooltip, Table, Modal } from 'antd';
import { SaveOutlined, ReloadOutlined, KeyOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import request from '../../utils/request';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;

type SystemSettings = {
  llm_base_url?: string | null;
  llm_model: string;
  llm_api_key_set: boolean;
  llm_api_key_last4?: string | null;
};

type PromptConfigItem = {
  system: string;
  user: string;
};

type PromptConfigs = {
  prompts: Record<string, PromptConfigItem>;
};

type PromptVariable = {
  name: string;
  description: string;
};

type PromptVariablesResponse = {
  variables_by_prompt: Record<string, PromptVariable[]>;
  all_variables: Record<string, string>;
};

type ApiKeyStatus = {
  set: boolean;
  updated_at: string | null;
  last4?: string;
};

const promptNames: Record<string, string> = {
  generate_jd: 'JD 生成',
  analyze_resume: '简历分析',
  parse_resume_pdf: 'PDF简历解析',
  generate_resume_markdown: '简历 Markdown 生成',
  generate_interview_questions: '面试题目生成',
  generate_interview_evaluation: '面试评价生成',
  generate_interview_evaluation_from_transcript: '转写评价生成',
  generate_coding_test_evaluation: '笔试代码评价',
};

const API_KEY_LABELS: Record<string, string> = {
  AGNES_API_KEY: 'Agnes AI 密钥',
  AGNES_BASE_URL: 'Agnes API 地址',
  MINERU_API_KEY: 'MinerU PDF 解析密钥',
  AI_API_KEY: 'DeepSeek/AI 备用密钥',
  AI_BASE_URL: 'DeepSeek API 地址',
};

const API_KEY_PLACEHOLDERS: Record<string, string> = {
  AGNES_API_KEY: 'sk-... 设置后不会回显',
  AGNES_BASE_URL: 'https://api.agnes-ai.com/v1',
  MINERU_API_KEY: 'sk-... 设置后不会回显',
  AI_API_KEY: 'sk-... 设置后不会回显',
  AI_BASE_URL: 'https://api.deepseek.com',
};

const SystemSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState<SystemSettings | null>(null);
  const [editingKey, setEditingKey] = useState(false);
  const role = (user as any)?.role?.value ?? (user as any)?.role;

  // API 密钥管理
  const [apiKeys, setApiKeys] = useState<Record<string, ApiKeyStatus>>({});
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [apiKeysSaving, setApiKeysSaving] = useState(false);
  const [keyEditValues, setKeyEditValues] = useState<Record<string, string>>({});
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  // 提示词配置
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptConfigs, setPromptConfigs] = useState<PromptConfigs | null>(null);
  const [activePromptKey, setActivePromptKey] = useState('generate_jd');
  const [promptForm] = Form.useForm();
  const [promptVariables, setPromptVariables] = useState<PromptVariablesResponse | null>(null);
  const [userPromptRef, setUserPromptRef] = useState<React.RefObject<any>>(React.createRef());

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = (await request.get('/settings/system')) as SystemSettings;
      setMeta(res);
      form.setFieldsValue({
        llm_base_url: res.llm_base_url || undefined,
        llm_model: res.llm_model || 'qwen3.5-plus',
        llm_api_key: '',
      });
      setEditingKey(false);
    } catch (e) {
      const status = (e as any)?.response?.status;
      if (status === 403) message.error('无权限访问系统设置');
      else message.error('获取系统设置失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchApiKeys = async () => {
    setApiKeysLoading(true);
    try {
      const res = (await request.get('/system/keys')) as Record<string, ApiKeyStatus>;
      setApiKeys(res);
      setKeyEditValues({});
    } catch {
      message.error('获取密钥状态失败');
    } finally {
      setApiKeysLoading(false);
    }
  };

  const fetchPromptConfigs = async () => {
    setPromptLoading(true);
    try {
      const res = (await request.get('/settings/prompts')) as PromptConfigs;
      setPromptConfigs(res);
      const currentPrompt = res.prompts[activePromptKey];
      if (currentPrompt) {
        promptForm.setFieldsValue({
          system: currentPrompt.system,
          user: currentPrompt.user,
        });
      }
    } catch {
      // 提示词接口可能不存在
    } finally {
      setPromptLoading(false);
    }
  };

  const fetchPromptVariables = async () => {
    try {
      const res = (await request.get('/settings/prompts/variables')) as PromptVariablesResponse;
      setPromptVariables(res);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (role !== 'admin') return;
    fetchSettings();
    fetchApiKeys();
    fetchPromptConfigs();
    fetchPromptVariables();
  }, [role]);

  useEffect(() => {
    if (promptConfigs?.prompts?.[activePromptKey]) {
      promptForm.setFieldsValue({
        system: promptConfigs.prompts[activePromptKey].system,
        user: promptConfigs.prompts[activePromptKey].user,
      });
    }
  }, [activePromptKey, promptConfigs, promptForm]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload: any = {
        llm_base_url: values.llm_base_url || null,
        llm_model: values.llm_model,
      };
      if (values.llm_api_key && values.llm_api_key.trim()) {
        payload.llm_api_key = values.llm_api_key.trim();
      }
      setSaving(true);
      await request.put('/settings/system', payload);
      form.setFieldsValue({ llm_api_key: '' });
      await fetchSettings();
      message.success('模型配置已保存');
    } catch (e) {
      const status = (e as any)?.response?.status;
      if (status === 403) message.error('无权限保存');
      else if (status === 400) message.error((e as any)?.response?.data?.detail || '参数不合法');
      else message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApiKeys = async () => {
    setApiKeysSaving(true);
    try {
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(keyEditValues)) {
        if (v !== undefined && v !== null) {
          payload[k] = v;
        }
      }
      if (Object.keys(payload).length === 0) {
        message.info('没有要保存的修改');
        return;
      }
      await request.put('/system/keys', payload);
      setKeyEditValues({});
      await fetchApiKeys();
      message.success('密钥已保存');
    } catch {
      message.error('保存密钥失败');
    } finally {
      setApiKeysSaving(false);
    }
  };

  const handleSavePrompt = async () => {
    try {
      const values = await promptForm.validateFields();
      setPromptSaving(true);
      await request.put('/settings/prompts', {
        key: activePromptKey,
        system: values.system,
        user: values.user,
      });
      message.success('提示词已保存');
      await fetchPromptConfigs();
    } catch (e: any) {
      if (e.errorFields) return;
      message.error('保存提示词失败');
    } finally {
      setPromptSaving(false);
    }
  };

  const handleInsertVariable = (variableName: string) => {
    const variableText = `{${variableName}}`;
    const currentValue = promptForm.getFieldValue('user') || '';
    promptForm.setFieldsValue({ user: currentValue + variableText });
  };

  const handleKeyValueChange = (key: string, value: string) => {
    setKeyEditValues(prev => ({ ...prev, [key]: value }));
  };

  const toggleKeyVisibility = (key: string) => {
    setVisibleKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (role !== 'admin') {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Text type="secondary">仅管理员可查看系统设置</Text>
      </div>
    );
  }

  // API 密钥表格列
  const apiKeyColumns = [
    {
      title: '密钥名称',
      dataIndex: 'key',
      key: 'key',
      width: 200,
      render: (k: string) => <Text strong>{API_KEY_LABELS[k] || k}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'key',
      key: 'status',
      width: 100,
      render: (k: string) => {
        const status = apiKeys[k];
        return status?.set ? <Tag color="green">已设置</Tag> : <Tag color="red">未设置</Tag>;
      },
    },
    {
      title: '当前值',
      key: 'current',
      width: 160,
      render: (_: any, record: string) => {
        const status = apiKeys[record];
        if (!status?.set) return <Text type="secondary">-</Text>;
        if (record.endsWith('_URL')) return <Text type="secondary">已设置</Text>;
        return <Text code>{'****' + (status?.last4 || '')}</Text>;
      },
    },
    {
      title: '新值',
      key: 'edit',
      render: (_: any, record: string) => {
        const isUrl = record.endsWith('_URL');
        const isSet = apiKeys[record]?.set;
        const showClear = keyEditValues[record] === '__clear__';
        if (showClear) {
          return <Button size="small" danger onClick={() => setKeyEditValues(prev => ({ ...prev, [record]: '' }))}>取消清除</Button>;
        }
        if (isUrl) {
          return (
            <Input
              size="small"
              style={{ width: 300 }}
              placeholder={API_KEY_PLACEHOLDERS[record] || ''}
              value={keyEditValues[record] ?? ''}
              onChange={e => handleKeyValueChange(record, e.target.value)}
            />
          );
        }
        const isVisible = visibleKeys[record];
        return (
          <Space>
            <Input
              size="small"
              style={{ width: 280 }}
              type={isVisible ? 'text' : 'password'}
              placeholder={API_KEY_PLACEHOLDERS[record] || ''}
              value={keyEditValues[record] ?? ''}
              onChange={e => handleKeyValueChange(record, e.target.value)}
            />
            <Button
              size="small"
              icon={isVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => toggleKeyVisibility(record)}
            />
            {isSet && (
              <Button size="small" danger onClick={() => {
                handleKeyValueChange(record, '');
                setKeyEditValues(prev => ({ ...prev, [record]: '__clear__' }));
              }}>清除</Button>
            )}
          </Space>
        );
      },
    },
  ];

  const apiKeyData = ['AGNES_API_KEY', 'AGNES_BASE_URL', 'MINERU_API_KEY', 'AI_API_KEY', 'AI_BASE_URL'];
  const hasKeyChanges = Object.values(keyEditValues).some(v => v !== undefined && v !== '');

  // 提示词 Tabs
  const promptTabs = promptConfigs ? Object.keys(promptConfigs.prompts).map(key => ({
    key,
    label: promptNames[key] || key,
    children: (
      <Form form={promptForm} layout="vertical" autoComplete="off" key={key}>
        <Form.Item
          name="system"
          label="System Prompt"
          rules={[{ required: true, message: '请输入 System Prompt' }]}
        >
          <Input.TextArea rows={4} placeholder="系统提示词，定义 AI 的角色和行为" />
        </Form.Item>
        <Form.Item
          name="user"
          label="User Prompt"
          rules={[{ required: true, message: '请输入 User Prompt' }]}
        >
          <Input.TextArea rows={10} placeholder="用户提示词模板，包含具体任务指令" />
        </Form.Item>
        {promptVariables?.variables_by_prompt[key] && (
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ marginRight: 8 }}>可用变量：</Text>
            <div style={{ marginTop: 8 }}>
              {promptVariables.variables_by_prompt[key].map(variable => (
                <Tooltip key={variable.name} title={variable.description}>
                  <Tag color="blue" style={{ cursor: 'pointer', marginBottom: 4 }} onClick={() => handleInsertVariable(variable.name)}>
                    {`{${variable.name}}`}
                  </Tag>
                </Tooltip>
              ))}
            </div>
          </div>
        )}
        <Button type="primary" onClick={handleSavePrompt} loading={promptSaving}>
          保存提示词
        </Button>
      </Form>
    ),
  })) : [];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <Title level={2} style={{ margin: 0 }}>系统设置</Title>
        <Text type="secondary">配置 AI 模型参数、API 密钥与提示词模板</Text>
      </div>

      {/* AI 模型配置 */}
      <Card
        title="AI 模型配置"
        style={{ marginBottom: 24 }}
        loading={loading}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchSettings}>刷新</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>保存</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" autoComplete="off" style={{ maxWidth: 640 }}>
          <input type="text" name="username" autoComplete="username" style={{ display: 'none' }} />
          <input type="password" name="password" autoComplete="current-password" style={{ display: 'none' }} />

          <Form.Item name="llm_base_url" label="Base URL">
            <Input placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" autoComplete="off" />
          </Form.Item>

          <Form.Item
            name="llm_model"
            label="模型名称"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="qwen-plus / qwen3.5-plus" autoComplete="off" />
          </Form.Item>

          <Form.Item
            name="llm_api_key"
            label="API Key"
            extra={
              <Space direction="vertical" size={4}>
                <Text type="secondary">
                  {meta?.llm_api_key_set
                    ? `已设置${meta?.llm_api_key_last4 ? `（末 4 位：${meta.llm_api_key_last4}）` : ''}`
                    : '未设置，请先配置 API Key'}
                </Text>
                {meta?.llm_api_key_set && !editingKey && (
                  <Button type="link" onClick={() => setEditingKey(true)} style={{ padding: 0, height: 'auto' }}>
                    更换 API Key
                  </Button>
                )}
              </Space>
            }
            rules={[
              {
                validator: async (_, value) => {
                  const trimmed = (value || '').trim();
                  if (!meta?.llm_api_key_set && !trimmed) throw new Error('请先配置 API Key');
                  if (editingKey && !trimmed) throw new Error('请输入新的 API Key');
                },
              },
            ]}
          >
            <Input.Password
              placeholder={meta?.llm_api_key_set && !editingKey ? '已设置（不会回显）' : '输入后会覆盖当前 Key'}
              autoComplete="new-password"
              disabled={!!(meta?.llm_api_key_set && !editingKey)}
            />
          </Form.Item>
        </Form>
      </Card>

      {/* API 密钥管理 */}
      <Card
        title={<Space><KeyOutlined />API 密钥管理</Space>}
        style={{ marginBottom: 24 }}
        loading={apiKeysLoading}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchApiKeys}>刷新</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveApiKeys}
              loading={apiKeysSaving}
              disabled={!hasKeyChanges}
            >
              保存密钥
            </Button>
          </Space>
        }
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          配置各 API 服务的密钥，保存后立即生效。密钥存储在数据库中，不会在页面回显完整值。
        </Text>
        <Table
          dataSource={apiKeyData}
          columns={apiKeyColumns}
          rowKey={k => k}
          pagination={false}
          bordered
          size="small"
        />
      </Card>

      {/* 提示词配置 */}
      <Card
        title="提示词模板"
        loading={promptLoading}
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchPromptConfigs}>刷新</Button>
        }
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          自定义各功能的 AI 提示词模板。修改后下次调用对应功能时生效。
        </Text>
        <Tabs activeKey={activePromptKey} onChange={setActivePromptKey} items={promptTabs} />
      </Card>
    </div>
  );
};

export default SystemSettingsPage;
