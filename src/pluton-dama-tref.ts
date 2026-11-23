/** DAMA TREF ♣ policy library. Not a firewall, sandbox, or antivirus; no network requests are made here. */
export const DAMA_TREF_MAX_SOURCES = 1000;
export const DAMA_TREF_MAX_INPUT_BYTES = 5_000_000;
export const DAMA_TREF_MAX_AUDIT_EVENTS = 10_000;
export type DamaTrefRole = 'admin' | 'chief' | 'worker' | 'auditor';
export type DamaTrefAction = 'read-assigned-task' | 'submit-local-result' | 'assign-task' | 'read-project-report' | 'read-audit' | 'change-policy' | 'source-fetch' | 'external-api' | 'export-data' | 'upload-data' | 'unknown';
export interface DamaTrefActor { id: string; role: DamaTrefRole; projectIds?: string[] }
export interface DamaTrefDecision { allowed: boolean; reason: string; auditedAction: DamaTrefAction }
export interface DamaTrefAuditEvent { id: string; actorId: string; action: string; allowed: boolean; reason: string; target: string; timestamp: string }
export interface DamaTrefInputInspection { accepted: boolean; quarantined: boolean; bytes: number; contentType: string; reasons: string[] }
const VALID_ROLES = new Set<DamaTrefRole>(['admin', 'chief', 'worker', 'auditor']);
const VALID_ACTIONS = new Set<DamaTrefAction>(['read-assigned-task', 'submit-local-result', 'assign-task', 'read-project-report', 'read-audit', 'change-policy', 'source-fetch', 'external-api', 'export-data', 'upload-data', 'unknown']);
const BLOCKED_HOSTS = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal', 'metadata.google', 'instance-data.ec2.internal']);
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTS.has(host) || !host.includes('.')) return true;
  if (host === '::1' || host === '::' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    const n = host.split('.').map(Number);
    if (n.some(v => v < 0 || v > 255)) return true;
    return n[0] === 10 || n[0] === 127 || n[0] === 0 || (n[0] === 169 && n[1] === 254) ||
      (n[0] === 172 && n[1] >= 16 && n[1] <= 31) || (n[0] === 192 && n[1] === 168) ||
      (n[0] === 100 && n[1] >= 64 && n[1] <= 127) || n[0] >= 224;
  }
  return false;
}
function normalizeHosts(hosts: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const raw of hosts) {
    const host = raw.trim().toLowerCase().replace(/\.$/, '');
    if (!host) continue;
    if (host.includes('/') || host.includes('@') || host.includes(':') || host.includes('*') || host.includes(' ') || isPrivateHost(host))
      throw new Error('Use public hostnames only; no scheme, path, port, wildcard, credentials, or private hosts.');
    out.add(host);
  }
  return out;
}
/** Validate HTTPS against an exact-host allowlist. Does not fetch the URL. */
export function validateDamaTrefSourceUrl(input: string, allowedHosts: readonly string[]): string {
  if (typeof input !== 'string' || input.length > 2048) throw new Error('Source URL is missing or too long.');
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error('Source URL is invalid.'); }
  if (url.protocol !== 'https:') throw new Error('Only HTTPS sources are allowed.');
  if (url.username || url.password) throw new Error('Credentials in source URLs are forbidden.');
  if (url.port && url.port !== '443') throw new Error('Only the default HTTPS port is allowed.');
  if (isPrivateHost(url.hostname)) throw new Error('Private, local, or non-public host is blocked.');
  if (!normalizeHosts(allowedHosts).has(url.hostname.toLowerCase().replace(/\.$/, ''))) throw new Error('Source host is not in the exact-host allowlist.');
  url.hash = '';
  return url.toString();
}
/** Default deny. A trusted server must enforce this before opening a socket. */
export function decideDamaTrefRequest(input: { action: DamaTrefAction; method?: string; url?: string; allowedHosts?: readonly string[]; hasPrivatePayload?: boolean }): DamaTrefDecision {
  if (input.action !== 'source-fetch') return { allowed: false, reason: 'Default-deny: outbound transfer is not an approved source read.', auditedAction: input.action };
  if ((input.method ?? 'GET').toUpperCase() !== 'GET') return { allowed: false, reason: 'Only GET is permitted for source acquisition.', auditedAction: input.action };
  if (input.hasPrivatePayload) return { allowed: false, reason: 'Source acquisition must not carry internal/private payload data.', auditedAction: input.action };
  try {
    validateDamaTrefSourceUrl(input.url ?? '', input.allowedHosts ?? []);
    return { allowed: true, reason: 'Approved source-read intent; external network enforcement is still required.', auditedAction: input.action };
  } catch (error) {
    return { allowed: false, reason: error instanceof Error ? error.message : 'Source URL rejected.', auditedAction: input.action };
  }
}
/** Role policy; project/task scope must additionally be enforced by a trusted caller. */
export function authorizeDamaTrefAction(actor: DamaTrefActor, action: DamaTrefAction): DamaTrefDecision {
  const deny = (reason: string): DamaTrefDecision => ({ allowed: false, reason, auditedAction: action });
  const allow = (reason: string): DamaTrefDecision => ({ allowed: true, reason, auditedAction: action });
  if (!VALID_ACTIONS.has(action)) return deny('Unrecognized action is blocked.');
  if (!actor || typeof actor.id !== 'string' || !actor.id.trim() || actor.id.length > 120 || !VALID_ROLES.has(actor.role)) return deny('Invalid actor identity or role.');
  if (['source-fetch', 'external-api', 'export-data', 'upload-data', 'unknown'].includes(action)) return deny('Blocked by input-only policy; internal data may not leave.');
  if (actor.role === 'admin') return allow('Administrator action allowed within local policy layer.');
  if (action === 'read-assigned-task' || action === 'submit-local-result') return actor.role === 'worker' || actor.role === 'chief' ? allow('Allowed for assigned work; caller must check project/task scope.') : deny('Auditors cannot execute or modify work.');
  if (action === 'assign-task') return actor.role === 'chief' ? allow('Chief may assign work within authorized projects.') : deny('Only a chief or administrator may assign work.');
  if (action === 'read-project-report' || action === 'read-audit') return actor.role === 'chief' || actor.role === 'auditor' ? allow('Read-only action allowed; caller must check project scope.') : deny('This role cannot access reports or audit records.');
  if (action === 'change-policy') return deny('Only an administrator may change policy.');
  return deny('Unrecognized action is blocked.');
}
/** Heuristic screening only; not malware signature scanning. Active content is quarantined. */
export function inspectDamaTrefInput(input: { content: string; contentType: string; maxBytes?: number }): DamaTrefInputInspection {
  const content = typeof input.content === 'string' ? input.content : '';
  const bytes = new TextEncoder().encode(content).byteLength;
  const contentType = (input.contentType || 'text/plain').split(';', 1)[0].trim().toLowerCase();
  const reasons: string[] = [];
  const requestedMaxBytes = input.maxBytes;
  const maxBytes = typeof requestedMaxBytes === 'number' && Number.isFinite(requestedMaxBytes) && requestedMaxBytes > 0
    ? Math.min(Math.floor(requestedMaxBytes), DAMA_TREF_MAX_INPUT_BYTES)
    : DAMA_TREF_MAX_INPUT_BYTES;
  const supported = new Set(['text/plain', 'text/html', 'application/json', 'text/csv']);
  if (bytes > maxBytes) reasons.push('Input exceeds the configured byte limit.');
  if (!supported.has(contentType)) reasons.push('Unsupported content type; use plain text, HTML-as-data, JSON, or CSV.');
  const active = [/<\s*script\b/i, /<\s*iframe\b/i, /<\s*object\b/i, /<\s*embed\b/i, /<\s*form\b/i, /\bon[a-z]{3,}\s*=/i, /javascript\s*:/i, /<\s*meta\b[^>]*http-equiv\s*=\s*["']?refresh/i];
  if (active.some(p => p.test(content))) reasons.push('Potential active HTML/script content detected; do not render or execute it.');
  const quarantined = bytes > maxBytes || !supported.has(contentType) || reasons.some(r => r.includes('active HTML/script'));
  return { accepted: !quarantined, quarantined, bytes, contentType, reasons };
}
export function appendDamaTrefAudit(events: DamaTrefAuditEvent[], event: DamaTrefAuditEvent, maxEvents = DAMA_TREF_MAX_AUDIT_EVENTS): DamaTrefAuditEvent[] {
  const limit = Number.isInteger(maxEvents) && maxEvents > 0 ? maxEvents : DAMA_TREF_MAX_AUDIT_EVENTS;
  const next = [...events, { ...event }];
  return next.length > limit ? next.slice(next.length - limit) : next;
}
