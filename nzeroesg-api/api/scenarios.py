"""Typed deterministic scenario comparison API."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from api.shipments import shipment_repository
from api.workspaces import require_workspace_principal, workspace_repository
from domain.scenarios.comparison import compare_shipment_modes
from domain.workspaces.principals import WorkspacePrincipal
from persistence.workspaces import QuotaExceededError, WorkspaceNotFoundError

ScenarioMode = Literal["plane", "air", "truck", "train", "ship", "ocean container"]
scenarios_router = APIRouter(prefix="/scenarios", tags=["scenarios"])


class ScenarioRequest(BaseModel):
    alternative_transport_method: ScenarioMode


class ScenarioResponse(BaseModel):
    baseline_mode: str
    alternative_mode: str
    shipment_count: int
    baseline_total_kg: float
    alternative_total_kg: float
    baseline_total_tonnes: float
    alternative_total_tonnes: float
    delta_kg: float
    delta_percent: float | None
    shipment_results: list[dict[str, str | float]]
    factor_source: str
    factor_version: str
    assumptions: list[str]


def _consume_analysis_run(workspace_id: str) -> None:
    try:
        workspace_repository.consume_quota(workspace_id, "analysis_runs_per_day")
    except WorkspaceNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The workspace session is no longer active.",
        ) from exc
    except QuotaExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="The daily analysis quota for this workspace has been reached.",
        ) from exc


@scenarios_router.post("/compare", response_model=ScenarioResponse)
async def compare_scenario(
    payload: ScenarioRequest,
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> ScenarioResponse:
    shipments = shipment_repository.list_for_workspace(principal.workspace_id)
    try:
        comparison = compare_shipment_modes(
            shipments,
            alternative_mode=payload.alternative_transport_method,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    _consume_analysis_run(principal.workspace_id)
    return ScenarioResponse.model_validate(comparison.to_dict())
