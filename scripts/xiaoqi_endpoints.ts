// ==================== Resume Screening (小七 integration) ====================

// CRUD for position mappings
registerCrud('position-mappings', 'position_mappings', { raw_name: 'like', mapped_name: 'like' });

// CRUD for capability dimensions
registerCrud('capability-dimensions', 'capability_dimensions', { position_name: 'like' });

// CRUD for recruitment tasks
registerCrud('recruitment-tasks', 'recruitment_tasks', { status: 'eq', position_name: 'like' });

// List screening queue with filters
app.get('/api/resume-screening', authMiddleware, async (c) => {
  const db = c.env.DB;
  const status = c.req.query('status') || '';
  const search = c.req.query('search') || '';
  let sql = 'SELECT * FROM resume_screening_queue';
  const conditions: string[] = [];
  const binds: any[] = [];
  if (status) { conditions.push('status = ?'); binds.push(status); }
  if (search) { conditions.push('(candidate_name LIKE ? OR position_applied LIKE ?)'); binds.push(`%${search}%`, `%${search}%`); }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  const result = await db.prepare(sql).bind(...binds).all();
  return c.json(result.results.map(transformRow));
});

// Get single screening record
app.get('/api/resume-screening/:id', authMiddleware, async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(c.req.param('id')).first();
  if (!row) return c.json({ detail: 'Not found' }, 404);
  return c.json(transformRow(row));
});

