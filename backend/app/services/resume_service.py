from sqlalchemy.orm import Session, joinedload
from app.models.models import Resume, Position, Interview
from app.schemas.resume import ResumeCreate, ResumeUpdate, ScreeningResult, ResumeStatus
from uuid import UUID
from fastapi import UploadFile, HTTPException
from app.utils.file_storage import save_upload_file
from app.services.ai_service import analyze_resume, generate_resume_markdown
import docx
import PyPDF2
import os
from typing import List
from datetime import datetime

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

def process_resume_background(resume_id: UUID, position_id: UUID):
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
        # resume_markdown = generate_resume_markdown(content) # Removed as per user request
        if not parsed_data or "match_score" not in parsed_data:
            resume.parse_status = "failed"
            resume.parse_error = "AI 解析失败"
            db.commit()
            return
        
        # 5. Update Resume
        resume.parsed_data = parsed_data
        # resume.resume_markdown = resume_markdown
        resume.match_score = parsed_data.get("match_score", 0)
        resume.screening_result = parsed_data.get("screening_result", ScreeningResult.PENDING)
        resume.ai_review = parsed_data.get("ai_review", "")
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
            resume.status = ResumeStatus.PENDING_REVIEW
        else:
            resume.status = ResumeStatus.COMPLETED
            
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

def upload_resume(db: Session, file: UploadFile, position_id: UUID, background_tasks: BackgroundTasks):
    # 1. Save file
    file_path = save_upload_file(file, "resumes")
    
    # 2. Create initial record
    db_resume = Resume(
        file_path=file_path,
        position_id=position_id,
        status=ResumeStatus.PENDING_SCREENING,
        candidate_name="解析中...",
        parse_status="processing",
    )
    
    db.add(db_resume)
    db.commit()
    db.refresh(db_resume)
    
    # 3. Add background task
    background_tasks.add_task(process_resume_background, db_resume.id, position_id)
    
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

def get_resumes(db: Session, skip: int = 0, limit: int = 100, candidate_name: str = None, status: str = None):
    query = db.query(Resume).options(joinedload(Resume.position))
    
    if candidate_name:
        query = query.filter(Resume.candidate_name.ilike(f"%{candidate_name}%"))
    
    if status:
        query = query.filter(Resume.status == status)
    
    # Sort by created_at desc
    query = query.order_by(Resume.created_at.desc())
        
    return query.offset(skip).limit(limit).all()

def get_resumes_by_stage(db: Session):
    """
    Get all resumes grouped by stage for Kanban board
    """
    resumes = db.query(Resume).options(joinedload(Resume.position)).all()
    return resumes

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
    # Note: If there are cascade delete constraints in DB, this might be redundant but safe
    db.query(Interview).filter(Interview.resume_id == resume_id).delete()
    
    # Store ID before deletion if needed for return, or return simple status
    # Returning the deleted object can cause DetachedInstanceError if fields are accessed later
    # especially relationships like 'position' if not eagerly loaded.
    # To fix the error, we should either:
    # 1. Eager load everything before delete (if we really need to return the object)
    # 2. Return a simple success message or ID (changing return type)
    # 3. Expunge the object from session before commit? No, that doesn't make sense for delete.
    
    # The error "Parent instance ... is not bound to a Session; lazy load operation of attribute 'position' cannot proceed"
    # suggests that FastAPI (Pydantic) is trying to serialize the returned `db_resume` object, 
    # and accessing `db_resume.position` triggered a lazy load after the session was committed/closed or object deleted.
    
    # Solution: Eager load position before deletion, so it's in memory.
    # Re-query with options
    db_resume = db.query(Resume).options(joinedload(Resume.position)).filter(Resume.id == resume_id).first()
    
    db.delete(db_resume)
    db.commit()
    return db_resume
