import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Log an admin action for audit trail
 * @param adminId - The ID of the admin performing the action
 * @param action - The action being performed (e.g., 'update_rating', 'change_role')
 * @param entityType - The type of entity being affected (e.g., 'player', 'team')
 * @param entityId - The ID of the entity being affected
 * @param details - Optional additional details about the action
 */
export const logAdminAction = async (
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, any>
) => {
  try {
    await supabase
      .from('admin_activity_log')
      .insert({
        admin_id: adminId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
      });
  } catch (error) {
    console.error('Error logging admin action:', error);
    // Don't throw - logging should not break the main operation
  }
};
