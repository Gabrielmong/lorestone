import React, { createContext, useContext, useState, useCallback } from 'react'

interface CampaignContextValue {
  campaignId: string | null
  campaignName: string | null
  setCampaignId: (id: string) => void
  setCampaignName: (name: string) => void
}

const CampaignContext = createContext<CampaignContextValue>({
  campaignId: null,
  campaignName: null,
  setCampaignId: () => {},
  setCampaignName: () => {},
})

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const [campaignId, setCampaignIdState] = useState<string | null>(
    localStorage.getItem('ttrpg_campaign_id')
  )
  const [campaignName, setCampaignNameState] = useState<string | null>(
    localStorage.getItem('ttrpg_campaign_name')
  )

  const setCampaignId = useCallback((id: string) => {
    localStorage.setItem('ttrpg_campaign_id', id)
    setCampaignIdState(id)
  }, [])

  const setCampaignName = useCallback((name: string) => {
    localStorage.setItem('ttrpg_campaign_name', name)
    setCampaignNameState(name)
  }, [])

  return (
    <CampaignContext.Provider value={{ campaignId, campaignName, setCampaignId, setCampaignName }}>
      {children}
    </CampaignContext.Provider>
  )
}

export function useCampaign() {
  return useContext(CampaignContext)
}
