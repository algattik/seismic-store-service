from enum import Enum

from fastapi import APIRouter

from core.config import settings

router = APIRouter()

class Role(Enum):
    viewer = "viewer"
    admin = "admin"
    both = "both"
    none = "none"

def api_description(what: str, role: Role, standard: bool=True):
    if(standard):
        description = f"<ul><li>Returns the seismic store {what}</li><li>Required roles:<ul>"
    else:
        description = f"<ul><li>Returns {what}</li><li>Required roles:<ul>"

    if(role == Role.viewer):
        description += "<li>subproject.viewer: if the applied subproject policy is 'uniform'</li>"
        description += "<li>dataset.viewer: if the applied subproject policy is 'dataset'</li>"
    elif(role == Role.admin):
        description += "<li>subproject.admin: if the applied subproject policy is 'uniform'</li>"
        description += "<li>dataset.admin: if the applied subproject policy is 'dataset'</li>"
    elif(role == Role.both):
        description += "<li>subproject.admin, subproject.viewer: if the applied subproject policy is 'uniform'</li>"
        description =+ "<li>dataset.admin, dataset.viewer: if the applied subproject policy is 'dataset'</li>"

    else:
        description += "<li>None</li>"
    
    description += "</ul></li></ul>"

    return description

@router.get(settings.API_PATH + "service-status", tags=["General"], description=api_description("service status", Role.none))
def get_status():
    return {"status": "ok"}
