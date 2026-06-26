/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Ctx } from './_shared'
import * as profiles from './profiles'
import * as supporters from './supporters'
import * as community from './community'
import * as groups from './groups'
import * as resources from './resources'
import * as ask from './ask'
import * as wellness from './wellness'
import * as games from './games'
import * as health from './health'
import * as cohort from './cohort'
import * as timeline from './timeline'
import * as personalInsights from './personal-insights'
import * as support from './support'
import * as symptomCheck from './symptom-check'
import * as notifications from './notifications'
import * as achievements from './achievements'
import * as saves from './saves'
import * as personalize from './personalize'
import * as polls from './polls'
import * as featureRequests from './feature-requests'
import * as groupSessions from './group-sessions'
import * as admin from './admin'
import * as bugs from './bugs'
import * as pins from './pins'
import * as blocks from './blocks'
import * as push from './push'
import * as brief from './brief'
import * as careProgram from './care-program'
import * as platformPulse from './platform-pulse'

export type DataMethod = (ctx: Ctx, ...args: any[]) => Promise<unknown>

/**
 * The full data-method registry. Method names are unique across domains and map
 * 1:1 to the legacy DatabaseService surface that the client adapter calls.
 */
export const dataMethods = {
  ...profiles,
  ...supporters,
  ...community,
  ...groups,
  ...resources,
  ...ask,
  ...wellness,
  ...games,
  ...health,
  ...cohort,
  ...timeline,
  ...personalInsights,
  ...support,
  ...symptomCheck,
  ...notifications,
  ...achievements,
  ...saves,
  ...personalize,
  ...polls,
  ...featureRequests,
  ...groupSessions,
  ...admin,
  ...bugs,
  ...pins,
  ...blocks,
  ...push,
  ...brief,
  ...careProgram,
  ...platformPulse,
} as unknown as Record<string, DataMethod>

export type { Ctx }
