import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "../store/store";
import { computeSnapshot, type ComputeRequest, type ComputeResponse } from "../compute";
import { createSingleFlightScheduler } from "../ui/compute-scheduler";
import { yieldToBrowser } from "../yield-to-browser";

/** Connect mounted editor components to the existing parse/evaluate/render pipeline. */
export function useEditorComputation(onError: (message: string) => void): string | null {
  const source = useEditorStore(state => state.source);
  const revision = useEditorStore(state => state.sourceRevision);
  const documentId = useEditorStore(state => state.activeDocumentId);
  const activeRootId = useEditorStore(state => state.activeRootId);
  const dispatch = useEditorStore(state => state.dispatch);
  const [error, setError] = useState<string | null>(null);
  const scheduler = useMemo(() => createSingleFlightScheduler<ComputeRequest, ComputeResponse>({
    run: (request, signal) => computeSnapshot(request, { signal, yieldControl: yieldToBrowser }),
    onStart: request => {
      dispatch({ type: "COMPUTE_REQUESTED", requestId: request.id,
        ...(request.documentId === undefined ? {} : { documentId: request.documentId }) });
    },
    onSuccess: (_request, response) => {
      setError(null);
      dispatch({ type: "SNAPSHOT_READY", requestId: response.id, snapshot: response.snapshot,
        ...(response.documentId === undefined ? {} : { documentId: response.documentId }) });
    },
    onError: (_request, cause) => {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      onError(message);
    }
  }), [dispatch, onError]);
  useEffect(() => () => { scheduler.dispose(); }, [scheduler]);
  useEffect(() => {
    const state = useEditorStore.getState();
    scheduler.schedule({
      id: crypto.randomUUID(), documentId, source, sourceRevision: revision,
      activeRootId, includeDrawingLayer: true, changedSourceIds: state.lastEditChangedSourceIds,
      patches: state.lastEditPatches ? [...state.lastEditPatches] : null,
      patchBaseRevision: state.lastEditPatchBaseRevision, inferSourceChanges: true,
      trigger: state.activeCanvasDragKind === "handle" ? "drag-handle" : state.activeCanvasDragKind ? "drag-element" : "other",
      textEditMaskSpan: state.canvasTextEditMask?.span ?? null
    });
  }, [scheduler, documentId, source, revision, activeRootId]);
  return error;
}
