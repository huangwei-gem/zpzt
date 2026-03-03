from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from app.models.models import Interview, Resume, Position, InterviewStatus, InterviewResult, QuestionBank, ResumeStatus, ScreeningResult, InterviewPanel, User
from app.schemas.interview import InterviewCreate, InterviewUpdate, InterviewScore
from fastapi import BackgroundTasks
# ...

def submit_interview_panel_score(db: Session, interview_id: UUID, interviewer_id: UUID, score_data: InterviewScore):
    """
    Submit score for a specific interviewer (panel member).
    """
    panel = db.query(InterviewPanel).filter(
        InterviewPanel.interview_id == interview_id,
        InterviewPanel.interviewer_id == interviewer_id
    ).first()
    
    if not panel:
        # Create new panel entry if not exists (should usually exist if assigned, but for safety)
        panel = InterviewPanel(
            interview_id=interview_id,
            interviewer_id=interviewer_id,
            scores=score_data.scores,
            comments=score_data.comments,
            total_score=sum(score_data.scores.values()) // len(score_data.scores) if score_data.scores else 0,
            is_submitted=True
        )
        db.add(panel)
    else:
        panel.scores = score_data.scores
        panel.comments = score_data.comments
        panel.total_score = sum(score_data.scores.values()) // len(score_data.scores) if score_data.scores else 0
        panel.is_submitted = True
        
    db.commit()
    db.refresh(panel)
    
    # Check if all panels submitted? Maybe update main interview status?
    # For now, we just save the panel score.
    # Check if all designated panel members have submitted
    db_interview = db.query(Interview).get(interview_id)
    if db_interview and db_interview.panel_members:
        # Get all submitted panels
        submitted_panels = db.query(InterviewPanel).filter(
            InterviewPanel.interview_id == interview_id,
            InterviewPanel.is_submitted == True
        ).all()
        
        submitted_interviewer_ids = [str(p.interviewer_id) for p in submitted_panels]
        required_interviewer_ids = [str(uid) for uid in db_interview.panel_members]
        
        # Check if all required interviewers have submitted
        all_submitted = all(uid in submitted_interviewer_ids for uid in required_interviewer_ids)
        
        if all_submitted:
            # Trigger aggregation automatically
            # We need background_tasks here, but this function doesn't have it in signature yet.
            # We will refactor the route to call aggregate directly or pass background_tasks here.
            # For now, let's just mark it as potentially ready.
            # Actually, let's return a flag or handle it in the route.
            pass

    return panel

def get_interview_panels(db: Session, interview_id: UUID):
    return db.query(InterviewPanel).filter(InterviewPanel.interview_id == interview_id).all()

