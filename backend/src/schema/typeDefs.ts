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

  type MissionMap {
    id: ID!
    missionId: ID!
    name: String!
    url: String!
    key: String!
    createdAt: DateTime!
  }

  input UpdateChapterInput {
    name: String
    summary: String
    content: String
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
    missionId: ID
  }

  input UpdateMissionInput {
    name: String
    type: MissionType
    description: String
    content: String
    status: MissionStatus
    orderIndex: Int
    chapterId: ID
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
    missionId: ID
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
    updateDecisionPosition(id: ID!, x: Float!, y: Float!): Boolean!

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

    # Mission maps
    addMissionMap(missionId: ID!, name: String!, url: String!, key: String!): MissionMap!
    deleteMissionMap(id: ID!): Boolean!

    # Wiki
    createWikiPage(input: CreateWikiPageInput!): WikiPage!
    updateWikiPage(id: ID!, input: UpdateWikiPageInput!): WikiPage!
    deleteWikiPage(id: ID!): Boolean!
  }

  type WikiPage {
    id: ID!
    campaignId: ID!
    parentId: ID
    title: String!
    content: String
    icon: String
    orderIndex: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  input CreateWikiPageInput {
    campaignId: ID!
    parentId: ID
    title: String
    icon: String
    orderIndex: Int
  }

  input UpdateWikiPageInput {
    title: String
    content: String
    icon: String
    parentId: ID
    orderIndex: Int
  }

  extend type Query {
    wikiPages(campaignId: ID!): [WikiPage!]!
    wikiPage(id: ID!): WikiPage
  }
`

export const typeDefs = [baseTypeDefs, extensions]