// Create screening record (from email scan or manual upload)
app.post('/api/resume-screening', authMiddleware, async (c) => {
  const body = await c.req.json();
  const id = body.id || uuid();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO resume_screening_queue (id, resume_id, candidate_name, position_applied, mapped_position, city, ai_analysis, ai_result, match_score, risk_points, match_reasons, interview_questions, strengths, age, gender, education, file_name, email_subject, status, batch_num, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, body.resume_id || null, body.candidate_name || '未知', body.position_applied || '',
    body.mapped_position || '', body.city || '', body.ai_analysis || '', body.ai_result || 'pending',
    body.match_score || 0, body.risk_points || '', body.match_reasons || '', body.interview_questions || '',
    body.strengths || '', body.age || '', body.gender || '', body.education || '',
    body.file_name || '', body.email_subject || '', body.status || 'pending', body.batch_num || 1,
    ts, ts
  ).run();
  const row = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

// AI analyze a resume for screening (core 小七 analysis engine)
app.post('/api/resume-screening/:id/ai-analyze', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const record = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(id).first() as any;
  if (!record) return c.json({ detail: 'Not found' }, 404);

  // Get resume text
  let resumeText = '';
  if (record.resume_id) {
    const resume = await c.env.DB.prepare('SELECT raw_text FROM resumes WHERE id = ?').bind(record.resume_id).first() as any;
    if (resume?.raw_text) resumeText = resume.raw_text;
  }
  if (!resumeText) resumeText = record.ai_analysis || '无简历文本';

  // Map position
  let mappedPosition = record.mapped_position || '';
  if (!mappedPosition && record.position_applied) {
    const pmRow = await c.env.DB.prepare('SELECT mapped_name FROM position_mappings WHERE raw_name LIKE ? LIMIT 1').bind(`%${record.position_applied.split('_')[0]}%`).first() as any;
    if (pmRow?.mapped_name) mappedPosition = pmRow.mapped_name;
  }
  if (!mappedPosition) mappedPosition = record.position_applied?.split('_')[0] || '未知岗位';

  // Get capability dimensions for this position
  const dimsResult = await c.env.DB.prepare('SELECT full_text FROM capability_dimensions WHERE position_name = ? LIMIT 3').bind(mappedPosition).all();
  let dimensionsText = '';
  if (dimsResult.results && dimsResult.results.length > 0) {
    dimensionsText = dimsResult.results.map((r: any) => r.full_text || '').filter(Boolean).join('\n');
  }

  // Get JD from job_requisitions if available
  const reqRow = await c.env.DB.prepare('SELECT requirements FROM job_requisitions WHERE title LIKE ? LIMIT 1').bind(`%${mappedPosition}%`).first() as any;
  const jdText = reqRow?.requirements || '(无JD)';

  const systemPrompt = `你是一个专业的人力资源简历初筛专家（AI简历分析引擎）。你的任务是分析候选人简历，评估其与目标岗位的匹配度。

分析要求：
1. 初筛结果：通过/不通过/待定
2. 优势分析：候选人的核心优势（2-3条）
3. 风险点：潜在风险或不足（1-2条）
4. 能力维度匹配：按岗位能力维度逐项评分（0-5分），并给出匹配依据
5. 建议追问的面试问题（3-5个）
6. 互动引导语：给面试官的一段简短引导

请用以下格式输出（中文）：

初筛结果：[通过/不通过/待定]
匹配分数：[0-5的数字]

优势分析：
• ...
• ...

风险点：
• ...

能力维度匹配：
能力：[维度名] [X]/5分。依据：...
能力：[维度名] [X]/5分。依据：...

建议追问的面试问题：
1. ...
2. ...
3. ...

互动引导语：
[一段简短的话]`;

  const userPrompt = `岗位名称：${mappedPosition}
岗位JD：
${jdText}

岗位能力维度要求：
${dimensionsText || '(无具体维度要求，请根据岗位常识评估)'}

候选人信息：
姓名：${record.candidate_name}
年龄：${record.age || '未知'}
性别：${record.gender || '未知'}
学历：${record.education || '未知'}
申请岗位：${record.position_applied || '未知'}

简历内容：
${resumeText.substring(0, 6000)}`;

  let aiAnalysis = '';
  try {
    aiAnalysis = await callAI(c.env, systemPrompt, userPrompt);
  } catch (e: any) {
    return c.json({ detail: `AI分析失败: ${e.message}` }, 500);
  }

  // Parse match score from AI response
  const scoreMatch = aiAnalysis.match(/匹配分数[：:]\s*(\d+(\.\d+)?)/);
  const matchScore = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
  const resultMatch = aiAnalysis.match(/初筛结果[：:]\s*(通过|不通过|待定)/);
  const aiResult = resultMatch ? resultMatch[1] : 'pending';

  // Update the screening record
  await c.env.DB.prepare(
    'UPDATE resume_screening_queue SET ai_analysis = ?, ai_result = ?, match_score = ?, mapped_position = ?, updated_at = ? WHERE id = ?'
  ).bind(aiAnalysis, aiResult, matchScore, mappedPosition, now(), id).run();

  const row = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

// Approve a screening record (入库 -> creates talent_pool entry)
app.post('/api/resume-screening/:id/approve', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const record = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(id).first() as any;
  if (!record) return c.json({ detail: 'Not found' }, 404);
  if (record.status !== 'pending') return c.json({ detail: 'Already processed' }, 400);

  // Create talent_pool entry
  const tpId = uuid();
  await c.env.DB.prepare(
    `INSERT INTO talent_pool (id, resume_id, candidate_name, email, phone, current_title, skills, experience_years, education, expected_salary, source, tags, status, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    tpId, record.resume_id || null, record.candidate_name, '', '', record.position_applied || '',
    '[]', 0, record.education || '', '', '邮箱初筛',
    JSON.stringify(['AI初筛']), 'available',
    record.ai_analysis || '', now(), now()
  ).run();

  // Update screening record
  await c.env.DB.prepare(
    'UPDATE resume_screening_queue SET status = ?, ai_result = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?'
  ).bind('approved', 'shortlisted', user.id, now(), now(), id).run();

  const row = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(id).first();
  return c.json({ ...transformRow(row), talent_pool_id: tpId });
});

// Reject a screening record (淘汰)
app.post('/api/resume-screening/:id/reject', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const record = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(id).first() as any;
  if (!record) return c.json({ detail: 'Not found' }, 404);
  if (record.status !== 'pending') return c.json({ detail: 'Already processed' }, 400);

  await c.env.DB.prepare(
    'UPDATE resume_screening_queue SET status = ?, ai_result = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?'
  ).bind('rejected', 'rejected', user.id, now(), now(), id).run();

  const row = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

// Batch AI analyze all pending records
app.post('/api/resume-screening/batch-analyze', authMiddleware, async (c) => {
  const result = await c.env.DB.prepare("SELECT id FROM resume_screening_queue WHERE status = 'pending' AND (ai_analysis IS NULL OR ai_analysis = '')").all();
  const ids = result.results.map((r: any) => r.id);
  let processed = 0;
  for (const rid of ids) {
    try {
      const rec = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(rid).first() as any;
      if (!rec) continue;
      let resumeText = '';
      if (rec.resume_id) {
        const resume = await c.env.DB.prepare('SELECT raw_text FROM resumes WHERE id = ?').bind(rec.resume_id).first() as any;
        if (resume?.raw_text) resumeText = resume.raw_text;
      }
      if (!resumeText) continue;
      let mappedPosition = rec.mapped_position || rec.position_applied?.split('_')[0] || '未知岗位';
      const dimsResult = await c.env.DB.prepare('SELECT full_text FROM capability_dimensions WHERE position_name = ? LIMIT 3').bind(mappedPosition).all();
      const dimensionsText = dimsResult.results?.map((r: any) => r.full_text || '').filter(Boolean).join('\n') || '';
      const systemPrompt = `你是简历初筛专家。分析简历并输出：初筛结果（通过/不通过/待定）、匹配分数（0-5）、优势分析、风险点、能力维度匹配（每项0-5分）、面试问题建议（3个）、互动引导语。用中文输出。`;
      const userPrompt = `岗位：${mappedPosition}\n能力维度要求：${dimensionsText || '(无)'}\n候选人：${rec.candidate_name} ${rec.age || ''}岁 ${rec.gender || ''} ${rec.education || ''}\n简历：${resumeText.substring(0, 5000)}`;
      const aiAnalysis = await callAI(c.env, systemPrompt, userPrompt);
      const scoreMatch = aiAnalysis.match(/匹配分数[：:]\s*(\d+(\.\d+)?)/);
      const matchScore = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
      const resultMatch = aiAnalysis.match(/初筛结果[：:]\s*(通过|不通过|待定)/);
      const aiResult = resultMatch ? resultMatch[1] : 'pending';
      await c.env.DB.prepare('UPDATE resume_screening_queue SET ai_analysis = ?, ai_result = ?, match_score = ?, mapped_position = ?, updated_at = ? WHERE id = ?').bind(aiAnalysis, aiResult, matchScore, mappedPosition, now(), rid).run();
      processed++;
    } catch (e) { /* skip on error */ }
  }
  return c.json({ processed, total: ids.length });
});

// Create screening record from resume (link existing resume to screening queue)
app.post('/api/resume-screening/from-resume/:resumeId', authMiddleware, async (c) => {
  const resumeId = c.req.param('resumeId');
  const resume = await c.env.DB.prepare('SELECT * FROM resumes WHERE id = ?').bind(resumeId).first() as any;
  if (!resume) return c.json({ detail: 'Resume not found' }, 404);

  const id = uuid();
  const ts = now();
  const positionApplied = resume.position_title || resume.target_position || '';
  // Map position
  let mappedPosition = '';
  if (positionApplied) {
    const pmRow = await c.env.DB.prepare('SELECT mapped_name FROM position_mappings WHERE ? LIKE "%" || raw_name || "%" LIMIT 1').bind(positionApplied).first() as any;
    if (pmRow?.mapped_name) mappedPosition = pmRow.mapped_name;
  }

  await c.env.DB.prepare(
    `INSERT INTO resume_screening_queue (id, resume_id, candidate_name, position_applied, mapped_position, age, gender, education, status, batch_num, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, resumeId, resume.candidate_name || '未知', positionApplied, mappedPosition, resume.age || '', resume.gender || '', resume.education || '', 'pending', 1, ts, ts).run();

  const row = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

// ==================== Daily Reports ====================

app.get('/api/daily-reports', authMiddleware, async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM daily_reports ORDER BY created_at DESC LIMIT 100').all();
  return c.json(result.results.map(transformRow));
});

app.post('/api/daily-reports/generate', authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({})) || {};
  const reportType = body.report_type || 'progress';
  const reportDate = body.report_date || new Date().toISOString().split('T')[0];

  // Gather stats
  const totalResumes = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM resumes').first();
  const totalScreening = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM resume_screening_queue WHERE status = 'pending'").first();
  const totalApproved = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM resume_screening_queue WHERE status = 'approved'").first();
  const totalRejected = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM resume_screening_queue WHERE status = 'rejected'").first();
  const totalInterviews = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE status IN ('scheduled','completed')").first();
  const totalOffers = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM offers WHERE status IN ('sent','accepted')").first();
  const totalOnboarding = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM onboarding_records WHERE status = 'in_progress'").first();
  const openRequisitions = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM job_requisitions WHERE status = 'open'").first();

  const stats = {
    report_date: reportDate,
    open_requisitions: openRequisitions?.cnt || 0,
    total_resumes: totalResumes?.cnt || 0,
    pending_screening: totalScreening?.cnt || 0,
    approved_candidates: totalApproved?.cnt || 0,
    rejected_candidates: totalRejected?.cnt || 0,
    active_interviews: totalInterviews?.cnt || 0,
    active_offers: totalOffers?.cnt || 0,
    onboarding_count: totalOnboarding?.cnt || 0,
  };

  // Generate AI summary
  let aiSummary = '';
  try {
    aiSummary = await callAI(c.env,
      '你是招聘数据分析专家。根据招聘统计数据生成一份简洁的日报摘要（中文），包含：整体进展概述、关键指标分析、风险提示、明日建议。控制在300字以内。',
      `日期：${reportDate}\n统计数据：${JSON.stringify(stats, null, 2)}`
    );
  } catch (e: any) {
    aiSummary = '(AI摘要生成失败)';
  }

  const content = JSON.stringify(stats);
  const title = `招聘日报 - ${reportDate}`;
  const id = uuid();

  await c.env.DB.prepare(
    'INSERT INTO daily_reports (id, report_date, report_type, title, content, stats, status, created_at) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(id, reportDate, reportType, title, content, aiSummary, 'generated', now()).run();

  const row = await c.env.DB.prepare('SELECT * FROM daily_reports WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

app.delete('/api/daily-reports/:id', authMiddleware, async (c) => {
  await c.env.DB.prepare('DELETE FROM daily_reports WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ detail: 'Report deleted' });
});

