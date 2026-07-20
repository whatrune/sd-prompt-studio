import { planContext } from './core'
import type { ContextPlannerCoreResult } from './core'
import { admitContextPlannerEntry } from './entry-admission'
import type {
  ContextPlannerCoreInput,
  ContextPlannerEntryAdmissionResult,
  PlannerEntryStructuralRejection,
} from './entry-admission'
import type { DeepReadonly } from './types'

export type ContextPlannerEntryResult = PlannerEntryStructuralRejection | ContextPlannerCoreResult
type OperationalDelegate = (
  coreInput: DeepReadonly<ContextPlannerCoreInput>,
) => Promise<ContextPlannerCoreResult>

async function sanitizedStructuralRejection(): Promise<PlannerEntryStructuralRejection> {
  const defect = new Proxy({}, {
    ownKeys() {
      throw new Error()
    },
  })
  const rejected = await admitContextPlannerEntry(defect)
  if (rejected.accepted) throw new Error()
  return rejected
}

async function sanitizedOperationalFailure(
  coreInput: DeepReadonly<ContextPlannerCoreInput>,
): Promise<ContextPlannerCoreResult> {
  const defect = new Proxy(coreInput, {
    get(target, property, receiver) {
      if (property === 'context_policy') throw new Error()
      return Reflect.get(target, property, receiver)
    },
  })
  return planContext(defect)
}

export function createPlanContextEntryFacade(
  operationalDelegate: OperationalDelegate,
): (value: unknown) => Promise<ContextPlannerEntryResult> {
  return async (value: unknown): Promise<ContextPlannerEntryResult> => {
    let admission: ContextPlannerEntryAdmissionResult
    try {
      admission = await admitContextPlannerEntry(value)
    } catch {
      return sanitizedStructuralRejection()
    }

    if (!admission.accepted) return admission

    try {
      return await operationalDelegate(admission.core_input)
    } catch {
      return sanitizedOperationalFailure(admission.core_input)
    }
  }
}

export const planContextEntry = createPlanContextEntryFacade(planContext)
