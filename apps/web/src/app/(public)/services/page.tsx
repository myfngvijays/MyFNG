import ServicesClient from './ServicesClient';
import { fetchActiveCategories } from '@/lib/chatbot_v2/db/supabase';

export default async function ServicesPage() {
  let categories: Array<{ uuid: string; category: string; description: string | null; sequence: number }> = [];
  try {
    categories = await fetchActiveCategories();
  } catch {
    // If Supabase admin env isn't configured in this environment, fall back to defaults in ServicesClient.
    categories = [];
  }

  return <ServicesClient categories={categories} />;
}