def aggregate_panel_scores(db: Session, interview_id: UUID, background_tasks: BackgroundTasks):
    """
    Aggregate scores from all panels to main interview record and generate AI evaluation.
    """
    panels = db.query(InterviewPanel).filter(
        InterviewPanel.interview_id == interview_id,
        InterviewPanel.is_submitted == True
    ).all()
    
    if not panels:
        return None
        
    # Aggregate logic: Average scores per question
    aggregated_scores = {}
    aggregated_comments = {}
    
    # Assuming all panels use the same question indices
    # We need to collect all scores for each question index
    question_scores_map = {} # { "0": [8, 9], "1": [7, 8] }
    
    # Collect aggregated transcripts
    aggregated_transcripts = {}
    
    for panel in panels:
        if not panel.scores: continue
        for q_idx, score in panel.scores.items():
            if q_idx not in question_scores_map:
                question_scores_map[q_idx] = []
            question_scores_map[q_idx].append(score)
            
        # Collect comments
        if panel.comments:
            for q_idx, comment in panel.comments.items():
                interviewer = db.query(User).get(panel.interviewer_id)
                name = interviewer.full_name if interviewer else "Interviewer"
                if q_idx not in aggregated_comments:
                    aggregated_comments[q_idx] = ""
                aggregated_comments[q_idx] += f"**{name}**: {comment}\n\n"
        
        # Collect transcripts (just concatenate or use first valid one)
        # Ideally, we should group them by question. 
        # If multiple recordings exist for same question (e.g. from different interviewers? unlikely for same candidate unless split),
        # we can append them.
        if panel.transcripts:
            for q_idx, transcript in panel.transcripts.items():
                if q_idx not in aggregated_transcripts:
                    aggregated_transcripts[q_idx] = ""
                # Avoid duplicate transcript if multiple panels upload same? 
                # Usually only one interviewer records, or they record sequentially.
                # Let's append with interviewer name if needed, or just append.
                if transcript:
                    interviewer = db.query(User).get(panel.interviewer_id)
                    name = interviewer.full_name if interviewer else "Interviewer"
                    aggregated_transcripts[q_idx] += f"[{name}记录]: {transcript}\n"

    # Calculate averages
    for q_idx, scores_list in question_scores_map.items():
        if scores_list:
            aggregated_scores[q_idx] = round(sum(scores_list) / len(scores_list))
            
    # Update main interview record
    db_interview = db.query(Interview).get(interview_id)
    if db_interview:
        db_interview.scores = aggregated_scores
        db_interview.comments = aggregated_comments
        db_interview.transcripts = aggregated_transcripts
        
        # Trigger AI evaluation with detailed panel comments AND transcripts
        # Convert aggregated_comments to a string format for AI
        panel_details_str = ""
        for q_idx, comment_str in aggregated_comments.items():
            panel_details_str += f"Question {q_idx} Comments:\n{comment_str}\n"
            
        # Add transcripts to context
        transcript_context = ""
        for q_idx, trans in aggregated_transcripts.items():
             transcript_context += f"Question {q_idx} Candidate Answer:\n{trans}\n"

        background_tasks.add_task(
            generate_evaluation_background,
            db_interview.id,
            {
                "scores": aggregated_scores, 
                "panel_details": panel_details_str,
                "transcripts": transcript_context
            }
        )
        
        db.commit()
        db.refresh(db_interview)
        return db_interview
    return None
from fastapi import HTTPException
from app.services.ai_service import generate_interview_questions, generate_interview_evaluation
from app.services.resume_service import read_file_content
import json
from datetime import timezone

from app.config.database import SessionLocal
from fastapi import BackgroundTasks

def _normalize_dt_utc(dt):
    if dt is None:
        return None
    if getattr(dt, "tzinfo", None) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def generate_questions_background(interview_id: UUID, question_bank_ids: list, question_count: int):
    db = SessionLocal()
    try:
        interview = db.query(Interview).filter(Interview.id == interview_id).first()
        if not interview:
            return
            
        resume = db.query(Resume).filter(Resume.id == interview.resume_id).first()
        position = db.query(Position).filter(Position.id == interview.position_id).first()
        
        if not resume or not position:
            return

        # 获取参考题库内容
        qb_content = ""
        if question_bank_ids:
            qbs = db.query(QuestionBank).filter(QuestionBank.id.in_(question_bank_ids)).all()
            for qb in qbs:
                if qb.source_file:
                    content = read_file_content(qb.source_file)
                    if content:
                        qb_content += f"\n--- 参考题库: {qb.name} ---\n{content[:5000]}\n"
        
        # 生成面试题
        position_desc = f"{position.title}\n{position.description}\n{position.requirements}"
        resume_data = resume.parsed_data if resume.parsed_data else {}
        
        questions = generate_interview_questions(
            resume_data, 
            position_desc, 
            question_bank_content=qb_content,
            count=question_count
        )
        
        interview.questions = questions
        db.commit()
        
    except Exception as e:
        print(f"Error generating questions for interview {interview_id}: {e}")
    finally:
        db.close()

