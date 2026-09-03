// Alias fixo e permanente: /e/atual e /projector/atual sempre resolvem para
// o evento (ou sequência, pelo evento raiz) marcado como "o de hoje" pelo
// operador, em vez de um slug específico de um evento — assim o mesmo QR
// Code impresso uma única vez continua funcionando em qualquer dia futuro.
// Arquivo sem dependências para poder ser importado tanto em código de
// servidor quanto em componentes de cliente sem puxar o client admin do Supabase.
export const DAILY_ACTIVE_SLUG = "atual";
