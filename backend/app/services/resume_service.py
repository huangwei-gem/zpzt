from sqlalchemy.orm import Session, joinedload
from app.models.models import (
    Resume, Position, Interview, DepartmentReview, User,
    ResumeStatus, ScreeningResult, RejectReasonCategory, ReviewRecommendation
)
from app.schemas.resume import (
    ResumeCreate, ResumeUpdate, ScreeningResult as ScreeningResultSchema,
    ResumeStatus as ResumeStatusSchema, DepartmentReviewCreate,
    DepartmentReviewUpdate, HRDecisionCreate, DuplicateCheckRequest
)
from uuid import UUID
from fastapi import UploadFile, HTTPException
from app.utils.file_storage import save_upload_file
from app.services.ai_service import analyze_resume, generate_resume_markdown
import docx
import PyPDF2
import os
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy import or_, and_, func

def read_file_content(file_path: str) -> str:
    _, ext = os.path.splitext(file_path)
    content = ""
    try:
        if ext == '.docx':
            doc = docx.Document(file_path)
            content = '\n'.join([para.text for para in doc.paragraphs])
        elif ext == '.pdf':
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    content += page.extract_text()
        elif ext in ('.txt', '.md', '.markdown'):
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        else:
            print(f"Unsupported file type: {ext}")
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
    return content

from app.config.database import SessionLocal
from fastapi import BackgroundTasks

def process_resume_background(resume_id: UUID, position_id: UUID, use_user_info: bool = False):
    """
    后台解析简历
    - use_user_info: 如果为True，表示姓名/邮箱/电话已由用户填写，不从简历解析覆盖
    """
    db = SessionLocal()
    try:
        # 1. Get Resume
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            return
        resume.parse_status = "processing"
        resume.parse_error = None
        db.commit()

        # 2. Read content
        content = read_file_content(resume.file_path)
        if not content:
            resume.parse_status = "failed"
            resume.parse_error = "读取简历内容失败"
            db.commit()
            return

        resume.raw_text = content

        # 3. Get Position
        position = db.query(Position).filter(Position.id == position_id).first()
        if not position:
            resume.parse_status = "failed"
            resume.parse_error = "未找到对应岗位"
            db.commit()
            return

        position_desc = f"{position.title}\n{position.description}\n{position.requirements}"

        # 4. AI Analysis
        parsed_data = analyze_resume(content, position_desc)
        if not parsed_data or "match_score" not in parsed_data:
            resume.parse_status = "failed"
            resume.parse_error = "AI 解析失败"
            db.commit()
            return

        # 5. Update Resume
        resume.parsed_data = parsed_data
        resume.match_score = parsed_data.get("match_score", 0)
        resume.screening_result = parsed_data.get("screening_result", ScreeningResult.PENDING)
        resume.ai_review = parsed_data.get("ai_review", "")

        # 如果用户没有填写基本信息，则从简历中解析
        if not use_user_info:
            resume.candidate_name = parsed_data.get("candidate_name", "")
            resume.contact = parsed_data.get("contact", "")
            email = parsed_data.get("email")
            if isinstance(email, str):
                email = email.strip()
            resume.email = email or None

        resume.parse_status = "success"
        resume.parse_error = None
        resume.parsed_at = datetime.utcnow()

        if resume.match_score >= 60:
            # 高分简历：进入待评审状态，等待HR指派评审人
            resume.status = ResumeStatus.PENDING_REVIEW
        else:
            # 低分简历：AI建议淘汰，但需要人工确认
            resume.status = ResumeStatus.AUTO_REJECTED_PENDING_REVIEW

        db.commit()

    except Exception as e:
        try:
            resume = db.query(Resume).filter(Resume.id == resume_id).first()
            if resume:
                resume.parse_status = "failed"
                resume.parse_error = str(e)[:500]
                db.commit()
        finally:
            pass
    finally:
        db.close()

