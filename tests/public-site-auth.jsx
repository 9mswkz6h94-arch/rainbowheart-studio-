export function useAuth() {
  const blocked = async () => { throw new Error('Authentication is disabled in this isolated preview') }
  return { user: null, loading: false, signIn: blocked, signUp: blocked, signOut: blocked }
}
