from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Response
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.schemas.interview import InterviewResponse, InterviewCreate, InterviewUpdate, InterviewScore
from app.services.interview_service import (
    create_interview, get_interviews, get_interview, update_interview, delete_interview, 
    submit_interview_score, update_interview_questions, export_interview_result, confirm_interview_result,
    submit_interview_panel_score, aggregate_panel_scores
)
from app.schemas.interview import InterviewResponse, InterviewCreate, InterviewUpdate, InterviewScore, InterviewPanelResponse
from app.models.models import User
from app.routes.auth import get_current_user

from typing import List
from uuid import UUID
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

router = APIRouter(
    prefix="/interviews",
    tags=["interviews"]
)

class ConfirmResult(BaseModel):
    result: str

@router.post("/{interview_id}/panel-score", response_model=InterviewPanelResponse)
def submit_panel_score_route(
    interview_id: UUID, 
    score_data: InterviewScore, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Submit individual score
    # Check if this triggers auto-aggregation
    panel = submit_interview_panel_score(db, interview_id, current_user.id, score_data)
    
    # Check if we should aggregate
    # This logic was partially in submit_interview_panel_score but that function didn't have background_tasks
    # So we do a check here or move the logic fully here
    # Let's check if all submitted
    from app.models.models import Interview, InterviewPanel
    
    db_interview = db.query(Interview).get(interview_id)
    if db_interview and db_interview.panel_members:
        submitted_panels = db.query(InterviewPanel).filter(
            InterviewPanel.interview_id == interview_id,
            InterviewPanel.is_submitted == True
        ).all()
        submitted_ids = [str(p.interviewer_id) for p in submitted_panels]
        required_ids = [str(uid) for uid in db_interview.panel_members]
        
        print(f"Auto-Aggregation Debug: Submitted={submitted_ids}, Required={required_ids}")
        
        if all(uid in submitted_ids for uid in required_ids):
             print(f"All panel members submitted. Triggering aggregation for interview {interview_id}")
             # Auto aggregate
             aggregate_panel_scores(db, interview_id, background_tasks)
             # Update status in response object (not DB object, as panel is different model)
             panel.interview_status = "completed"
             
    return panel

@router.post("/{interview_id}/aggregate", response_model=InterviewResponse)
def aggregate_scores_route(
    interview_id: UUID, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) # Only allowed users (HR/Admin) should do this ideally
):
    db_interview = aggregate_panel_scores(db, interview_id, background_tasks)
    if not db_interview:
        raise HTTPException(status_code=404, detail="Interview or panels not found")
    return db_interview

@router.post("/{interview_id}/confirm", response_model=InterviewResponse)
def confirm_interview_result_route(interview_id: UUID, confirm_data: ConfirmResult, db: Session = Depends(get_db)):
    db_interview = confirm_interview_result(db, interview_id, confirm_data.result)
    if not db_interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return db_interview

@router.get("/{interview_id}/export")
def export_interview_route(interview_id: UUID, format: str = "markdown", db: Session = Depends(get_db)):
    content = export_interview_result(db, interview_id, format)
    if not content:
        raise HTTPException(status_code=404, detail="Interview not found")
        
    return PlainTextResponse(content=content)

@router.put("/{interview_id}/questions", response_model=InterviewResponse)
def update_questions_route(interview_id: UUID, questions: List[dict], db: Session = Depends(get_db)):
    db_interview = update_interview_questions(db, interview_id, questions)
    if not db_interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return db_interview

from app.core.security import check_roles
from app.models.models import User, UserRole

@router.post("", response_model=InterviewResponse)
def create_interview_route(
    interview: InterviewCreate, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles([UserRole.ADMIN, UserRole.HR]))
):
    return create_interview(db, interview, background_tasks)

@router.get("", response_model=List[InterviewResponse])
def get_interviews_route(
    skip: int = 0, 
    limit: int = 100, 
    status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Filter for interviewers: only see interviews where they are panel members
    if current_user.role == UserRole.INTERVIEWER:
        # We need to implement a filter in get_interviews or do it here
        # Since panel_members is a JSON list of UUIDs, it's tricky to query directly in all SQL dialects efficiently without specific JSON operators.
        # But we can fetch all and filter in python for now (assuming not huge volume) or use specific query.
        # Better: Update get_interviews service to handle filtering.
        from app.services.interview_service import get_interviews_for_interviewer
        interviews = get_interviews_for_interviewer(db, current_user.id, skip=0, limit=10000)
        if status:
            interviews = [i for i in interviews if str(i.status) == status or getattr(i.status, "value", None) == status]
        return interviews[skip: skip + limit]
        
    return get_interviews(db, skip=skip, limit=limit, status=status)

@router.get("/{interview_id}", response_model=InterviewResponse)
def get_interview_route(interview_id: UUID, db: Session = Depends(get_db)):
    interview = get_interview(db, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview

@router.put("/{interview_id}", response_model=InterviewResponse)
def update_interview_route(interview_id: UUID, interview: InterviewUpdate, db: Session = Depends(get_db)):
    db_interview = update_interview(db, interview_id, interview)
    if not db_interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return db_interview

@router.post("/{interview_id}/score", response_model=InterviewResponse)
def submit_score_route(interview_id: UUID, score_data: InterviewScore, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    db_interview = submit_interview_score(db, interview_id, score_data, background_tasks)
    if not db_interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return db_interview

from fastapi import UploadFile, File
import shutil
import os
from app.services.audio_service import transcribe_audio

# ...

@router.post("/{interview_id}/audio/{question_index}")
def upload_audio_route(
    interview_id: UUID,
    question_index: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload audio recording for a specific question, transcribe it, and save to panel record.
    """
    # 1. Save file
    upload_dir = f"uploads/audio/{interview_id}"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_extension = file.filename.split(".")[-1] if "." in file.filename else "webm"
    file_name = f"{current_user.id}_{question_index}.{file_extension}"
    file_path = os.path.join(upload_dir, file_name)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # 2. Transcribe
    transcript = transcribe_audio(file_path)
    
    # 3. Update DB (InterviewPanel)
    # We need to find or create the panel for this user
    from app.models.models import InterviewPanel
    
    panel = db.query(InterviewPanel).filter(
        InterviewPanel.interview_id == interview_id,
        InterviewPanel.interviewer_id == current_user.id
    ).first()
    
    if not panel:
        # Create provisional panel if not exists
        panel = InterviewPanel(
            interview_id=interview_id,
            interviewer_id=current_user.id,
            scores={},
            comments={},
            audio_records={},
            transcripts={}
        )
        db.add(panel)
    
    # Update JSON fields
    # Note: SQLAlchemy JSON mutation requires re-assignment or flag_modified
    audio_records = dict(panel.audio_records) if panel.audio_records else {}
    transcripts = dict(panel.transcripts) if panel.transcripts else {}
    
    audio_records[question_index] = file_path
    transcripts[question_index] = transcript
    
    panel.audio_records = audio_records
    panel.transcripts = transcripts
    
    db.commit()
    db.refresh(panel)
    
    return {"transcript": transcript, "file_path": file_path}

@router.delete("/{interview_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_interview_route(
    interview_id: UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles([UserRole.ADMIN, UserRole.HR]))
):
    db_interview = delete_interview(db, interview_id)
    if not db_interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