def upload_resume(db: Session, file: UploadFile, position_id: UUID, background_tasks: BackgroundTasks,
                  candidate_name: str = None, email: str = None, contact: str = None):
    """
    上传简历
    - 公开链接上传时，candidate_name/email/contact 由应聘者填写，解析时不会覆盖
    - 后台上传时，这些字段为空，解析时会从简历中提取
    """
    # 1. Save file
    file_path = save_upload_file(file, "resumes")

    # 2. Create initial record
    # 如果有应聘者填写的信息，直接使用；否则显示"解析中..."
    db_resume = Resume(
        file_path=file_path,
        position_id=position_id,
        status=ResumeStatus.PENDING_SCREENING,
        candidate_name=candidate_name or "解析中...",
        email=email or None,
        contact=contact or None,
        parse_status="processing",
    )

    db.add(db_resume)
    db.commit()
    db.refresh(db_resume)

    # 3. Add background task - 传递是否使用用户填写的信息标记
    use_user_info = bool(candidate_name or email or contact)
    background_tasks.add_task(process_resume_background, db_resume.id, position_id, use_user_info)

    return db_resume

def batch_upload_resumes(db: Session, files: List[UploadFile], position_id: UUID, background_tasks: BackgroundTasks):
    uploaded_resumes = []
    for file in files:
        resume = upload_resume(db, file, position_id, background_tasks)
        uploaded_resumes.append(resume)
    return uploaded_resumes

def reparse_resume(db: Session, resume_id: UUID, background_tasks: BackgroundTasks):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        return None
    if not resume.position_id:
        raise HTTPException(status_code=400, detail="Resume missing position_id")

    resume.parse_status = "processing"
    resume.parse_error = None
    resume.parsed_at = None
    resume.parsed_data = None
    resume.match_score = None
    resume.ai_review = None
    resume.screening_result = ScreeningResult.PENDING
    resume.status = ResumeStatus.PENDING_SCREENING
    resume.candidate_name = "解析中..."
    resume.contact = None
    resume.email = None
    db.commit()
    db.refresh(resume)

    background_tasks.add_task(process_resume_background, resume.id, resume.position_id)
    return resume

def get_resumes(db: Session, skip: int = 0, limit: int = 100, candidate_name: str = None, status: str = None, reviewer_id: UUID = None):
    query = db.query(Resume).options(joinedload(Resume.position))

    if candidate_name:
        query = query.filter(Resume.candidate_name.ilike(f"%{candidate_name}%"))

    if status:
        query = query.filter(Resume.status == status)

    # 如果指定了评审人ID，只返回被指派给该评审人的简历
    if reviewer_id:
        query = query.join(DepartmentReview, Resume.id == DepartmentReview.resume_id)
        query = query.filter(DepartmentReview.reviewer_id == reviewer_id)
        query = query.filter(DepartmentReview.is_completed == False)  # 只显示待评审的

    # Sort by created_at desc
    query = query.order_by(Resume.created_at.desc())

    return query.offset(skip).limit(limit).all()

def get_resume(db: Session, resume_id: UUID):
    return db.query(Resume).options(joinedload(Resume.position)).filter(Resume.id == resume_id).first()

def update_resume(db: Session, resume_id: UUID, resume: ResumeUpdate):
    db_resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not db_resume:
        return None
    
    update_data = resume.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_resume, key, value)
    
    db.commit()
    db.refresh(db_resume)
    return db_resume

def delete_resume(db: Session, resume_id: UUID):
    db_resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not db_resume:
        return None

    # Delete associated interviews first
    db.query(Interview).filter(Interview.resume_id == resume_id).delete()

    # Delete associated department reviews
    db.query(DepartmentReview).filter(DepartmentReview.resume_id == resume_id).delete()

    # Solution: Eager load position before deletion, so it's in memory.
    # Re-query with options
    db_resume = db.query(Resume).options(joinedload(Resume.position)).filter(Resume.id == resume_id).first()

    db.delete(db_resume)
    db.commit()
    return db_resume


# ==================== 简历查重 ====================

def check_duplicate_resume(db: Session, email: Optional[str], contact: Optional[str], position_id: UUID) -> Optional[Resume]:
    """
    检查同一岗位下是否存在相同邮箱或手机号的简历
    返回已存在的简历或 None
    """
    conditions = []

    if email:
        conditions.append(Resume.email == email.strip().lower())

    if contact:
        conditions.append(Resume.contact == contact.strip())

    if not conditions:
        return None

    # 查找同一岗位下邮箱或手机号匹配的简历
    existing = db.query(Resume).filter(
        Resume.position_id == position_id,
        or_(*conditions)
    ).first()

    return existing


