/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { scenariosSchema } from './schemas/scenarios-schema'
import { scenarioAnswersSchema } from './schemas/scenario-answers-schema'
import { runsSchema } from './schemas/runs-schema'
import { generationsSchema } from './schemas/generations-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  scenariosSchema,
  scenarioAnswersSchema,
  runsSchema,
  generationsSchema,
]
