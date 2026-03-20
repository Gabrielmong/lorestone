import { readFileSync } from 'fs'
import { join } from 'path'

const baseTypeDefs = readFileSync(join(__dirname, '../../schema.graphql'), 'utf-8')

const extensions = `
  type User {
    id: ID!
    email: String!
    name: String!
    dateOfBirth: Date
    campaigns: [Campaign!]!
    createdAt: DateTime!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type PlayerView {
    campaign: PlayerCampaign!
    sessions: [PlayerSession!]!
    items: [PlayerItem!]!
    factions: [PlayerFaction!]!
    characters: [PlayerCharacter!]!
    resolvedDecisions: [PlayerDecision!]!
    missedDecisions: [PlayerDecision!]!
    encounters: [PlayerEncounter!]!
    stats: CampaignStats!
    chapterLanes: [PlayerChapterLane!]!
  }

  type PlayerChapterLane {
    name: String!
    colorIndex: Int!
  }

  type PlayerEncounter {
    id: ID!
    name: String!
    status: String!
    outcomeType: String
    participantCount: Int!
    linkedDecisionId: ID
    outcomeDecisionId: ID
  }

  type PlayerCampaign {
    name: String!
    system: String
    yearInGame: String
  }

  type PlayerSession {
    sessionNumber: Int!
    title: String
    playedAt: Date
    playerSummary: String
  }

  type PlayerItem {
    name: String!
    description: String
    type: String!
  }

  type PlayerFaction {
    name: String!
    reputation: Int!
    repMin: Int!
    repMax: Int!
  }

  type PlayerCharacter {
    name: String!
    description: String
    status: String!
    role: String!
  }

  type PlayerDecision {
    id: ID!
    question: String!
    chosenLabel: String!
    missionName: String
    chapterName: String
    branches: [PlayerBranch!]!
    chosenBranchId: ID!
    incomingLinks: [PlayerDecisionLink!]!
  }

  type PlayerDecisionLink {
    fromDecisionId: ID!
    fromBranchId: ID
  }

  type PlayerBranch {
    id: ID!
    label: String!
    outcomeType: String!
  }

  input CreateMissionInput {
    campaignId: ID!
    chapterId: ID
    name: String!
    type: MissionType
    description: String
    orderIndex: Int
  }

  input UpdateChapterInput {
    name: String
    summary: String
    status: ChapterStatus
    orderIndex: Int
    playerVisible: Boolean
  }

  input UpdateFactionInput {
    name: String
    description: String
    color: String
    icon: String
  }

  input UpdateItemInput {
    name: String
    type: ItemType
    description: String
    narrativeWeight: String
    locationFound: String
    requiredFor: String
    discoveryRequires: [String!]
    extra: JSON
  }

  input UpdateMissionInput {
    name: String
    type: MissionType
    description: String
    status: MissionStatus
    orderIndex: Int
  }

  input UpdateSessionInput {
    title: String
    chapterId: ID
    playedAt: Date
    dmNotes: String
    playerSummary: String
  }

  input UpdateDecisionInput {
    question: String
    context: String
    missionName: String
    status: DecisionStatus
    orderIndex: Int
    chapterId: ID
  }

  input UpdateBranchInput {
    label: String
    description: String
    consequence: String
    outcomeType: OutcomeType
    orderIndex: Int
  }

  extend type Campaign {
    shareToken: String!
    owner: User
  }

  type CampaignStats {
    totalPlayMinutes: Int!
    sessionsPlayed: Int!
    totalEncounters: Int!
    encountersWon: Int!
    npcsMet: Int!
    decisionsResolved: Int!
    enemiesKilled: Int!
    itemsCollected: Int!
    missionsCompleted: Int!
    chaptersCompleted: Int!
  }

  extend type Query {
    me: User
    playerView(shareToken: String!): PlayerView
    campaignStats(campaignId: ID!): CampaignStats!
  }

  extend type Mutation {
    register(email: String!, password: String!, name: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    updateProfile(name: String, dateOfBirth: Date): User!
    changePassword(currentPassword: String!, newPassword: String!): Boolean!

    # Full updates
    updateChapter(id: ID!, input: UpdateChapterInput!): Chapter!
    updateFaction(id: ID!, input: UpdateFactionInput!): Faction!
    updateItem(id: ID!, input: UpdateItemInput!): Item!
    updateMission(id: ID!, input: UpdateMissionInput!): Mission!
    updateSession(id: ID!, input: UpdateSessionInput!): Session!
    updateDecision(id: ID!, input: UpdateDecisionInput!): Decision!

    # Branch editing
    updateBranch(id: ID!, input: UpdateBranchInput!): DecisionBranch!
    addBranch(decisionId: ID!, input: CreateBranchInput!): DecisionBranch!
    deleteBranch(id: ID!): Boolean!

    # Deletes
    deleteCampaign(id: ID!): Boolean!
    deleteChapter(id: ID!): Boolean!
    deleteCharacter(id: ID!): Boolean!
    deleteDecision(id: ID!): Boolean!
    deleteFaction(id: ID!): Boolean!
    deleteItem(id: ID!): Boolean!
    deleteSession(id: ID!): Boolean!
    deleteMission(id: ID!): Boolean!
  }
`

export const typeDefs = [baseTypeDefs, extensions]
