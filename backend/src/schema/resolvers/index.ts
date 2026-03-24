import { DateTimeResolver, DateResolver, JSONResolver } from 'graphql-scalars'
import { campaignResolvers } from './campaign'
import { characterResolvers } from './character'
import { decisionResolvers } from './decision'
import { sessionResolvers } from './session'
import { factionResolvers } from './faction'
import { itemResolvers } from './item'
import { missionResolvers } from './mission'
import { authResolvers } from './auth'
import { playerViewResolvers } from './playerView'
import { encounterResolvers } from './encounter'
import { campaignStatsResolvers } from './campaignStats'
import { wikiResolvers } from './wiki'
import { diceSetResolvers } from './diceSet'
import { analyticsResolvers } from './analytics'
import { transcriptResolvers } from './transcript'

export const resolvers = {
  DateTime: DateTimeResolver,
  Date: DateResolver,
  JSON: JSONResolver,

  Query: {
    ...campaignResolvers.Query,
    ...characterResolvers.Query,
    ...decisionResolvers.Query,
    ...sessionResolvers.Query,
    ...factionResolvers.Query,
    ...itemResolvers.Query,
    ...missionResolvers.Query,
    ...encounterResolvers.Query,
    ...authResolvers.Query,
    ...playerViewResolvers.Query,
    ...campaignStatsResolvers.Query,
    ...wikiResolvers.Query,
    ...diceSetResolvers.Query,
    ...analyticsResolvers.Query,
    ...transcriptResolvers.Query,
  },

  Mutation: {
    ...campaignResolvers.Mutation,
    ...characterResolvers.Mutation,
    ...decisionResolvers.Mutation,
    ...sessionResolvers.Mutation,
    ...factionResolvers.Mutation,
    ...itemResolvers.Mutation,
    ...missionResolvers.Mutation,
    ...encounterResolvers.Mutation,
    ...authResolvers.Mutation,
    ...wikiResolvers.Mutation,
    ...diceSetResolvers.Mutation,
    ...analyticsResolvers.Mutation,
    ...transcriptResolvers.Mutation,
  },

  Campaign: campaignResolvers.Campaign,
  Chapter: campaignResolvers.Chapter,
  Character: characterResolvers.Character,
  CharacterSessionState: characterResolvers.CharacterSessionState,
  Decision: decisionResolvers.Decision,
  DecisionLink: decisionResolvers.DecisionLink,
  DecisionBranch: decisionResolvers.DecisionBranch,
  CharacterDecisionState: decisionResolvers.CharacterDecisionState,
  Session: sessionResolvers.Session,
  SessionEvent: sessionResolvers.SessionEvent,
  Faction: factionResolvers.Faction,
  Item: itemResolvers.Item,
  Mission: missionResolvers.Mission,
  MissionMap: missionResolvers.MissionMap,
  Encounter: encounterResolvers.Encounter,
  EncounterParticipant: encounterResolvers.EncounterParticipant,
  User: authResolvers.User,
}
