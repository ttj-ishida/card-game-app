import { getAppConfig } from '../../config/appEnv';
import type { NumberCardMaster, SkillCardMaster } from './cardCatalog';

type SupabaseTable = 'number_cards' | 'skill_cards';

async function fetchMasterTable<T>(table: SupabaseTable, select: string): Promise<T[]> {
  const config = getAppConfig();
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/${table}?select=${select}&is_active=eq.true&order=sort_order.asc`,
    {
      headers: {
        apikey: config.supabaseAnonKey,
        authorization: `Bearer ${config.supabaseAnonKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase ${table} request failed: ${response.status}`);
  }

  return (await response.json()) as T[];
}

export async function fetchCatalogMasters() {
  const [numberCards, skillCards] = await Promise.all([
    fetchMasterTable<NumberCardMaster>(
      'number_cards',
      'card_id,rank_code,suit_code,display_resource_key,sort_order',
    ),
    fetchMasterTable<SkillCardMaster>(
      'skill_cards',
      'skill_id,effect_code,display_resource_key,description_resource_key,card_count,sort_order',
    ),
  ]);

  return { numberCards, skillCards };
}