# ==================== 部门评审 ====================

def create_department_review(db: Session, resume_id: UUID, reviewer_id: UUID) -> DepartmentReview:
    """
    创建部门评审记录（指派评审人）
    """
    # 检查简历是否存在
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")

    # 检查是否已经指派过该评审人
    existing = db.query(DepartmentReview).filter(
        DepartmentReview.resume_id == resume_id,
        DepartmentReview.reviewer_id == reviewer_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="该评审人已被指派")

    # 创建评审记录
    review = DepartmentReview(
        resume_id=resume_id,
        reviewer_id=reviewer_id,
        is_completed=False
        # 不设置 recommendation 默认值，让它为 None
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    # 更新简历状态为待部门评审
    if resume.status == ResumeStatus.PENDING_REVIEW:
        # 首次指派评审人时，更新状态
        resume.status = ResumeStatus.PENDING_DEPT_REVIEW
        db.commit()

    return review


def get_department_reviews(db: Session, resume_id: UUID) -> List[DepartmentReview]:
    """
    获取简历的所有部门评审记录
    """
    reviews = db.query(DepartmentReview).options(
        joinedload(DepartmentReview.reviewer)
    ).filter(DepartmentReview.resume_id == resume_id).all()
    return reviews


def complete_department_review(db: Session, review_id: UUID, reviewer_id: UUID, review_data: DepartmentReviewUpdate) -> DepartmentReview:
    """
    完成部门评审
    """
    review = db.query(DepartmentReview).filter(
        DepartmentReview.id == review_id,
        DepartmentReview.reviewer_id == reviewer_id
    ).first()

    if not review:
        raise HTTPException(status_code=404, detail="评审记录不存在")

    if review.is_completed:
        raise HTTPException(status_code=400, detail="该评审已完成，不可修改")

    # 更新评审数据
    update_data = review_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(review, key, value)

    review.is_completed = True
    review.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(review)

    # 检查是否所有评审人都已完成
    _check_and_update_resume_status(db, review.resume_id)

    return review


def _check_and_update_resume_status(db: Session, resume_id: UUID):
    """
    检查所有评审人是否已完成，如果是则更新简历状态
    """
    reviews = db.query(DepartmentReview).filter(
        DepartmentReview.resume_id == resume_id
    ).all()

    if not reviews:
        return

    all_completed = all(r.is_completed for r in reviews)

    if all_completed:
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if resume:
            resume.status = ResumeStatus.PENDING_HR_DECISION
            db.commit()


def aggregate_department_reviews(db: Session, resume_id: UUID) -> Dict[str, Any]:
    """
    聚合多人评审结果
    """
    reviews = get_department_reviews(db, resume_id)

    if not reviews:
        return {
            "resume_id": resume_id,
            "total_reviewers": 0,
            "completed_reviewers": 0,
            "avg_technical_score": None,
            "avg_experience_score": None,
            "avg_overall_score": None,
            "recommend_count": 0,
            "not_recommend_count": 0,
            "pending_count": 0,
            "recommend_ratio": 0.0,
            "comments": [],
            "reviews": []
        }

    completed_reviews = [r for r in reviews if r.is_completed]

    # 计算平均分
    technical_scores = [r.technical_score for r in completed_reviews if r.technical_score is not None]
    experience_scores = [r.experience_score for r in completed_reviews if r.experience_score is not None]
    overall_scores = [r.overall_score for r in completed_reviews if r.overall_score is not None]

    # 统计推荐情况
    recommend_count = sum(1 for r in completed_reviews if r.recommendation == ReviewRecommendation.RECOMMEND)
    not_recommend_count = sum(1 for r in completed_reviews if r.recommendation == ReviewRecommendation.NOT_RECOMMEND)
    pending_count = sum(1 for r in completed_reviews if r.recommendation == ReviewRecommendation.PENDING)

    # 汇总评语
    comments = [r.comment for r in completed_reviews if r.comment]

    total_completed = len(completed_reviews)
    recommend_ratio = recommend_count / total_completed if total_completed > 0 else 0.0

    # 构建响应
    review_responses = []
    for r in reviews:
        reviewer_name = r.reviewer.full_name if r.reviewer else None
        review_responses.append({
            "id": r.id,
            "resume_id": r.resume_id,
            "reviewer_id": r.reviewer_id,
            "technical_score": r.technical_score,
            "experience_score": r.experience_score,
            "overall_score": r.overall_score,
            "recommendation": r.recommendation,
            "comment": r.comment,
            "is_completed": r.is_completed,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
            "reviewer_name": reviewer_name
        })

    return {
        "resume_id": resume_id,
        "total_reviewers": len(reviews),
        "completed_reviewers": len(completed_reviews),
        "avg_technical_score": sum(technical_scores) / len(technical_scores) if technical_scores else None,
        "avg_experience_score": sum(experience_scores) / len(experience_scores) if experience_scores else None,
        "avg_overall_score": sum(overall_scores) / len(overall_scores) if overall_scores else None,
        "recommend_count": recommend_count,
        "not_recommend_count": not_recommend_count,
        "pending_count": pending_count,
        "recommend_ratio": recommend_ratio,
        "comments": comments,
        "reviews": review_responses
    }


# ==================== HR决策 ====================

def submit_hr_decision(db: Session, resume_id: UUID, hr_id: UUID, decision_data: HRDecisionCreate) -> Resume:
    """
    HR提交最终决策
    """
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")

    # 验证状态流转
    valid_states = [
        ResumeStatus.PENDING_HR_DECISION,
        ResumeStatus.PENDING_DEPT_REVIEW,
        ResumeStatus.PENDING_REVIEW,
        ResumeStatus.AUTO_REJECTED_PENDING_REVIEW
    ]

    if resume.status not in valid_states:
        raise HTTPException(status_code=400, detail=f"当前状态 [{resume.status.value}] 不允许HR决策")

    decision = decision_data.decision

    # 更新简历状态
    resume.status = decision
    resume.hr_review = decision_data.hr_comment

    # 如果是淘汰，记录淘汰原因
    if decision == ResumeStatus.REJECTED:
        if not decision_data.reject_reason_category:
            raise HTTPException(status_code=400, detail="淘汰时必须选择淘汰原因")
        resume.reject_reason_category = decision_data.reject_reason_category
        resume.reject_reason_detail = decision_data.reject_reason_detail
        resume.rejected_at = datetime.utcnow()
        resume.rejected_by = hr_id

    # 如果是备选
    elif decision == ResumeStatus.WAITLIST:
        resume.reject_reason_category = None
        resume.reject_reason_detail = None

    db.commit()
    db.refresh(resume)

    return resume


def confirm_rejection(db: Session, resume_id: UUID, hr_id: UUID,
                      reason_category: RejectReasonCategory, reason_detail: Optional[str] = None) -> Resume:
    """
    确认淘汰低分简历（从 AUTO_REJECTED_PENDING_REVIEW 状态）
    """
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")

    if resume.status != ResumeStatus.AUTO_REJECTED_PENDING_REVIEW:
        raise HTTPException(status_code=400, detail="当前状态不允许此操作")

    resume.status = ResumeStatus.REJECTED
    resume.reject_reason_category = reason_category
    resume.reject_reason_detail = reason_detail
    resume.rejected_at = datetime.utcnow()
    resume.rejected_by = hr_id

    db.commit()
    db.refresh(resume)

    return resume


def override_rejection(db: Session, resume_id: UUID, hr_id: UUID) -> Resume:
    """
    覆盖AI淘汰建议（从 AUTO_REJECTED_PENDING_REVIEW 恢复到评审流程）
    """
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")

    if resume.status != ResumeStatus.AUTO_REJECTED_PENDING_REVIEW:
        raise HTTPException(status_code=400, detail="当前状态不允许此操作")

    # 恢复到部门评审流程
    resume.status = ResumeStatus.PENDING_DEPT_REVIEW
    resume.reject_reason_category = None
    resume.reject_reason_detail = None

    db.commit()
    db.refresh(resume)

    return resume


def get_resume_with_reviews(db: Session, resume_id: UUID) -> Optional[Resume]:
    """
    获取简历详情（包含部门评审记录）
    """
    resume = db.query(Resume).options(
        joinedload(Resume.position),
        joinedload(Resume.department_reviews).joinedload(DepartmentReview.reviewer)
    ).filter(Resume.id == resume_id).first()

    return resume
