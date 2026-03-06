from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.schemas.resume import (
    ResumeResponse, ResumeCreate, ResumeUpdate,
    DepartmentReviewCreate, DepartmentReviewUpdate, DepartmentReviewResponse,
    HRDecisionCreate, HRDecisionResponse,
    DuplicateCheckRequest, DuplicateCheckResponse, DepartmentReviewSummary
)
from app.services.resume_service import (
    upload_resume, get_resumes, get_resume, update_resume, delete_resume,
    batch_upload_resumes, reparse_resume,
    check_duplicate_resume, create_department_review, get_department_reviews,
    complete_department_review, aggregate_department_reviews, submit_hr_decision,
    confirm_rejection, override_rejection, get_resume_with_reviews
)
from app.models.models import ResumeStatus, RejectReasonCategory
from typing import List, Dict, Any, Optional
from uuid import UUID

router = APIRouter(
    prefix="/resumes",
    tags=["resumes"]
)

# ==================== 简历列表 ====================

@router.get("", response_model=List[ResumeResponse])
def get_resumes_route(
    skip: int = 0,
    limit: int = 100,
    candidate_name: str = None,
    status: str = None,
    reviewer_id: Optional[UUID] = None,  # 面试官查看被指派的简历
    db: Session = Depends(get_db)
):
    return get_resumes(db, skip=skip, limit=limit, candidate_name=candidate_name, status=status, reviewer_id=reviewer_id)

# ==================== 简历查重 ====================

@router.post("/check-duplicate", response_model=DuplicateCheckResponse)
def check_duplicate_route(
    request: DuplicateCheckRequest,
    db: Session = Depends(get_db)
):
    """
    检查简历是否重复（基于邮箱/手机号）
    """
    existing = check_duplicate_resume(db, request.email, request.contact, request.position_id)

    if existing:
        return DuplicateCheckResponse(
            is_duplicate=True,
            existing_resume=ResumeResponse.model_validate(existing),
            message=f"发现重复简历：{existing.candidate_name or '未知候选人'}"
        )

    return DuplicateCheckResponse(
        is_duplicate=False,
        existing_resume=None,
        message="未发现重复简历"
    )

# ==================== 简历上传 ====================

@router.post("", response_model=ResumeResponse)
def create_resume_route(
    background_tasks: BackgroundTasks,
    position_id: UUID = Form(...),
    file: UploadFile = File(...),
    candidate_name: str = Form(None),  # 公开链接上传时由应聘者填写
    email: str = Form(None),
    contact: str = Form(None),
    db: Session = Depends(get_db)
):
    return upload_resume(db, file, position_id, background_tasks, candidate_name, email, contact)

@router.post("/batch", response_model=List[ResumeResponse])
def batch_upload_resumes_route(
    background_tasks: BackgroundTasks,
    position_id: UUID = Form(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    return batch_upload_resumes(db, files, position_id, background_tasks)

# ==================== 简历详情与更新 ====================

@router.get("/{resume_id}", response_model=ResumeResponse)
def get_resume_route(resume_id: UUID, db: Session = Depends(get_db)):
    resume = get_resume_with_reviews(db, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return resume

@router.put("/{resume_id}", response_model=ResumeResponse)
def update_resume_route(resume_id: UUID, resume: ResumeUpdate, db: Session = Depends(get_db)):
    db_resume = update_resume(db, resume_id, resume)
    if not db_resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return db_resume

@router.delete("/{resume_id}", response_model=ResumeResponse)
def delete_resume_route(resume_id: UUID, db: Session = Depends(get_db)):
    db_resume = delete_resume(db, resume_id)
    if not db_resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return db_resume

@router.post("/{resume_id}/reparse", response_model=ResumeResponse)
def reparse_resume_route(
    resume_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    resume = reparse_resume(db, resume_id, background_tasks)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return resume

# ==================== 部门评审 ====================

@router.get("/{resume_id}/department-reviews", response_model=DepartmentReviewSummary)
def get_department_reviews_route(
    resume_id: UUID,
    db: Session = Depends(get_db)
):
    """
    获取部门评审汇总报告
    """
    return aggregate_department_reviews(db, resume_id)


@router.post("/{resume_id}/department-reviews", response_model=DepartmentReviewResponse)
def create_department_review_route(
    resume_id: UUID,
    reviewer_id: UUID = Form(...),
    db: Session = Depends(get_db)
):
    """
    指派部门评审人
    """
    return create_department_review(db, resume_id, reviewer_id)


@router.put("/{resume_id}/department-reviews/{review_id}", response_model=DepartmentReviewResponse)
def complete_department_review_route(
    resume_id: UUID,
    review_id: UUID,
    reviewer_id: UUID = Form(...),
    technical_score: int = Form(None),
    experience_score: int = Form(None),
    overall_score: int = Form(None),
    recommendation: str = Form(None),
    comment: str = Form(None),
    db: Session = Depends(get_db)
):
    """
    完成部门评审
    """
    review_data = DepartmentReviewUpdate(
        technical_score=technical_score,
        experience_score=experience_score,
        overall_score=overall_score,
        recommendation=recommendation,
        comment=comment
    )
    return complete_department_review(db, review_id, reviewer_id, review_data)

# ==================== HR决策 ====================

@router.post("/{resume_id}/hr-decision", response_model=ResumeResponse)
def submit_hr_decision_route(
    resume_id: UUID,
    decision_data: HRDecisionCreate,
    db: Session = Depends(get_db)
):
    """
    HR提交最终决策
    """
    return submit_hr_decision(db, resume_id, decision_data.hr_id, decision_data)


@router.post("/{resume_id}/confirm-rejection", response_model=ResumeResponse)
def confirm_rejection_route(
    resume_id: UUID,
    reason_category: RejectReasonCategory = Form(...),
    reason_detail: str = Form(None),
    hr_id: UUID = Form(...),  # TODO: 从认证中间件获取
    db: Session = Depends(get_db)
):
    """
    确认淘汰低分简历
    """
    return confirm_rejection(db, resume_id, hr_id, reason_category, reason_detail)


@router.post("/{resume_id}/override-rejection", response_model=ResumeResponse)
def override_rejection_route(
    resume_id: UUID,
    hr_id: UUID = Form(...),  # TODO: 从认证中间件获取
    db: Session = Depends(get_db)
):
    """
    覆盖AI淘汰建议，恢复到评审流程
    """
    return override_rejection(db, resume_id, hr_id)