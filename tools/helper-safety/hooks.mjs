// Lets Node load the Edge Function files unchanged: the one remote import (supabase-js from esm.sh) becomes a stub.
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('https://esm.sh/@supabase/supabase-js')) return { url: 'stub:supabase', shortCircuit: true };
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url === 'stub:supabase') return { format: 'module', source: 'export const createClient = (...a) => globalThis.__makeSupa(...a);', shortCircuit: true };
  return next(url, context);
}