def create_interview(db: Session, interview: InterviewCreate, background_tasks: BackgroundTasks):
    # 检查简历和岗位是否存在
    resume = db.query(Resume).filter(Resume.id == interview.resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
        
    position = db.query(Position).filter(Position.id == interview.position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    
    db_interview = Interview(
        resume_id=interview.resume_id,
        position_id=interview.position_id,
        interviewer=interview.interviewer,
        interview_time=_normalize_dt_utc(interview.interview_time),
        questions=[], # Initially empty
        status=InterviewStatus.SCHEDULED,
        panel_members=interview.panel_members
    )
    
    db.add(db_interview)
    db.commit()
    db.refresh(db_interview)
    
    # Add background task
    background_tasks.add_task(
        generate_questions_background, 
        db_interview.id, 
        interview.question_bank_ids, 
        interview.question_count or 5
    )
    
    return db_interview

def export_interview_result(db: Session, interview_id: UUID, format: str = "markdown"):
    db_interview = db.query(Interview).options(
        joinedload(Interview.resume),
        joinedload(Interview.position)
    ).filter(Interview.id == interview_id).first()
    
    if not db_interview:
        return None
        
    candidate_name = db_interview.resume.candidate_name if db_interview.resume else "Candidate"
    position_title = db_interview.position.title if db_interview.position else "Position"
    
    # Always return Markdown
    content = f"# 面试评估报告\n\n"
    content += f"- **候选人**: {candidate_name}\n"
    content += f"- **应聘岗位**: {position_title}\n"
    content += f"- **面试时间**: {db_interview.interview_time.strftime('%Y-%m-%d %H:%M') if db_interview.interview_time else 'N/A'}\n"
    content += f"- **面试结果**: {db_interview.result.value if db_interview.result else 'N/A'}\n"
    content += f"- **综合得分**: {db_interview.total_score if db_interview.total_score is not None else 'N/A'}\n\n"
    
    content += "## 综合评价\n\n"
    content += f"{db_interview.evaluation or '暂无评价'}\n\n"
    
    content += "## 详细评估\n\n"
    
    questions = db_interview.questions or []
    scores = db_interview.scores or {}
    comments = db_interview.comments or {}
    
    for i, q in enumerate(questions):
        idx = str(i)
        title = q.get('title', f'问题 {i+1}')
        score = scores.get(idx, 0)
        comment = comments.get(idx, '暂无评语')
        
        content += f"### {i+1}. {title}\n\n"
        content += f"**平均得分**: {score}/10\n\n"
        content += f"**问题内容**:\n{q.get('content', '')}\n\n"
        content += f"**参考答案**:\n{q.get('reference_answer', '')}\n\n"
        
        # Display aggregated comments or detailed panel breakdown
        # comments for aggregated interview is already formatted as "**Name**: comment"
        if comment:
             content += f"**面试官详细评语**:\n{comment}\n\n"
        else:
             content += f"**面试官评语**: 暂无\n\n"
             
        content += "---\n\n"
        
    return content

def get_interviews(db: Session, skip: int = 0, limit: int = 100, status: str = None):
    query = db.query(Interview).options(
        joinedload(Interview.resume),
        joinedload(Interview.position)
    )
    if status:
        query = query.filter(Interview.status == status)
    return query.offset(skip).limit(limit).all()

def get_interviews_for_interviewer(db: Session, interviewer_id: UUID, skip: int = 0, limit: int = 100):
    """
    Fetch interviews where the user is a panel member.
    Since panel_members is a JSON column storing a list of IDs, we need to filter in memory 
    or use dialect-specific JSON operators. For portability and simplicity with small datasets,
    we'll filter in Python. Ideally, use a many-to-many relationship table.
    """
    # Fetch all interviews (or a larger subset) and filter
    # Optimization: Filter by status if needed, but here we want all.
    all_interviews = db.query(Interview).options(
        joinedload(Interview.resume),
        joinedload(Interview.position)
    ).all()
    
    filtered = []
    str_id = str(interviewer_id)
    
    for interview in all_interviews:
        if interview.panel_members and str_id in [str(m) for m in interview.panel_members]:
            filtered.append(interview)
            
    # Apply skip/limit
    return filtered[skip: skip + limit]

def get_interview(db: Session, interview_id: UUID):
    return db.query(Interview).options(
        joinedload(Interview.resume),
        joinedload(Interview.position),
        joinedload(Interview.panels)
    ).filter(Interview.id == interview_id).first()

def update_interview(db: Session, interview_id: UUID, interview: InterviewUpdate):
    db_interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not db_interview:
        return None
    
    update_data = interview.dict(exclude_unset=True)
    for key, value in update_data.items():
        if key == "interview_time":
            value = _normalize_dt_utc(value)
        setattr(db_interview, key, value)
    
    db.commit()
    db.refresh(db_interview)
    return db_interview

def update_interview_questions(db: Session, interview_id: UUID, questions: list):
    db_interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not db_interview:
        return None
    
    db_interview.questions = questions
    db.commit()
    db.refresh(db_interview)
    return db_interview

def delete_interview(db: Session, interview_id: UUID):
    db_interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not db_interview:
        return None
    
    db.delete(db_interview)
    db.commit()
    return db_interview

def generate_evaluation_background(interview_id: UUID, score_data: dict):
    db = SessionLocal()
    try:
        db_interview = db.query(Interview).filter(Interview.id == interview_id).first()
        if not db_interview:
            return
            
        # 计算总分 (平均分)
        scores = score_data.get('scores', {})
        panel_details = score_data.get('panel_details', "")
        transcripts = score_data.get('transcripts', "")
        
        if not scores:
            print(f"No scores provided for evaluation {interview_id}")
            return

        count = len(scores)
        total_sum = sum(scores.values())
        average_score = round(total_sum / count) if count > 0 else 0
        
        # 生成评价
        questions = db_interview.questions or []
        evaluation_result = generate_interview_evaluation(
            questions,
            scores,
            average_score,
            panel_details=panel_details,
            transcripts=transcripts
        )
        
        # 更新面试记录
        db_interview.total_score = average_score
        db_interview.evaluation = evaluation_result.get("evaluation")
        db_interview.suggestion = evaluation_result.get("suggestion")
        
        # 结果设为 PENDING，状态设为 COMPLETED (表示评分结束，等待最终确认)
        db_interview.result = InterviewResult.PENDING
        db_interview.status = InterviewStatus.COMPLETED
        
        db.commit()
        print(f"Evaluation generated and status updated to COMPLETED for interview {interview_id}")
        
    except Exception as e:
        print(f"Error generating evaluation for interview {interview_id}: {e}")
    finally:
        db.close()

def confirm_interview_result(db: Session, interview_id: UUID, result: str):
    db_interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not db_interview:
        return None
        
    # 更新结果和状态
    # result string comes from frontend as 'passed', 'rejected', 'waitlist' (lowercase)
    # InterviewResult enum members are PASSED, REJECTED, WAITLIST (uppercase)
    result_upper = result.upper()
    
    if result_upper in InterviewResult.__members__:
        db_interview.result = InterviewResult[result_upper]
    else:
        # Fallback or error handling
        print(f"Invalid result value: {result}")
        return None
    
    db_interview.status = InterviewStatus.COMPLETED
    
    # 同步更新简历状态
    if db_interview.resume_id:
        resume = db.query(Resume).filter(Resume.id == db_interview.resume_id).first()
        if resume:
            if db_interview.result == InterviewResult.PASSED:
                resume.status = ResumeStatus.COMPLETED
                resume.screening_result = ScreeningResult.PASSED
            elif db_interview.result == InterviewResult.REJECTED:
                resume.status = ResumeStatus.REJECTED
                resume.screening_result = ScreeningResult.REJECTED
            elif db_interview.result == InterviewResult.WAITLIST:
                resume.status = ResumeStatus.COMPLETED
                resume.screening_result = ScreeningResult.WAITLIST
            
            # Commit explicitly for resume if needed, but db.commit() below handles all changes in session
            
    db.commit()
    db.refresh(db_interview)
    return db_interview

def submit_interview_score(db: Session, interview_id: UUID, score_data: InterviewScore, background_tasks: BackgroundTasks):
    db_interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not db_interview:
        return None
        
    # 保存评分和评语
    db_interview.scores = score_data.scores
    db_interview.comments = score_data.comments
    
    # 临时设置为 COMPLETED，但实际上还在处理中
    # 或者可以引入一个新的状态 PROCESSING
    # 为了简单起见，我们先不改变状态，或者保持 SCHEDULED 直到生成完毕
    # 但前端需要知道已经提交了。
    # 这里我们只保存数据，真正的状态变更在后台任务完成
    
    db.commit()
    db.refresh(db_interview)
    
    # Add background task
    background_tasks.add_task(
        generate_evaluation_background,
        db_interview.id,
        score_data.dict()
    )
    
    # Reset result to PENDING just in case
    db_interview.result = InterviewResult.PENDING
    db.commit()
    
    return db_interview
